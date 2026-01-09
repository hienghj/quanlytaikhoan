// API URL - tự động detect hostname
const API_URL = window.location.origin + '/api';

// Helper function for authenticated fetch
async function authFetch(url, options = {}) {
    options.credentials = 'include';
    const response = await fetch(url, options);

    if (response.status === 401) {
        window.location.href = '/login.html';
        throw new Error('Session expired');
    }

    return response;
}

// Check authentication first
async function checkAuth() {
    try {
        const response = await authFetch(`${API_URL}/auth/me`);

        if (!response.ok) {
            window.location.href = '/login.html';
            return false;
        }

        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// State
let currentCategory = 'all';
let allAccounts = [];
let filteredAccounts = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 20;
let deleteMode = false;
let selectedAccounts = new Set();

// Calculate remaining days
function calculateRemainingDays(expiryDate) {
    if (!expiryDate) return null;
    const now = Date.now();
    const diff = expiryDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
}

// Get days badge HTML
function getDaysBadge(days) {
    if (days === null) return '<span class="days-badge days-none">-</span>';
    if (days === 0) return '<span class="days-badge days-expired">Hết hạn</span>';
    if (days <= 3) return `<span class="days-badge days-critical">${days} ngày</span>`;
    if (days <= 7) return `<span class="days-badge days-warning">${days} ngày</span>`;
    return `<span class="days-badge days-good">${days} ngày</span>`;
}

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const pageTitle = document.getElementById('pageTitle');
const searchInput = document.getElementById('searchInput');
const filterSold = document.getElementById('filterSold');
const filterWarranty = document.getElementById('filterWarranty');
const allPassInput = document.getElementById('allPassInput');
const allPassBtn = document.getElementById('allPassBtn');
const allPassWarrantyInput = document.getElementById('allPassWarrantyInput');
const allPassWarrantyBtn = document.getElementById('allPassWarrantyBtn');
const allPassWarrantyGroup = document.getElementById('allPassWarrantyGroup');
const tableBody = document.getElementById('tableBody');
const addBtn = document.getElementById('addBtn');
const importTxtBtn = document.getElementById('importTxtBtn');
const importTxtFile = document.getElementById('importTxtFile');
const importTxtModal = document.getElementById('importTxtModal');
const importTxtModalClose = document.getElementById('importTxtModalClose');
const importTxtCancelBtn = document.getElementById('importTxtCancelBtn');
const importTxtConfirmBtn = document.getElementById('importTxtConfirmBtn');
const importCategory = document.getElementById('importCategory');
const importWarrantyBtn = document.getElementById('importWarrantyBtn');
const importWarrantyFile = document.getElementById('importWarrantyFile');
const importWarrantyModal = document.getElementById('importWarrantyModal');
const importWarrantyModalClose = document.getElementById('importWarrantyModalClose');
const importWarrantyCancelBtn = document.getElementById('importWarrantyCancelBtn');
const importWarrantyConfirmBtn = document.getElementById('importWarrantyConfirmBtn');
const importWarrantyCategory = document.getElementById('importWarrantyCategory');
const modal = document.getElementById('accountModal');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const accountForm = document.getElementById('accountForm');
const toast = document.getElementById('toast');
const firstPageBtn = document.getElementById('firstPageBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const lastPageBtn = document.getElementById('lastPageBtn');
const pageNumbers = document.getElementById('pageNumbers');
const paginationInfo = document.getElementById('paginationInfo');
const toggleDeleteModeBtn = document.getElementById('toggleDeleteModeBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');
const selectedCount = document.getElementById('selectedCount');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');

// Make goToPage globally accessible for onclick handlers
window.goToPage = function (page) {
    const totalPages = getTotalPages();
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        loadAccounts();
        attachEventListeners();
    }
});

// Event Listeners
function attachEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentCategory = item.dataset.category;
            updatePageTitle();
            filterAccounts();
        });
    });

    // Search & Filters
    searchInput.addEventListener('input', debounce(filterAccounts, 300));
    filterSold.addEventListener('change', filterAccounts);
    filterWarranty.addEventListener('change', filterAccounts);

    // Buttons
    addBtn.addEventListener('click', openAddModal);
    importTxtBtn.addEventListener('click', openImportTxtModal);
    importTxtFile.addEventListener('change', handleTxtFileSelect);
    importTxtConfirmBtn.addEventListener('click', confirmImportTxt);
    importTxtCancelBtn.addEventListener('click', closeImportTxtModal);
    importTxtModalClose.addEventListener('click', closeImportTxtModal);
    importWarrantyBtn.addEventListener('click', openImportWarrantyModal);
    importWarrantyFile.addEventListener('change', handleWarrantyFileSelect);
    importWarrantyConfirmBtn.addEventListener('click', confirmImportWarranty);
    importWarrantyCancelBtn.addEventListener('click', closeImportWarrantyModal);
    importWarrantyModalClose.addEventListener('click', closeImportWarrantyModal);
    allPassBtn.addEventListener('click', applyAllPassword);
    allPassWarrantyBtn.addEventListener('click', applyAllWarrantyPassword);

    // Select Accounts Modal
    selectAccountsModalClose.addEventListener('click', closeSelectAccountsModal);
    cancelSelectAccountsBtn.addEventListener('click', closeSelectAccountsModal);
    confirmSelectAccountsBtn.addEventListener('click', confirmSelectAccounts);

    // Delete Mode
    toggleDeleteModeBtn.addEventListener('click', toggleDeleteMode);
    deleteAllBtn.addEventListener('click', deleteSelectedAccounts);
    selectAllCheckbox.addEventListener('change', toggleSelectAll);

    // Modal
    modalClose.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    accountForm.addEventListener('submit', handleSubmit);

    // Pagination
    firstPageBtn.addEventListener('click', () => window.goToPage(1));
    prevPageBtn.addEventListener('click', () => window.goToPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => window.goToPage(currentPage + 1));
    lastPageBtn.addEventListener('click', () => window.goToPage(getTotalPages()));

    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Close import txt modal on background click
    importTxtModal.addEventListener('click', (e) => {
        if (e.target === importTxtModal) closeImportTxtModal();
    });

    // Close import warranty modal on background click
    importWarrantyModal.addEventListener('click', (e) => {
        if (e.target === importWarrantyModal) closeImportWarrantyModal();
    });

    // Pagination
    firstPageBtn.addEventListener('click', () => goToPage(1));
    prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));
    lastPageBtn.addEventListener('click', () => goToPage(getTotalPages()));
}

// Load accounts from API
async function loadAccounts() {
    try {
        const response = await authFetch(`${API_URL}/accounts`);

        if (!response.ok) throw new Error('Không thể tải dữ liệu');

        allAccounts = await response.json();
        filterAccounts();
        updateCounts();
    } catch (error) {
        console.error('Lỗi:', error);
        showToast('Lỗi tải dữ liệu: ' + error.message, 'error');
        tableBody.innerHTML = '<tr><td colspan="11" class="no-data">Lỗi tải dữ liệu. Vui lòng kiểm tra kết nối server.</td></tr>';
    }
}

// Filter accounts
function filterAccounts() {
    let accounts = [...allAccounts];

    // Filter by category
    if (currentCategory !== 'all') {
        accounts = accounts.filter(acc => acc.category === currentCategory);
    }

    // Filter by sold status
    const soldStatus = filterSold.value;
    if (soldStatus !== 'all') {
        accounts = accounts.filter(acc => acc.soldStatus === soldStatus);
    }

    // Filter by warranty status
    const warrantyStatus = filterWarranty.value;
    if (warrantyStatus !== 'all') {
        accounts = accounts.filter(acc => acc.warrantyStatus === warrantyStatus);
    }

    // Search
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
        accounts = accounts.filter(acc =>
            (acc.code && acc.code.toLowerCase().includes(searchTerm)) ||
            (acc.username && acc.username.toLowerCase().includes(searchTerm)) ||
            (acc.customerName && acc.customerName.toLowerCase().includes(searchTerm)) ||
            (acc.warrantyAccount && acc.warrantyAccount.toLowerCase().includes(searchTerm))
        );
    }

    filteredAccounts = accounts;
    currentPage = 1;
    renderTable();
}

// Render table
function renderTable() {
    if (filteredAccounts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="15" class="no-data">Không có dữ liệu</td></tr>';
        updatePagination();
        return;
    }

    // Calculate pagination
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredAccounts.length);
    const currentPageAccounts = filteredAccounts.slice(startIndex, endIndex);

    tableBody.innerHTML = currentPageAccounts.map(acc => {
        const remainingDays = calculateRemainingDays(acc.expiryDate);
        const warrantyRemainingDays = calculateRemainingDays(acc.warrantyExpiryDate);
        const isSelected = selectedAccounts.has(acc.id);

        return `
        <tr>
            <td class="checkbox-column" style="display: ${deleteMode ? 'table-cell' : 'none'};">
                <input type="checkbox" class="account-checkbox" data-id="${acc.id}" 
                       ${isSelected ? 'checked' : ''} onchange="toggleAccountSelection('${acc.id}')">
            </td>
            <td>
                <span class="badge badge-category">
                    ${acc.category === 'chatgpt' ? '🤖 ChatGPT' : acc.category === 'veo3' ? '🎥 Veo 3' : '✂️ CapCut'}
                </span>
            </td>
            <td><span class="text-truncate" title="${acc.code || ''}">${acc.code || '-'}</span></td>
            <td><span class="text-truncate" title="${acc.username}">${acc.username}</span></td>
            <td><span class="text-truncate password-cell" title="${acc.password || ''}">${acc.password || '-'}</span></td>
            <td>${getDaysBadge(remainingDays)}</td>
            <td><span class="text-truncate" title="${acc.customerName || ''}">${acc.customerName || '-'}</span></td>
            <td>
                <button class="toggle-btn toggle-sold ${acc.soldStatus === 'sold' ? 'active' : ''}" 
                        onclick="toggleStatus('${acc.id}', 'soldStatus', '${acc.soldStatus}')">
                    ${acc.soldStatus === 'sold' ? '✓ Đã bán' : '○ Chưa bán'}
                </button>
            </td>
            <td>
                <button class="toggle-btn toggle-warranty ${acc.warrantyStatus === 'yes' ? 'active' : ''}"
                        onclick="toggleStatus('${acc.id}', 'warrantyStatus', '${acc.warrantyStatus}')">
                    ${acc.warrantyStatus === 'yes' ? '✓ Đã BH' : '○ Chưa BH'}
                </button>
            </td>
            <td><span class="text-truncate" title="${acc.warrantyAccount || ''}">${acc.warrantyAccount || '-'}</span></td>
            <td><span class="text-truncate password-cell" title="${acc.warrantyPassword || ''}">${acc.warrantyPassword || '-'}</span></td>
            <td>${getDaysBadge(warrantyRemainingDays)}</td>
            <td><span class="text-truncate" title="${acc.note || ''}">${acc.note || '-'}</span></td>
            <td>${formatDate(acc.updatedAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-primary" onclick="openEditModal('${acc.id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAccount('${acc.id}')">🗑️</button>
                </div>
            </td>
        </tr>
    `;
    }).join('');

    updatePagination();
}

// Pagination functions
function getTotalPages() {
    return Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE);
}

function goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
}

function updatePagination() {
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredAccounts.length);

    // Update info
    paginationInfo.textContent = `Hiển thị ${startIndex + 1} - ${endIndex} của ${filteredAccounts.length} tài khoản`;

    // Update button states
    firstPageBtn.disabled = currentPage === 1;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    lastPageBtn.disabled = currentPage === totalPages || totalPages === 0;

    // Render page numbers
    renderPageNumbers();
}

function renderPageNumbers() {
    const totalPages = getTotalPages();
    if (totalPages === 0) {
        pageNumbers.innerHTML = '';
        return;
    }

    let pages = [];

    // Always show first page
    pages.push(1);

    // Calculate range around current page
    const rangeStart = Math.max(2, currentPage - 1);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 1);

    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
        pages.push('...');
    }

    // Add pages around current page
    for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
        pages.push('...');
    }

    // Always show last page if more than 1 page
    if (totalPages > 1) {
        pages.push(totalPages);
    }

    pageNumbers.innerHTML = pages.map(page => {
        if (page === '...') {
            return '<span class="page-ellipsis">...</span>';
        }
        const isActive = page === currentPage;
        return `<button class="btn-page-number ${isActive ? 'active' : ''}" onclick="goToPage(${page})">${page}</button>`;
    }).join('');
}

// Update counts
function updateCounts() {
    document.getElementById('count-all').textContent = allAccounts.length;
    document.getElementById('count-chatgpt').textContent =
        allAccounts.filter(acc => acc.category === 'chatgpt').length;
    document.getElementById('count-veo3').textContent =
        allAccounts.filter(acc => acc.category === 'veo3').length;
    document.getElementById('count-capcut').textContent =
        allAccounts.filter(acc => acc.category === 'capcut').length;
}

// Update page title
function updatePageTitle() {
    const titles = {
        'all': 'Tất cả tài khoản',
        'chatgpt': 'ChatGPT',
        'veo3': 'Veo 3',
        'capcut': 'CapCut'
    };
    pageTitle.textContent = titles[currentCategory] || 'Tài khoản';
    updateAllPassUI();
}

// Modal functions
function openAddModal() {
    modalTitle.textContent = 'Thêm tài khoản mới';
    accountForm.reset();
    document.getElementById('accountId').value = '';
    modal.classList.add('show');
}

function openEditModal(id) {
    const account = allAccounts.find(acc => acc.id === id);
    if (!account) return;

    modalTitle.textContent = 'Sửa tài khoản';
    document.getElementById('accountId').value = account.id;
    document.getElementById('category').value = account.category;
    document.getElementById('code').value = account.code || '';
    document.getElementById('username').value = account.username;
    document.getElementById('password').value = account.password;
    document.getElementById('customerName').value = account.customerName || '';
    document.getElementById('soldStatus').value = account.soldStatus;
    document.getElementById('warrantyStatus').value = account.warrantyStatus;
    document.getElementById('warrantyAccount').value = account.warrantyAccount || '';
    document.getElementById('warrantyPassword').value = account.warrantyPassword || '';
    document.getElementById('note').value = account.note || '';

    modal.classList.add('show');
}

function closeModal() {
    modal.classList.remove('show');
    accountForm.reset();
}

// Handle form submit
async function handleSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('accountId').value;

    // Get existing account data if editing
    const existingAccount = id ? allAccounts.find(acc => acc.id === id) : null;

    const formData = {
        id: id || generateId(),
        category: document.getElementById('category').value,
        code: document.getElementById('code').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        customerName: document.getElementById('customerName').value,
        soldStatus: document.getElementById('soldStatus').value,
        warrantyStatus: document.getElementById('warrantyStatus').value,
        warrantyAccount: document.getElementById('warrantyAccount').value,
        warrantyPassword: document.getElementById('warrantyPassword').value,
        note: document.getElementById('note').value
    };

    // Preserve expiryDate and warrantyExpiryDate when editing
    if (existingAccount) {
        formData.expiryDate = existingAccount.expiryDate;
        formData.warrantyExpiryDate = existingAccount.warrantyExpiryDate;
    }

    try {
        const url = id ? `${API_URL}/accounts/${id}` : `${API_URL}/accounts`;
        const method = id ? 'PUT' : 'POST';

        const response = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Không thể lưu dữ liệu');

        showToast(id ? 'Cập nhật thành công!' : 'Thêm mới thành công!', 'success');
        closeModal();
        await loadAccounts();
    } catch (error) {
        console.error('Lỗi:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Toggle status
async function toggleStatus(id, field, currentValue) {
    const newValue = field === 'soldStatus'
        ? (currentValue === 'sold' ? 'unsold' : 'sold')
        : (currentValue === 'yes' ? 'no' : 'yes');

    try {
        const response = await authFetch(`${API_URL}/accounts/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field, value: newValue })
        });

        if (!response.ok) throw new Error('Không thể cập nhật trạng thái');

        showToast('Cập nhật trạng thái thành công!', 'success');
        await loadAccounts();
    } catch (error) {
        console.error('Lỗi:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Delete account
async function deleteAccount(id) {
    if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;

    try {
        const response = await authFetch(`${API_URL}/accounts/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Không thể xóa tài khoản');

        showToast('Xóa tài khoản thành công!', 'success');
        await loadAccounts();
    } catch (error) {
        console.error('Lỗi:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Import TXT functions
let txtFileContent = null;

function openImportTxtModal() {
    importCategory.value = '';
    txtFileContent = null;
    importTxtModal.classList.add('show');
    importTxtFile.click();
}

function closeImportTxtModal() {
    importTxtModal.classList.remove('show');
    importCategory.value = '';
    txtFileContent = null;
    importTxtFile.value = '';
}

async function handleTxtFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
        closeImportTxtModal();
        return;
    }

    try {
        txtFileContent = await file.text();
        // Keep modal open for category selection
    } catch (error) {
        console.error('Lỗi đọc file:', error);
        showToast('Lỗi đọc file: ' + error.message, 'error');
        closeImportTxtModal();
    }
}

async function confirmImportTxt() {
    const category = importCategory.value;

    if (!category) {
        showToast('Vui lòng chọn loại tài khoản!', 'error');
        return;
    }

    if (!txtFileContent) {
        showToast('Vui lòng chọn file!', 'error');
        return;
    }

    try {
        // Parse file content
        const lines = txtFileContent.split('\n').filter(line => line.trim());
        const accounts = [];
        let successCount = 0;
        let errorCount = 0;

        for (const line of lines) {
            try {
                // Check if line contains | separator
                const parts = line.includes('|')
                    ? line.split('|').map(p => p.trim())
                    : [line.trim()]; // Chỉ có email

                if (parts.length >= 1 && parts[0]) {
                    const now = Date.now();
                    // Veo3: 14 ngày, CapCut: 28 ngày, ChatGPT: 30 ngày
                    let daysToAdd = 30; // Mặc định ChatGPT
                    if (category === 'veo3') daysToAdd = 14;
                    else if (category === 'capcut') daysToAdd = 28;
                    const expiryDate = now + (daysToAdd * 24 * 60 * 60 * 1000);

                    const account = {
                        id: generateId(),
                        category: category,
                        code: parts[2] || '', // Mã (nếu có)
                        username: parts[0] || '', // Email/Tài khoản
                        password: parts[1] || '', // Password (để trống nếu không có)
                        customerName: '',
                        soldStatus: 'unsold',
                        warrantyStatus: 'no',
                        warrantyAccount: '',
                        warrantyPassword: '',
                        note: '',
                        expiryDate: expiryDate,
                        warrantyExpiryDate: null
                    };

                    // Call API to create account
                    const response = await authFetch(`${API_URL}/accounts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(account)
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                        console.error(`Lỗi tạo account: ${parts[0]}`);
                    }
                }
            } catch (err) {
                errorCount++;
                console.error('Lỗi parse dòng:', line, err);
            }
        }

        closeImportTxtModal();
        showToast(`Import thành công ${successCount} tài khoản${errorCount > 0 ? `, ${errorCount} lỗi` : ''}!`, 'success');
        await loadAccounts();
    } catch (error) {
        console.error('Lỗi import:', error);
        showToast('Lỗi import: ' + error.message, 'error');
    }
}

// Import Warranty functions
let warrantyFileContent = null;
let selectedWarrantyAccounts = [];
let warrantyLines = [];

function openImportWarrantyModal() {
    importWarrantyCategory.value = '';
    warrantyFileContent = null;
    selectedWarrantyAccounts = [];
    warrantyLines = [];
    importWarrantyModal.classList.add('show');
    importWarrantyFile.click();
}

function closeImportWarrantyModal() {
    importWarrantyModal.classList.remove('show');
    importWarrantyCategory.value = '';
    warrantyFileContent = null;
    importWarrantyFile.value = '';
    // Không reset selectedWarrantyAccounts và warrantyLines ở đây
    // Vì chúng cần giữ lại để dùng trong modal chọn tài khoản
}

async function handleWarrantyFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
        closeImportWarrantyModal();
        return;
    }

    try {
        warrantyFileContent = await file.text();
        // Keep modal open for category selection
    } catch (error) {
        console.error('Lỗi đọc file:', error);
        showToast('Lỗi đọc file: ' + error.message, 'error');
        closeImportWarrantyModal();
    }
}

async function confirmImportWarranty() {
    const category = importWarrantyCategory.value;

    if (!category) {
        showToast('Vui lòng chọn loại tài khoản!', 'error');
        return;
    }

    if (!warrantyFileContent) {
        showToast('Vui lòng chọn file!', 'error');
        return;
    }

    try {
        // Parse file content
        warrantyLines = warrantyFileContent.split('\n').filter(line => line.trim());

        console.log('File content length:', warrantyFileContent.length);
        console.log('Warranty lines:', warrantyLines.length);
        console.log('First 3 lines:', warrantyLines.slice(0, 3));

        if (warrantyLines.length === 0) {
            showToast('File rỗng hoặc không có dữ liệu hợp lệ!', 'error');
            return;
        }

        // Get accounts of selected category
        const categoryAccounts = allAccounts.filter(acc => acc.category === category);

        if (categoryAccounts.length === 0) {
            showToast('Không có tài khoản nào trong mục này!', 'error');
            return;
        }

        console.log('Opening modal with', warrantyLines.length, 'lines and', categoryAccounts.length, 'accounts');

        // Close import modal and open selection modal
        closeImportWarrantyModal();
        openSelectAccountsModal(categoryAccounts, warrantyLines.length);

    } catch (error) {
        console.error('Lỗi import:', error);
        showToast('Lỗi import: ' + error.message, 'error');
    }
}

// Select Accounts Modal Functions
const selectAccountsModal = document.getElementById('selectAccountsModal');
const selectAccountsModalClose = document.getElementById('selectAccountsModalClose');
const cancelSelectAccountsBtn = document.getElementById('cancelSelectAccountsBtn');
const confirmSelectAccountsBtn = document.getElementById('confirmSelectAccountsBtn');
const accountsSelectionList = document.getElementById('accountsSelectionList');
const selectedWarrantyCount = document.getElementById('selectedWarrantyCount');
const totalWarrantyLines = document.getElementById('totalWarrantyLines');

function openSelectAccountsModal(accounts, requiredCount) {
    selectedWarrantyAccounts = [];
    totalWarrantyLines.textContent = requiredCount;
    selectedWarrantyCount.textContent = '0';

    // Render accounts list with checkboxes
    accountsSelectionList.innerHTML = accounts.map(acc => {
        const remainingDays = calculateRemainingDays(acc.expiryDate);
        const categoryIcon = acc.category === 'chatgpt' ? '🤖' : acc.category === 'veo3' ? '🎥' : '✂️';
        const categoryName = acc.category === 'chatgpt' ? 'ChatGPT' : acc.category === 'veo3' ? 'Veo 3' : 'CapCut';

        return `
            <div class="account-selection-item">
                <input type="checkbox" class="warranty-account-checkbox" data-id="${acc.id}" onchange="toggleWarrantyAccount('${acc.id}')">
                <div class="account-selection-info">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <span style="font-size: 1.2rem;">${categoryIcon}</span>
                        <div>
                            <div style="font-weight: 600;">${acc.username}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">
                                ${categoryName} | Mã: ${acc.code || '-'} | Khách hàng: ${acc.customerName || '-'}
                            </div>
                        </div>
                    </div>
                    <div>
                        ${getDaysBadge(remainingDays)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    selectAccountsModal.classList.add('show');

    // Tự động chọn đủ số lượng nếu file có ít dòng hơn hoặc bằng số tài khoản
    if (requiredCount <= accounts.length) {
        const firstAccounts = accounts.slice(0, requiredCount);
        selectedWarrantyAccounts = firstAccounts.map(acc => acc.id);
        selectedWarrantyCount.textContent = selectedWarrantyAccounts.length;

        // Update checkboxes
        firstAccounts.forEach(acc => {
            const checkbox = document.querySelector(`.warranty-account-checkbox[data-id="${acc.id}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
}

function closeSelectAccountsModal() {
    selectAccountsModal.classList.remove('show');
    selectedWarrantyAccounts = [];
    warrantyLines = [];
    warrantyFileContent = null;
}

function selectAllWarrantyAccounts() {
    const checkboxes = document.querySelectorAll('.warranty-account-checkbox');
    selectedWarrantyAccounts = [];
    checkboxes.forEach(cb => {
        cb.checked = true;
        selectedWarrantyAccounts.push(parseInt(cb.dataset.id));
    });
    selectedWarrantyCount.textContent = selectedWarrantyAccounts.length;
}

function deselectAllWarrantyAccounts() {
    const checkboxes = document.querySelectorAll('.warranty-account-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    selectedWarrantyAccounts = [];
    selectedWarrantyCount.textContent = '0';
}

function toggleWarrantyAccount(id) {
    const accountId = parseInt(id);
    if (selectedWarrantyAccounts.includes(accountId)) {
        selectedWarrantyAccounts = selectedWarrantyAccounts.filter(accId => accId !== accountId);
    } else {
        selectedWarrantyAccounts.push(accountId);
    }
    selectedWarrantyCount.textContent = selectedWarrantyAccounts.length;
}

async function confirmSelectAccounts() {
    const requiredCount = parseInt(totalWarrantyLines.textContent);

    if (selectedWarrantyAccounts.length !== requiredCount) {
        showToast(`Vui lòng chọn đúng ${requiredCount} tài khoản!`, 'error');
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    showToast(`Đang cập nhật ${selectedWarrantyAccounts.length} tài khoản...`, 'success');

    // Update accounts with warranty info
    for (let i = 0; i < selectedWarrantyAccounts.length; i++) {
        try {
            const accountId = selectedWarrantyAccounts[i];
            const account = allAccounts.find(acc => acc.id === accountId);
            const line = warrantyLines[i].trim();

            // Parse warranty info
            let warrantyAccount, warrantyPassword;

            if (line.includes('|')) {
                // Có cả tài khoản và mật khẩu
                const parts = line.split('|').map(p => p.trim());
                warrantyAccount = parts[0] || '';
                warrantyPassword = parts[1] || '';
            } else {
                // Chỉ có tài khoản, giữ nguyên mật khẩu cũ
                warrantyAccount = line.trim();
                warrantyPassword = account.warrantyPassword || '';
            }

            // Calculate warrantyExpiryDate
            const now = Date.now();
            let daysToAdd = 30;
            if (account.category === 'veo3') daysToAdd = 14;
            else if (account.category === 'capcut') daysToAdd = 28;
            const warrantyExpiryDate = now + (daysToAdd * 24 * 60 * 60 * 1000);

            // Call API to update account
            const response = await authFetch(`${API_URL}/accounts/${accountId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...account,
                    warrantyAccount: warrantyAccount,
                    warrantyPassword: warrantyPassword,
                    warrantyExpiryDate: warrantyExpiryDate
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
            console.error('Lỗi cập nhật:', error);
        }
    }

    closeSelectAccountsModal();
    await loadAccounts();
    showToast(`Cập nhật thành công ${successCount} tài khoản${errorCount > 0 ? `, ${errorCount} lỗi` : ''}!`, 'success');
}

// Make functions global
window.toggleWarrantyAccount = toggleWarrantyAccount;
window.selectAllWarrantyAccounts = selectAllWarrantyAccounts;
window.deselectAllWarrantyAccounts = deselectAllWarrantyAccounts;

// Update All Pass UI based on category
function updateAllPassUI() {
    const allPassGroup = document.querySelector('.all-pass-group');

    if (currentCategory === 'all') {
        // Ẩn khi ở mục "Tất cả"
        allPassGroup.style.display = 'none';
        allPassWarrantyGroup.style.display = 'none';
    } else {
        allPassGroup.style.display = 'flex';
        allPassWarrantyGroup.style.display = 'flex';
        // Cập nhật placeholder
        const placeholders = {
            'chatgpt': 'VD: Phuthanhtbc123@',
            'veo3': 'VD: Veo3ultra@',
            'capcut': 'VD: Capcut123@'
        };
        allPassInput.placeholder = placeholders[currentCategory] || 'Nhập mật khẩu chung...';
        allPassWarrantyInput.placeholder = 'VD: WarrantyPass123@';
    }
}

// Apply password to all accounts in current category
async function applyAllPassword() {
    // Không cho phép dùng ở mục "Tất cả"
    if (currentCategory === 'all') {
        showToast('Vui lòng chọn mục ChatGPT hoặc Veo 3!', 'error');
        return;
    }

    const password = allPassInput.value.trim();

    if (!password) {
        showToast('Vui lòng nhập mật khẩu!', 'error');
        return;
    }

    // Get accounts to update based on current category
    const accountsToUpdate = allAccounts.filter(acc => acc.category === currentCategory);

    if (accountsToUpdate.length === 0) {
        showToast('Không có tài khoản nào để cập nhật!', 'error');
        return;
    }

    const categoryName = currentCategory === 'chatgpt' ? 'ChatGPT' : currentCategory === 'veo3' ? 'Veo 3' : 'CapCut';

    if (!confirm(`Bạn có chắc muốn đổi mật khẩu cho ${accountsToUpdate.length} tài khoản ${categoryName} thành:\n"${password}"?`)) {
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Show progress
    showToast(`Đang cập nhật ${accountsToUpdate.length} tài khoản...`, 'success');

    for (const account of accountsToUpdate) {
        try {
            const response = await authFetch(`${API_URL}/accounts/${account.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...account,
                    password: password
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
            console.error(`Lỗi cập nhật ${account.username}:`, error);
        }
    }

    allPassInput.value = '';
    await loadAccounts();
    showToast(`Cập nhật thành công ${successCount} tài khoản${errorCount > 0 ? `, ${errorCount} lỗi` : ''}!`, 'success');
}

// Apply warranty password to all accounts in current category
async function applyAllWarrantyPassword() {
    // Không cho phép dùng ở mục "Tất cả"
    if (currentCategory === 'all') {
        showToast('Vui lòng chọn mục ChatGPT hoặc Veo 3!', 'error');
        return;
    }

    const password = allPassWarrantyInput.value.trim();

    if (!password) {
        showToast('Vui lòng nhập mật khẩu bảo hành!', 'error');
        return;
    }

    // Get accounts to update based on current category
    const accountsToUpdate = allAccounts.filter(acc => acc.category === currentCategory);

    if (accountsToUpdate.length === 0) {
        showToast('Không có tài khoản nào để cập nhật!', 'error');
        return;
    }

    const categoryName = currentCategory === 'chatgpt' ? 'ChatGPT' : currentCategory === 'veo3' ? 'Veo 3' : 'CapCut';

    if (!confirm(`Bạn có chắc muốn đổi mật khẩu bảo hành cho ${accountsToUpdate.length} tài khoản ${categoryName} thành:\n"${password}"?`)) {
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Show progress
    showToast(`Đang cập nhật ${accountsToUpdate.length} tài khoản...`, 'success');

    for (const account of accountsToUpdate) {
        try {
            const response = await authFetch(`${API_URL}/accounts/${account.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...account,
                    warrantyPassword: password
                })
            });

            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
            console.error(`Lỗi cập nhật ${account.username}:`, error);
        }
    }

    allPassWarrantyInput.value = '';
    await loadAccounts();
    showToast(`Cập nhật mật khẩu BH thành công ${successCount} tài khoản${errorCount > 0 ? `, ${errorCount} lỗi` : ''}!`, 'success');
}

// Utility functions
function generateId() {
    return `acc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(Number(timestamp));
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Make functions available globally for onclick handlers
window.openEditModal = openEditModal;
window.toggleStatus = toggleStatus;
window.deleteAccount = deleteAccount;

// Delete Mode Functions
function toggleDeleteMode() {
    deleteMode = !deleteMode;

    // Toggle UI
    const checkboxColumns = document.querySelectorAll('.checkbox-column');
    checkboxColumns.forEach(col => {
        col.style.display = deleteMode ? 'table-cell' : 'none';
    });

    // Update button text
    toggleDeleteModeBtn.innerHTML = deleteMode
        ? '<span>❌ Hủy</span>'
        : '<span>☑️ Chọn xóa</span>';

    toggleDeleteModeBtn.classList.toggle('btn-secondary', !deleteMode);
    toggleDeleteModeBtn.classList.toggle('btn-danger', deleteMode);

    // Show/hide delete all button
    deleteAllBtn.style.display = deleteMode && selectedAccounts.size > 0 ? 'inline-block' : 'none';

    // Clear selections when exiting delete mode
    if (!deleteMode) {
        selectedAccounts.clear();
        selectAllCheckbox.checked = false;
        updateSelectedCount();
    }
}

function toggleSelectAll() {
    if (selectAllCheckbox.checked) {
        // Select all visible accounts on current page
        const currentPageIds = Array.from(document.querySelectorAll('.account-checkbox'))
            .map(cb => cb.dataset.id);
        currentPageIds.forEach(id => selectedAccounts.add(id));
    } else {
        // Deselect all visible accounts on current page
        const currentPageIds = Array.from(document.querySelectorAll('.account-checkbox'))
            .map(cb => cb.dataset.id);
        currentPageIds.forEach(id => selectedAccounts.delete(id));
    }

    updateSelectedCount();
    renderTable();
}

function toggleAccountSelection(id) {
    if (selectedAccounts.has(id)) {
        selectedAccounts.delete(id);
    } else {
        selectedAccounts.add(id);
    }

    updateSelectedCount();
    updateSelectAllCheckbox();
}

function updateSelectedCount() {
    selectedCount.textContent = selectedAccounts.size;
    deleteAllBtn.style.display = deleteMode && selectedAccounts.size > 0 ? 'inline-block' : 'none';
}

function updateSelectAllCheckbox() {
    const visibleCheckboxes = document.querySelectorAll('.account-checkbox');
    const allChecked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(visibleCheckboxes).some(cb => cb.checked);

    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
}

async function deleteSelectedAccounts() {
    if (selectedAccounts.size === 0) {
        showToast('Vui lòng chọn tài khoản cần xóa!', 'error');
        return;
    }

    const count = selectedAccounts.size;
    if (!confirm(`Bạn có chắc muốn xóa ${count} tài khoản đã chọn?\nThao tác này không thể hoàn tác!`)) {
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    showToast(`Đang xóa ${count} tài khoản...`, 'success');

    for (const id of selectedAccounts) {
        try {
            const response = await authFetch(`${API_URL}/accounts/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
            console.error(`Lỗi xóa tài khoản ${id}:`, error);
        }
    }

    selectedAccounts.clear();
    selectAllCheckbox.checked = false;
    updateSelectedCount();

    await loadAccounts();
    showToast(`Đã xóa ${successCount} tài khoản${errorCount > 0 ? `, ${errorCount} lỗi` : ''}!`, 'success');

    // Exit delete mode after deletion
    if (deleteMode) {
        toggleDeleteMode();
    }
}

// Make delete functions available globally
window.toggleAccountSelection = toggleAccountSelection;

// =====================================================
// USER MANAGEMENT FUNCTIONS
// =====================================================

let currentUser = null;

// Load current user info
async function loadCurrentUser() {
    try {
        const response = await authFetch(`${API_URL}/auth/me`);
        if (response.ok) {
            currentUser = await response.json();
            updateUserDisplay();
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Update user display in sidebar
function updateUserDisplay() {
    const userNameEl = document.getElementById('userName');
    const manageUsersBtn = document.getElementById('manageUsersBtn');

    if (currentUser) {
        userNameEl.textContent = currentUser.fullName || currentUser.username;

        // Show admin button only for admin users
        if (currentUser.role === 'admin') {
            manageUsersBtn.style.display = 'block';
        }
    }
}

// Logout function
async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login.html';
    }
}

// User Management Modal
const userManagementModal = document.getElementById('userManagementModal');
const userManagementModalClose = document.getElementById('userManagementModalClose');
const closeUserManagementBtn = document.getElementById('closeUserManagementBtn');
const addUserBtn = document.getElementById('addUserBtn');
const usersList = document.getElementById('usersList');
const manageUsersBtn = document.getElementById('manageUsersBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Open user management modal
function openUserManagementModal() {
    userManagementModal.classList.add('show');
    loadUsers();
}

// Close user management modal
function closeUserManagementModal() {
    userManagementModal.classList.remove('show');
    document.getElementById('newUserUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserFullName').value = '';
}

// Load users list
async function loadUsers() {
    try {
        usersList.innerHTML = '<div style="text-align: center; color: #64748b; padding: 2rem;">Đang tải...</div>';

        const response = await authFetch(`${API_URL}/users`);
        if (!response.ok) {
            throw new Error('Không thể tải danh sách user');
        }

        const users = await response.json();
        renderUsersList(users);
    } catch (error) {
        console.error('Error loading users:', error);
        usersList.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 2rem;">Lỗi tải danh sách user</div>';
    }
}

// Render users list
function renderUsersList(users) {
    if (users.length === 0) {
        usersList.innerHTML = '<div style="text-align: center; color: #64748b; padding: 2rem;">Chưa có user nào</div>';
        return;
    }

    usersList.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-item-info">
                <div class="user-item-avatar">${user.role === 'admin' ? '👑' : '👤'}</div>
                <div class="user-item-details">
                    <h4>${user.username}</h4>
                    <p>${user.fullName || 'Chưa có tên'}</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="user-item-badge ${user.role}">${user.role === 'admin' ? 'Admin' : 'User'}</span>
                ${user.username !== 'admin' ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">🗑️</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Add new user
async function addUser() {
    const username = document.getElementById('newUserUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const fullName = document.getElementById('newUserFullName').value.trim();

    if (!username || !password) {
        showToast('Vui lòng nhập tên đăng nhập và mật khẩu!', 'error');
        return;
    }

    try {
        const response = await authFetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, fullName, role: 'user' })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Không thể tạo user');
        }

        showToast('Tạo user thành công!', 'success');
        document.getElementById('newUserUsername').value = '';
        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserFullName').value = '';
        loadUsers();
    } catch (error) {
        console.error('Error adding user:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Delete user
async function deleteUser(userId, username) {
    if (!confirm(`Bạn có chắc muốn xóa user "${username}"?`)) return;

    try {
        const response = await authFetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Không thể xóa user');
        }

        showToast('Xóa user thành công!', 'success');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// Make deleteUser available globally
window.deleteUser = deleteUser;

// Event listeners for user management
if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
}

if (manageUsersBtn) {
    manageUsersBtn.addEventListener('click', openUserManagementModal);
}

if (userManagementModalClose) {
    userManagementModalClose.addEventListener('click', closeUserManagementModal);
}

if (closeUserManagementBtn) {
    closeUserManagementBtn.addEventListener('click', closeUserManagementModal);
}

if (addUserBtn) {
    addUserBtn.addEventListener('click', addUser);
}

if (userManagementModal) {
    userManagementModal.addEventListener('click', (e) => {
        if (e.target === userManagementModal) closeUserManagementModal();
    });
}

// Load current user on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCurrentUser();
});

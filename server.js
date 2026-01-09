const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: 'phuthanh-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // set true nếu dùng HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 giờ
    }
}));

// Cấu hình SQL Server - Kết nối qua localhost và port
const config = {
    user: 'appuser',
    password: 'App@12345',
    server: 'localhost',
    port: 1433,
    database: 'AccountManager',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Kết nối database
let pool;

async function connectDB() {
    try {
        pool = await sql.connect(config);
        console.log('✓ Kết nối SQL Server thành công!');
    } catch (err) {
        console.error('✗ Lỗi kết nối SQL Server:', err);
        process.exit(1);
    }
}

// Auth Middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Vui lòng đăng nhập!' });
    }
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Chỉ admin mới có quyền thực hiện!' });
    }
}

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM users WHERE username = @username AND isActive = 1');
        
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Tên đăng nhập không tồn tại!' });
        }
        
        const user = result.recordset[0];
        
        // So sánh mật khẩu (chưa mã hóa)
        if (password !== user.password) {
            return res.status(401).json({ error: 'Mật khẩu không đúng!' });
        }
        
        // Lưu thông tin user vào session
        req.session.user = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role
        };
        
        // Đảm bảo session được lưu trước khi trả response
        req.session.save((err) => {
            if (err) {
                console.error('Lỗi lưu session:', err);
                return res.status(500).json({ error: 'Lỗi lưu phiên đăng nhập!' });
            }
            
            res.json({ 
                message: 'Đăng nhập thành công!',
                user: req.session.user
            });
        });
    } catch (err) {
        console.error('Lỗi login:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Đăng xuất thành công!' });
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'Chưa đăng nhập!' });
    }
});

// User Management Routes (Admin only)
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.request()
            .query('SELECT id, username, fullName, role, isActive, createdAt FROM users ORDER BY createdAt DESC');
        res.json(result.recordset);
    } catch (err) {
        console.error('Lỗi GET users:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { username, password, fullName, role } = req.body;
        
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .input('fullName', sql.NVarChar, fullName || '')
            .input('role', sql.NVarChar, role || 'user')
            .query('INSERT INTO users (username, password, fullName, role) OUTPUT INSERTED.* VALUES (@username, @password, @fullName, @role)');
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Lỗi POST user:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM users WHERE id = @id');
        res.json({ message: 'Xóa user thành công!' });
    } catch (err) {
        console.error('Lỗi DELETE user:', err);
        res.status(500).json({ error: err.message });
    }
});

// API Routes

// GET - Lấy tất cả accounts hoặc lọc theo category
app.get('/api/accounts', requireAuth, async (req, res) => {
    try {
        const { category, soldStatus, warrantyStatus, search } = req.query;
        let query = 'SELECT * FROM accounts WHERE 1=1';
        
        if (category && category !== 'all') {
            query += ` AND category = '${category}'`;
        }
        if (soldStatus && soldStatus !== 'all') {
            query += ` AND soldStatus = '${soldStatus}'`;
        }
        if (warrantyStatus && warrantyStatus !== 'all') {
            query += ` AND warrantyStatus = '${warrantyStatus}'`;
        }
        if (search) {
            query += ` AND (username LIKE '%${search}%' OR code LIKE '%${search}%' OR customerName LIKE '%${search}%' OR warrantyAccount LIKE '%${search}%')`;
        }
        
        query += ' ORDER BY createdAt DESC';
        
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Lỗi GET accounts:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET - Lấy một account theo ID
app.get('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.NVarChar, req.params.id)
            .query('SELECT * FROM accounts WHERE id = @id');
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Lỗi GET account:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST - Tạo account mới
app.post('/api/accounts', requireAuth, async (req, res) => {
    try {
        const {
            id,
            category,
            code,
            username,
            password,
            customerName,
            soldStatus,
            warrantyStatus,
            warrantyAccount,
            warrantyPassword,
            note
        } = req.body;

        const now = Date.now();
        
        // Tính expiryDate dựa vào category
        const daysToAdd = category === 'veo3' ? 14 : 30; // Veo3: 14 ngày, ChatGPT: 30 ngày
        const expiryDate = now + (daysToAdd * 24 * 60 * 60 * 1000);
        
        await pool.request()
            .input('id', sql.NVarChar, id)
            .input('category', sql.NVarChar, category)
            .input('code', sql.NVarChar, code || null)
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .input('customerName', sql.NVarChar, customerName || null)
            .input('soldStatus', sql.NVarChar, soldStatus || 'unsold')
            .input('warrantyStatus', sql.NVarChar, warrantyStatus || 'no')
            .input('warrantyAccount', sql.NVarChar, warrantyAccount || null)
            .input('warrantyPassword', sql.NVarChar, warrantyPassword || null)
            .input('note', sql.NVarChar, note || null)
            .input('createdAt', sql.BigInt, now)
            .input('updatedAt', sql.BigInt, now)
            .input('expiryDate', sql.BigInt, expiryDate)
            .input('warrantyExpiryDate', sql.BigInt, null)
            .query(`
                INSERT INTO accounts (id, category, code, username, password, customerName, soldStatus, warrantyStatus, warrantyAccount, warrantyPassword, note, createdAt, updatedAt, expiryDate, warrantyExpiryDate)
                VALUES (@id, @category, @code, @username, @password, @customerName, @soldStatus, @warrantyStatus, @warrantyAccount, @warrantyPassword, @note, @createdAt, @updatedAt, @expiryDate, @warrantyExpiryDate)
            `);
        
        res.status(201).json({ message: 'Tạo tài khoản thành công', id });
    } catch (err) {
        console.error('Lỗi POST account:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT - Cập nhật account
app.put('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
        const {
            category,
            code,
            username,
            password,
            customerName,
            soldStatus,
            warrantyStatus,
            warrantyAccount,
            warrantyPassword,
            note,
            expiryDate,
            warrantyExpiryDate
        } = req.body;

        const now = Date.now();
        
        const result = await pool.request()
            .input('id', sql.NVarChar, req.params.id)
            .input('category', sql.NVarChar, category)
            .input('code', sql.NVarChar, code || null)
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, password)
            .input('customerName', sql.NVarChar, customerName || null)
            .input('soldStatus', sql.NVarChar, soldStatus)
            .input('warrantyStatus', sql.NVarChar, warrantyStatus)
            .input('warrantyAccount', sql.NVarChar, warrantyAccount || null)
            .input('warrantyPassword', sql.NVarChar, warrantyPassword || null)
            .input('note', sql.NVarChar, note || null)
            .input('updatedAt', sql.BigInt, now)
            .input('expiryDate', sql.BigInt, expiryDate || null)
            .input('warrantyExpiryDate', sql.BigInt, warrantyExpiryDate || null)
            .query(`
                UPDATE accounts SET 
                    category = @category,
                    code = @code,
                    username = @username,
                    password = @password,
                    customerName = @customerName,
                    soldStatus = @soldStatus,
                    warrantyStatus = @warrantyStatus,
                    warrantyAccount = @warrantyAccount,
                    warrantyPassword = @warrantyPassword,
                    note = @note,
                    updatedAt = @updatedAt,
                    expiryDate = @expiryDate,
                    warrantyExpiryDate = @warrantyExpiryDate
                WHERE id = @id
            `);
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }
        
        res.json({ message: 'Cập nhật thành công' });
    } catch (err) {
        console.error('Lỗi PUT account:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH - Cập nhật trạng thái nhanh
app.patch('/api/accounts/:id/status', async (req, res) => {
    try {
        const { field, value } = req.body; // field: 'soldStatus' hoặc 'warrantyStatus'
        const now = Date.now();
        
        const result = await pool.request()
            .input('id', sql.NVarChar, req.params.id)
            .input('value', sql.NVarChar, value)
            .input('updatedAt', sql.BigInt, now)
            .query(`
                UPDATE accounts SET 
                    ${field} = @value,
                    updatedAt = @updatedAt
                WHERE id = @id
            `);
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }
        
        res.json({ message: 'Cập nhật trạng thái thành công' });
    } catch (err) {
        console.error('Lỗi PATCH status:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE - Xóa account
app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
        const result = await pool.request()
            .input('id', sql.NVarChar, req.params.id)
            .query('DELETE FROM accounts WHERE id = @id');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }
        
        res.json({ message: 'Xóa tài khoản thành công' });
    } catch (err) {
        console.error('Lỗi DELETE account:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST - Import dữ liệu từ JSON
app.post('/api/accounts/import', async (req, res) => {
    try {
        const accounts = req.body;
        let imported = 0;
        
        for (const acc of accounts) {
            try {
                await pool.request()
                    .input('id', sql.NVarChar, acc.id)
                    .input('category', sql.NVarChar, acc.category)
                    .input('code', sql.NVarChar, acc.code || null)
                    .input('username', sql.NVarChar, acc.username)
                    .input('password', sql.NVarChar, acc.password)
                    .input('customerName', sql.NVarChar, acc.customerName || null)
                    .input('soldStatus', sql.NVarChar, acc.soldStatus || 'unsold')
                    .input('warrantyStatus', sql.NVarChar, acc.warrantyStatus || 'no')
                    .input('warrantyAccount', sql.NVarChar, acc.warrantyAccount || null)
                    .input('warrantyPassword', sql.NVarChar, acc.warrantyPassword || null)
                    .input('note', sql.NVarChar, acc.note || null)
                    .input('createdAt', sql.BigInt, acc.createdAt || Date.now())
                    .input('updatedAt', sql.BigInt, acc.updatedAt || Date.now())
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = @id)
                        INSERT INTO accounts (id, category, code, username, password, customerName, soldStatus, warrantyStatus, warrantyAccount, warrantyPassword, note, createdAt, updatedAt)
                        VALUES (@id, @category, @code, @username, @password, @customerName, @soldStatus, @warrantyStatus, @warrantyAccount, @warrantyPassword, @note, @createdAt, @updatedAt)
                    `);
                imported++;
            } catch (err) {
                console.error(`Lỗi import account ${acc.id}:`, err.message);
            }
        }
        
        res.json({ message: `Import thành công ${imported}/${accounts.length} tài khoản` });
    } catch (err) {
        console.error('Lỗi import:', err);
        res.status(500).json({ error: err.message });
    }
});

// Serve index.html with auth check
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect('/login.html');
    }
});

// Khởi động server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`✓ Server đang chạy tại http://localhost:${PORT}`);
        console.log(`✓ Mở trình duyệt và truy cập: http://localhost:${PORT}`);
        console.log(`✓ Đăng nhập: admin / admin123`);
    });
});

// Xử lý tắt server
process.on('SIGINT', async () => {
    console.log('\nĐang đóng kết nối database...');
    await pool.close();
    process.exit(0);
});

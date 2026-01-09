const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for now to allow inline scripts
}));

// Rate limiting - chống brute force
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 100, // Tối đa 100 requests mỗi 15 phút
    message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau!' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // Tối đa 5 lần đăng nhập thất bại
    message: { error: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 15 phút!' }
});

app.use('/api/', limiter);

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'phuthanh-secret-key-2026-super-secure',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 giờ
        sameSite: 'lax'
    }
}));

// Khởi tạo SQLite Database
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'database.sqlite');

// Tạo thư mục data nếu chưa có
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
console.log('✓ Kết nối SQLite thành công!');

// Tạo bảng nếu chưa tồn tại
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullName TEXT,
        role TEXT DEFAULT 'user',
        isActive INTEGER DEFAULT 1,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        code TEXT,
        username TEXT NOT NULL,
        password TEXT,
        customerName TEXT,
        soldStatus TEXT DEFAULT 'unsold',
        warrantyStatus TEXT DEFAULT 'no',
        warrantyAccount TEXT,
        warrantyPassword TEXT,
        note TEXT,
        createdAt INTEGER,
        updatedAt INTEGER,
        expiryDate INTEGER,
        warrantyExpiryDate INTEGER
    );
`);

// Tạo admin user mặc định nếu chưa có
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)').run('admin', hashedPassword, 'Administrator', 'admin');
    console.log('✓ Đã tạo tài khoản admin mặc định (admin / admin123)');
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
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = db.prepare('SELECT * FROM users WHERE username = ? AND isActive = 1').get(username);

        if (!user) {
            return res.status(401).json({ error: 'Tên đăng nhập không tồn tại!' });
        }

        // So sánh mật khẩu với bcrypt
        const isValidPassword = bcrypt.compareSync(password, user.password);
        if (!isValidPassword) {
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
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, fullName, role, isActive, createdAt FROM users ORDER BY createdAt DESC').all();
        res.json(users);
    } catch (err) {
        console.error('Lỗi GET users:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
    try {
        const { username, password, fullName, role } = req.body;

        // Hash password
        const hashedPassword = bcrypt.hashSync(password, 10);

        const result = db.prepare('INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)').run(username, hashedPassword, fullName || '', role || 'user');

        const newUser = db.prepare('SELECT id, username, fullName, role, isActive, createdAt FROM users WHERE id = ?').get(result.lastInsertRowid);
        res.json(newUser);
    } catch (err) {
        console.error('Lỗi POST user:', err);
        if (err.message.includes('UNIQUE constraint')) {
            res.status(400).json({ error: 'Tên đăng nhập đã tồn tại!' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ message: 'Xóa user thành công!' });
    } catch (err) {
        console.error('Lỗi DELETE user:', err);
        res.status(500).json({ error: err.message });
    }
});

// API Routes for Accounts

// GET - Lấy tất cả accounts hoặc lọc theo category
app.get('/api/accounts', requireAuth, (req, res) => {
    try {
        const { category, soldStatus, warrantyStatus, search } = req.query;
        let query = 'SELECT * FROM accounts WHERE 1=1';
        const params = [];

        if (category && category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }
        if (soldStatus && soldStatus !== 'all') {
            query += ' AND soldStatus = ?';
            params.push(soldStatus);
        }
        if (warrantyStatus && warrantyStatus !== 'all') {
            query += ' AND warrantyStatus = ?';
            params.push(warrantyStatus);
        }
        if (search) {
            query += ' AND (username LIKE ? OR code LIKE ? OR customerName LIKE ? OR warrantyAccount LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY createdAt DESC';

        const accounts = db.prepare(query).all(...params);
        res.json(accounts);
    } catch (err) {
        console.error('Lỗi GET accounts:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET - Lấy một account theo ID
app.get('/api/accounts/:id', requireAuth, (req, res) => {
    try {
        const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);

        if (!account) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        res.json(account);
    } catch (err) {
        console.error('Lỗi GET account:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST - Tạo account mới
app.post('/api/accounts', requireAuth, (req, res) => {
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
        const daysToAdd = category === 'veo3' ? 14 : category === 'capcut' ? 28 : 30;
        const expiryDate = now + (daysToAdd * 24 * 60 * 60 * 1000);

        db.prepare(`
            INSERT INTO accounts (id, category, code, username, password, customerName, soldStatus, warrantyStatus, warrantyAccount, warrantyPassword, note, createdAt, updatedAt, expiryDate, warrantyExpiryDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, category, code || null, username, password, customerName || null, soldStatus || 'unsold', warrantyStatus || 'no', warrantyAccount || null, warrantyPassword || null, note || null, now, now, expiryDate, null);

        res.status(201).json({ message: 'Tạo tài khoản thành công', id });
    } catch (err) {
        console.error('Lỗi POST account:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT - Cập nhật account
app.put('/api/accounts/:id', requireAuth, (req, res) => {
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

        const result = db.prepare(`
            UPDATE accounts SET 
                category = ?,
                code = ?,
                username = ?,
                password = ?,
                customerName = ?,
                soldStatus = ?,
                warrantyStatus = ?,
                warrantyAccount = ?,
                warrantyPassword = ?,
                note = ?,
                updatedAt = ?,
                expiryDate = ?,
                warrantyExpiryDate = ?
            WHERE id = ?
        `).run(category, code || null, username, password, customerName || null, soldStatus, warrantyStatus, warrantyAccount || null, warrantyPassword || null, note || null, now, expiryDate || null, warrantyExpiryDate || null, req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        res.json({ message: 'Cập nhật thành công' });
    } catch (err) {
        console.error('Lỗi PUT account:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH - Cập nhật trạng thái nhanh
app.patch('/api/accounts/:id/status', requireAuth, (req, res) => {
    try {
        const { field, value } = req.body;
        const now = Date.now();

        // Validate field name to prevent SQL injection
        if (!['soldStatus', 'warrantyStatus'].includes(field)) {
            return res.status(400).json({ error: 'Field không hợp lệ' });
        }

        const result = db.prepare(`UPDATE accounts SET ${field} = ?, updatedAt = ? WHERE id = ?`).run(value, now, req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        res.json({ message: 'Cập nhật trạng thái thành công' });
    } catch (err) {
        console.error('Lỗi PATCH status:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE - Xóa account
app.delete('/api/accounts/:id', requireAuth, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        res.json({ message: 'Xóa tài khoản thành công' });
    } catch (err) {
        console.error('Lỗi DELETE account:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST - Import dữ liệu từ JSON
app.post('/api/accounts/import', requireAuth, (req, res) => {
    try {
        const accounts = req.body;
        let imported = 0;

        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO accounts (id, category, code, username, password, customerName, soldStatus, warrantyStatus, warrantyAccount, warrantyPassword, note, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((accounts) => {
            for (const acc of accounts) {
                try {
                    const result = insertStmt.run(
                        acc.id, acc.category, acc.code || null, acc.username, acc.password,
                        acc.customerName || null, acc.soldStatus || 'unsold', acc.warrantyStatus || 'no',
                        acc.warrantyAccount || null, acc.warrantyPassword || null, acc.note || null,
                        acc.createdAt || Date.now(), acc.updatedAt || Date.now()
                    );
                    if (result.changes > 0) imported++;
                } catch (err) {
                    console.error(`Lỗi import account ${acc.id}:`, err.message);
                }
            }
        });

        insertMany(accounts);

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

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Khởi động server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Server đang chạy tại http://localhost:${PORT}`);
    console.log(`✓ Môi trường: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ Đăng nhập: admin / admin123`);
});

// Xử lý tắt server
process.on('SIGINT', () => {
    console.log('\nĐang đóng kết nối database...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nĐang đóng kết nối database...');
    db.close();
    process.exit(0);
});

const express = require('express');
const { createClient } = require('@libsql/client');
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
    contentSecurityPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Quá nhiều yêu cầu, vui lòng thử lại sau!' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
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
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Khởi tạo Turso Database
const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN
});

console.log('✓ Kết nối Turso Database thành công!');

// Khởi tạo bảng
async function initDatabase() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                fullName TEXT,
                role TEXT DEFAULT 'user',
                isActive INTEGER DEFAULT 1,
                createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
            )
        `);

        await db.execute(`
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
            )
        `);

        // Tạo admin user mặc định nếu chưa có
        const adminCheck = await db.execute({
            sql: 'SELECT id FROM users WHERE username = ?',
            args: ['admin']
        });

        if (adminCheck.rows.length === 0) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            await db.execute({
                sql: 'INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)',
                args: ['admin', hashedPassword, 'Administrator', 'admin']
            });
            console.log('✓ Đã tạo tài khoản admin mặc định (admin / admin123)');
        }

        console.log('✓ Database đã sẵn sàng!');
    } catch (err) {
        console.error('Lỗi khởi tạo database:', err);
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
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await db.execute({
            sql: 'SELECT * FROM users WHERE username = ? AND isActive = 1',
            args: [username]
        });

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Tên đăng nhập không tồn tại!' });
        }

        const user = result.rows[0];

        const isValidPassword = bcrypt.compareSync(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Mật khẩu không đúng!' });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role
        };

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

// User Management Routes
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await db.execute('SELECT id, username, fullName, role, isActive, createdAt FROM users ORDER BY createdAt DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Lỗi GET users:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { username, password, fullName, role } = req.body;
        const hashedPassword = bcrypt.hashSync(password, 10);

        await db.execute({
            sql: 'INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)',
            args: [username, hashedPassword, fullName || '', role || 'user']
        });

        const result = await db.execute({
            sql: 'SELECT id, username, fullName, role, isActive, createdAt FROM users WHERE username = ?',
            args: [username]
        });

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Lỗi POST user:', err);
        if (err.message.includes('UNIQUE')) {
            res.status(400).json({ error: 'Tên đăng nhập đã tồn tại!' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM users WHERE id = ?',
            args: [req.params.id]
        });
        res.json({ message: 'Xóa user thành công!' });
    } catch (err) {
        console.error('Lỗi DELETE user:', err);
        res.status(500).json({ error: err.message });
    }
});

// Account Routes
app.get('/api/accounts', requireAuth, async (req, res) => {
    try {
        const { category, soldStatus, warrantyStatus, search } = req.query;
        let sql = 'SELECT * FROM accounts WHERE 1=1';
        const args = [];

        if (category && category !== 'all') {
            sql += ' AND category = ?';
            args.push(category);
        }
        if (soldStatus && soldStatus !== 'all') {
            sql += ' AND soldStatus = ?';
            args.push(soldStatus);
        }
        if (warrantyStatus && warrantyStatus !== 'all') {
            sql += ' AND warrantyStatus = ?';
            args.push(warrantyStatus);
        }
        if (search) {
            sql += ' AND (username LIKE ? OR code LIKE ? OR customerName LIKE ? OR warrantyAccount LIKE ?)';
            const searchPattern = `%${search}%`;
            args.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        sql += ' ORDER BY createdAt DESC';

        const result = await db.execute({ sql, args });
        res.json(result.rows);
    } catch (err) {
        console.error('Lỗi GET accounts:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM accounts WHERE id = ?',
            args: [req.params.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Lỗi GET account:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/accounts', requireAuth, async (req, res) => {
    try {
        const {
            id, category, code, username, password, customerName,
            soldStatus, warrantyStatus, warrantyAccount, warrantyPassword, note
        } = req.body;

        const now = Date.now();
        const daysToAdd = category === 'veo3' ? 14 : category === 'capcut' ? 28 : 30;
        const expiryDate = now + (daysToAdd * 24 * 60 * 60 * 1000);

        await db.execute({
            sql: `INSERT INTO accounts (id, category, code, username, password, customerName, soldStatus, warrantyStatus, warrantyAccount, warrantyPassword, note, createdAt, updatedAt, expiryDate, warrantyExpiryDate)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [id, category, code || null, username, password, customerName || null, soldStatus || 'unsold', warrantyStatus || 'no', warrantyAccount || null, warrantyPassword || null, note || null, now, now, expiryDate, null]
        });

        res.status(201).json({ message: 'Tạo tài khoản thành công', id });
    } catch (err) {
        console.error('Lỗi POST account:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
        const {
            category, code, username, password, customerName,
            soldStatus, warrantyStatus, warrantyAccount, warrantyPassword,
            note, expiryDate, warrantyExpiryDate
        } = req.body;

        const now = Date.now();

        const result = await db.execute({
            sql: `UPDATE accounts SET 
                    category = ?, code = ?, username = ?, password = ?,
                    customerName = ?, soldStatus = ?, warrantyStatus = ?,
                    warrantyAccount = ?, warrantyPassword = ?, note = ?,
                    updatedAt = ?, expiryDate = ?, warrantyExpiryDate = ?
                  WHERE id = ?`,
            args: [category, code || null, username, password, customerName || null, soldStatus, warrantyStatus, warrantyAccount || null, warrantyPassword || null, note || null, now, expiryDate || null, warrantyExpiryDate || null, req.params.id]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        res.json({ message: 'Cập nhật thành công' });
    } catch (err) {
        console.error('Lỗi PUT account:', err);
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/accounts/:id/status', requireAuth, async (req, res) => {
    try {
        const { field, value } = req.body;
        const now = Date.now();

        if (!['soldStatus', 'warrantyStatus'].includes(field)) {
            return res.status(400).json({ error: 'Field không hợp lệ' });
        }

        const result = await db.execute({
            sql: `UPDATE accounts SET ${field} = ?, updatedAt = ? WHERE id = ?`,
            args: [value, now, req.params.id]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        res.json({ message: 'Cập nhật trạng thái thành công' });
    } catch (err) {
        console.error('Lỗi PATCH status:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'DELETE FROM accounts WHERE id = ?',
            args: [req.params.id]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        res.json({ message: 'Xóa tài khoản thành công' });
    } catch (err) {
        console.error('Lỗi DELETE account:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/accounts/import', requireAuth, async (req, res) => {
    try {
        const accounts = req.body;
        let imported = 0;

        for (const acc of accounts) {
            try {
                await db.execute({
                    sql: `INSERT OR IGNORE INTO accounts (id, category, code, username, password, customerName, soldStatus, warrantyStatus, warrantyAccount, warrantyPassword, note, createdAt, updatedAt)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [acc.id, acc.category, acc.code || null, acc.username, acc.password, acc.customerName || null, acc.soldStatus || 'unsold', acc.warrantyStatus || 'no', acc.warrantyAccount || null, acc.warrantyPassword || null, acc.note || null, acc.createdAt || Date.now(), acc.updatedAt || Date.now()]
                });
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Khởi động server
initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✓ Server đang chạy tại http://localhost:${PORT}`);
        console.log(`✓ Môi trường: ${process.env.NODE_ENV || 'development'}`);
        console.log(`✓ Đăng nhập: admin / admin123`);
    });
});

process.on('SIGINT', () => {
    console.log('\nĐang đóng kết nối...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nĐang đóng kết nối...');
    process.exit(0);
});

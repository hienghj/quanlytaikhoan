# Account Manager - Quản lý tài khoản ChatGPT & Veo 3

## 🚀 Deploy trên Render.com + Turso Database

### ✅ Tính năng
- Quản lý tài khoản ChatGPT, Veo 3, CapCut
- Đăng nhập/Đăng xuất với session
- Quản lý user (Admin only)
- Mật khẩu mã hóa bcrypt
- Rate limiting chống brute-force
- Database Turso (SQLite Cloud) - **Miễn phí vĩnh viễn**

---

## 📋 Hướng dẫn Deploy

### Bước 1: Tạo Database trên Turso (Miễn phí)
1. Đăng ký tại [turso.tech](https://turso.tech)
2. Tạo database mới
3. Lấy URL và Auth Token

### Bước 2: Deploy lên Render.com
1. Đăng nhập [Render.com](https://render.com)
2. New → Web Service
3. Kết nối repository này
4. Cấu hình:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Environment Variables:
   - `NODE_ENV` = `production`
   - `SESSION_SECRET` = `your-secret-key`
   - `TURSO_DATABASE_URL` = `libsql://your-db.turso.io`
   - `TURSO_AUTH_TOKEN` = `your-auth-token`

### Bước 3: Trỏ tên miền
1. Render Dashboard → Settings → Custom Domains
2. Thêm tên miền
3. Cập nhật DNS CNAME

---

## 🔐 Đăng nhập mặc định
- Username: `admin`
- Password: `admin123`

⚠️ **Đổi mật khẩu ngay sau khi deploy!**

---

## 💻 Chạy local
```bash
npm install
npm run dev
```

Truy cập: http://localhost:3000

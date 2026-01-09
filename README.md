# Account Manager - Quản lý tài khoản ChatGPT & Veo 3

## 🚀 Deploy trên Render.com

### Bước 1: Push code lên GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Bước 2: Tạo Web Service trên Render.com
1. Đăng nhập [Render.com](https://render.com)
2. Click "New" → "Web Service"
3. Kết nối với GitHub repository của bạn
4. Cấu hình:
   - **Name**: account-manager (hoặc tên bạn muốn)
   - **Region**: Singapore (gần Việt Nam nhất)
   - **Branch**: main
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Bước 3: Cấu hình Environment Variables
Trong Render Dashboard → Environment:
```
NODE_ENV=production
SESSION_SECRET=your-super-secret-key-here-make-it-long-and-random
```

### Bước 4: Trỏ tên miền
1. Vào Render Dashboard → Settings → Custom Domains
2. Thêm tên miền của bạn
3. Cập nhật DNS record:
   - Type: CNAME
   - Name: www (hoặc @ cho root domain)
   - Value: your-app.onrender.com

## 🔐 Đăng nhập mặc định
- Username: `admin`
- Password: `admin123`

⚠️ **Quan trọng**: Đổi mật khẩu admin ngay sau khi deploy!

## 📁 Cấu trúc thư mục
```
├── public/
│   ├── index.html      # Trang chính
│   ├── login.html      # Trang đăng nhập
│   ├── app.js          # JavaScript frontend
│   └── styles.css      # CSS styles
├── data/
│   └── database.sqlite # SQLite database (tự tạo)
├── server-sqlite.js    # Server chính
├── package.json        # Dependencies
└── README.md           # File này
```

## 🛡️ Bảo mật
- ✅ HTTPS tự động (Render.com)
- ✅ Mật khẩu mã hóa bcrypt
- ✅ Rate limiting chống brute-force
- ✅ Helmet security headers
- ✅ HTTP-only session cookies

## 💻 Chạy local
```bash
npm install
npm run dev
```

Truy cập: http://localhost:3000

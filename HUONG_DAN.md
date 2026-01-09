# Hướng dẫn cài đặt và sử dụng

## 📋 Yêu cầu hệ thống
- **Windows** với SQL Server Express đã cài đặt
- **Node.js** (phiên bản 14 trở lên) - [Tải tại đây](https://nodejs.org/)
- Quyền truy cập SQL Server (Windows Authentication)

---

## 🚀 Bước 1: Cài đặt Node.js
1. Tải và cài đặt Node.js từ https://nodejs.org/
2. Mở PowerShell và kiểm tra:
   ```powershell
   node --version
   npm --version
   ```

---

## 🗄️ Bước 2: Tạo Database trong SQL Server

### Cách 1: Dùng SQL Server Management Studio (SSMS)
1. Mở SSMS và kết nối đến server: `MSI\SQLEXPRESS`
2. Mở file `database\setup.sql`
3. Nhấn **Execute** (F5) để chạy script

### Cách 2: Dùng dòng lệnh
```powershell
sqlcmd -S MSI\SQLEXPRESS -E -i "d:\WEB ANH PHU THANH\database\setup.sql"
```

**Lưu ý**: Script sẽ tạo database `AccountManager` và bảng `accounts` cùng 2 dòng dữ liệu mẫu.

---

## 📦 Bước 3: Cài đặt dependencies

Mở PowerShell tại thư mục `d:\WEB ANH PHU THANH` và chạy:

```powershell
cd "d:\WEB ANH PHU THANH"
npm install
```

Lệnh này sẽ cài đặt:
- `express` - Web framework
- `mssql` - SQL Server connector
- `cors` - Cross-origin resource sharing

---

## ▶️ Bước 4: Chạy ứng dụng

```powershell
npm start
```

Hoặc để tự động reload khi code thay đổi:
```powershell
npm run dev
```

Khi thấy thông báo:
```
✓ Kết nối SQL Server thành công!
✓ Server đang chạy tại http://localhost:3000
```

---

## 🌐 Bước 5: Mở trình duyệt

Truy cập: **http://localhost:3000**

---

## 📚 Hướng dẫn sử dụng

### 1️⃣ Thêm tài khoản mới
- Nhấn nút **➕ Thêm tài khoản** ở góc trên phải
- Điền thông tin (các trường có dấu * là bắt buộc)
- Nhấn **Lưu**

### 2️⃣ Xem theo nhóm
- Sidebar bên trái: chọn **Tất cả**, **ChatGPT**, hoặc **Veo 3**

### 3️⃣ Tìm kiếm & lọc
- Ô tìm kiếm: nhập mã, tài khoản, tên KH, hoặc TK bảo hành
- Dropdown: lọc theo trạng thái bán và bảo hành

### 4️⃣ Chỉnh sửa nhanh
- Nhấn nút **Đã bán/Chưa bán** để chuyển trạng thái
- Nhấn nút **Đã BH/Chưa BH** để chuyển trạng thái bảo hành

### 5️⃣ Sửa & Xóa
- Nút ✏️: Sửa thông tin chi tiết
- Nút 🗑️: Xóa tài khoản (có xác nhận)

### 6️⃣ Sao lưu & Nhập dữ liệu
- **📥 Export**: Tải file JSON về máy
- **📤 Import**: Nhập dữ liệu từ file JSON

---

## ⚙️ Cấu hình nâng cao

### Thay đổi port server
Mở file `server.js`, dòng 6:
```javascript
const PORT = 3000; // Đổi thành port khác
```

### Thay đổi thông tin kết nối SQL
Mở file `server.js`, dòng 14-28, chỉnh sửa:
```javascript
const config = {
    server: 'TÊN_SERVER\\INSTANCE',  // Ví dụ: MSI\SQLEXPRESS
    database: 'TÊN_DATABASE',
    ...
};
```

---

## 🛠️ Xử lý lỗi thường gặp

### Lỗi: "Cannot find module 'express'"
```powershell
npm install
```

### Lỗi: "Login failed for user"
- Kiểm tra SQL Server đang chạy
- Đảm bảo Windows Authentication được bật
- Kiểm tra quyền truy cập database

### Lỗi: "ECONNREFUSED"
- Kiểm tra tên server trong `server.js`
- Đảm bảo SQL Server đang chạy
- Kiểm tra firewall

### Lỗi kết nối database
1. Mở **SQL Server Configuration Manager**
2. Đảm bảo **SQL Server** service đang chạy
3. Kiểm tra **TCP/IP** đã được enable

---

## 📝 Cấu trúc dữ liệu

### Bảng `accounts`
| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | NVARCHAR(50) | ID duy nhất |
| category | NVARCHAR(20) | chatgpt hoặc veo3 |
| code | NVARCHAR(50) | Mã tài khoản |
| username | NVARCHAR(255) | Tài khoản đăng nhập |
| password | NVARCHAR(255) | Mật khẩu |
| customerName | NVARCHAR(255) | Tên khách hàng |
| soldStatus | NVARCHAR(20) | unsold hoặc sold |
| warrantyStatus | NVARCHAR(20) | no hoặc yes |
| warrantyAccount | NVARCHAR(255) | Tài khoản bảo hành |
| note | NVARCHAR(MAX) | Ghi chú |
| createdAt | BIGINT | Thời gian tạo (Unix ms) |
| updatedAt | BIGINT | Thời gian cập nhật |

---

## 🔒 Bảo mật

⚠️ **Quan trọng**:
- Dữ liệu mật khẩu được lưu **không mã hóa** trong database
- Chỉ nên dùng trong môi trường **nội bộ** hoặc **offline**
- Không public server ra Internet
- Nếu cần bảo mật cao hơn, cân nhắc:
  - Mã hóa mật khẩu (bcrypt, AES)
  - Thêm xác thực người dùng
  - HTTPS cho kết nối

---

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra SQL Server đang chạy
2. Kiểm tra Node.js đã cài đúng
3. Xem log lỗi trong PowerShell
4. Đảm bảo database đã được tạo bằng script `setup.sql`

---

## 📄 License
MIT License - Tự do sử dụng và chỉnh sửa

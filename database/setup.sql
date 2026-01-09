-- Tạo database quản lý tài khoản
USE master;
GO

-- Xóa database cũ nếu tồn tại (cẩn thận với lệnh này!)
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'AccountManager')
BEGIN
    ALTER DATABASE AccountManager SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE AccountManager;
END
GO

-- Tạo database mới
CREATE DATABASE AccountManager;
GO

USE AccountManager;
GO

-- Tạo bảng accounts
CREATE TABLE accounts (
    id NVARCHAR(50) PRIMARY KEY,
    category NVARCHAR(20) NOT NULL CHECK (category IN ('chatgpt', 'veo3')),
    code NVARCHAR(50),
    username NVARCHAR(255) NOT NULL,
    password NVARCHAR(255) NOT NULL,
    customerName NVARCHAR(255),
    soldStatus NVARCHAR(20) NOT NULL DEFAULT 'unsold' CHECK (soldStatus IN ('unsold', 'sold')),
    warrantyStatus NVARCHAR(20) NOT NULL DEFAULT 'no' CHECK (warrantyStatus IN ('no', 'yes')),
    warrantyAccount NVARCHAR(255),
    note NVARCHAR(MAX),
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL
);
GO

-- Tạo index cho tìm kiếm nhanh
CREATE INDEX idx_category ON accounts(category);
CREATE INDEX idx_soldStatus ON accounts(soldStatus);
CREATE INDEX idx_warrantyStatus ON accounts(warrantyStatus);
CREATE INDEX idx_username ON accounts(username);
CREATE INDEX idx_customerName ON accounts(customerName);
GO

-- Thêm dữ liệu mẫu (có thể xóa nếu không cần)
INSERT INTO accounts (id, category, code, username, password, customerName, soldStatus, warrantyStatus, warrantyAccount, note, createdAt, updatedAt)
VALUES 
    ('sample-cg-001', 'chatgpt', 'CG-001', 'demo@chatgpt.com', 'password123', NULL, 'unsold', 'no', NULL, 'Tài khoản demo ChatGPT', DATEDIFF_BIG(ms, '1970-01-01', GETUTCDATE()), DATEDIFF_BIG(ms, '1970-01-01', GETUTCDATE())),
    ('sample-veo-001', 'veo3', 'VEO-001', 'demo@veo3.com', 'password456', 'Nguyễn Văn A', 'sold', 'yes', 'warranty@veo3.com', 'Tài khoản demo Veo 3', DATEDIFF_BIG(ms, '1970-01-01', GETUTCDATE()), DATEDIFF_BIG(ms, '1970-01-01', GETUTCDATE()));
GO

-- Kiểm tra dữ liệu
SELECT * FROM accounts;
GO

PRINT 'Database và bảng đã được tạo thành công!';
GO

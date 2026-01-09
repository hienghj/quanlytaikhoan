USE AccountManager;
GO

-- Tạo bảng users
CREATE TABLE users (
    id INT PRIMARY KEY IDENTITY(1,1),
    username NVARCHAR(50) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    fullName NVARCHAR(100),
    role NVARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    isActive BIT DEFAULT 1,
    createdAt DATETIME DEFAULT GETDATE(),
    updatedAt DATETIME DEFAULT GETDATE()
);
GO

-- Tạo tài khoản admin mặc định (username: admin, password: admin123)
INSERT INTO users (username, password, fullName, role) 
VALUES ('admin', 'admin123', N'Quản trị viên', 'admin');
GO

SELECT * FROM users;
GO

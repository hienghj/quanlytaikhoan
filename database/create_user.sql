-- Tạo SQL Login và User cho ứng dụng
USE master;
GO

-- Tạo login với SQL Authentication
CREATE LOGIN appuser WITH PASSWORD = 'App@12345';
GO

-- Chuyển sang database AccountManager
USE AccountManager;
GO

-- Tạo user trong database
CREATE USER appuser FOR LOGIN appuser;
GO

-- Gán quyền đầy đủ cho user
ALTER ROLE db_owner ADD MEMBER appuser;
GO

PRINT 'Đã tạo user appuser thành công!';
PRINT 'Username: appuser';
PRINT 'Password: App@12345';
GO

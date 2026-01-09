-- Thêm cột warrantyPassword vào bảng accounts
USE AccountManager;
GO

ALTER TABLE accounts
ADD warrantyPassword NVARCHAR(255);
GO

PRINT 'Đã thêm cột warrantyPassword thành công!';
GO

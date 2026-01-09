-- Thêm cột expiryDate và warrantyExpiryDate vào bảng accounts
USE AccountManager;
GO

ALTER TABLE accounts
ADD expiryDate BIGINT;
GO

ALTER TABLE accounts
ADD warrantyExpiryDate BIGINT;
GO

PRINT 'Đã thêm cột expiryDate và warrantyExpiryDate thành công!';
GO

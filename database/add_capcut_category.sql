-- Add capcut to category check constraint
USE AccountManager;
GO

-- Drop old constraint
ALTER TABLE accounts
DROP CONSTRAINT CK__accounts__catego__37A5467C;
GO

-- Add new constraint with capcut
ALTER TABLE accounts
ADD CONSTRAINT CK_accounts_category 
CHECK (category IN ('chatgpt', 'veo3', 'capcut'));
GO

PRINT 'Đã thêm capcut vào category constraint thành công!';

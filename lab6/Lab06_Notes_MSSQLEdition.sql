-- Lab06_Notes_MSSQLEdition.sql
SET NOCOUNT ON;

IF DB_ID(N'TI_Lab') IS NULL CREATE DATABASE TI_Lab;
GO

USE TI_Lab;
GO

IF OBJECT_ID('dbo.Notes', 'U') IS NOT NULL DROP TABLE dbo.Notes;
GO

CREATE TABLE dbo.Notes (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(200) NOT NULL,
  Body NVARCHAR(MAX) NOT NULL,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Notes_CreatedAt DEFAULT (SYSUTCDATETIME())
);
GO

INSERT dbo.Notes(Title, Body) VALUES
(N'Pierwsza notatka', N'To jest treść pierwszej notatki'),
(N'Druga notatka', N'Treść drugiej notatki');
GO

/* Lab05_Kanban_MSSQLEdition.sql
   Kanban – schema + seed + constraints
*/

IF DB_ID(N'TI_Lab') IS NULL CREATE DATABASE TI_Lab;
GO

USE TI_Lab;
GO

IF OBJECT_ID('dbo.Tasks', 'U') IS NOT NULL DROP TABLE dbo.Tasks;
GO

IF OBJECT_ID('dbo.Columns', 'U') IS NOT NULL DROP TABLE dbo.Columns;
GO

CREATE TABLE dbo.Columns (
  Id   INT IDENTITY(1,1) PRIMARY KEY,
  Name NVARCHAR(50) NOT NULL,
  Ord  INT NOT NULL
);
GO

CREATE TABLE dbo.Tasks (
  Id    INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(200) NOT NULL,
  ColId INT NOT NULL CONSTRAINT FK_Tasks_Columns FOREIGN KEY REFERENCES dbo.Columns(Id) ON DELETE CASCADE,
  Ord   INT NOT NULL
);
GO

CREATE UNIQUE INDEX UX_Tasks_Col_Ord ON dbo.Tasks(ColId, Ord);
GO

INSERT dbo.Columns(Name, Ord) VALUES (N'Todo',1),(N'Doing',2),(N'Done',3);
GO

INSERT dbo.Tasks(Title, ColId, Ord) VALUES 
  (N'Setup project',1,1),
  (N'Write docs',1,2),
  (N'Release',3,1);
GO

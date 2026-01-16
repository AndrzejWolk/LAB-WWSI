/* Lab07_Library_MSSQLEdition.sql
   Wypożyczalnia książek – schema + seed + testy
*/
SET NOCOUNT ON;

-- Create DB if needed (optional)
-- IF DB_ID(N'TI_Lab') IS NULL CREATE DATABASE TI_Lab;
-- USE TI_Lab;
-- GO

/* Drop (idempotent) */
IF OBJECT_ID('dbo.Note', 'U') IS NOT NULL DROP TABLE dbo.Note; -- safety if user reuses DB
IF OBJECT_ID('dbo.Loans', 'U') IS NOT NULL DROP TABLE dbo.Loans;
IF OBJECT_ID('dbo.Books', 'U') IS NOT NULL DROP TABLE dbo.Books;
IF OBJECT_ID('dbo.Members', 'U') IS NOT NULL DROP TABLE dbo.Members;

CREATE TABLE dbo.Members (
  Id    INT IDENTITY(1,1) PRIMARY KEY,
  Name  NVARCHAR(100) NOT NULL,
  Email NVARCHAR(200) NOT NULL UNIQUE
);

CREATE TABLE dbo.Books (
  Id     INT IDENTITY(1,1) PRIMARY KEY,
  Title  NVARCHAR(200) NOT NULL,
  Author NVARCHAR(120) NOT NULL,
  Copies INT NOT NULL CONSTRAINT CK_Books_Copies CHECK (Copies >= 0)
);

CREATE TABLE dbo.Loans (
  Id         INT IDENTITY(1,1) PRIMARY KEY,
  MemberId   INT NOT NULL CONSTRAINT FK_Loans_Members FOREIGN KEY REFERENCES dbo.Members(Id) ON DELETE CASCADE,
  BookId     INT NOT NULL CONSTRAINT FK_Loans_Books   FOREIGN KEY REFERENCES dbo.Books(Id)   ON DELETE CASCADE,
  LoanDate   DATETIME2(0) NOT NULL CONSTRAINT DF_Loans_LoanDate DEFAULT (SYSUTCDATETIME()),
  DueDate    DATETIME2(0) NOT NULL,
  ReturnDate DATETIME2(0) NULL
);

CREATE INDEX IX_Loans_Member ON dbo.Loans(MemberId);
CREATE INDEX IX_Loans_Book   ON dbo.Loans(BookId) INCLUDE(ReturnDate);

-- Seed
INSERT dbo.Members(Name, Email) VALUES
(N'Ala Kowalska', N'ala@example.com'),
(N'Jan Nowak',    N'jan@example.com');

INSERT dbo.Books(Title, Author, Copies) VALUES
(N'Clean Code',             N'R. Martin', 3),
(N'Domain-Driven Design',   N'E. Evans',  2),
(N'You Don''t Know JS',     N'K. Simpson',4);

-- Borrow helper: checks availability; returns 409 if no copies
-- Example transaction
DECLARE @MemberId INT = 1, @BookId INT = 1, @Days INT = 14;

BEGIN TRAN;
DECLARE @Active INT = (
    SELECT COUNT(*) FROM dbo.Loans WHERE BookId = @BookId AND ReturnDate IS NULL
);
DECLARE @Copies INT = (SELECT Copies FROM dbo.Books WHERE Id = @BookId);
IF @Active >= @Copies
BEGIN
    ROLLBACK TRAN;
    THROW 50001, 'No copies available', 1;
END

DECLARE @LoanDate DATETIME2(0) = SYSUTCDATETIME();
DECLARE @DueDate  DATETIME2(0) = DATEADD(DAY, @Days, @LoanDate);

INSERT dbo.Loans(MemberId, BookId, LoanDate, DueDate)
OUTPUT INSERTED.Id AS LoanId
VALUES(@MemberId, @BookId, @LoanDate, @DueDate);
COMMIT;

-- Return example
-- UPDATE dbo.Loans SET ReturnDate = SYSUTCDATETIME() WHERE Id = <LoanId>;
-- SELECT l.Id, m.Name, b.Title, l.LoanDate, l.DueDate, l.ReturnDate
-- FROM dbo.Loans AS l JOIN dbo.Members m ON m.Id=l.MemberId JOIN dbo.Books b ON b.Id=l.BookId
-- ORDER BY l.Id DESC;

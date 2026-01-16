/* Lab08_Shop_MSSQLEdition.sql
   Sklep – schema + seed + testy checkout
*/
IF DB_ID(N'TI_Lab') IS NULL CREATE DATABASE TI_Lab;USE TI_Lab;
SET NOCOUNT ON;

IF OBJECT_ID('dbo.OrderItems', 'U') IS NOT NULL DROP TABLE dbo.OrderItems;
IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Products', 'U') IS NOT NULL DROP TABLE dbo.Products;

CREATE TABLE dbo.Products (
  Id    INT IDENTITY(1,1) PRIMARY KEY,
  Name  NVARCHAR(120) NOT NULL,
  Price DECIMAL(12,2) NOT NULL CONSTRAINT CK_Products_Price CHECK (Price >= 0)
);

CREATE TABLE dbo.Orders (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE dbo.OrderItems (
  Id        INT IDENTITY(1,1) PRIMARY KEY,
  OrderId   INT NOT NULL CONSTRAINT FK_OrderItems_Orders   FOREIGN KEY REFERENCES dbo.Orders(Id)   ON DELETE CASCADE,
  ProductId INT NOT NULL CONSTRAINT FK_OrderItems_Products FOREIGN KEY REFERENCES dbo.Products(Id),
  Qty       INT NOT NULL CONSTRAINT CK_OrderItems_Qty CHECK (Qty > 0),
  Price     DECIMAL(12,2) NOT NULL
);

CREATE INDEX IX_OrderItems_Order ON dbo.OrderItems(OrderId) INCLUDE(Qty, Price);

-- Seed
INSERT dbo.Products(Name, Price) VALUES
(N'Klawiatura', 129.99), (N'Mysz', 79.90), (N'Monitor', 899.00);

-- Checkout demo
DECLARE @Cart TABLE(ProductId INT, Qty INT);
INSERT @Cart VALUES (1,2),(3,1);

BEGIN TRAN;
INSERT dbo.Orders DEFAULT VALUES;
DECLARE @Id INT = SCOPE_IDENTITY();  -- Zamiast OUTPUT, użyj SCOPE_IDENTITY()

INSERT dbo.OrderItems(OrderId, ProductId, Qty, Price)
SELECT @Id, p.Id, c.Qty, p.Price
FROM @Cart AS c
JOIN dbo.Products AS p ON p.Id = c.ProductId;

-- Total
SELECT OrderId = @Id, Total = SUM(Qty*Price) FROM dbo.OrderItems WHERE OrderId = @Id;
COMMIT;

/* Lab04_Movies_MSSQLEdition.sql
   Filmy i oceny – schema + seed + ranking view
*/

-- Utwórz bazę jeśli nie istnieje
IF DB_ID(N'TI_Lab') IS NULL CREATE DATABASE TI_Lab;
GO

USE TI_Lab;
GO

-- Usuń stare obiekty
IF OBJECT_ID('dbo.vMoviesRanking', 'V') IS NOT NULL DROP VIEW dbo.vMoviesRanking;
GO

USE TI_Lab;
GO

IF OBJECT_ID('dbo.Ratings', 'U') IS NOT NULL DROP TABLE dbo.Ratings;
GO

USE TI_Lab;
GO

IF OBJECT_ID('dbo.Movies', 'U') IS NOT NULL DROP TABLE dbo.Movies;
GO

USE TI_Lab;
GO

-- Utwórz tabelę Movies
CREATE TABLE dbo.Movies (
  Id    INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(200) NOT NULL,
  [Year] INT NOT NULL
);
GO

USE TI_Lab;
GO

-- Utwórz tabelę Ratings
CREATE TABLE dbo.Ratings (
  Id       INT IDENTITY(1,1) PRIMARY KEY,
  MovieId  INT NOT NULL CONSTRAINT FK_Ratings_Movies FOREIGN KEY REFERENCES dbo.Movies(Id) ON DELETE CASCADE,
  Score    INT NOT NULL CONSTRAINT CK_Ratings_Score CHECK (Score BETWEEN 1 AND 5)
);
GO

USE TI_Lab;
GO

-- Utwórz widok rankingowy (musi być pierwszą instrukcją w partii)
CREATE VIEW dbo.vMoviesRanking AS
SELECT m.Id, m.Title, m.[Year],
       CAST(AVG(CAST(r.Score AS DECIMAL(5,2))) AS DECIMAL(5,2)) AS AvgScore,
       COUNT(r.Id) AS Votes
FROM dbo.Movies m
LEFT JOIN dbo.Ratings r ON r.MovieId = m.Id
GROUP BY m.Id, m.Title, m.[Year];
GO

USE TI_Lab;
GO

-- Seed
INSERT dbo.Movies(Title,[Year]) VALUES (N'Inception',2010),(N'Matrix',1999),(N'Arrival',2016);
INSERT dbo.Ratings(MovieId,Score) VALUES (1,5),(1,4),(2,5),(3,4),(3,5);
GO

USE TI_Lab;
GO

-- Test widoku
SELECT * FROM dbo.vMoviesRanking ORDER BY AvgScore DESC, Votes DESC;
GO

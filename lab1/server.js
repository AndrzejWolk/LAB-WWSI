const express = require('express');
const morgan = require('morgan');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Konfiguracja połączenia z MSSQL
const config = {
  server: 'localhost',
  database: 'TI_Lab',
  user: 'SA',
  password: 'zaq1@WSX',
  options: {
  trustServerCertificate: true,
  },
};

// Middleware
app.use(cors());
app.use(morgan('combined')); // Loguje: metoda, URL, status, czas itp.
app.use(bodyParser.json());
app.use(express.static('public')); // Serwowanie frontendu

// Funkcja pomocnicza do łączenia z bazą
async function connectDB() {
  try {
    await sql.connect(config);
  } catch (err) {
    console.error('Błąd połączenia z bazą:', err);
  }
}

// Endpointy API

// GET /api/members - Lista członków
app.get('/api/members', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT Id, Name, Email FROM dbo.Members');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/members - Dodanie członka
app.post('/api/members', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('Name', sql.NVarChar, name)
      .input('Email', sql.NVarChar, email)
      .query('INSERT INTO dbo.Members (Name, Email) OUTPUT INSERTED.Id VALUES (@Name, @Email)');
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    if (err.number === 2627) res.status(409).json({ error: 'Email already exists' });
    else res.status(500).json({ error: err.message });
  }
});

// GET /api/books - Lista książek z dostępnymi kopiami
app.get('/api/books', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT b.Id, b.Title, b.Author, b.Copies, 
             (b.Copies - COUNT(l.Id)) AS Available
      FROM dbo.Books b
      LEFT JOIN dbo.Loans l ON l.BookId = b.Id AND l.ReturnDate IS NULL
      GROUP BY b.Id, b.Title, b.Author, b.Copies
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/books - Dodanie książki
app.post('/api/books', async (req, res) => {
  const { title, author, copies = 1 } = req.body;
  if (!title || !author || copies < 0) return res.status(400).json({ error: 'Invalid data' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('Title', sql.NVarChar, title)
      .input('Author', sql.NVarChar, author)
      .input('Copies', sql.Int, copies)
      .query('INSERT INTO dbo.Books (Title, Author, Copies) OUTPUT INSERTED.Id VALUES (@Title, @Author, @Copies)');
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/loans - Lista wypożyczeń (aktywne i zwrócone)
app.get('/api/loans', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT l.Id, m.Name AS MemberName, b.Title AS BookTitle, l.LoanDate, l.DueDate, l.ReturnDate
      FROM dbo.Loans l
      JOIN dbo.Members m ON m.Id = l.MemberId
      JOIN dbo.Books b ON b.Id = l.BookId
      ORDER BY l.Id DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/loans/borrow - Wypożyczenie książki
app.post('/api/loans/borrow', async (req, res) => {
  const { member_id, book_id, days = 14 } = req.body;
  if (!member_id || !book_id) return res.status(400).json({ error: 'Member and book required' });
  try {
    const pool = await sql.connect(config);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Sprawdź dostępność
    const activeResult = await transaction.request()
      .input('BookId', sql.Int, book_id)
      .query('SELECT COUNT(*) AS Active FROM dbo.Loans WHERE BookId = @BookId AND ReturnDate IS NULL');
    const copiesResult = await transaction.request()
      .input('BookId', sql.Int, book_id)
      .query('SELECT Copies FROM dbo.Books WHERE Id = @BookId');
    if (activeResult.recordset[0].Active >= copiesResult.recordset[0].Copies) {
      await transaction.rollback();
      return res.status(409).json({ error: 'No copies available' });
    }

    // Wypożycz
    const loanDate = new Date();
    const dueDate = new Date(loanDate);
    dueDate.setDate(dueDate.getDate() + days);
    const result = await transaction.request()
      .input('MemberId', sql.Int, member_id)
      .input('BookId', sql.Int, book_id)
      .input('LoanDate', sql.DateTime2, loanDate)
      .input('DueDate', sql.DateTime2, dueDate)
      .query('INSERT INTO dbo.Loans (MemberId, BookId, LoanDate, DueDate) OUTPUT INSERTED.Id VALUES (@MemberId, @BookId, @LoanDate, @DueDate)');
    await transaction.commit();
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/loans/return - Zwrot książki
app.post('/api/loans/return', async (req, res) => {
  const { loan_id } = req.body;
  if (!loan_id) return res.status(400).json({ error: 'Loan ID required' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('Id', sql.Int, loan_id)
      .input('ReturnDate', sql.DateTime2, new Date())
      .query('UPDATE dbo.Loans SET ReturnDate = @ReturnDate WHERE Id = @Id AND ReturnDate IS NULL');
    if (result.rowsAffected[0] === 0) return res.status(409).json({ error: 'Already returned or invalid loan' });
    res.status(200).json({ message: 'Returned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Uruchomienie serwera
app.listen(port, () => {
  console.log(`Serwer działa na http://localhost:${port}`);
  connectDB();
});

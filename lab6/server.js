const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const port = 3005;

const config = {
  server: 'localhost',
  database: 'TI_Lab',
  user: 'SA',
  password: 'zaq1@WSX',
  options: {
    trustServerCertificate: true,
  },
};

app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
app.use(express.static('public'));

async function connectDB() {
  try {
    await sql.connect(config);
  } catch (err) {
    console.error('Błąd połączenia z bazą:', err);
  }
}

// GET /api/notes — zwraca listę notatek
app.get('/api/notes', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .query('SELECT Id, Title, Body, CreatedAt FROM dbo.Notes ORDER BY CreatedAt DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notes — dodaje nową notatkę {title, body}
app.post('/api/notes', async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });

  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('Title', sql.NVarChar, title)
      .input('Body', sql.NVarChar, body)
      .query('INSERT INTO dbo.Notes (Title, Body) OUTPUT INSERTED.Id VALUES (@Title, @Body)');
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Serwer Notatek działa na http://localhost:${port}`);
  connectDB();
});

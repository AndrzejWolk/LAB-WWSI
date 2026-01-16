const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const app = express();
const port = 3002;

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
app.use(bodyParser.json());
app.use(morgan('combined'));
app.use(express.static('public'));

async function connectDB() {
  try {
    await sql.connect(config);
  } catch (err) {
    console.error('Błąd połączenia z bazą:', err);
  }
}

app.get('/api/posts', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT Id, Title, Body, CreatedAt FROM dbo.Posts ORDER BY CreatedAt DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts', async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('Title', sql.NVarChar, title)
      .input('Body', sql.NVarChar, body)
      .query('INSERT INTO dbo.Posts (Title, Body) OUTPUT INSERTED.Id VALUES (@Title, @Body)');
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/posts/:id/comments', async (req, res) => {
  const postId = parseInt(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Invalid Post ID' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('PostId', sql.Int, postId)
      .query('SELECT Id, Author, Body, CreatedAt FROM dbo.Comments WHERE PostId = @PostId AND Approved = 1 ORDER BY CreatedAt DESC');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts/:id/comments', async (req, res) => {
  const postId = parseInt(req.params.id);
  const { author, body } = req.body;
  if (!postId || !author || !body) return res.status(400).json({ error: 'PostId, author and body required' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('PostId', sql.Int, postId)
      .input('Author', sql.NVarChar, author)
      .input('Body', sql.NVarChar, body)
      .query('INSERT INTO dbo.Comments (PostId, Author, Body) OUTPUT INSERTED.Approved VALUES (@PostId, @Author, @Body)');
    res.status(201).json({ approved: result.recordset[0].Approved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comments/:id/approve', async (req, res) => {
  const commentId = parseInt(req.params.id);
  if (!commentId) return res.status(400).json({ error: 'Invalid Comment ID' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('Id', sql.Int, commentId)
      .query('UPDATE dbo.Comments SET Approved = 1 WHERE Id = @Id');
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Comment not found' });
    res.status(200).json({ message: 'Comment approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comments/pending', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT c.Id, c.PostId, c.Author, c.Body, c.CreatedAt, p.Title AS PostTitle
      FROM dbo.Comments c
      JOIN dbo.Posts p ON c.PostId = p.Id
      WHERE c.Approved = 0
      ORDER BY c.CreatedAt DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Serwer bloga działa na http://localhost:${port}`);
  connectDB();
});

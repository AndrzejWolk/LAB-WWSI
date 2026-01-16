const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const app = express();
const port = 3003;

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

app.get('/api/movies', async (req, res) => {
  const { year, limit } = req.query;
  let query = 'SELECT * FROM dbo.vMoviesRanking';
  const conditions = [];
  if (year) conditions.push(`[Year] = ${parseInt(year)}`);
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY AvgScore DESC, Votes DESC';
  if (limit) query += ` OFFSET 0 ROWS FETCH NEXT ${parseInt(limit)} ROWS ONLY`;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/movies', async (req, res) => {
  const { title, year } = req.body;
  if (!title || !year) return res.status(400).json({ error: 'Title and year required' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('Title', sql.NVarChar, title)
      .input('Year', sql.Int, year)
      .query('INSERT INTO dbo.Movies (Title, [Year]) OUTPUT INSERTED.Id VALUES (@Title, @Year)');
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ratings', async (req, res) => {
  const { movie_id, score } = req.body;
  if (!movie_id || score < 1 || score > 5) return res.status(400).json({ error: 'Movie ID and score 1-5 required' });
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('MovieId', sql.Int, movie_id)
      .input('Score', sql.Int, score)
      .query('INSERT INTO dbo.Ratings (MovieId, Score) OUTPUT INSERTED.Id VALUES (@MovieId, @Score)');
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Serwer filmów działa na http://localhost:${port}`);
  connectDB();
});

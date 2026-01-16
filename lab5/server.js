const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const app = express();
const port = 3004;

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
    console.error('DB connection error:', err);
  }
}

// Pobierz kolumny i zadania
app.get('/api/board', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const colsResult = await pool.request().query('SELECT Id, Name, Ord FROM dbo.Columns ORDER BY Ord');
    const tasksResult = await pool.request().query('SELECT Id, Title, ColId, Ord FROM dbo.Tasks ORDER BY Ord');
    res.json({ cols: colsResult.recordset, tasks: tasksResult.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dodaj zadanie
app.post('/api/tasks', async (req, res) => {
  const { title, col_id } = req.body;
  if (!title || !col_id) return res.status(400).json({ error: 'Title and col_id required' });
  try {
    const pool = await sql.connect(config);
    const maxOrdResult = await pool.request()
      .input('ColId', sql.Int, col_id)
      .query('SELECT ISNULL(MAX(Ord), 0) + 1 AS NextOrd FROM dbo.Tasks WHERE ColId = @ColId');
    const nextOrd = maxOrdResult.recordset[0].NextOrd;
    const result = await pool.request()
      .input('Title', sql.NVarChar, title)
      .input('ColId', sql.Int, col_id)
      .input('Ord', sql.Int, nextOrd)
      .query('INSERT INTO dbo.Tasks (Title, ColId, Ord) OUTPUT INSERTED.Id VALUES (@Title, @ColId, @Ord)');
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Przenieś zadanie między kolumnami
app.post('/api/tasks/:id/move', async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { col_id, ord } = req.body;
  if (!taskId || !col_id || ord === undefined) {
    return res.status(400).json({ error: 'Task ID, col_id and ord required' });
  }
  try {
    const pool = await sql.connect(config);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Pobierz obecne dane zadania
    const taskResult = await transaction.request()
      .input('Id', sql.Int, taskId)
      .query('SELECT ColId, Ord FROM dbo.Tasks WHERE Id = @Id');
    if (taskResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Task not found' });
    }
    const oldColId = taskResult.recordset[0].ColId;
    const oldOrd = taskResult.recordset[0].Ord;

    // Zmień tymczasowo Ord aby uniknąć konfliktu
    await transaction.request()
      .input('Id', sql.Int, taskId)
      .query('UPDATE dbo.Tasks SET Ord = 99999 WHERE Id = @Id');

    // Przesuń zadania w starej kolumnie aby wypełnić lukę
    await transaction.request()
      .input('OldColId', sql.Int, oldColId)
      .input('OldOrd', sql.Int, oldOrd)
      .query('UPDATE dbo.Tasks SET Ord = Ord - 1 WHERE ColId = @OldColId AND Ord > @OldOrd');

    // Zrób miejsce w nowej kolumnie
    await transaction.request()
      .input('NewColId', sql.Int, col_id)
      .input('NewOrd', sql.Int, ord)
      .query('UPDATE dbo.Tasks SET Ord = Ord + 1 WHERE ColId = @NewColId AND Ord >= @NewOrd');

    // Ustaw nową kolumnę i pozycję zadania
    await transaction.request()
      .input('Id', sql.Int, taskId)
      .input('NewColId', sql.Int, col_id)
      .input('NewOrd', sql.Int, ord)
      .query('UPDATE dbo.Tasks SET ColId = @NewColId, Ord = @NewOrd WHERE Id = @Id');

    await transaction.commit();
    res.status(200).json({ message: 'Task moved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Serwer Kanban działa na http://localhost:${port}`);
  connectDB();
});

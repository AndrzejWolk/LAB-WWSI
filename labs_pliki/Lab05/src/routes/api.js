import { Router } from 'express';
import { db, nextOrdInColumn, moveTask } from '../db.js';

const router = Router();

// GET /api/board -> { cols:[], tasks:[] }
router.get('/board', (req, res) => {
  const cols = db.prepare('SELECT id, name, ord FROM columns ORDER BY ord ASC').all();
  const tasks = db.prepare('SELECT id, title, col_id, ord FROM tasks ORDER BY col_id ASC, ord ASC').all();
  res.json({ cols, tasks });
});

// POST /api/tasks {title,col_id} -> 201 (ord = MAX+1 in column)
router.post('/tasks', (req, res) => {
  const { title, col_id } = req.body || {};
  const colId = parseInt(col_id);
  if (!title?.trim() || !Number.isFinite(colId)) return res.status(400).json({ message: 'Invalid title or col_id.' });
  const col = db.prepare('SELECT id FROM columns WHERE id = ?').get(colId);
  if (!col) return res.status(400).json({ message: 'Column not found.' });
  const ord = nextOrdInColumn(colId);
  const info = db.prepare('INSERT INTO tasks(title, col_id, ord) VALUES(?,?,?)').run(title.trim(), colId, ord);
  res.status(201).location(`/api/tasks/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid, title: title.trim(), col_id: colId, ord });
});

// POST /api/tasks/:id/move {col_id, ord} -> 200
router.post('/tasks/:id/move', (req, res) => {
  const id = parseInt(req.params.id);
  const { col_id, ord } = req.body || {};
  const colId = parseInt(col_id);
  const o = parseInt(ord);
  if (!Number.isFinite(id) || !Number.isFinite(colId) || !Number.isFinite(o)) return res.status(400).json({ message: 'Invalid id/col_id/ord.' });
  const col = db.prepare('SELECT id FROM columns WHERE id = ?').get(colId);
  if (!col) return res.status(400).json({ message: 'Column not found.' });
  try {
    const result = moveTask(id, colId, o);
    res.json({ id, ...result });
  } catch (e) {
    res.status(404).json({ message: 'Task not found.' });
  }
});

export default router;

import { Router } from 'express';
import { db, nextOrdInColumn, moveTask } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const cols = db.prepare('SELECT id, name, ord FROM columns ORDER BY ord ASC').all();
  const tasks = db.prepare('SELECT id, title, col_id, ord FROM tasks ORDER BY ord ASC').all();
  const grouped = Object.fromEntries(cols.map(c => [c.id, []]));
  for (const t of tasks) {
    if (!grouped[t.col_id]) grouped[t.col_id] = [];
    grouped[t.col_id].push(t);
  }
  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Kanban</title>
<link rel="stylesheet" href="/public/site.css"/></head>
<body>
<header><h1>Lab05 — Kanban</h1></header>
<section class="board">
  ${cols.map((c, idx) => `
  <div class="col">
    <h2>${escapeHtml(c.name)}</h2>
    <ul>
      ${(grouped[c.id]||[]).map(t => `
        <li>
          <span class="card">${escapeHtml(t.title)}</span>
          <form method="post" action="/tasks/${t.id}/moveRight" style="display:inline">
            <button ${idx===cols.length-1?'disabled':''}>→</button>
          </form>
        </li>
      `).join('')}
    </ul>
    <form method="post" action="/tasks/create">
      <input type="hidden" name="col_id" value="${c.id}"/>
      <input name="title" placeholder="Nowe zadanie" required/>
      <button>Dodaj</button>
    </form>
  </div>
  `).join('')}
</section>
</body></html>`);
});

router.post('/tasks/create', (req, res) => {
  const { title, col_id } = req.body || {};
  const colId = parseInt(col_id);
  if (title?.trim() && Number.isFinite(colId)) {
    const ord = nextOrdInColumn(colId);
    db.prepare('INSERT INTO tasks(title, col_id, ord) VALUES(?,?,?)').run(title.trim(), colId, ord);
  }
  res.redirect('/');
});

router.post('/tasks/:id/moveRight', (req, res) => {
  const id = parseInt(req.params.id);
  const task = db.prepare('SELECT id, col_id FROM tasks WHERE id = ?').get(id);
  if (!task) return res.redirect('/');
  const cols = db.prepare('SELECT id, ord FROM columns ORDER BY ord ASC').all();
  const idx = cols.findIndex(c => c.id === task.col_id);
  if (idx >= 0 && idx < cols.length - 1) {
    const newColId = cols[idx + 1].id;
    const ord = nextOrdInColumn(newColId);
    try { moveTask(id, newColId, ord); } catch {}
  }
  res.redirect('/');
});

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default router;

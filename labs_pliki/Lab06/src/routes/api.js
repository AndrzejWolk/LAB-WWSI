import { Router } from 'express';
import { db, nowISO, findOrCreateTags } from '../db.js';

const router = Router();

// GET /api/notes?q=&tag=
router.get('/notes', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const tag = (req.query.tag || '').toString().trim().toLowerCase();
  const params = [];
  let where = '';
  if (q) {
    where += (where ? ' AND ' : ' WHERE ') + '(n.title LIKE ? OR n.body LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (tag) {
    where += (where ? ' AND ' : ' WHERE ') + 'EXISTS (SELECT 1 FROM note_tags nt JOIN tags t ON t.id=nt.tag_id WHERE nt.note_id=n.id AND t.name = ?)';
    params.push(tag);
  }
  const rows = db.prepare(`
    SELECT n.id, n.title, n.body, n.created_at
    FROM notes n
    ${where}
    ORDER BY n.created_at DESC, n.id DESC
  `).all(...params);

  // attach tags
  const tagStmt = db.prepare('SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id = ? ORDER BY t.name');
  const items = rows.map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    created_at: r.created_at,
    tags: tagStmt.all(r.id).map(x => x.name)
  }));
  res.json(items);
});

// POST /api/notes {title, body}
router.post('/notes', (req, res) => {
  const { title, body } = req.body || {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ message: 'Invalid title or body.' });
  const info = db.prepare('INSERT INTO notes(title, body, created_at) VALUES(?,?,?)').run(title.trim(), body.trim(), nowISO());
  res.status(201).location(`/api/notes/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid, title: title.trim() });
});

// GET /api/tags
router.get('/tags', (req, res) => {
  const rows = db.prepare('SELECT id, name FROM tags ORDER BY name').all();
  res.json(rows);
});

// POST /api/notes/:id/tags {tags:["work","home"]}
router.post('/notes/:id/tags', (req, res) => {
  const id = parseInt(req.params.id);
  const { tags } = req.body || {};
  if (!Array.isArray(tags)) return res.status(400).json({ message: 'tags must be an array.' });
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(id);
  if (!note) return res.status(404).json({ message: 'Note not found.' });
  const tagIds = findOrCreateTags(tags);
  const ins = db.prepare('INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES(?,?)');
  const trx = db.transaction(() => {
    for (const tid of tagIds) ins.run(id, tid);
  });
  trx();
  res.json({ id, tags: db.prepare('SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id = ? ORDER BY t.name').all(id).map(x=>x.name) });
});

export default router;

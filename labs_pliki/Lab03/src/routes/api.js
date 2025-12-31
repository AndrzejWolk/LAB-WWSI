import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// -------- POSTS --------

// GET /api/posts
router.get('/posts', (req, res) => {
  const rows = db.prepare('SELECT id, title, body, created_at FROM posts ORDER BY id DESC').all();
  res.json(rows);
});

// POST /api/posts {title, body}
router.post('/posts', (req, res) => {
  const { title, body } = req.body || {};
  if (!title?.trim() || !body?.trim()) return res.status(400).json({ message: 'Invalid title or body.' });
  const now = new Date().toISOString();
  const info = db.prepare('INSERT INTO posts(title, body, created_at) VALUES(?,?,?)').run(title.trim(), body.trim(), now);
  res.status(201).location(`/api/posts/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid, title: title.trim(), body: body.trim(), created_at: now });
});

// -------- COMMENTS --------

// GET /api/posts/:id/comments (approved only, with pagination)
router.get('/posts/:id/comments', (req, res) => {
  const postId = parseInt(req.params.id);
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ message: 'Post not found.' });

  let page = Math.max(1, parseInt(req.query.page || '1'));
  let pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '10')));

  const total = db.prepare(`
    SELECT COUNT(*) AS c
    FROM comments
    WHERE post_id = ? AND approved = 1
  `).get(postId).c;

  const items = db.prepare(`
    SELECT id, author, body, created_at
    FROM comments
    WHERE post_id = ? AND approved = 1
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(postId, pageSize, (page - 1) * pageSize);

  res.json({ total, page, pageSize, items });
});

export default router;

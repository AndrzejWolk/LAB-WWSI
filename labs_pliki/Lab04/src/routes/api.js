import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// helper to compute ranking with optional filters/limit
function selectMovies({ year, limit } = {}) {
  const params = [];
  const where = year ? 'WHERE m.year = ?' : '';
  if (year) params.push(parseInt(year));
  const sql = `
    SELECT 
      m.id, m.title, m.year,
      ROUND(COALESCE(AVG(r.score), 0), 2) AS avg_score,
      COUNT(r.id) AS votes
    FROM movies m
    LEFT JOIN ratings r ON r.movie_id = m.id
    ${where}
    GROUP BY m.id
    ORDER BY avg_score DESC, votes DESC, m.title ASC
    ${limit ? 'LIMIT ?' : ''}
  `;
  if (limit) params.push(parseInt(limit));
  return db.prepare(sql).all(...params);
}

// GET /api/movies  (optional ?year=&limit= for bonus)
router.get('/movies', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
  const rows = selectMovies({ year, limit });
  res.json(rows);
});

// Bonus endpoint alias: /api/movies/top?limit=5&year=2014
router.get('/movies/top', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit) : 5;
  const rows = selectMovies({ year, limit });
  res.json(rows);
});

// POST /api/movies {title,year}
router.post('/movies', (req, res) => {
  const { title, year } = req.body || {};
  const y = parseInt(year);
  if (!title?.trim() || !Number.isFinite(y)) return res.status(400).json({ message: 'Invalid title or year.' });
  const info = db.prepare('INSERT INTO movies(title,year) VALUES(?,?)').run(title.trim(), y);
  res.status(201).location(`/api/movies/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid, title: title.trim(), year: y });
});

// POST /api/ratings {movie_id, score}
router.post('/ratings', (req, res) => {
  const { movie_id, score } = req.body || {};
  const mid = parseInt(movie_id);
  const s = parseInt(score);
  if (!Number.isFinite(mid) || !Number.isFinite(s) || s < 1 || s > 5) {
    return res.status(400).json({ message: 'Invalid movie_id or score (1..5).' });
  }
  const movie = db.prepare('SELECT id FROM movies WHERE id = ?').get(mid);
  if (!movie) return res.status(400).json({ message: 'Movie not found.' });
  const info = db.prepare('INSERT INTO ratings(movie_id,score) VALUES(?,?)').run(mid, s);
  res.status(201).location(`/api/ratings/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid });
});

export default router;

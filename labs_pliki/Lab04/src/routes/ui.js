import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

function getRanking(year) {
  const params = [];
  const where = year ? 'WHERE m.year = ?' : '';
  if (year) params.push(parseInt(year));
  const sql = `
    SELECT m.id, m.title, m.year,
           ROUND(COALESCE(AVG(r.score),0),2) AS avg_score,
           COUNT(r.id) AS votes
    FROM movies m
    LEFT JOIN ratings r ON r.movie_id = m.id
    ${where}
    GROUP BY m.id
    ORDER BY avg_score DESC, votes DESC, m.title ASC
  `;
  return db.prepare(sql).all(...params);
}

router.get('/', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year) : undefined;
  const rows = getRanking(year);

  // unique years for filter
  const years = db.prepare('SELECT DISTINCT year FROM movies ORDER BY year DESC').all().map(r => r.year);

  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Filmy</title>
<link rel="stylesheet" href="/public/site.css"/></head>
<body>
<header><h1>Lab04 — Filmy i oceny</h1></header>

<section>
<form method="get">
  <label>Rok:
    <select name="year">
      <option value="">(wszystkie)</option>
      ${years.map(y => `<option value="${y}" ${year===y?'selected':''}>${y}</option>`).join('')}
    </select>
  </label>
  <button>Filtruj</button>
</form>
</section>

<section class="grid">
  <div>
    <h2>Ranking</h2>
    <table><thead><tr><th>Tytuł</th><th>Rok</th><th>Średnia</th><th>Głosy</th><th>Oceń</th></tr></thead>
    <tbody>
      ${rows.map(m => `<tr>
        <td>${escapeHtml(m.title)}</td>
        <td>${m.year}</td>
        <td>${Number(m.avg_score).toFixed(2)}</td>
        <td>${m.votes}</td>
        <td>
          <form method="post" action="/rate">
            <input type="hidden" name="movie_id" value="${m.id}"/>
            <select name="score">
              ${[1,2,3,4,5].map(s=>`<option value="${s}">${s}</option>`).join('')}
            </select>
            <button>Wyślij</button>
          </form>
        </td>
      </tr>`).join('') || '<tr><td colspan="5"><i>Brak filmów</i></td></tr>'}
    </tbody></table>
  </div>

  <div>
    <h2>Dodaj film</h2>
    <form method="post" action="/movies/create">
      <p><label>Tytuł: <input name="title" required style="width:300px"/></label></p>
      <p><label>Rok: <input name="year" type="number" required min="1888" max="2100" value="${new Date().getFullYear()}"/></label></p>
      <button>Dodaj</button>
    </form>
  </div>
</section>
</body></html>`);
});

router.post('/movies/create', (req, res) => {
  const { title, year } = req.body || {};
  const y = parseInt(year);
  if (title?.trim() && Number.isFinite(y)) {
    db.prepare('INSERT INTO movies(title,year) VALUES(?,?)').run(title.trim(), y);
  }
  res.redirect('/');
});

router.post('/rate', (req, res) => {
  const { movie_id, score } = req.body || {};
  const mid = parseInt(movie_id);
  const s = parseInt(score);
  if (Number.isFinite(mid) && Number.isFinite(s) && s >= 1 && s <= 5) {
    db.prepare('INSERT INTO ratings(movie_id,score) VALUES(?,?)').run(mid, s);
  }
  res.redirect('back');
});

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default router;

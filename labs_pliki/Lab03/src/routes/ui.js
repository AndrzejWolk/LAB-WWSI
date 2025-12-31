
import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

/**
 * Pomocnicze: prosty escapowanie HTML
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Strona główna: lista postów
 */
router.get('/', (req, res) => {
  const posts = db.prepare('SELECT id, title, created_at FROM posts ORDER BY id DESC').all();
  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Blog</title>
/public/site.css</head>
<body>
<header><h1>Lab03 — Blog</h1>
<nav>/Posty</a> /newNowy post</a> /moderationModeracja</a></nav>
</header>
<section>
<table><thead><tr><th>Tytuł</th><th>Data</th><th>Akcja</th></tr></thead>
<tbody>
${posts.map(p=>`<tr>
  <td>${escapeHtml(p.title)}</td>
  <td>${new Date(p.created_at).toLocaleString()}</td>
  <td>/posts/${p.id}Komentarze</a></td>
</tr>`).join('')}
${posts.length===0?'<tr><td colspan="3"><i>Brak postów</i></td></tr>':''}
</tbody></table>
</section>
</body></html>`);
});

/**
 * Formularz: nowy post
 */
router.get('/new', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Nowy post</title>
/public/site.css</head>
<body>
<header><h1>Nowy post</h1><nav>/Posty</a> /moderationModeracja</a></nav></header>
<section>
/posts/create
  <p><label>Tytuł: <input name="title" required style="width:400px"/></label></p>
  <p><label>Treść:<br/><textarea name="body" rows="8" cols="80" required></textarea></label></p>
  <button>Dodaj</button>
</form>
</section>
</body></html>`);
});

router.post('/posts/create', (req, res) => {
  const { title, body } = req.body || {};
  if (title?.trim() && body?.trim()) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO posts(title,body,created_at) VALUES(?,?,?)').run(title.trim(), body.trim(), now);
  }
  res.redirect('/');
});

/**
 * Szczegóły posta + komentarze (tylko approved) + dodanie komentarza (trafia do moderacji)
 * BONUS: paginacja komentarzy via ?page=&pageSize=
 */
router.get('/posts/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!post) return res.status(404).send('Not found');

  // --- PAGINACJA KOMENTARZY (bonus) ---
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '10')));

  const total = db.prepare('SELECT COUNT(*) AS c FROM comments WHERE post_id=? AND approved=1').get(id).c;
  const comments = db.prepare(`
    SELECT id, author, body, created_at
    FROM comments
    WHERE post_id = ? AND approved = 1
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(id, pageSize, (page - 1) * pageSize);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const baseQS = (p) => `?page=${p}&pageSize=${pageSize}`;
  const prevLink = page > 1 ? `/posts/${id}${baseQS(page-1)}` : null;
  const nextLink = page < pages ? `/posts/${id}${baseQS(page+1)}` : null;

  const pendingCount = db.prepare('SELECT COUNT(*) AS c FROM comments WHERE post_id = ? AND approved = 0').get(id).c;

  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>${escapeHtml(post.title)}</title>
<link rel="e.css</head>
<body>
<header><h1>${escapeHtml(post.title)}</h1>
<nav>/Posty</a> /moderationModeracja (${pendingCount})</a></nav>
</header>

<article><pre>${escapeHtml(post.body)}</pre></article>

<section>
  <h2>Komentarze (zatwierdzone)</h2>
  <p><small>Łącznie: ${total}, strona ${page}/${pages}, pageSize=${pageSize}</small>
  ${prevLink ? `${prevLink}← Poprzednia</a>` : ''}
  ${nextLink ? `${nextLink}Następna →</a>` : ''}</p>
  <ul>
    ${
      comments.length
        ? comments.map(c => `<li><b>${escapeHtml(c.author)}</b> (${new Date(c.created_at).toLocaleString()}):<br/>${escapeHtml(c.body)}</li>`).join('')
        : '<i>Brak komentarzy na tej stronie</i>'
    }
  </ul>
</section>

<section>
  <h3>Dodaj komentarz (trafi do moderacji)</h3>
  <form method="post" action="/posts/${post.id}/comments/create${baser: <input name="author" required/></label></p>
    <p><label>Treść:<br/><textarea name="body" rows="5" cols="80" required></textarea></label></p>
    <button>Wyślij</button>
  </form>
</section>

</body></html>`);
});

/**
 * Dodanie komentarza (approved=0), redirect do posta (z zachowaniem paginacji)
 */
router.post('/posts/:id/comments/create', (req, res) => {
  const id = parseInt(req.params.id);
  const { author, body } = req.body || {};
  if (author?.trim() && body?.trim()) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO comments(post_id,author,body,created_at,approved) VALUES(?,?,?,?,0)')
      .run(id, author.trim(), body.trim(), now);
  }
  // zachowaj bieżące parametry paginacji w redirect (jeśli były)
  const page = req.query.page ? parseInt(req.query.page) : null;
  const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : null;
  const qs = [
    page ? `page=${page}` : null,
    pageSize ? `pageSize=${pageSize}` : null,
  ].filter(Boolean).join('&');
  res.redirect(`/posts/${id}${qs ? `?${qs}` : ''}`);
});

/**
 * Panel moderacji
 */
router.get('/moderation', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.post_id, p.title AS post_title, c.author, c.body, c.created_at
    FROM comments c JOIN posts p ON p.id = c.post_id
    WHERE c.approved = 0 ORDER BY c.id ASC
  `).all();

  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Moderacja</title>
/public/site.css</head>
<body>
<header><h1>Moderacja komentarzy</h1><nav>/Posty</a></nav></header>
<section>
<table><thead><tr><th>Post</th><th>Autor</th><th>Komentarz</th><th>Data</th><th>Akcja</th></tr></thead>
<tbody>
${
  rows.length
    ? rows.map(r => `<tr>
        <td>/posts/${r.post_id}${escapeHtml(r.post_title)}</a></td>
        <td>${escapeHtml(r.author)}</td>
        <td>${escapeHtml(r.body)}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td>
          /comments/${r.id}/approve
            <button>Zatwierdź</button>
          </form>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="5"><i>Brak oczekujących</i></td></tr>'
}
</tbody></table>
</section>
</body></html>`);
});

/**
 * Moderacja – zatwierdzenie komentarza (redirect do panelu)
 */
router.post('/comments/:id/approve', (req, res) => {
  const id = parseInt(req.params.id);
  db.prepare('UPDATE comments SET approved = 1 WHERE id = ?').run(id);
  res.redirect('/moderation');
});

export default router;


import { Router } from 'express';
import { db, nowISO, findOrCreateTags } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
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
  const notes = db.prepare(`
    SELECT n.id, n.title, n.body, n.created_at
    FROM notes n
    ${where}
    ORDER BY n.created_at DESC, n.id DESC
  `).all(...params);
  const tagStmt = db.prepare('SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id=t.id WHERE nt.note_id = ? ORDER BY t.name');
  const allTags = db.prepare('SELECT name FROM tags ORDER BY name').all().map(x=>x.name);

  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Notatki</title>
<link rel="stylesheet" href="/public/site.css"/></head>
<body>
<header><h1>Lab06 — Notatki, tagi i wyszukiwanie</h1></header>

<section>
<form method="get">
  <input name="q" placeholder="Szukaj..." value="${escapeHtml(q)}" style="width:320px"/>
  <select name="tag">
    <option value="">(wszystkie tagi)</option>
    ${allTags.map(t=>`<option value="${t}" ${tag===t?'selected':''}>${t}</option>`).join('')}
  </select>
  <button>Szukaj</button>
</form>
</section>

<section class="grid">
  <div>
    <h2>Wyniki</h2>
    <ul class="notes">
      ${notes.map(n=>{
        const snippet = makeSnippet(n.body, q);
        const tags = tagStmt.all(n.id).map(x=>x.name);
        return `<li>
          <h3>${escapeHtml(n.title)}</h3>
          <div class="meta">${new Date(n.created_at).toLocaleString()} • ${tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</div>
          <p>${snippet}</p>
          <form method="post" action="/notes/${n.id}/add-tags">
            <input name="tags" placeholder="tagi, np. work,idea"/>
            <button>Dodaj tagi</button>
          </form>
        </li>`;
      }).join('') || '<i>Brak wyników</i>'}
    </ul>
  </div>

  <div>
    <h2>Dodaj notatkę</h2>
    <form method="post" action="/notes/create">
      <p><label>Tytuł: <input name="title" required style="width:300px"/></label></p>
      <p><label>Treść:<br/><textarea name="body" rows="8" cols="60" required></textarea></label></p>
      <p><label>Tagi (opcjonalnie): <input name="tags" placeholder="np. work,home"/></label></p>
      <button>Dodaj</button>
    </form>
  </div>
</section>
</body></html>`);
});

router.post('/notes/create', (req, res) => {
  const { title, body, tags } = req.body || {};
  if (title?.trim() && body?.trim()) {
    const info = db.prepare('INSERT INTO notes(title, body, created_at) VALUES(?,?,?)').run(title.trim(), body.trim(), nowISO());
    const id = info.lastInsertRowid;
    const list = parseTags(tags);
    if (list.length) {
      const ids = findOrCreateTags(list);
      const ins = db.prepare('INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES(?,?)');
      const trx = db.transaction(()=>{
        for (const tid of ids) ins.run(id, tid);
      });
      trx();
    }
  }
  res.redirect('/');
});

router.post('/notes/:id/add-tags', (req, res) => {
  const id = parseInt(req.params.id);
  const { tags } = req.body || {};
  const list = parseTags(tags);
  if (Number.isFinite(id) && list.length) {
    const ids = findOrCreateTags(list);
    const ins = db.prepare('INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES(?,?)');
    const trx = db.transaction(()=>{
      for (const tid of ids) ins.run(id, tid);
    });
    trx();
  }
  res.redirect('/');
});

function parseTags(s) {
  if (!s) return [];
  return String(s).split(/[,\s]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeSnippet(text, q) {
  const t = String(text || '');
  if (!q) return escapeHtml(t.slice(0, 200)) + (t.length > 200 ? '…' : '');
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  const start = Math.max(0, i - 40);
  const end = Math.min(t.length, i >= 0 ? i + q.length + 40 : 160);
  let snippet = t.slice(start, end);
  if (i >= 0) {
    const before = escapeHtml(snippet.slice(0, i - start));
    const hit = `<mark>${escapeHtml(t.slice(i, i + q.length))}</mark>`;
    const after = escapeHtml(snippet.slice(i - start + q.length));
    snippet = before + hit + after;
  } else {
    snippet = escapeHtml(snippet);
  }
  if (start > 0) snippet = '…' + snippet;
  if (end < t.length) snippet = snippet + '…';
  return snippet;
}

export default router;

import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const author = (req.query.author || '').toString();
  const where = author ? 'WHERE author LIKE ?' : '';
  const params = author ? [`%${author}%`] : [];
  const books = db.prepare(
    `SELECT b.*, (b.copies - COALESCE((SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.return_date IS NULL),0)) AS available
     FROM books b ${where} ORDER BY b.title`
  ).all(...params);
  const members = db.prepare('SELECT id, name FROM members ORDER BY name').all();
  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Książki</title>
<link rel="stylesheet" href="/public/site.css"/></head>
<body>
<header><h1>Lab01 — Wypożyczalnia książek</h1>
<nav><a href="/">Książki</a> | <a href="/members">Czytelnicy</a> | <a href="/loans">Wypożyczenia</a></nav></header>
<section>
<form method="get">
  <label>Autor: <input name="author" value="${author}"/></label>
  <button>Filtruj</button>
</form>
<table><thead><tr><th>Tytuł</th><th>Autor</th><th>Egz.</th><th>Dostępne</th><th>Akcja</th></tr></thead>
<tbody>
${books.map(b=>`<tr>
  <td>${b.title}</td><td>${b.author}</td><td>${b.copies}</td><td>${b.available}</td>
  <td>
    <form method="post" action="/borrow">
      <input type="hidden" name="book_id" value="${b.id}"/>
      <label>Czytelnik: <select name="member_id">
        ${members.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}
      </select></label>
      <label>Dni: <input type="number" name="days" value="14" min="1" max="60"/></label>
      <button ${b.available<=0 ? 'disabled' : ''}>Wypożycz</button>
    </form>
  </td>
</tr>`).join('')}
</tbody></table>

<h3>Dodaj książkę</h3>
<form method="post" action="/books/create">
  <label>Tytuł: <input name="title" required/></label>
  <label>Autor: <input name="author" required/></label>
  <label>Egz.: <input type="number" name="copies" value="1" min="1" max="99"/></label>
  <button>Dodaj</button>
</form>
</section>
</body></html>`);
});

router.post('/books/create', (req, res) => {
  const { title, author, copies } = req.body || {};
  const c = Math.max(1, parseInt(copies || 1));
  db.prepare('INSERT INTO books(title,author,copies) VALUES(?,?,?)').run(String(title||'').trim(), String(author||'').trim(), c);
  res.redirect('/');
});

router.post('/borrow', (req, res) => {
  const { member_id, book_id, days } = req.body || {};
  // delegate to API logic via SQL
  const book = db.prepare('SELECT id, copies FROM books WHERE id = ?').get(parseInt(book_id));
  if (!book) return res.redirect('/');
  const active = db.prepare('SELECT COUNT(*) AS c FROM loans WHERE book_id = ? AND return_date IS NULL').get(book.id).c;
  if (active >= book.copies) return res.redirect('/');
  const today = new Date().toISOString().slice(0,10);
  const d = new Date(today+'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + (parseInt(days)||14));
  const due = d.toISOString().slice(0,10);
  db.prepare('INSERT INTO loans(member_id,book_id,loan_date,due_date) VALUES(?,?,?,?)').run(parseInt(member_id), book.id, today, due);
  res.redirect('/');
});

router.get('/members', (req, res) => {
  const rows = db.prepare('SELECT * FROM members ORDER BY name').all();
  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Czytelnicy</title><link rel="stylesheet" href="/public/site.css"/></head>
<body><header><h1>Czytelnicy</h1><nav><a href="/">Książki</a> | <a href="/members">Czytelnicy</a> | <a href="/loans">Wypożyczenia</a></nav></header>
<section>
<table><thead><tr><th>Imię i nazwisko</th><th>Email</th></tr></thead>
<tbody>${rows.map(r=>`<tr><td>${r.name}</td><td>${r.email}</td></tr>`).join('')}</tbody></table>
<h3>Dodaj czytelnika</h3>
<form method="post" action="/members/create">
  <label>Imię i nazwisko: <input name="name" required/></label>
  <label>Email: <input name="email" type="email" required/></label>
  <button>Dodaj</button>
</form>
</section></body></html>`);
});

router.post('/members/create', (req, res) => {
  const { name, email } = req.body || {};
  try {
    db.prepare('INSERT INTO members(name,email) VALUES(?,?)').run(String(name||'').trim(), String(email||'').trim());
  } catch {}
  res.redirect('/members');
});

router.get('/loans', (req, res) => {
  const loans = db.prepare(`
    SELECT l.id, m.name AS member, b.title AS book, l.loan_date, l.due_date, l.return_date
    FROM loans l JOIN members m ON m.id=l.member_id JOIN books b ON b.id=l.book_id
    ORDER BY l.id DESC
  `).all();
  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Wypożyczenia</title><link rel="stylesheet" href="/public/site.css"/></head>
<body><header><h1>Wypożyczenia</h1><nav><a href="/">Książki</a> | <a href="/members">Czytelnicy</a> | <a href="/loans">Wypożyczenia</a></nav></header>
<section>
<table><thead><tr><th>Czytelnik</th><th>Książka</th><th>Od</th><th>Do</th><th>Zwrot</th><th>Akcja</th></tr></thead>
<tbody>${loans.map(l=>`<tr>
  <td>${l.member}</td><td>${l.book}</td><td>${l.loan_date}</td><td>${l.due_date}</td><td>${l.return_date || '-'}</td>
  <td>${!l.return_date ? `<form method="post" action="/loans/return"><input type="hidden" name="loan_id" value="${l.id}"/><button>Zwróć</button></form>` : ''}</td>
</tr>`).join('')}</tbody></table>
</section></body></html>`);
});

router.post('/loans/return', (req, res) => {
  const { loan_id } = req.body || {};
  const loan = db.prepare('SELECT id, return_date FROM loans WHERE id = ?').get(parseInt(loan_id));
  if (loan && !loan.return_date) {
    const today = new Date().toISOString().slice(0,10);
    db.prepare('UPDATE loans SET return_date = ? WHERE id = ?').run(today, loan.id);
  }
  res.redirect('/loans');
});

export default router;

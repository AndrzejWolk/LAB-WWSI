import { Router } from 'express';
import { db, todayISO, addDaysISO } from '../db.js';

const router = Router();

// GET /api/members
router.get('/members', (req, res) => {
  const rows = db.prepare('SELECT id, name, email FROM members ORDER BY name').all();
  res.json(rows);
});

// POST /api/members {name,email}
router.post('/members', (req, res) => {
  const { name, email } = req.body || {};
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ message: 'Name and Email are required.' });
  try {
    const info = db.prepare('INSERT INTO members(name,email) VALUES(?,?)').run(name.trim(), email.trim());
    res.status(201).location(`/api/members/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid, name: name.trim(), email: email.trim() });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ message: 'Email already exists.' });
    throw e;
  }
});

// GET /api/books?author=&page=&pageSize=
router.get('/books', (req, res) => {
  const author = (req.query.author || '').toString();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

  const where = author ? 'WHERE author LIKE ?' : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM books ${where}`).get(author ? `%${author}%` : undefined).c;
  const items = db.prepare(
    `SELECT b.id, b.title, b.author, b.copies,
            (b.copies - COALESCE((SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.return_date IS NULL),0)) AS available
     FROM books b ${where}
     ORDER BY b.title
     LIMIT ? OFFSET ?`
  ).all(...(author ? [`%${author}%`, pageSize, (page-1)*pageSize] : [pageSize, (page-1)*pageSize]));
  res.json({ total, page, pageSize, items });
});

// POST /api/books
router.post('/books', (req, res) => {
  let { title, author, copies } = req.body || {};
  if (!title?.trim() || !author?.trim()) return res.status(400).json({ message: 'Title and Author are required.' });
  copies = parseInt(copies || 1);
  if (!Number.isFinite(copies) || copies < 1) copies = 1;
  const info = db.prepare('INSERT INTO books(title,author,copies) VALUES(?,?,?)').run(title.trim(), author.trim(), copies);
  res.status(201).location(`/api/books/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid, title: title.trim(), author: author.trim(), copies });
});

// GET /api/loans — list joined
router.get('/loans', (req, res) => {
  const rows = db.prepare(`
    SELECT l.id,
           m.id AS memberId, m.name AS memberName, m.email AS memberEmail,
           b.id AS bookId, b.title AS bookTitle, b.author AS bookAuthor,
           l.loan_date AS loanDate, l.due_date AS dueDate, l.return_date AS returnDate
    FROM loans l
    JOIN members m ON m.id = l.member_id
    JOIN books b ON b.id = l.book_id
    ORDER BY l.id DESC
  `).all();
  res.json(rows.map(r => ({
    id: r.id,
    member: { id: r.memberId, name: r.memberName, email: r.memberEmail },
    book: { id: r.bookId, title: r.bookTitle, author: r.bookAuthor },
    loan_date: r.loanDate,
    due_date: r.dueDate,
    return_date: r.returnDate
  })));
});

// POST /api/loans/borrow {member_id, book_id, days?}
router.post('/loans/borrow', (req, res) => {
  const { member_id, book_id, days } = req.body || {};
  const memberId = parseInt(member_id);
  const bookId = parseInt(book_id);
  const loanDays = Number.isFinite(parseInt(days)) && parseInt(days) > 0 ? parseInt(days) : 14;

  const member = db.prepare('SELECT id FROM members WHERE id = ?').get(memberId);
  const book = db.prepare('SELECT id, copies FROM books WHERE id = ?').get(bookId);
  if (!member || !book) return res.status(400).json({ message: 'Invalid member_id or book_id.' });

  // availability check
  const activeCount = db.prepare('SELECT COUNT(*) AS c FROM loans WHERE book_id = ? AND return_date IS NULL').get(bookId).c;
  if (activeCount >= book.copies) return res.status(409).json({ message: 'No copies available.' });

  const loanDate = todayISO();
  const dueDate = addDaysISO(loanDate, loanDays);
  const info = db.prepare('INSERT INTO loans(member_id,book_id,loan_date,due_date,return_date) VALUES(?,?,?,?,NULL)').run(memberId, bookId, loanDate, dueDate);
  res.status(201).location(`/api/loans/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid, member_id: memberId, book_id: bookId, loan_date: loanDate, due_date: dueDate, return_date: null });
});

// POST /api/loans/return {loan_id}
router.post('/loans/return', (req, res) => {
  const { loan_id } = req.body || {};
  const id = parseInt(loan_id);
  const loan = db.prepare('SELECT id, return_date FROM loans WHERE id = ?').get(id);
  if (!loan) return res.status(404).json({ message: 'Loan not found.' });
  if (loan.return_date) return res.status(409).json({ message: 'Loan already returned.' });
  db.prepare('UPDATE loans SET return_date = ? WHERE id = ?').run(todayISO(), id);
  res.json({ message: 'Returned.' });
});

// BONUS: overdue
router.get('/loans/overdue', (req, res) => {
  const today = todayISO();
  const rows = db.prepare(`
    SELECT l.id, m.name AS member, b.title AS book, l.loan_date, l.due_date
    FROM loans l
    JOIN members m ON m.id = l.member_id
    JOIN books b ON b.id = l.book_id
    WHERE l.return_date IS NULL AND l.due_date < ?
    ORDER BY l.due_date ASC
  `).all(today);
  // compute days late
  const parse = s => new Date(s + 'T00:00:00Z');
  const out = rows.map(r => ({
    id: r.id, member: r.member, book: r.book, loan_date: r.loan_date, due_date: r.due_date,
    days_late: Math.floor((parse(today) - parse(r.due_date)) / (1000*60*60*24))
  }));
  res.json(out);
});

export default router;

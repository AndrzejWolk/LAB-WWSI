import Database from 'better-sqlite3';
import fs from 'fs';
const DB_FILE = process.env.DB_FILE || 'library.db';

export let db;

export async function initDb() {
  const firstTime = !fs.existsSync(DB_FILE);
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      copies INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1)
    );
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      loan_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      return_date TEXT NULL
    );
  `);

  if (firstTime) {
    seed();
  }
}

function seed() {
  const insertMember = db.prepare('INSERT INTO members(name,email) VALUES(?,?)');
  const insertBook = db.prepare('INSERT INTO books(title,author,copies) VALUES(?,?,?)');
  const trx = db.transaction(() => {
    insertMember.run('Ala Kowalska','ala@example.com');
    insertMember.run('Jan Nowak','jan@example.com');
    insertBook.run('Clean Code','Robert C. Martin',2);
    insertBook.run('CLR via C#','Jeffrey Richter',1);
    insertBook.run('DDIA','Martin Kleppmann',3);
  });
  trx();
}

// helpers
export function todayISO() {
  return new Date().toISOString().slice(0,10);
}
export function addDaysISO(startISO, days) {
  const d = new Date(startISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

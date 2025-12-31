import Database from 'better-sqlite3';
import fs from 'fs';
const DB_FILE = process.env.DB_FILE || 'blog.db';

export let db;

export async function initDb() {
  const firstTime = !fs.existsSync(DB_FILE);
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0
    );
  `);
  if (firstTime) seed();
}

function seed() {
  const now = new Date().toISOString();
  const insPost = db.prepare('INSERT INTO posts(title, body, created_at) VALUES(?,?,?)');
  const insComment = db.prepare('INSERT INTO comments(post_id, author, body, created_at, approved) VALUES(?,?,?,?,?)');
  const trx = db.transaction(() => {
    const p1 = insPost.run('Witaj na Blogu', 'To pierwszy wpis testowy.', now).lastInsertRowid;
    const p2 = insPost.run('Drugi wpis', 'Jeszcze trochę treści do testów.', now).lastInsertRowid;
    insComment.run(p1, 'Ala', 'Fajny post!', now, 1);
    insComment.run(p1, 'Jan', 'Proponuję dodać paginację.', now, 0); // pending
    insComment.run(p2, 'Ola', 'Czekam na więcej.', now, 1);
  });
  trx();
}

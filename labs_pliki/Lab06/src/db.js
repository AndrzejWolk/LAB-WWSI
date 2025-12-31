import Database from 'better-sqlite3';
import fs from 'fs';
const DB_FILE = process.env.DB_FILE || 'notes.db';

export let db;

export async function initDb() {
  const firstTime = !fs.existsSync(DB_FILE);
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS ix_notes_created ON notes(created_at DESC);
    CREATE INDEX IF NOT EXISTS ix_tags_name ON tags(name);
    CREATE INDEX IF NOT EXISTS ix_note_tags_note ON note_tags(note_id);
  `);
  if (firstTime) seed();
}

function seed() {
  const now = new Date().toISOString();
  const insNote = db.prepare('INSERT INTO notes(title, body, created_at) VALUES(?,?,?)');
  const insTag = db.prepare('INSERT OR IGNORE INTO tags(name) VALUES(?)');
  const insLink = db.prepare('INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES(?,?)');
  const trx = db.transaction(() => {
    const n1 = insNote.run('Plan tygodnia', 'Poniedziałek: zajęcia; Środa: laby; Piątek: publikacje.', now).lastInsertRowid;
    const n2 = insNote.run('Pomysły na projekt', 'Aplikacja Node.js z SQLite i prostym API.', now).lastInsertRowid;
    const n3 = insNote.run('Lista zakupów', 'Kawa, mleko, płatki owsiane.', now).lastInsertRowid;
    const tWork = insTag.run('work').lastInsertRowid;
    const tHome = insTag.run('home').lastInsertRowid;
    const tIdeas = insTag.run('ideas').lastInsertRowid;
    insLink.run(n1, tWork);
    insLink.run(n2, tIdeas);
    insLink.run(n3, tHome);
  });
  trx();
}

// helpers
export function nowISO() {
  return new Date().toISOString();
}

export function findOrCreateTags(names) {
  const out = [];
  const ins = db.prepare('INSERT OR IGNORE INTO tags(name) VALUES(?)');
  const sel = db.prepare('SELECT id FROM tags WHERE name = ?');
  for (const raw of names) {
    const n = String(raw || '').trim().toLowerCase();
    if (!n) continue;
    ins.run(n);
    out.push(sel.get(n).id);
  }
  return Array.from(new Set(out));
}

import Database from 'better-sqlite3';
import fs from 'fs';
const DB_FILE = process.env.DB_FILE || 'movies.db';

export let db;

export async function initDb() {
  const firstTime = !fs.existsSync(DB_FILE);
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      year INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5)
    );
  `);
  if (firstTime) seed();
}

function seed() {
  const insMovie = db.prepare('INSERT INTO movies(title,year) VALUES(?,?)');
  const insRate = db.prepare('INSERT INTO ratings(movie_id,score) VALUES(?,?)');
  const trx = db.transaction(() => {
    const m1 = insMovie.run('The Matrix', 1999).lastInsertRowid;
    const m2 = insMovie.run('Inception', 2010).lastInsertRowid;
    const m3 = insMovie.run('Interstellar', 2014).lastInsertRowid;
    const m4 = insMovie.run('Blade Runner 2049', 2017).lastInsertRowid;
    // some ratings
    insRate.run(m1, 5); insRate.run(m1, 4); insRate.run(m1, 5);
    insRate.run(m2, 5); insRate.run(m2, 4);
    insRate.run(m3, 5); insRate.run(m3, 5); insRate.run(m3, 4);
    insRate.run(m4, 4);
  });
  trx();
}

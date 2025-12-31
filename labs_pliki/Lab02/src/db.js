import Database from 'better-sqlite3';
import fs from 'fs';
const DB_FILE = process.env.DB_FILE || 'shop.db';

export let db;

export async function initDb() {
  const firstTime = !fs.existsSync(DB_FILE);
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL CHECK (qty > 0),
      price REAL NOT NULL CHECK (price >= 0)
    );
  `);

  if (firstTime) seed();
}

function seed() {
  const ins = db.prepare('INSERT INTO products(name,price) VALUES(?,?)');
  const trx = db.transaction(() => {
    ins.run('Kawa ziarnista 1kg', 79.90);
    ins.run('Kubek porcelanowy', 24.50);
    ins.run('Notes A5 kropki', 12.00);
    ins.run('Długopis żelowy', 5.99);
  });
  trx();
}

export function todayISO() {
  return new Date().toISOString();
}

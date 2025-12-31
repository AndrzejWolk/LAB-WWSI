import Database from 'better-sqlite3';
import fs from 'fs';
const DB_FILE = process.env.DB_FILE || 'kanban.db';

export let db;

export async function initDb() {
  const firstTime = !fs.existsSync(DB_FILE);
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      ord INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      col_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
      ord INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_columns_ord ON columns(ord);
    CREATE INDEX IF NOT EXISTS ix_tasks_col_ord ON tasks(col_id, ord);
  `);
  if (firstTime) seed();
}

function seed() {
  const trx = db.transaction(() => {
    // Predefined columns Todo, Doing, Done
    const c1 = db.prepare('INSERT INTO columns(name, ord) VALUES(?,?)').run('Todo', 1).lastInsertRowid;
    const c2 = db.prepare('INSERT INTO columns(name, ord) VALUES(?,?)').run('Doing', 2).lastInsertRowid;
    const c3 = db.prepare('INSERT INTO columns(name, ord) VALUES(?,?)').run('Done', 3).lastInsertRowid;
    // Sample tasks
    db.prepare('INSERT INTO tasks(title, col_id, ord) VALUES(?,?,?)').run('Skonfigurować repo', c1, 1);
    db.prepare('INSERT INTO tasks(title, col_id, ord) VALUES(?,?,?)').run('Napisać API', c1, 2);
    db.prepare('INSERT INTO tasks(title, col_id, ord) VALUES(?,?,?)').run('UI kolumn', c2, 1);
  });
  trx();
}

// helpers for ordering
export function nextOrdInColumn(colId) {
  const row = db.prepare('SELECT COALESCE(MAX(ord),0) AS m FROM tasks WHERE col_id = ?').get(colId);
  return (row.m || 0) + 1;
}

// move task with reindexing
export function moveTask(taskId, newColId, targetOrd) {
  const trx = db.transaction(() => {
    const t = db.prepare('SELECT id, col_id, ord FROM tasks WHERE id = ?').get(taskId);
    if (!t) throw new Error('Task not found');
    const oldCol = t.col_id;
    const oldOrd = t.ord;

    // clamp targetOrd within [1, max+1] of new column
    const maxRow = db.prepare('SELECT COALESCE(MAX(ord),0) AS m FROM tasks WHERE col_id = ?').get(newColId);
    const maxOrd = maxRow.m || 0;
    let to = parseInt(targetOrd);
    if (!Number.isFinite(to) || to < 1) to = 1;
    if (to > (newColId === oldCol ? maxOrd : maxOrd + 1)) to = (newColId === oldCol ? maxOrd : maxOrd + 1);

    if (newColId === oldCol) {
      if (to === oldOrd) return { col_id: newColId, ord: to };
      if (to < oldOrd) {
        // shift down [to..oldOrd-1] +1
        db.prepare('UPDATE tasks SET ord = ord + 1 WHERE col_id = ? AND ord >= ? AND ord < ?').run(newColId, to, oldOrd);
      } else {
        // to > oldOrd: shift up (left) (oldOrd+1..to] -1
        db.prepare('UPDATE tasks SET ord = ord - 1 WHERE col_id = ? AND ord > ? AND ord <= ?').run(newColId, oldOrd, to);
      }
      db.prepare('UPDATE tasks SET ord = ? WHERE id = ?').run(to, taskId);
    } else {
      // remove gap in old column
      db.prepare('UPDATE tasks SET ord = ord - 1 WHERE col_id = ? AND ord > ?').run(oldCol, oldOrd);
      // make space in new column at position to
      db.prepare('UPDATE tasks SET ord = ord + 1 WHERE col_id = ? AND ord >= ?').run(newColId, to);
      // move task
      db.prepare('UPDATE tasks SET col_id = ?, ord = ? WHERE id = ?').run(newColId, to, taskId);
    }
    return { col_id: newColId, ord: to };
  });
  return trx();
}

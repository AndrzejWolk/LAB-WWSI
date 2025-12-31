import fs from 'fs';
const DB_FILE = process.env.DB_FILE || 'movies.db';
if (fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);
console.log('Removed', DB_FILE);

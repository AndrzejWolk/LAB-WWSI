import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import cookie from './src/simple-cookie.js';
import { initDb } from './src/db.js';
import api from './src/routes/api.js';
import ui from './src/routes/ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await initDb();

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookie()); // simple cookie + session id

app.use('/public', express.static(path.join(__dirname, 'public')));

app.use('/api', api);
app.use('/', ui);

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`ShopLab Node listening on http://localhost:${port}`);
});

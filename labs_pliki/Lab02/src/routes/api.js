import { Router } from 'express';
import { db, todayISO } from '../db.js';

const router = Router();

// -------- PRODUCTS --------

// GET /api/products
router.get('/products', (req, res) => {
  const items = db.prepare('SELECT id, name, price FROM products ORDER BY id').all();
  res.json(items);
});

// POST /api/products {name, price}
router.post('/products', (req, res) => {
  const { name, price } = req.body || {};
  const p = Number(price);
  if (!name?.trim() || !Number.isFinite(p) || p < 0) {
    return res.status(400).json({ message: 'Invalid name or price.' });
  }
  const info = db.prepare('INSERT INTO products(name,price) VALUES(?,?)').run(name.trim(), p);
  res.status(201).location(`/api/products/${info.lastInsertRowid}`).json({ id: info.lastInsertRowid, name: name.trim(), price: p });
});

// Optional CRUD extras
router.patch('/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, price } = req.body || {};
  const p = price !== undefined ? Number(price) : undefined;
  if (p !== undefined && (!Number.isFinite(p) || p < 0)) return res.status(400).json({ message: 'Invalid price.' });
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!cur) return res.status(404).json({ message: 'Not found' });
  const n = name?.trim() || cur.name;
  const pr = p !== undefined ? p : cur.price;
  db.prepare('UPDATE products SET name=?, price=? WHERE id=?').run(n, pr, id);
  res.json({ id, name: n, price: pr });
});

router.delete('/products/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ message: 'Not found' });
  res.status(204).end();
});

// -------- CART (per-session via simple-cookie) --------

// GET /api/cart
router.get('/cart', (req, res) => {
  const cart = req.cart || {};
  // hydrate with product names & subtotals
  const items = Object.entries(cart).map(([pid, qty]) => {
    const p = db.prepare('SELECT id, name, price FROM products WHERE id = ?').get(parseInt(pid));
    if (!p) return null;
    return { product_id: p.id, name: p.name, price: p.price, qty: qty, subtotal: +(p.price * qty).toFixed(2) };
  }).filter(Boolean);
  const total = +items.reduce((s, it) => s + it.subtotal, 0).toFixed(2);
  res.json({ items, total });
});

// POST /api/cart/add {product_id, qty}
router.post('/cart/add', (req, res) => {
  const { product_id, qty } = req.body || {};
  const id = parseInt(product_id);
  const q = parseInt(qty);
  if (!Number.isFinite(id) || !Number.isFinite(q) || q <= 0) return res.status(400).json({ message: 'Invalid product_id or qty.' });
  const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!prod) return res.status(400).json({ message: 'Product not found.' });
  const cart = req.cart || {};
  cart[id] = (cart[id] || 0) + q;
  req.saveCart();
  res.status(201).json({ message: 'Added.' });
});

// PATCH /api/cart/item {product_id, qty}
router.patch('/cart/item', (req, res) => {
  const { product_id, qty } = req.body || {};
  const id = parseInt(product_id);
  const q = parseInt(qty);
  if (!Number.isFinite(id) || !Number.isFinite(q) || q <= 0) return res.status(400).json({ message: 'Invalid product_id or qty.' });
  const cart = req.cart || {};
  if (!cart[id]) return res.status(404).json({ message: 'Item not in cart.' });
  cart[id] = q;
  req.saveCart();
  res.json({ message: 'Updated.' });
});

// DELETE /api/cart/item/:product_id
router.delete('/cart/item/:product_id', (req, res) => {
  const id = parseInt(req.params.product_id);
  const cart = req.cart || {};
  if (!cart[id]) return res.status(404).json({ message: 'Item not in cart.' });
  delete cart[id];
  req.saveCart();
  res.status(204).end();
});

// -------- CHECKOUT --------

// POST /api/checkout -> 201 {order_id,total}
router.post('/checkout', (req, res) => {
  const cart = req.cart || {};
  const entries = Object.entries(cart);
  if (entries.length === 0) return res.status(400).json({ message: 'Cart is empty.' });

  // snapshot prices now
  const items = entries.map(([pid, qty]) => {
    const p = db.prepare('SELECT id, price FROM products WHERE id = ?').get(parseInt(pid));
    if (!p) throw new Error('Product missing during checkout.');
    const q = parseInt(qty);
    if (!(q > 0)) throw new Error('Invalid qty.');
    return { product_id: p.id, qty: q, price: p.price };
  });

  const trx = db.transaction(() => {
    const orderId = db.prepare('INSERT INTO orders(created_at) VALUES(?)').run(todayISO()).lastInsertRowid;
    const insItem = db.prepare('INSERT INTO order_items(order_id,product_id,qty,price) VALUES(?,?,?,?)');
    let total = 0;
    for (const it of items) {
      insItem.run(orderId, it.product_id, it.qty, it.price);
      total += it.qty * it.price;
    }
    // empty cart
    for (const k of Object.keys(cart)) delete cart[k];
    return { orderId, total: +total.toFixed(2) };
  });

  const result = trx();
  req.saveCart();
  res.status(201).json({ order_id: result.orderId, total: result.total });
});

export default router;

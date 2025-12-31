import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const products = db.prepare('SELECT id, name, price FROM products ORDER BY id').all();
  const cart = req.cart || {};
  const cartItems = Object.entries(cart).map(([pid, qty]) => {
    const p = db.prepare('SELECT id, name, price FROM products WHERE id = ?').get(parseInt(pid));
    if (!p) return null;
    return { id: p.id, name: p.name, price: p.price, qty: qty, subtotal: +(p.price * qty).toFixed(2) };
  }).filter(Boolean);
  const total = +cartItems.reduce((s, it) => s + it.subtotal, 0).toFixed(2);

  res.type('html').send(`<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8"/><title>Sklep</title>
<link rel="stylesheet" href="/public/site.css"/></head>
<body>
<header><h1>Lab02 — Sklep</h1></header>
<section class="grid">
  <div>
    <h2>Produkty</h2>
    <table><thead><tr><th>Produkt</th><th>Cena</th><th>Akcja</th></tr></thead>
    <tbody>
      ${products.map(p => `<tr>
        <td>${p.name}</td>
        <td>${p.price.toFixed(2)} zł</td>
        <td>
          <form method="post" action="/cart/add">
            <input type="hidden" name="product_id" value="${p.id}"/>
            <input type="number" name="qty" min="1" value="1" style="width:60px"/>
            <button>Dodaj</button>
          </form>
        </td>
      </tr>`).join('')}
    </tbody></table>

    <h3>Dodaj/Edytuj produkt</h3>
    <form method="post" action="/products/create">
      <label>Nazwa: <input name="name" required/></label>
      <label>Cena: <input name="price" type="number" step="0.01" min="0" value="0"/></label>
      <button>Dodaj</button>
    </form>
  </div>

  <div>
    <h2>Koszyk</h2>
    <table><thead><tr><th>Produkt</th><th>Cena</th><th>Ilość</th><th>Suma</th><th>Akcja</th></tr></thead>
    <tbody>
      ${cartItems.map(it => `<tr>
        <td>${it.name}</td>
        <td>${it.price.toFixed(2)} zł</td>
        <td>
          <form method="post" action="/cart/update">
            <input type="hidden" name="product_id" value="${it.id}"/>
            <input type="number" name="qty" min="1" value="${it.qty}" style="width:60px"/>
            <button>Zmień</button>
          </form>
        </td>
        <td>${it.subtotal.toFixed(2)} zł</td>
        <td>
          <form method="post" action="/cart/remove">
            <input type="hidden" name="product_id" value="${it.id}"/>
            <button>Usuń</button>
          </form>
        </td>
      </tr>`).join('')}
      ${cartItems.length === 0 ? `<tr><td colspan="5"><i>Koszyk pusty</i></td></tr>` : ''}
    </tbody></table>
    <p><b>Razem:</b> ${total.toFixed(2)} zł</p>
    <form method="post" action="/checkout"><button ${cartItems.length===0?'disabled':''}>Zamów</button></form>
  </div>
</section>
</body></html>`);
});

// UI endpoints delegating to API logic
router.post('/products/create', (req, res) => {
  const { name, price } = req.body || {};
  const p = Number(price);
  if (name?.trim() && Number.isFinite(p) && p >= 0) {
    db.prepare('INSERT INTO products(name,price) VALUES(?,?)').run(name.trim(), p);
  }
  res.redirect('/');
});

router.post('/cart/add', (req, res) => {
  const { product_id, qty } = req.body || {};
  const id = parseInt(product_id);
  const q = parseInt(qty);
  if (Number.isFinite(id) && Number.isFinite(q) && q > 0) {
    req.cart[id] = (req.cart[id] || 0) + q;
    req.saveCart();
  }
  res.redirect('/');
});

router.post('/cart/update', (req, res) => {
  const { product_id, qty } = req.body || {};
  const id = parseInt(product_id);
  const q = parseInt(qty);
  if (Number.isFinite(id) && Number.isFinite(q) && q > 0 && req.cart[id]) {
    req.cart[id] = q;
    req.saveCart();
  }
  res.redirect('/');
});

router.post('/cart/remove', (req, res) => {
  const { product_id } = req.body || {};
  const id = parseInt(product_id);
  if (req.cart[id]) {
    delete req.cart[id];
    req.saveCart();
  }
  res.redirect('/');
});

router.post('/checkout', (req, res) => {
  // redirect to API action by HTML form
  res.redirect(307, '/api/checkout'); // preserve POST
});

export default router;

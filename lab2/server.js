const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const morgan = require('morgan');

const app = express();
const port = 3001;

const config = {
  server: 'localhost',
  database: 'TI_Lab',
  user: 'SA',
  password: 'zaq1@WSX',
  options: {
    trustServerCertificate: true,
  },
};

app.use(cors());
app.use(bodyParser.json());
app.use(session({ secret: 'shop-secret', resave: false, saveUninitialized: true }));
app.use(morgan('combined'));
app.use(express.static('public'));

async function connectDB() {
  try {
    await sql.connect(config);
  } catch (err) {
    console.error('Błąd połączenia z bazą:', err);
  }
}

// Endpointy API

app.get('/api/products', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query('SELECT Id, Name, Price FROM dbo.Products');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  const { name, price } = req.body;
  if (!name || price < 0) return res.status(400).json({ error: 'Invalid data' });
  try {
    const pool = await sql.connect(config);
    await pool.request()
      .input('Name', sql.NVarChar, name)
      .input('Price', sql.Decimal(12,2), price)
      .query('INSERT INTO dbo.Products (Name, Price) VALUES (@Name, @Price)');
    const result = await pool.request().query('SELECT SCOPE_IDENTITY() AS Id');
    res.status(201).json({ id: result.recordset[0].Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cart', (req, res) => {
  req.session.cart = req.session.cart || [];
  res.json(req.session.cart);
});

app.post('/api/cart/add', async (req, res) => {
  const { product_id, qty } = req.body;
  if (!product_id || qty <= 0) return res.status(400).json({ error: 'Invalid qty' });
  try {
    const pool = await sql.connect(config);
    const product = await pool.request()
      .input('Id', sql.Int, product_id)
      .query('SELECT Name, Price FROM dbo.Products WHERE Id = @Id');
    if (product.recordset.length === 0) return res.status(404).json({ error: 'Product not found' });

    req.session.cart = req.session.cart || [];
    const existing = req.session.cart.find(item => item.product_id === product_id);
    if (existing) {
      existing.qty += qty;
    } else {
      req.session.cart.push({ product_id, name: product.recordset[0].Name, price: product.recordset[0].Price, qty });
    }
    res.status(200).json({ message: 'Added to cart' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/cart/item', (req, res) => {
  const { product_id, qty } = req.body;
  if (qty <= 0) return res.status(400).json({ error: 'Qty must be > 0' });
  req.session.cart = req.session.cart || [];
  const item = req.session.cart.find(item => item.product_id === product_id);
  if (!item) return res.status(404).json({ error: 'Item not in cart' });
  item.qty = qty;
  res.status(200).json({ message: 'Updated' });
});

app.delete('/api/cart/item/:product_id', (req, res) => {
  const product_id = parseInt(req.params.product_id);
  req.session.cart = req.session.cart || [];
  req.session.cart = req.session.cart.filter(item => item.product_id !== product_id);
  res.status(200).json({ message: 'Removed' });
});

app.post('/api/checkout', async (req, res) => {
  req.session.cart = req.session.cart || [];
  if (req.session.cart.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  try {
    const pool = await sql.connect(config);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const orderResult = await transaction.request()
      .query('INSERT INTO dbo.Orders DEFAULT VALUES OUTPUT INSERTED.Id');
    const orderId = orderResult.recordset[0].Id;

    for (const item of req.session.cart) {
      await transaction.request()
        .input('OrderId', sql.Int, orderId)
        .input('ProductId', sql.Int, item.product_id)
        .input('Qty', sql.Int, item.qty)
        .input('Price', sql.Decimal(12,2), item.price)
        .query('INSERT INTO dbo.OrderItems (OrderId, ProductId, Qty, Price) VALUES (@OrderId, @ProductId, @Qty, @Price)');
    }

    const totalResult = await transaction.request()
      .input('OrderId', sql.Int, orderId)
      .query('SELECT SUM(Qty * Price) AS Total FROM dbo.OrderItems WHERE OrderId = @OrderId');
    const total = totalResult.recordset[0].Total;

    await transaction.commit();
    req.session.cart = [];
    res.status(201).json({ order_id: orderId, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Serwer sklepu działa na http://localhost:${port}`);
  connectDB();
});

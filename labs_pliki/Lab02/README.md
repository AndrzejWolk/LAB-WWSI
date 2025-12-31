
# Lab02 — Sklep: koszyk i zamówienia (Node.js + Express + SQLite)

## Wymagania
- Node.js 18+ (Windows, VS Code)
- Brak Dockera

## Start
```powershell
npm install
npm run dev
# http://localhost:3000
```
Baza `shop.db` tworzy się automatycznie z kilkoma produktami.

**Reset bazy:**
```powershell
npm run reset:db && npm run dev
```

## Model danych
- `products(id, name, price CHECK price>=0)`
- `orders(id, created_at)`
- `order_items(id, order_id→orders.id, product_id→products.id, qty>0, price snapshot)`

## Kontrakt API
- `GET /api/products` | `POST /api/products {name,price}`
- `GET /api/cart` | `POST /api/cart/add {product_id,qty}` | `PATCH /api/cart/item {product_id,qty}` | `DELETE /api/cart/item/{product_id}`
- `POST /api/checkout` → `201 {order_id,total}`

## UI (minimum)
- `/` – lista produktów z „Dodaj do koszyka”
- Panel koszyka: modyfikacja ilości, usuwanie, przycisk „Zamów”

## Zasady
- `qty > 0` – walidacja po stronie API.
- „Snapshot” ceny: kwota pozycji w `order_items.price` to aktualna cena w momencie zamówienia (potem niezależna od zmian w `products`).
- Po `checkout` koszyk jest czyszczony; w DB pojawia się `orders` + `order_items` ze zsumowaną kwotą.

## Bonus (pomysły)
- Kupony rabatowe: tabela `coupons(code, percent)` i endpoint `POST /api/cart/apply-coupon` z wyliczeniem nowej sumy.
- Historia zamówień: `GET /api/orders` z joinem na pozycje.

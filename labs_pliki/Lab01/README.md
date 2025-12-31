
# Lab01 — Wypożyczalnia książek (Node.js + Express + SQLite)

## Wymagania
- Node.js 18+ (Windows, VS Code)
- Brak Dockera, wszystko lokalnie

## Start
```powershell
npm install
npm run dev
```
Aplikacja: http://localhost:3000  
Baza `library.db` tworzy się automatycznie, z seedem.

**Reset bazy:**
```powershell
npm run reset:db && npm run dev
```

## API
- `GET /api/members`
- `POST /api/members` body: `{ "name":"Ala", "email":"ala@example.com" }` → `201` lub `409`
- `GET /api/books?author=Kowalski&page=1&pageSize=20`
- `POST /api/books` body: `{ "title":"X", "author":"Y", "copies":2 }` → `201`
- `GET /api/loans`
- `POST /api/loans/borrow` body: `{ "member_id":1, "book_id":2, "days":14 }` → `201` lub `409`
- `POST /api/loans/return` body: `{ "loan_id":123 }` → `200/409`
- Bonus: `GET /api/loans/overdue`

## UI (minimum)
- `/` – książki + dostępność + formularz wypożyczenia
- `/members` – lista + dodawanie członka
- `/loans` – aktywne/zwrócone + akcja „Zwróć”

## Uwagi implementacyjne
- Walidacja dostępności: `SELECT COUNT(*) FROM loans WHERE book_id=? AND return_date IS NULL` vs `copies`
- Unikalność e-maila: `UNIQUE` na kolumnie oraz obsługa błędu `409`
- Daty w formacie `YYYY-MM-DD`, logika terminów po stronie serwera

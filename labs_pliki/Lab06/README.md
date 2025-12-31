
# Lab06 — Notatki, tagi i wyszukiwanie (Node.js + Express + SQLite)

## Start
```powershell
npm install
npm run dev
# http://localhost:3000
```
Baza `notes.db` tworzy się automatycznie (seed: kilka notatek i tagi).  
Reset: `npm run reset:db`.

## Model danych
- `notes(id, title, body, created_at)`
- `tags(id, name UNIQUE)`
- `note_tags(note_id, tag_id, PK(note_id,tag_id))`

## Kontrakt API
- `GET /api/notes?q=...&tag=...` — filtr po tytule/treści (LIKE) i opcjonalnie po tagu; zwraca też listę tagów danej notatki.
- `POST /api/notes {title,body}` → `201`
- `GET /api/tags` → lista tagów
- `POST /api/notes/{id}/tags { "tags": ["work","home"] }` → tworzy brakujące tagi i relacje (unikalność relacji wymusza PK)

## UI (minimum)
- Pole „Szukaj…”, lista wyników (tytuł + fragment treści z <mark>podświetleniem</mark>).
- Formularz dodania notatki i tagów (comma‑sep).
- Formularz dopisywania tagów do istniejącej notatki.

## Akceptacja
- Wyszukiwanie LIKE znajduje frazy w tytule i treści.
- Ten sam tag nie doda się drugi raz do tej samej notatki (PRIMARY KEY w `note_tags` + `INSERT OR IGNORE`).

## Bonus (opcje do rozbudowy)
- FTS5: dodać w SQLite wirtualną tabelę `notes_fts` i triggery sync dla lepszego rankingu.
- Paginacja: `?page=&pageSize=`
- Multi‑tag filter: `?tags=work,home` (intersect).

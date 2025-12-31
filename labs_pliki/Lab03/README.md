
# Lab03 — Blog: komentarze z moderacją (Node.js + Express + SQLite)

## Start
```powershell
npm install
npm run dev
# http://localhost:3000
```
Baza `blog.db` tworzy się automatycznie z seedem (2 posty, kilka komentarzy – część oczekuje na akcept).  
Reset: `npm run reset:db`.

## Model danych
- `posts(id, title, body, created_at)`
- `comments(id, post_id→posts.id, author, body, created_at, approved DEFAULT 0)`

## Kontrakt API
- `GET /api/posts`
- `POST /api/posts {title,body}`
- `GET /api/posts/{id}/comments` — **tylko approved=1**
- `POST /api/posts/{id}/comments {author,body}` → `201 {approved:0}`
- `POST /api/comments/{id}/approve` → `200`

## UI (minimum)
- `/` – lista postów
- `/posts/:id` – szczegóły + **tylko zatwierdzone** komentarze + formularz dodania (trafia do moderacji)
- `/moderation` – panel moderatora: lista oczekujących + „Zatwierdź”

## Akceptacja
- Nowy komentarz nie jest publiczny, dopóki nie przejdzie **approve**.
- Po zatwierdzeniu komentarz jest widoczny natychmiast w widoku posta.

## Bonusy (do rozbudowy)
- Paginacja komentarzy: `?page=&pageSize=` w endpointach i UI.
- Anty‑spam: limiter na IP/treść (np. naive: max 3 komentarze/5 min/IP).

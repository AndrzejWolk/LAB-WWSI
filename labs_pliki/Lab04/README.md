
# Lab04 — Filmy i oceny (Node.js + Express + SQLite)

## Start
```powershell
npm install
npm run dev
# http://localhost:3000
```
Baza `movies.db` tworzy się automatycznie z kilkoma filmami i głosami.

**Reset bazy:**
```powershell
npm run reset:db && npm run dev
```

## Model danych
- `movies(id, title, year)`
- `ratings(id, movie_id→movies.id, score CHECK 1..5)`

## Kontrakt API
- `GET /api/movies` → ranking: `avg_score` (2 miejsca) i `votes`, posortowane malejąco po `avg_score`
  - Bonus: `?year=2014&limit=5`
- `POST /api/movies {title,year}` → `201`
- `POST /api/ratings {movie_id,score}` → `201` (walidacja zakresu 1..5)

## UI (minimum)
- `/` – lista filmów z `avg_score` i `votes` + formularz oceny
- Form. dodania filmu

## Akceptacja
- Dodanie oceny aktualizuje średnią i liczbę głosów bez restartu (liczone zapytaniem).
- `score` walidowane do zakresu 1..5.

## Bonus
- `GET /api/movies/top?limit=5` (opcjonalnie `&year=YYYY`).
- Filtrowanie roku w UI.

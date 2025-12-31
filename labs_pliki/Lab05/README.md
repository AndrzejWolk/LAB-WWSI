
# Lab05 — Kanban (Node.js + Express + SQLite)

## Start
```powershell
npm install
npm run dev
# http://localhost:3000
```
Baza `kanban.db` tworzy się automatycznie z kolumnami **Todo/Doing/Done** i przykładowymi zadaniami.

**Reset bazy:**
```powershell
npm run reset:db && npm run dev
```

## Model danych
- `columns(id, name, ord)` – predefiniowane: Todo(1), Doing(2), Done(3)
- `tasks(id, title, col_id→columns.id, ord)`

## Kontrakt API
- `GET /api/board` → `{ cols:[{id,name,ord}], tasks:[{id,title,col_id,ord}] }` posortowane po `ord`
- `POST /api/tasks {title,col_id}` → `201` (ustaw `ord = MAX+1` w danej kolumnie)
- `POST /api/tasks/{id}/move {col_id,ord}` → `200` (przeniesienie z przeliczeniem pozycji)

## Zasady kolejności
- Dodawanie: zawsze na **koniec** kolumny (MAX+1).
- Przenoszenie: transakcyjnie:
  - przy zmianie kolumny „zamyka” dziurę w starej,
  - w nowej robi miejsce od `ord` w górę,
  - ustawia zadaniu nowy `col_id, ord`.
- Po odświeżeniu widok odtwarza stan z DB.

## UI (minimum)
- Trzy kolumny obok siebie; karty w kolejności `ord`.
- Formularz dodania do każdej kolumny.
- Przycisk „→” przy karcie, który przerzuca ją do kolumny po prawej (na koniec).

## Bonusy (pomysły)
- Drag&drop i wsadowe zmiany (PATCH z listą nowych `ord`).
- Edycja tytułów zadań.

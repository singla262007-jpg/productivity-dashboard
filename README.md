# Productivity Dashboard

A small full-stack app for tracking tasks and focus time.

- **Frontend:** plain HTML, CSS and JavaScript in `public/`
- **Backend:** Node.js + Express (`server.js`), REST API under `/api`
- **Database:** SQLite file (`dashboard.db`), created automatically on first run (`db.js`)

## Run it in VS Code

1. Install [Node.js](https://nodejs.org) 18 or newer (LTS is fine).
2. In VS Code: **File > Open Folder...** and choose the `productivity-dashboard` folder.
3. Open the terminal: **Terminal > New Terminal** (or press Ctrl + `).
4. Install dependencies (first time only):

   ```bash
   npm install
   ```

5. Start the app:

   ```bash
   npm start
   ```

   For auto-restart when you edit server code, use `npm run dev` instead.

6. Open http://localhost:3000 in your browser.

Press Ctrl + C in the terminal to stop the server.

## API

| Method | Route             | Purpose                                   |
|--------|-------------------|-------------------------------------------|
| GET    | `/api/tasks`      | List tasks (`?status=todo` or `done`)     |
| POST   | `/api/tasks`      | Create `{ title, priority, due_date }`    |
| PUT    | `/api/tasks/:id`  | Update title, priority, status, due date  |
| DELETE | `/api/tasks/:id`  | Delete a task                             |
| POST   | `/api/focus`      | Log a focus session `{ minutes }`         |
| GET    | `/api/stats`      | Dashboard numbers and last 7 days         |

## Troubleshooting

- **Port already in use:** run on another port, e.g. `PORT=4000 npm start` (macOS/Linux) or
  `$env:PORT=4000; npm start` (Windows PowerShell).
- **`better-sqlite3` install error on Windows:** install the "Desktop development with C++"
  workload from Visual Studio Build Tools, then run `npm install` again. Using Node LTS usually
  avoids this because a prebuilt binary is downloaded.
- **Reset all data:** stop the server and delete `dashboard.db`.

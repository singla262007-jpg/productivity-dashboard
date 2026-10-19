const Database = require("better-sqlite3");
const path = require("path");

// The database is a single file created next to this script on first run.
const db = new Database(path.join(__dirname, "dashboard.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
    status       TEXT NOT NULL DEFAULT 'todo'   CHECK (status IN ('todo','done')),
    due_date     TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS focus_sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    minutes    INTEGER NOT NULL,
    task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

module.exports = db;

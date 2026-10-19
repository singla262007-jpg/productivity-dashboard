const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PRIORITIES = ["low", "medium", "high"];
const STATUSES = ["todo", "done"];

// ---------- Tasks ----------
app.get("/api/tasks", (req, res) => {
  const { status } = req.query;
  const order = `ORDER BY status = 'done',
    CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
    due_date IS NULL, due_date, id DESC`;
  const rows = STATUSES.includes(status)
    ? db.prepare(`SELECT * FROM tasks WHERE status = ? ${order}`).all(status)
    : db.prepare(`SELECT * FROM tasks ${order}`).all();
  res.json(rows);
});

app.post("/api/tasks", (req, res) => {
  const title = String(req.body.title || "").trim();
  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : "medium";
  const due = /^\d{4}-\d{2}-\d{2}$/.test(req.body.due_date || "") ? req.body.due_date : null;
  if (!title) return res.status(400).json({ error: "Title is required" });
  const info = db
    .prepare("INSERT INTO tasks (title, priority, due_date) VALUES (?, ?, ?)")
    .run(title.slice(0, 200), priority, due);
  res.status(201).json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(info.lastInsertRowid));
});

app.put("/api/tasks/:id", (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });

  const title = req.body.title !== undefined ? String(req.body.title).trim() || task.title : task.title;
  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : task.priority;
  const status = STATUSES.includes(req.body.status) ? req.body.status : task.status;
  const due = req.body.due_date !== undefined ? req.body.due_date || null : task.due_date;

  let completedAt = task.completed_at;
  if (status === "done" && task.status !== "done") completedAt = db.prepare("SELECT datetime('now','localtime') AS t").get().t;
  if (status === "todo") completedAt = null;

  db.prepare(
    "UPDATE tasks SET title=?, priority=?, status=?, due_date=?, completed_at=? WHERE id=?"
  ).run(title, priority, status, due, completedAt, task.id);
  res.json(db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id));
});

app.delete("/api/tasks/:id", (req, res) => {
  const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Task not found" });
  res.status(204).end();
});

// ---------- Focus sessions ----------
app.post("/api/focus", (req, res) => {
  const minutes = Math.round(Number(req.body.minutes));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240)
    return res.status(400).json({ error: "minutes must be between 1 and 240" });
  const taskId = req.body.task_id ? Number(req.body.task_id) : null;
  const info = db.prepare("INSERT INTO focus_sessions (minutes, task_id) VALUES (?, ?)").run(minutes, taskId);
  res.status(201).json({ id: info.lastInsertRowid, minutes });
});

// ---------- Stats ----------
app.get("/api/stats", (req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const total = one("SELECT COUNT(*) AS n FROM tasks").n;
  const done = one("SELECT COUNT(*) AS n FROM tasks WHERE status='done'").n;
  const overdue = one(
    "SELECT COUNT(*) AS n FROM tasks WHERE status='todo' AND due_date IS NOT NULL AND due_date < date('now','localtime')"
  ).n;
  const dueToday = one(
    "SELECT COUNT(*) AS n FROM tasks WHERE status='todo' AND due_date = date('now','localtime')"
  ).n;
  const focusToday = one(
    "SELECT COALESCE(SUM(minutes),0) AS n FROM focus_sessions WHERE date(created_at) = date('now','localtime')"
  ).n;

  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const offset = `-${i} days`;
    const day = one("SELECT date('now','localtime',?) AS d", offset).d;
    const completed = one(
      "SELECT COUNT(*) AS n FROM tasks WHERE date(completed_at) = ?", day
    ).n;
    const focus = one(
      "SELECT COALESCE(SUM(minutes),0) AS n FROM focus_sessions WHERE date(created_at) = ?", day
    ).n;
    last7.push({ date: day, completed, focusMinutes: focus });
  }

  res.json({
    total,
    done,
    pending: total - done,
    overdue,
    dueToday,
    completionRate: total ? Math.round((done / total) * 100) : 0,
    focusToday,
    last7,
  });
});

app.listen(PORT, () => console.log(`Dashboard running at http://localhost:${PORT}`));

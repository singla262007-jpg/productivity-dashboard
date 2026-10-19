const $ = (id) => document.getElementById(id);
let filter = "all";
let tasks = [];

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ---------- Stats ----------
async function loadStats() {
  const s = await api("/api/stats");
  $("s-pending").textContent = s.pending;
  $("s-done").textContent = s.done;
  $("s-overdue").textContent = s.overdue;
  $("s-today").textContent = s.dueToday;
  $("s-rate").textContent = s.completionRate + "%";
  $("s-focus").textContent = s.focusToday + "m";
  renderChart(s.last7);
}

function renderChart(days) {
  const chart = $("chart");
  chart.innerHTML = "";
  const maxTasks = Math.max(1, ...days.map((d) => d.completed));
  const maxFocus = Math.max(1, ...days.map((d) => d.focusMinutes));
  for (const d of days) {
    const col = document.createElement("div");
    col.className = "day";

    const pair = document.createElement("div");
    pair.className = "pair";

    const a = document.createElement("div");
    a.className = "bar a";
    a.style.height = (d.completed / maxTasks) * 85 + "%";
    a.title = `${d.completed} task(s) completed`;
    if (d.completed) a.innerHTML = `<span>${d.completed}</span>`;

    const b = document.createElement("div");
    b.className = "bar b";
    b.style.height = (d.focusMinutes / maxFocus) * 85 + "%";
    b.title = `${d.focusMinutes} focus minute(s)`;
    if (d.focusMinutes) b.innerHTML = `<span>${d.focusMinutes}</span>`;

    pair.append(a, b);

    const lbl = document.createElement("div");
    lbl.className = "lbl";
    const dt = new Date(d.date + "T00:00:00");
    lbl.textContent = dt.toLocaleDateString(undefined, { weekday: "short" });

    col.append(pair, lbl);
    chart.append(col);
  }
}

// ---------- Tasks ----------
async function loadTasks() {
  tasks = await api("/api/tasks");
  renderTasks();
}

function renderTasks() {
  const list = $("task-list");
  list.innerHTML = "";
  const visible = tasks.filter((t) => filter === "all" || t.status === filter);
  $("empty").hidden = visible.length > 0;

  for (const t of visible) {
    const li = document.createElement("li");
    li.className = "task" + (t.status === "done" ? " done" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = t.status === "done";
    cb.addEventListener("change", async () => {
      await api(`/api/tasks/${t.id}`, { method: "PUT", body: { status: cb.checked ? "done" : "todo" } });
      refresh();
    });

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = t.title;

    const badge = document.createElement("span");
    badge.className = "badge " + t.priority;
    badge.textContent = t.priority;

    li.append(cb, title, badge);

    if (t.due_date) {
      const due = document.createElement("span");
      due.className = "due" + (t.status === "todo" && t.due_date < todayStr() ? " overdue" : "");
      due.textContent = t.due_date;
      li.append(due);
    }

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.title = "Delete task";
    del.addEventListener("click", async () => {
      await api(`/api/tasks/${t.id}`, { method: "DELETE" });
      refresh();
    });
    li.append(del);

    list.append(li);
  }
}

$("task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("t-title").value.trim();
  if (!title) return;
  try {
    await api("/api/tasks", {
      method: "POST",
      body: { title, priority: $("t-priority").value, due_date: $("t-due").value || null },
    });
    $("t-title").value = "";
    $("t-due").value = "";
    refresh();
  } catch (err) {
    alert(err.message);
  }
});

$("filters").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-f]");
  if (!btn) return;
  filter = btn.dataset.f;
  document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("active", b === btn));
  renderTasks();
});

// ---------- Focus timer ----------
let remaining = 25 * 60;
let total = 25 * 60;
let ticking = null;
let endAt = 0;

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function setTimerFromSelect() {
  total = Number($("f-minutes").value) * 60;
  remaining = total;
  $("timer").textContent = fmt(remaining);
}

function stopTimer() {
  clearInterval(ticking);
  ticking = null;
  $("f-start").textContent = "Start";
  document.title = "Productivity Dashboard";
}

$("f-minutes").addEventListener("change", () => {
  if (!ticking) setTimerFromSelect();
});

$("f-start").addEventListener("click", () => {
  if (ticking) {
    // pause
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    stopTimer();
    $("f-start").textContent = "Resume";
    return;
  }
  endAt = Date.now() + remaining * 1000;
  $("f-start").textContent = "Pause";
  ticking = setInterval(async () => {
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    $("timer").textContent = fmt(remaining);
    document.title = `${fmt(remaining)} · Focus`;
    if (remaining === 0) {
      const minutes = Math.round(total / 60);
      stopTimer();
      setTimerFromSelect();
      try {
        await api("/api/focus", { method: "POST", body: { minutes } });
        loadStats();
      } catch (err) {
        console.error(err);
      }
      alert(`Focus session complete: ${minutes} minute(s) logged.`);
    }
  }, 250);
});

$("f-reset").addEventListener("click", () => {
  stopTimer();
  setTimerFromSelect();
});

// ---------- Init ----------
function refresh() {
  loadTasks();
  loadStats();
}

$("today").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});
setTimerFromSelect();
refresh();

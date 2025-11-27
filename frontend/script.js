let tasks = [];

// ---------------- Add Task ----------------
document.getElementById("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const task = {
        title: document.getElementById("title").value.trim(),
        due_date: document.getElementById("due_date").value,
        estimated_hours: Number(document.getElementById("estimated_hours").value),
        importance: Number(document.getElementById("importance").value),
        dependencies: document.getElementById("dependencies").value
            .split(",")
            .map(x => x.trim())
            .filter(x => x !== "")
            .map(x => {
                // try convert to number if it's numeric id
                const n = Number(x);
                return isNaN(n) ? x : n;
            })
    };

    tasks.push(task);
    e.target.reset();
    alert("Task added!");
});

// ---------------- Analyze Tasks ----------------
document.getElementById("analyzeBtn").addEventListener("click", async () => {
    await analyzeAndRender();
});

async function analyzeAndRender() {
    const jsonInput = document.getElementById("jsonInput").value.trim();

    if (jsonInput) {
        try {
            tasks = JSON.parse(jsonInput);
        } catch {
            return showError("Invalid JSON input!");
        }
    }

    if (tasks.length === 0) return showError("No tasks provided!");

    const strategy = document.getElementById("strategy").value;
    const loading = document.getElementById("loading");
    const errorMsg = document.getElementById("errorMsg");

    errorMsg.classList.add("hidden");
    loading.classList.remove("hidden");

    try {
        const response = await fetch("https://smart-task-analyser.onrender.com/api/tasks/analyze/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tasks, strategy })
        });

        const data = await response.json();
        loading.classList.add("hidden");

        if (!response.ok) return showError(data.error || "API error");

        renderResults(data.results);

    } catch (err) {
        loading.classList.add("hidden");
        showError("Failed to reach backend API.");
    }
}

// ---------------- Render Results ----------------
function renderResults(results) {
    const container = document.getElementById("results");
    container.innerHTML = "";

    results.forEach((task, index) => {
        const div = document.createElement("div");
        div.className = `task-card priority-${getPriorityLevel(task.score)}`;
        // include index to map feedback back to the task object from results
        div.dataset.index = index;

        div.innerHTML = `
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            <p><strong>Score:</strong> ${Number(task.score).toFixed(2)}</p>
            <p><strong>Due:</strong> ${escapeHtml(task.due_date)}</p>
            <p><strong>Effort:</strong> ${escapeHtml(String(task.estimated_hours))} hrs</p>
            <p><strong>Importance:</strong> ${escapeHtml(String(task.importance))}</p>

            <p><strong>Working Days Left:</strong> ${escapeHtml(String(task.working_days))}</p>
            <p><strong>Skipped Weekends:</strong> ${task.skipped_weekends ? task.skipped_weekends.length : 0}</p>
            <p><strong>Skipped Holidays:</strong> ${task.skipped_holidays ? task.skipped_holidays.length : 0}</p>

            <p><strong>Why:</strong> ${escapeHtml(task.explanation || "")}</p>

            <div class="feedback">
                <button class="btn-small helpful-btn" data-index="${index}">👍 Helpful</button>
                <button class="btn-small not-helpful-btn" data-index="${index}">👎 Not Helpful</button>
            </div>
        `;

        container.appendChild(div);
    });

    const strategy = document.getElementById("strategy").value;

    // Update visual components
    renderDependencyGraph(results, strategy);
    renderMatrix(results);
    attachFeedbackHandlers(results);
}

// ---------------- FEEDBACK SYSTEM ----------------
function attachFeedbackHandlers(results) {
    // Results area buttons
    document.querySelectorAll(".helpful-btn").forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.dataset.index);
            if (!Number.isNaN(idx) && results[idx]) {
                sendFeedback(results[idx].title, true);
            }
        };
    });

    document.querySelectorAll(".not-helpful-btn").forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.dataset.index);
            if (!Number.isNaN(idx) && results[idx]) {
                sendFeedback(results[idx].title, false);
            }
        };
    });

    // Matrix buttons (they have class names created in renderMatrix)
    document.querySelectorAll(".matrix-helpful-btn").forEach(btn => {
        btn.onclick = () => {
            const title = btn.dataset.title;
            sendFeedback(title, true);
        };
    });

    document.querySelectorAll(".matrix-not-helpful-btn").forEach(btn => {
        btn.onclick = () => {
            const title = btn.dataset.title;
            sendFeedback(title, false);
        };
    });
}

function sendFeedback(title, helpful) {
    // Disable buttons briefly to avoid spam
    disableAllFeedbackButtons(true);

    fetch("https://smart-task-analyser.onrender.com/api/tasks/feedback/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, helpful })
    })
    .then(async res => {
        let json = {};
        try { json = await res.json(); } catch {}
        if (!res.ok) throw new Error(json.error || "Feedback failed");
        // show small confirmation
        toast((helpful ? "Marked helpful: " : "Marked not helpful: ") + title);
        // re-run analysis so new learning weights take effect
        setTimeout(() => analyzeAndRender(), 300);
    })
    .catch(err => {
        console.error("Feedback error", err);
        alert("Failed to send feedback.");
    })
    .finally(() => {
        // re-enable after short delay
        setTimeout(() => disableAllFeedbackButtons(false), 600);
    });
}

function disableAllFeedbackButtons(disable) {
    document.querySelectorAll(".helpful-btn, .not-helpful-btn, .matrix-helpful-btn, .matrix-not-helpful-btn")
        .forEach(b => b.disabled = disable);
}

// small toast helper
function toast(msg) {
    // create single ephemeral toast at bottom-left
    let existing = document.getElementById("__task_toast");
    if (existing) existing.remove();
    const t = document.createElement("div");
    t.id = "__task_toast";
    t.textContent = msg;
    t.style.position = "fixed";
    t.style.left = "16px";
    t.style.bottom = "16px";
    t.style.background = "rgba(0,0,0,0.85)";
    t.style.color = "white";
    t.style.padding = "8px 12px";
    t.style.borderRadius = "6px";
    t.style.zIndex = 9999;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

// ---------------- Dependency Graph Rendering ----------------
function renderDependencyGraph(tasks, strategy) {
    const nodes = [];
    const edges = [];

    tasks.forEach((task, index) => {
        let bg = "#e8f0fe";
        let border = "#1a73e8";

        if (strategy === "High Impact") {
            let intensity = Math.max(0, 255 - (task.importance || 0) * 18);
            bg = `rgb(255, ${intensity}, ${intensity})`;
            border = "#b30000";
        } else if (strategy === "Fastest Wins") {
            let eff = Math.min(task.estimated_hours || 0, 10);
            let intensity = 255 - eff * 15;
            bg = `rgb(220, 255, ${intensity})`;
            border = "#008000";
        } else if (strategy === "Deadline Driven") {
            let urgency = Math.min(30, 30 - (task.working_days || 0));
            let intensity = 255 - urgency * 7;
            bg = `rgb(255, ${intensity}, ${intensity})`;
            border = "#cc0000";
        } else {
            bg = "#dce7ff";
            border = "#3050ff";
        }

        nodes.push({
            id: index,
            label: `${task.title}\n(${task.working_days} days left)`,
            shape: "box",
            color: { background: bg, border: border }
        });

        (task.dependencies || []).forEach(depId => {
            edges.push({
                from: depId,
                to: index,
                arrows: "to",
                color: "#666"
            });
        });
    });

    const container = document.getElementById("dependencyGraph");
    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    const options = {
        nodes: { font: { size: 14 } },
        edges: { smooth: true },
        layout: { hierarchical: { direction: "LR", sortMethod: "directed" } },
        physics: { enabled: false }
    };

    // clear previous network if any by replacing container content
    container.innerHTML = "";
    new vis.Network(container, data, options);
}

// ---------------- Eisenhower Matrix Rendering ----------------
function renderMatrix(tasks) {
    document.querySelectorAll(".matrix-list").forEach(list => list.innerHTML = "");

    tasks.forEach(task => {
        const urgent = (typeof task.working_days === "number") ? task.working_days <= 3 : false;
        const important = (typeof task.importance === "number") ? task.importance >= 6 : false;

        let quadrant = "";
        if (urgent && important) quadrant = "q1";
        else if (!urgent && important) quadrant = "q2";
        else if (urgent && !important) quadrant = "q3";
        else quadrant = "q4";

        const item = document.createElement("div");
        item.className = "matrix-item";

        // content: title + days left + inline feedback buttons
        item.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <div style="flex:1;">${escapeHtml(task.title)} <span style="opacity:0.8">(${task.working_days} days left)</span></div>
                <div style="flex:none;display:flex;gap:6px;">
                    <button class="btn-small matrix-helpful-btn" data-title="${escapeAttr(task.title)}">👍</button>
                    <button class="btn-small matrix-not-helpful-btn" data-title="${escapeAttr(task.title)}">👎</button>
                </div>
            </div>
        `;

        document.querySelector(`#${quadrant} .matrix-list`).appendChild(item);
    });

    // attach matrix feedback handlers (some browsers need them)
    attachFeedbackHandlers(tasks);
}

// ---------------- Helpers ----------------
function getPriorityLevel(score) {
    if (score >= 7) return "high";
    if (score >= 4) return "medium";
    return "low";
}

function showError(msg) {
    const errorMsg = document.getElementById("errorMsg");
    errorMsg.textContent = msg;
    errorMsg.classList.remove("hidden");
}

// small escaping helpers for safety
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
function escapeAttr(s) {
    return String(s).replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

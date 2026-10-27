/* MEDIORA script.js
   Compact Chart.js charts plus medicine and health tracker API helpers.
   Check the element IDs below against your index.html if any section does not appear.
*/
const API_BASE = "http://127.0.0.1:5000";
let charts = {};

document.addEventListener("DOMContentLoaded", () => {
  bind("medicineForm", addMedicine);
  bind("healthForm", saveHealthRecord);
  const csvForm = byId("healthCSVForm") || byId("csvForm") || byId("uploadCSVForm");
  if (csvForm) csvForm.addEventListener("submit", e => { e.preventDefault(); analyzeHealthCSV(); });
  const csvButton = byId("analyzeCSVButton");
  if (csvButton && !csvForm) csvButton.addEventListener("click", analyzeHealthCSV);
  loadMedicines();
  loadDashboard();
  loadHistory();
  loadHealthRecords();
  loadReminders();
});

function byId(id) { return document.getElementById(id); }
function first(ids) { for (const id of ids) if (byId(id)) return byId(id); return null; }
function bind(id, fn) {
  const form = byId(id);
  if (form) form.addEventListener("submit", async e => { e.preventDefault(); await fn(); });
}
function field(ids) { const el = first(ids); return el ? el.value.trim() : ""; }
function setText(ids, value) { const el = first(ids); if (el) el.textContent = value ?? ""; }
function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}
function message(text, type = "info") {
  const el = first(["message", "statusMessage", "alertMessage"]);
  if (el) { el.textContent = text; el.className = `message ${type}`; }
  else console.log(text);
}
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const isJSON = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJSON ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  return data;
}
function jsonOptions(method, data) {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

async function addMedicine() {
  const data = {
    name: field(["medicineName", "medicine_name", "name"]),
    dosage: field(["dosage", "medicineDosage", "medicine_dosage"]),
    reminder_time: field(["reminderTime", "reminder_time", "medicineTime", "time"])
  };
  if (!data.name || !data.dosage || !data.reminder_time) {
    message("Enter medicine name, dosage, and reminder time.", "error"); return;
  }
  try {
    await request("/medicines", jsonOptions("POST", data));
    byId("medicineForm")?.reset();
    message("Medicine added.", "success");
    await Promise.all([loadMedicines(), loadDashboard()]);
  } catch (e) { message(`Could not add medicine: ${e.message}`, "error"); }
}

async function loadMedicines() {
  const root = first(["medicineList", "medicinesList", "medicineContainer", "medicinesContainer"]);
  if (!root) return;
  try {
    const result = await request("/medicines");
    const items = Array.isArray(result) ? result : (result.medicines || []);
    if (!items.length) { root.innerHTML = "<p>No medicines added yet.</p>"; return; }
    root.innerHTML = items.map(m => {
      const id = m.id ?? m.medicine_id;
      return `<article class="medicine-card">
        <div><h3>${safe(m.name ?? m.medicine_name ?? "Medicine")}</h3>
        <p>Dosage: ${safe(m.dosage ?? "—")}</p>
        <p>Reminder: ${safe(m.reminder_time ?? m.time ?? "—")}</p></div>
        <div class="medicine-actions">
        <button class="take-btn" type="button" data-taken="${safe(id)}">Mark Taken</button>
        <button class="delete-btn" type="button" data-delete="${safe(id)}">Delete</button></div></article>`;
    }).join("");
    root.querySelectorAll("[data-taken]").forEach(b => b.addEventListener("click", () => markTaken(b.dataset.taken)));
    root.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => deleteMedicine(b.dataset.delete)));
  } catch (e) { message(`Could not load medicines: ${e.message}`, "error"); }
}
async function markTaken(id) {
  try {
    await request(`/medicines/${encodeURIComponent(id)}/taken`, { method: "POST" });
    message("Medicine marked as taken.", "success");
    await Promise.all([loadMedicines(), loadDashboard(), loadHistory()]);
  } catch (e) { message(e.message, "error"); }
}
async function deleteMedicine(id) {
  if (!confirm("Delete this medicine?")) return;
  try {
    await request(`/medicines/${encodeURIComponent(id)}`, { method: "DELETE" });
    await Promise.all([loadMedicines(), loadDashboard()]);
    message("Medicine deleted.", "success");
  } catch (e) { message(e.message, "error"); }
}
async function loadDashboard() {
  try {
    const d = await request("/dashboard");
    setText(["totalMedicines", "medicineCount", "total-medicines"], d.total_medicines ?? d.medicine_count ?? 0);
    setText(["takenMedicines", "takenCount", "taken-medicines"], d.taken ?? d.taken_count ?? 0);
    setText(["missedMedicines", "missedCount", "missed-medicines"], d.missed ?? d.missed_count ?? 0);
    setText(["nextReminder", "next-reminder"], d.next_reminder ?? "None scheduled");
  } catch (e) { console.warn("Dashboard:", e.message); }
}

async function loadHistory() {
    const table = document.getElementById("historyTable");
    if (!table) {
        console.error("History table not found.");
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:5000/history");

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const result = await response.json();
        const rows = Array.isArray(result)
            ? result
            : (result.history || []);

        if (rows.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="5">No medicine history available yet.</td>
                </tr>`;
            return;
        }

        table.innerHTML = rows.map(item => `
            <tr>
                <td>${safe(item.name ?? item.medicine_name ?? "Medicine")}</td>
                <td>${safe(item.dosage ?? "N/A")}</td>
                <td>${safe(item.reminder_time ?? "N/A")}</td>
                <td>${safe(item.taken_at ?? item.timestamp ?? item.date ?? "N/A")}</td>
                <td><span class="history-status">${safe(item.status ?? "Taken")}</span></td>
            </tr>
        `).join("");

    } catch (error) {
        console.error("Failed to load medicine history:", error);
        table.innerHTML = `
            <tr>
                <td colspan="5">Could not load history. Check that the backend is running.</td>
            </tr>`;
    }
}

async function saveHealthRecord() {
  const data = {
    age: num(field(["healthAge", "age"])),
    weight: num(field(["healthWeight", "weight"])),
    bmi: num(field(["healthBMI", "bmi"])),
    systolic_bp: num(field(["healthSystolic", "systolicBP", "systolic_bp", "systolic"])),
    diastolic_bp: num(field(["healthDiastolic", "diastolicBP", "diastolic_bp", "diastolic"])),
    heart_rate: num(field(["healthHeartRate", "heartRate", "heart_rate"])),
    glucose: num(field(["healthGlucose", "glucose", "bloodGlucose"]))
  };
  if (Object.values(data).every(v => v === null)) {
    message("Enter at least one health measurement.", "error"); return;
  }
  try {
    await request("/health-records", jsonOptions("POST", data));
    byId("healthForm")?.reset();
    message("Health record saved.", "success");
    await loadHealthRecords();
  } catch (e) { message(`Could not save health record: ${e.message}`, "error"); }
}
function num(value) { if (value === "") return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
async function loadHealthRecords() {
  const root = first(["healthHistory", "healthRecords", "healthHistoryTable"]);
  try {
    const result = await request("/health-records");
    const rows = Array.isArray(result) ? result : (result.records || result.health_records || []);
    if (root) root.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr>
      <th>Date</th><th>Age</th><th>Weight</th><th>BMI</th><th>Blood Pressure</th><th>Heart Rate</th><th>Glucose</th>
      </tr></thead><tbody>${rows.map(r => `<tr><td>${safe(r.recorded_at ?? r.date ?? "")}</td>
      <td>${safe(r.age ?? "—")}</td><td>${safe(r.weight ?? "—")}</td><td>${safe(r.bmi ?? "—")}</td>
      <td>${safe(r.systolic_bp ?? "—")} / ${safe(r.diastolic_bp ?? "—")}</td>
      <td>${safe(r.heart_rate ?? "—")}</td><td>${safe(r.glucose ?? "—")}</td></tr>`).join("")}</tbody></table></div>`
      : "<p>No health records saved yet.</p>";
    drawManualCharts(rows);
  } catch (e) { console.warn("Health records:", e.message); }
}

async function analyzeHealthCSV() {
  const input = first(["healthCsv", "healthCSV", "csvFile", "healthCsvFile", "file"]);
  if (!input?.files?.[0]) { message("Choose a CSV file first.", "error"); return; }
  if (!input.files[0].name.toLowerCase().endsWith(".csv")) { message("Choose a .csv file.", "error"); return; }
  const form = new FormData();
  form.append("file", input.files[0]);
  try {
    const result = await request("/health/analyze", { method: "POST", body: form });
    renderSummary(result.summary || result.statistics || {});
    drawCSVCharts(result.charts || result.chart_data || {});
    renderPreview(result.preview || result.data || []);
    message("CSV analysis completed.", "success");
  } catch (e) { message(`CSV analysis failed: ${e.message}`, "error"); }
}
function renderSummary(summary) {
  const root = first(["healthSummary", "csvSummary", "healthCSVSummary", "analysisSummary"]);
  if (!root || !summary || typeof summary !== "object") return;
  const cols = Object.keys(summary);
  const stats = ["count", "mean", "std", "min", "25%", "50%", "75%", "max"];
  root.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Statistic</th>${cols.map(c => `<th>${safe(c)}</th>`).join("")}</tr></thead>
    <tbody>${stats.map(s => `<tr><th>${s}</th>${cols.map(c => `<td>${safe(summary[c]?.[s] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function renderPreview(rows) {
  const root = first(["csvPreview", "healthCSVPreview", "dataPreview"]);
  if (!root || !Array.isArray(rows) || !rows.length) return;
  const cols = Object.keys(rows[0]);
  root.innerHTML = `<div class="table-wrap"><table><thead><tr>${cols.map(c => `<th>${safe(c)}</th>`).join("")}</tr></thead>
    <tbody>${rows.slice(0, 8).map(r => `<tr>${cols.map(c => `<td>${safe(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function drawCSVCharts(data) {
  if (typeof Chart === "undefined") {
    message("Chart.js is missing. Load Chart.js before script.js.", "error"); return;
  }
  const labels = data.labels || data.patient_ids || data.Patient_ID || [];
  const systolic = data.systolic_bp || data.Systolic_BP || [];
  const diastolic = data.diastolic_bp || data.Diastolic_BP || [];
  const heart = data.heart_rate || data.Heart_Rate || [];
  const bmi = data.bmi || data.BMI || [];
  const glucose = data.glucose || data.Glucose || [];

  const bp = byId("csvBPChart");
  if (bp && (systolic.length || diastolic.length)) {
    charts.bp = makeChart(bp, "bar", chartLabels(labels, Math.max(systolic.length, diastolic.length)), [
      { label: "Systolic BP", data: systolic, backgroundColor: "rgba(56,189,248,.75)", borderRadius: 4 },
      { label: "Diastolic BP", data: diastolic, backgroundColor: "rgba(129,140,248,.75)", borderRadius: 4 }
    ], "mmHg", true);
  }
  const hr = byId("csvHeartChart");
  if (hr && heart.length) charts.heart = makeChart(hr, "line", chartLabels(labels, heart.length), [
    { label: "Heart Rate", data: heart, borderColor: "#2dd4bf", backgroundColor: "rgba(45,212,191,.12)", fill: true, tension: .3, pointRadius: 2 }
  ], "BPM", false);
  const bmiCanvas = byId("csvBMIChart");
  if (bmiCanvas && bmi.length) charts.bmi = makeChart(bmiCanvas, "bar", chartLabels(labels, bmi.length), [
    { label: "BMI", data: bmi, backgroundColor: "rgba(96,165,250,.75)", borderRadius: 4 }
  ], "BMI", false);
  const glucoseCanvas = byId("csvGlucoseChart");
  if (glucoseCanvas && glucose.length) charts.glucose = makeChart(glucoseCanvas, "line", chartLabels(labels, glucose.length), [
    { label: "Glucose", data: glucose, borderColor: "#fbbf24", backgroundColor: "rgba(251,191,36,.12)", fill: true, tension: .3, pointRadius: 2 }
  ], "Glucose", false);
}
function drawManualCharts(rows) {
  if (typeof Chart === "undefined" || !rows.length) return;
  const bp = byId("bpChart");
  if (bp) charts.manualBP = makeChart(bp, "line", rows.map(r => r.recorded_at || r.date || r.created_at || ""), [
    { label: "Systolic BP", data: rows.map(r => r.systolic_bp), borderColor: "#38bdf8", tension: .3, pointRadius: 2 },
    { label: "Diastolic BP", data: rows.map(r => r.diastolic_bp), borderColor: "#818cf8", tension: .3, pointRadius: 2 }
  ], "mmHg", true);
  const hr = byId("heartRateChart");
  if (hr) charts.manualHR = makeChart(hr, "line", rows.map(r => r.recorded_at || r.date || r.created_at || ""), [
    { label: "Heart Rate", data: rows.map(r => r.heart_rate), borderColor: "#2dd4bf", tension: .3, pointRadius: 2 }
  ], "BPM", false);
}
function chartLabels(labels, length) {
  return Array.isArray(labels) && labels.length === length
    ? labels : Array.from({ length }, (_, i) => `Record ${i + 1}`);
}
function makeChart(canvas, type, labels, datasets, yTitle, showLegend) {
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  return new Chart(canvas, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: {
          display: showLegend,
          position: "bottom",
          labels: { color: "#dbeafe", boxWidth: 9, boxHeight: 9, padding: 8, font: { size: 10 } }
        },
        title: { display: false }
      },
      layout: { padding: 3 },
      scales: {
        x: {
          ticks: { color: "#cbd5e1", maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 9 } },
          grid: { color: "rgba(148,163,184,.10)" },
          border: { display: false }
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: yTitle, color: "#cbd5e1", font: { size: 10 } },
          ticks: { color: "#cbd5e1", maxTicksLimit: 5, font: { size: 9 } },
          grid: { color: "rgba(148,163,184,.12)" },
          border: { display: false }
        }
      }
    }
  });
}

async function loadReminders() {
    const container = document.getElementById("reminderList");
    if (!container) return;

    try {
        const response = await fetch("http://127.0.0.1:5000/medicines");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        const medicines = Array.isArray(result)
            ? result
            : (result.medicines || []);

        if (medicines.length === 0) {
            container.innerHTML = `
                <div class="empty-state glass">
                    <div class="empty-icon">⏰</div>
                    <h3>No upcoming reminders</h3>
                    <p>Add a medicine to schedule a reminder.</p>
                </div>`;
            return;
        }

        container.innerHTML = medicines.map(m => `
            <div class="reminder-card">
                <div class="reminder-info">
                    <div>
                        <h3>${safe(m.name ?? m.medicine_name ?? "Medicine")}</h3>
                        <p>Dosage: ${safe(m.dosage ?? "N/A")}</p>
                        <p class="reminder-time">
                            ${safe(m.reminder_time ?? m.time ?? "No time set")}
                        </p>
                    </div>
                </div>
            </div>
        `).join("");

    } catch (error) {
        console.error("Reminder loading failed:", error);
        container.innerHTML = `
            <div class="empty-state glass">
                <h3>Could not load reminders</h3>
                <p>Check that the Flask backend is running.</p>
            </div>`;
    }
}

import { firebaseConfig } from "./firebase-config.js";

/* ======================================================================
   CONFIGURAZIONE — modifica qui elenco volontari e orari standard
   ====================================================================== */

// Aggiungi "responsabile: true" ai volontari che ricoprono un ruolo di responsabile.
const VOLONTARI = [
  { nome: "Anna Bianchi", responsabile: true },
  { nome: "Marco Rossi", responsabile: false },
  { nome: "Giulia Verdi", responsabile: false },
  { nome: "Luca Ferrari", responsabile: false },
  { nome: "Sara Romano", responsabile: false },
  { nome: "Paolo Colombo", responsabile: false },
];

function isResponsabile(persona) {
  const v = VOLONTARI.find((v) => v.nome === persona);
  return !!(v && v.responsabile);
}

const ORARI_STANDARD = {
  mattina: { inizio: "08:30", fine: "12:30", label: "Mattina", icona: "🌅" },
  pomeriggio: { inizio: "14:30", fine: "18:30", label: "Pomeriggio", icona: "🌇" },
};

// Il calendario non mostra giorni precedenti a questa data (avvio della piattaforma).
const CALENDARIO_INIZIO = "2026-07-06";

// Soglie colore copertura: numero di volontari registrati per quel turno/giorno.
// 0 = urgente, 1-2 = scarso, 3 = medio, 4+ = ben coperto.
function coverageLevel(count) {
  if (count <= 0) return "empty";
  if (count <= 2) return "low";
  if (count === 3) return "mid";
  return "good";
}

const DOG_PHOTOS = [
  "assets/dog-happy-1.jpeg",
  "assets/dog-happy-2.jpeg",
  "assets/dog-happy-3.jpeg",
  "assets/dog-happy-4.jpeg",
];

const DOG_MESSAGES = [
  "Grazie, ti porterò la mia pallina preferita! 🎾",
  "Non vedo l'ora di passare del tempo insieme!",
  "Ecco qui per te il mio sorriso migliore 😄",
  "Scodinzolo già dalla gioia!",
  "Ti aspetto con la coda che non sta ferma un attimo!",
  "Grazie di cuore, ci vediamo presto!",
  "Hai appena fatto la mia giornata!",
  "Preparo le coccole migliori per te 🐾",
];

const GIORNI_SETTIMANA = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

/* ======================================================================
   STRATO DATI — Firestore se configurato, altrimenti localStorage
   ====================================================================== */

const isFirebaseConfigured = !Object.values(firebaseConfig).some((v) =>
  String(v).startsWith("INSERISCI_")
);

let db = null;
let entries = [];
let logEntries = [];
let entriesListeners = [];
let logListeners = [];

function notifyEntries() { entriesListeners.forEach((cb) => cb(entries)); }
function notifyLog() { logListeners.forEach((cb) => cb(logEntries)); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---- Backend: localStorage (fallback / demo) ---- */
const LS_ENTRIES_KEY = "scodinzolando_entries";
const LS_LOG_KEY = "scodinzolando_log";

const localBackend = {
  async init() {
    entries = JSON.parse(localStorage.getItem(LS_ENTRIES_KEY) || "[]");
    logEntries = JSON.parse(localStorage.getItem(LS_LOG_KEY) || "[]");
    window.addEventListener("storage", (e) => {
      if (e.key === LS_ENTRIES_KEY) {
        entries = JSON.parse(localStorage.getItem(LS_ENTRIES_KEY) || "[]");
        notifyEntries();
      }
      if (e.key === LS_LOG_KEY) {
        logEntries = JSON.parse(localStorage.getItem(LS_LOG_KEY) || "[]");
        notifyLog();
      }
    });
    notifyEntries();
    notifyLog();
    setConnectionStatus("local");
  },
  async createEntry(data) {
    const entry = { id: uid(), ...data, createdAt: Date.now(), updatedAt: Date.now() };
    entries.push(entry);
    localStorage.setItem(LS_ENTRIES_KEY, JSON.stringify(entries));
    notifyEntries();
    return entry.id;
  },
  async updateEntry(id, data) {
    entries = entries.map((e) => (e.id === id ? { ...e, ...data, updatedAt: Date.now() } : e));
    localStorage.setItem(LS_ENTRIES_KEY, JSON.stringify(entries));
    notifyEntries();
  },
  async deleteEntry(id) {
    entries = entries.filter((e) => e.id !== id);
    localStorage.setItem(LS_ENTRIES_KEY, JSON.stringify(entries));
    notifyEntries();
  },
  async createLog(data) {
    const item = { id: uid(), ...data, timestamp: Date.now() };
    logEntries.unshift(item);
    localStorage.setItem(LS_LOG_KEY, JSON.stringify(logEntries));
    notifyLog();
  },
};

/* ---- Backend: Firebase Firestore ---- */
const firestoreBackend = {
  async init() {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
    const {
      getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
      onSnapshot, query, orderBy, serverTimestamp, enableIndexedDbPersistence,
    } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    this._fns = { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp };

    try { await enableIndexedDbPersistence(db); } catch (_) { /* più tab aperte: ignorabile */ }

    const entriesQuery = query(collection(db, "entries"), orderBy("data", "asc"));
    onSnapshot(
      entriesQuery,
      (snap) => {
        entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        notifyEntries();
        setConnectionStatus("online");
      },
      () => setConnectionStatus("offline")
    );

    const logQuery = query(collection(db, "log"), orderBy("timestamp", "desc"));
    onSnapshot(logQuery, (snap) => {
      logEntries = snap.docs.map((d) => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toMillis?.() ?? Date.now() }));
      notifyLog();
    });
  },
  async createEntry(data) {
    const { collection, addDoc, serverTimestamp } = this._fns;
    const ref = await addDoc(collection(db, "entries"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return ref.id;
  },
  async updateEntry(id, data) {
    const { doc, updateDoc, serverTimestamp } = this._fns;
    await updateDoc(doc(db, "entries", id), { ...data, updatedAt: serverTimestamp() });
  },
  async deleteEntry(id) {
    const { doc, deleteDoc } = this._fns;
    await deleteDoc(doc(db, "entries", id));
  },
  async createLog(data) {
    const { collection, addDoc, serverTimestamp } = this._fns;
    await addDoc(collection(db, "log"), { ...data, timestamp: serverTimestamp() });
  },
};

const backend = isFirebaseConfigured ? firestoreBackend : localBackend;

function setConnectionStatus(status) {
  const el = document.getElementById("connection-status");
  if (!el) return;
  el.classList.remove("status-online", "status-offline", "status-local");
  if (status === "online") { el.textContent = "🟢 Sincronizzato"; el.classList.add("status-online"); }
  else if (status === "local") { el.textContent = "💾 Modalità locale"; el.classList.add("status-local"); }
  else { el.textContent = "🔴 Offline"; el.classList.add("status-offline"); }
}

/* ======================================================================
   UTILITÀ
   ====================================================================== */

function pad(n) { return String(n).padStart(2, "0"); }
function toDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayKey() { return toDateKey(new Date()); }
function formatDateHuman(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${GIORNI_SETTIMANA[(date.getDay() + 6) % 7]} ${d} ${MESI[m - 1]} ${y}`;
}
function turnoLabel(entry) {
  if (entry.turno === "libero") return `Libero ${entry.oraInizio || "?"}–${entry.oraFine || "?"}`;
  const std = ORARI_STANDARD[entry.turno];
  return std ? `${std.icona} ${std.label} (${std.inizio}–${std.fine})` : entry.turno;
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function showToast(message, isError = false) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " toast-error" : "");
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ======================================================================
   EXPORT EXCEL
   ====================================================================== */

function initExport() {
  document.getElementById("btn-export-excel").addEventListener("click", exportToExcel);
}

async function exportToExcel() {
  if (!entries.length) {
    showToast("Nessun inserimento da esportare.", true);
    return;
  }
  const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");

  const rows = entries
    .slice()
    .sort((a, b) => (a.data > b.data ? 1 : a.data < b.data ? -1 : 0))
    .map((e) => ({
      Data: e.data,
      Giorno: formatDateHuman(e.data),
      "Volontario/a": e.persona,
      Turno: e.turno === "libero" ? "Libero" : ORARI_STANDARD[e.turno]?.label || e.turno,
      Orario: e.turno === "libero"
        ? `${e.oraInizio || "?"}–${e.oraFine || "?"}`
        : `${ORARI_STANDARD[e.turno]?.inizio || ""}–${ORARI_STANDARD[e.turno]?.fine || ""}`,
      Note: e.note || "",
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presenze");
  XLSX.writeFile(wb, `presenze_scodinzolando_${todayKey()}.xlsx`);
}

/* ======================================================================
   TABS
   ====================================================================== */

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
}

/* ======================================================================
   MODALI
   ====================================================================== */

function openModal(html) {
  document.getElementById("modal-content").innerHTML = html;
  document.getElementById("modal-overlay").classList.remove("hidden");
}
function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }

function showDogModal() {
  const img = document.getElementById("modal-dog-img");
  const text = document.getElementById("modal-dog-text");
  img.src = DOG_PHOTOS[Math.floor(Math.random() * DOG_PHOTOS.length)];
  img.alt = "Cane felice";
  text.textContent = DOG_MESSAGES[Math.floor(Math.random() * DOG_MESSAGES.length)];
  document.getElementById("dog-modal-overlay").classList.remove("hidden");
}
function closeDogModal() { document.getElementById("dog-modal-overlay").classList.add("hidden"); }

function initModals() {
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => { if (e.target.id === "modal-overlay") closeModal(); });
  document.getElementById("modal-dog-close").addEventListener("click", closeDogModal);
  document.getElementById("dog-modal-overlay").addEventListener("click", (e) => { if (e.target.id === "dog-modal-overlay") closeDogModal(); });
}

/* ======================================================================
   POPOLAMENTO SELECT PERSONE
   ====================================================================== */

function populatePersonSelects() {
  const selects = [
    { el: document.getElementById("f-persona"), withAll: false },
    { el: document.getElementById("filter-persona"), withAll: true },
    { el: document.getElementById("log-filter-persona"), withAll: true },
  ];
  selects.forEach(({ el, withAll }) => {
    el.innerHTML = "";
    if (withAll) el.appendChild(new Option("Tutti/e", ""));
    VOLONTARI.forEach((v) => el.appendChild(new Option(v.responsabile ? `★ ${v.nome}` : v.nome, v.nome)));
  });
}

/* ======================================================================
   CALENDARIO
   ====================================================================== */

let calViewDate = new Date();

function initCalendar() {
  document.getElementById("cal-weekdays").innerHTML = GIORNI_SETTIMANA
    .map((g) => `<div class="cal-weekday">${g}</div>`).join("");
  document.getElementById("cal-prev").addEventListener("click", () => { calViewDate.setMonth(calViewDate.getMonth() - 1); renderCalendar(); });
  document.getElementById("cal-next").addEventListener("click", () => { calViewDate.setMonth(calViewDate.getMonth() + 1); renderCalendar(); });
  document.getElementById("cal-today").addEventListener("click", () => { calViewDate = new Date(); renderCalendar(); });
  entriesListeners.push(() => renderCalendar());
}

function renderCalendar() {
  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();
  document.getElementById("cal-title").textContent = `${MESI[month]} ${year}`;

  const [inizioYear, inizioMonth] = CALENDARIO_INIZIO.split("-").map(Number);
  const isStartMonth = year === inizioYear && month === inizioMonth - 1;
  document.getElementById("cal-prev").disabled = isStartMonth;

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // lunedì = 0
  const gridStart = new Date(year, month, 1 - startOffset);

  const byDate = groupEntriesByDate();

  let html = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = toDateKey(d);

    if (key < CALENDARIO_INIZIO) {
      html += `<div class="cal-day cal-day-blank"></div>`;
      continue;
    }

    const dayEntries = byDate[key] || [];
    const isOutside = d.getMonth() !== month;
    const isToday = key === todayKey();

    const mattinaEntries = dayEntries.filter((e) => e.turno === "mattina");
    const pomeriggioEntries = dayEntries.filter((e) => e.turno === "pomeriggio");
    const liberoEntries = dayEntries.filter((e) => e.turno === "libero");
    const mattinaResp = mattinaEntries.some((e) => isResponsabile(e.persona));
    const pomeriggioResp = pomeriggioEntries.some((e) => isResponsabile(e.persona));
    const liberoResp = liberoEntries.some((e) => isResponsabile(e.persona));

    const slots = `
      <span class="slot-dot coverage-${coverageLevel(mattinaEntries.length)} ${mattinaResp ? "has-responsabile" : ""}" title="Mattina: ${mattinaEntries.length} presenti${mattinaResp ? " (con responsabile)" : ""}"></span>
      <span class="slot-dot coverage-${coverageLevel(pomeriggioEntries.length)} ${pomeriggioResp ? "has-responsabile" : ""}" title="Pomeriggio: ${pomeriggioEntries.length} presenti${pomeriggioResp ? " (con responsabile)" : ""}"></span>
    `;

    html += `
      <div class="cal-day ${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""} ${dayEntries.length ? "has-data" : ""}" data-date="${key}">
        ${liberoEntries.length ? `<span class="cal-day-star">${liberoResp ? "👑" : "⭐"}</span>` : ""}
        <span class="cal-day-num">${d.getDate()}</span>
        <div class="cal-day-slots">${slots}</div>
      </div>
    `;
  }
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = html;
  grid.querySelectorAll(".cal-day[data-date]").forEach((cell) => {
    cell.addEventListener("click", () => openDayDetail(cell.dataset.date));
  });
}

function groupEntriesByDate() {
  const map = {};
  entries.forEach((e) => { (map[e.data] = map[e.data] || []).push(e); });
  return map;
}

function openDayDetail(dateKey) {
  const dayEntries = entries.filter((e) => e.data === dateKey)
    .sort((a, b) => (a.turno > b.turno ? 1 : -1));

  const rows = dayEntries.length
    ? dayEntries.map((e) => entryRowHtml(e, true)).join("")
    : `<div class="empty-state">Nessun turno registrato per questo giorno.</div>`;

  openModal(`
    <h3>${formatDateHuman(dateKey)}</h3>
    <div id="day-detail-list">${rows}</div>
    <button class="btn btn-primary" style="margin-top:14px;width:100%;" id="day-detail-add">＋ Aggiungi turno per questo giorno</button>
  `);

  document.getElementById("day-detail-add").addEventListener("click", () => {
    closeModal();
    resetForm();
    document.getElementById("f-data").value = dateKey;
    switchTab("inserisci");
  });
  bindEntryRowActions(document.getElementById("day-detail-list"), () => openDayDetail(dateKey));
}

/* ======================================================================
   FORM INSERIMENTO
   ====================================================================== */

let editingId = null;

function initForm() {
  document.getElementById("f-data").value = todayKey();

  document.querySelectorAll("#f-turno-group .toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setToggleValue("f-turno-group", btn.dataset.value);
      document.getElementById("libero-orari").classList.toggle("hidden", btn.dataset.value !== "libero");
    });
  });

  document.getElementById("entry-form").addEventListener("submit", onSubmitEntry);
  document.getElementById("btn-cancel-edit").addEventListener("click", resetForm);

  document.getElementById("filter-persona").addEventListener("change", renderEntriesList);
  document.getElementById("filter-periodo").addEventListener("change", renderEntriesList);

  entriesListeners.push(() => renderEntriesList());
}

function setToggleValue(groupId, value) {
  const group = document.getElementById(groupId);
  group.dataset.selected = value;
  group.querySelectorAll(".toggle-btn").forEach((b) => b.classList.toggle("active", b.dataset.value === value));
}

function getToggleValue(groupId) { return document.getElementById(groupId).dataset.selected || ""; }

function resetForm() {
  editingId = null;
  document.getElementById("entry-form").reset();
  document.getElementById("f-entry-id").value = "";
  document.getElementById("f-data").value = todayKey();
  setToggleValue("f-turno-group", "");
  document.getElementById("libero-orari").classList.add("hidden");
  document.getElementById("entry-form-title").textContent = "Nuovo inserimento";
  document.getElementById("btn-save-entry").textContent = "Salva";
  document.getElementById("btn-cancel-edit").classList.add("hidden");
}

async function onSubmitEntry(e) {
  e.preventDefault();

  const persona = document.getElementById("f-persona").value;
  const data = document.getElementById("f-data").value;
  const turno = getToggleValue("f-turno-group");
  const note = document.getElementById("f-note").value.trim();

  if (!persona || !data || !turno) {
    showToast("Compila tutti i campi obbligatori.", true);
    return;
  }

  let oraInizio = "", oraFine = "";
  if (turno === "libero") {
    oraInizio = document.getElementById("f-ora-inizio").value;
    oraFine = document.getElementById("f-ora-fine").value;
    if (!oraInizio || !oraFine) {
      showToast("Indica l'orario del turno libero.", true);
      return;
    }
  }

  const payload = { persona, data, turno, oraInizio, oraFine, note };
  const wasEditing = !!editingId;

  try {
    if (wasEditing) {
      await backend.updateEntry(editingId, payload);
      await backend.createLog({
        azione: "modifica",
        persona,
        entryId: editingId,
        dettagli: `${persona} — ${turnoLabel(payload)} — ${formatDateHuman(data)}`,
      });
      showToast("Inserimento aggiornato.");
    } else {
      const id = await backend.createEntry(payload);
      await backend.createLog({
        azione: "creazione",
        persona,
        entryId: id,
        dettagli: `${persona} — ${turnoLabel(payload)} — ${formatDateHuman(data)}`,
      });
      showToast("Inserimento salvato.");
    }
    resetForm();
    showDogModal();
  } catch (err) {
    console.error(err);
    showToast("Errore durante il salvataggio.", true);
  }
}

function startEdit(entry) {
  editingId = entry.id;
  document.getElementById("f-entry-id").value = entry.id;
  document.getElementById("f-persona").value = entry.persona;
  document.getElementById("f-data").value = entry.data;
  setToggleValue("f-turno-group", entry.turno);
  document.getElementById("libero-orari").classList.toggle("hidden", entry.turno !== "libero");
  if (entry.turno === "libero") {
    document.getElementById("f-ora-inizio").value = entry.oraInizio || "";
    document.getElementById("f-ora-fine").value = entry.oraFine || "";
  }
  document.getElementById("f-note").value = entry.note || "";
  document.getElementById("entry-form-title").textContent = "Modifica inserimento";
  document.getElementById("btn-save-entry").textContent = "Aggiorna";
  document.getElementById("btn-cancel-edit").classList.remove("hidden");
  switchTab("inserisci");
  document.getElementById("entry-form").scrollIntoView({ behavior: "smooth" });
}

async function deleteEntry(entry) {
  if (!confirm(`Eliminare l'inserimento di ${entry.persona} (${formatDateHuman(entry.data)})?`)) return;
  try {
    await backend.deleteEntry(entry.id);
    await backend.createLog({
      azione: "eliminazione",
      persona: entry.persona,
      entryId: entry.id,
      dettagli: `${entry.persona} — ${turnoLabel(entry)} — ${formatDateHuman(entry.data)}`,
    });
    showToast("Inserimento eliminato.");
  } catch (err) {
    console.error(err);
    showToast("Errore durante l'eliminazione.", true);
  }
}

/* ======================================================================
   LISTA INSERIMENTI
   ====================================================================== */

function entryRowHtml(e, compact = false) {
  const resp = isResponsabile(e.persona);
  const nomeHtml = resp ? `<strong class="nome-responsabile">${escapeHtml(e.persona)}</strong>` : escapeHtml(e.persona);
  return `
    <div class="entry-item" data-id="${e.id}">
      <div class="entry-main">
        <div class="entry-title">${nomeHtml}${compact ? "" : ` — ${formatDateHuman(e.data)}`}</div>
        <div class="entry-sub">${resp ? `<span class="badge badge-responsabile">★ Responsabile</span>` : ""}<span class="badge badge-turno">${turnoLabel(e)}</span></div>
        ${e.note ? `<div class="entry-note">"${escapeHtml(e.note)}"</div>` : ""}
      </div>
      <div class="entry-actions">
        <button class="icon-btn btn-edit" title="Modifica">✏️</button>
        <button class="icon-btn btn-delete" title="Elimina">🗑️</button>
      </div>
    </div>
  `;
}

function bindEntryRowActions(container, onChange) {
  container.querySelectorAll(".entry-item").forEach((row) => {
    const id = row.dataset.id;
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    row.querySelector(".btn-edit").addEventListener("click", () => { closeModal(); startEdit(entry); });
    row.querySelector(".btn-delete").addEventListener("click", async () => { await deleteEntry(entry); onChange?.(); });
  });
}

function renderEntriesList() {
  const personaFilter = document.getElementById("filter-persona").value;
  const periodo = document.getElementById("filter-periodo").value;
  const today = todayKey();

  let list = entries.slice();
  if (personaFilter) list = list.filter((e) => e.persona === personaFilter);
  if (periodo === "futuri") list = list.filter((e) => e.data >= today);
  if (periodo === "passati") list = list.filter((e) => e.data < today);

  list.sort((a, b) => (a.data > b.data ? 1 : a.data < b.data ? -1 : 0));

  const container = document.getElementById("entries-list");
  container.innerHTML = list.length
    ? list.map((e) => entryRowHtml(e)).join("")
    : `<div class="empty-state">Nessun inserimento trovato.</div>`;
  bindEntryRowActions(container);
}

/* ======================================================================
   STATISTICHE
   ====================================================================== */

function initStats() {
  document.getElementById("stats-periodo").addEventListener("change", renderStats);
  entriesListeners.push(() => renderStats());
}

function renderStats() {
  const days = Number(document.getElementById("stats-periodo").value);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = toDateKey(cutoff);

  // Esclude gli inserimenti caricati in blocco prima dell'anagrafica reale (solo per visibilità in calendario).
  const list = entries.filter((e) => e.data >= cutoffKey && !e.excludeFromStats);
  const giorniCoperti = new Set(list.map((e) => e.data)).size;

  // turno più scoperto: tra i giorni/turni standard con almeno un inserimento, il minimo presenze
  const byDate = {};
  list.forEach((e) => { (byDate[e.data] = byDate[e.data] || []).push(e); });
  let minKey = null, minCount = Infinity;
  Object.entries(byDate).forEach(([date, es]) => {
    ["mattina", "pomeriggio"].forEach((turno) => {
      const count = es.filter((e) => e.turno === turno).length;
      if (count < minCount) { minCount = count; minKey = `${formatDateHuman(date)} — ${ORARI_STANDARD[turno].label}`; }
    });
  });

  const perPersona = {};
  list.forEach((e) => { perPersona[e.persona] = (perPersona[e.persona] || 0) + 1; });
  const topPersona = Object.entries(perPersona).sort((a, b) => b[1] - a[1])[0];

  document.getElementById("stats-cards").innerHTML = `
    <div class="stat-card"><div class="stat-value">${list.length}</div><div class="stat-label">Presenze registrate</div></div>
    <div class="stat-card"><div class="stat-value">${giorniCoperti}</div><div class="stat-label">Giorni coperti</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:13px;">${topPersona ? escapeHtml(topPersona[0]) : "—"}</div><div class="stat-label">Volontario/a più attivo/a</div></div>
    <div class="stat-card"><div class="stat-value" style="font-size:13px;">${minKey ? escapeHtml(minKey) : "—"}</div><div class="stat-label">Turno più scoperto</div></div>
  `;

  renderPerPersonaStats(list);
  renderCoverageTable(list);
}

function renderPerPersonaStats(list) {
  const counts = {};
  VOLONTARI.forEach((v) => (counts[v.nome] = 0));
  list.forEach((e) => { if (e.persona in counts) counts[e.persona]++; });

  const maxVal = Math.max(1, ...Object.values(counts));

  const html = VOLONTARI.map((v) => `
    <div class="bar-row">
      <div class="bar-name" title="${escapeHtml(v.nome)}">${v.responsabile ? `<strong>★ ${escapeHtml(v.nome)}</strong>` : escapeHtml(v.nome)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(counts[v.nome] / maxVal) * 100}%"></div></div>
      <div class="bar-count">${counts[v.nome]}</div>
    </div>
  `).join("");

  document.getElementById("stats-per-persona").innerHTML = html || `<div class="empty-state">Nessun dato.</div>`;
}

function renderCoverageTable(list) {
  const byWeekday = {}; // 0=Lun..6=Dom -> {mattina:[], pomeriggio:[]}
  GIORNI_SETTIMANA.forEach((_, i) => (byWeekday[i] = { mattina: [], pomeriggio: [] }));

  const byDate = {};
  list.forEach((e) => { (byDate[e.data] = byDate[e.data] || []).push(e); });

  Object.entries(byDate).forEach(([date, es]) => {
    const [y, m, d] = date.split("-").map(Number);
    const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
    ["mattina", "pomeriggio"].forEach((turno) => {
      const count = es.filter((e) => e.turno === turno).length;
      byWeekday[wd][turno].push(count);
    });
  });

  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  let html = `
    <div class="coverage-table">
      <div class="cell head"></div>
      <div class="cell head">Mattina</div>
      <div class="cell head">Pomeriggio</div>
  `;
  GIORNI_SETTIMANA.forEach((g, i) => {
    const m = avg(byWeekday[i].mattina);
    const p = avg(byWeekday[i].pomeriggio);
    html += `
      <div class="cell head" style="text-align:left;">${g}</div>
      <div class="cell coverage-${coverageLevel(Math.round(m))}">${m ? m.toFixed(1) : "–"}</div>
      <div class="cell coverage-${coverageLevel(Math.round(p))}">${p ? p.toFixed(1) : "–"}</div>
    `;
  });
  html += `</div>`;
  document.getElementById("stats-coverage").innerHTML = html;
}

/* ======================================================================
   LOG
   ====================================================================== */

const LOG_ICONS = { creazione: "➕", modifica: "✏️", eliminazione: "🗑️" };
let logPageSize = 30;

function initLog() {
  document.getElementById("log-filter-persona").addEventListener("change", () => { logPageSize = 30; renderLog(); });
  document.getElementById("log-filter-azione").addEventListener("change", () => { logPageSize = 30; renderLog(); });
  document.getElementById("log-load-more").addEventListener("click", () => { logPageSize += 30; renderLog(); });
  logListeners.push(() => renderLog());
}

function renderLog() {
  const persona = document.getElementById("log-filter-persona").value;
  const azione = document.getElementById("log-filter-azione").value;

  // Esclude i log del caricamento in blocco pre-anagrafica (solo per visibilità in calendario).
  let list = logEntries.filter((l) => !l.excludeFromStats);
  if (persona) list = list.filter((l) => l.persona === persona);
  if (azione) list = list.filter((l) => l.azione === azione);
  list.sort((a, b) => b.timestamp - a.timestamp);

  const shown = list.slice(0, logPageSize);
  const container = document.getElementById("log-list");
  container.innerHTML = shown.length
    ? shown.map((l) => `
      <div class="log-item">
        <div class="log-main">
          <div><span class="log-icon">${LOG_ICONS[l.azione] || "•"}</span><strong>${escapeHtml(l.dettagli)}</strong></div>
          <div class="log-time">${new Date(l.timestamp).toLocaleString("it-IT")}</div>
        </div>
      </div>
    `).join("")
    : `<div class="empty-state">Nessun evento registrato.</div>`;

  document.getElementById("log-load-more").classList.toggle("hidden", list.length <= logPageSize);
}

/* ======================================================================
   AVVIO
   ====================================================================== */

async function init() {
  initTabs();
  initModals();
  initExport();
  populatePersonSelects();
  initCalendar();
  initForm();
  initStats();
  initLog();
  resetForm();

  setConnectionStatus(isFirebaseConfigured ? "offline" : "local");
  await backend.init();

  renderCalendar();
  renderEntriesList();
  renderStats();
  renderLog();
}

document.addEventListener("DOMContentLoaded", init);

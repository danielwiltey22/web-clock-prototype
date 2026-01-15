const digital = document.getElementById("digital");
const numbersEl = document.getElementById("numbers");
const dateLine = document.getElementById("dateLine");

const hourHand = document.getElementById("hour");
const minuteHand = document.getElementById("minute");
const secondHand = document.getElementById("second");

const fmtToggle = document.getElementById("fmtToggle");
const fmtLabel = document.getElementById("fmtLabel");

const alarmForm = document.getElementById("alarmForm");
const alarmTime = document.getElementById("alarmTime");
const alarmLabel = document.getElementById("alarmLabel");
const alarmEnabled = document.getElementById("alarmEnabled");
const alarmList = document.getElementById("alarmList");

const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const snoozeBtn = document.getElementById("snoozeBtn");
const stopBtn = document.getElementById("stopBtn");
const enableSoundToggle = document.getElementById("enableSoundToggle");
const enableSoundLabel = document.getElementById("enableSoundLabel");
const colorPicker = document.getElementById("colorPicker");


// ---------- State (saved) ----------
const STORE_KEY = "clockapp:v1";
let state = loadState();

// Default: 12-hour
if (typeof state.use24h !== "boolean") state.use24h = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : { use24h: false, alarms: [] };
  } catch {
    return { use24h: false, alarms: [] };
  }
}
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

// ---------- Time formatting ----------
function formatDigital(now) {
  if (state.use24h) {
    // 24-hour
    return now.toLocaleTimeString(undefined, { hour12: false });
  }
  // 12-hour
  return now.toLocaleTimeString(undefined, { hour12: true });
}
function formatDate(now) {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function hhmm(now) {
  // for alarm compare: "HH:MM" in 24h
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatAlarmDisplay(time24) {
  // time24: "HH:MM"
  if (state.use24h) return time24;
  const [hh, mm] = time24.split(":");
  let h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}

// ---------- Analog hands ----------
function setHands(now) {
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const ms = now.getMilliseconds();
  const sec = s + ms / 1000;

  const secondAngle = sec * 6;
  const minuteAngle = (m + sec / 60) * 6;
  const hourAngle = (h + m / 60) * 30;

  hourHand.style.transform = `rotate(${hourAngle}deg)`;
  minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
  secondHand.style.transform = `rotate(${secondAngle}deg)`;
}

// ---------- UI: toggle ----------
fmtToggle.checked = state.use24h;
fmtLabel.textContent = state.use24h ? "24-hour" : "12-hour";

fmtToggle.addEventListener("change", () => {
  state.use24h = fmtToggle.checked;
  fmtLabel.textContent = state.use24h ? "24-hour" : "12-hour";
  saveState();
  renderAlarms();
});

// ---------- Alarms ----------
function addAlarm({ time, label, enabled }) {
  state.alarms.push({
    id: crypto.randomUUID(),
    time,       // "HH:MM"
    label: label || "",
    enabled: !!enabled,
    lastFiredDay: null, // prevent multiple fires same day
  });
  saveState();
  renderAlarms();

}

function deleteAlarm(id) {
  state.alarms = state.alarms.filter(a => a.id !== id);
  saveState();
  renderAlarms();
}

function toggleAlarm(id) {
  const a = state.alarms.find(x => x.id === id);
  if (!a) return;
  a.enabled = !a.enabled;
  saveState();
  renderAlarms();
}

function renderAlarms() {
  alarmList.innerHTML = "";

  if (state.alarms.length === 0) {
    const li = document.createElement("li");
    li.style.color = "rgba(230,230,230,0.6)";
    li.style.fontSize = "13px";
    li.textContent = "No alarms yet. Add one above.";
    alarmList.appendChild(li);
    return;
  }

  for (const a of state.alarms) {
    const li = document.createElement("li");
    li.className = "alarmItem";

    const main = document.createElement("div");
    main.className = "alarmMain";

    const timeEl = document.createElement("div");
    timeEl.className = "alarmTime";
    timeEl.textContent = formatAlarmDisplay(a.time);

    const labelEl = document.createElement("div");
    labelEl.className = "alarmLabel";
    labelEl.textContent = a.label || "Alarm";

    main.appendChild(timeEl);
    main.appendChild(labelEl);

    const actions = document.createElement("div");
    actions.className = "alarmActions";

    const badge = document.createElement("span");
    badge.className = `badge ${a.enabled ? "on" : ""}`;
    badge.textContent = a.enabled ? "ON" : "OFF";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "smallBtn";
    toggleBtn.textContent = a.enabled ? "Disable" : "Enable";
    toggleBtn.addEventListener("click", () => toggleAlarm(a.id));

    const delBtn = document.createElement("button");
    delBtn.className = "smallBtn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteAlarm(a.id));

    actions.appendChild(badge);
    actions.appendChild(toggleBtn);
    actions.appendChild(delBtn);

    li.appendChild(main);
    li.appendChild(actions);
    alarmList.appendChild(li);
  }
}

alarmForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // alarmTime.value is "HH:MM" (24h)
  const time = alarmTime.value;
  if (!time) return;

  addAlarm({
    time,
    label: alarmLabel.value.trim(),
    enabled: alarmEnabled.checked,
  });

  alarmTime.value = "";
  alarmLabel.value = "";
  alarmEnabled.checked = true;
});

// ---------- Alarm ringing ----------
let ringingAlarmId = null;

function showModal(text) {
  modalBody.textContent = text;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function hideModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

// (WebAudio-based beep functions are defined later.)

function ringAlarm(alarm) {
  ringingAlarmId = alarm.id;
  showModal(`${alarm.label || "Alarm"} — ${alarm.time}`);
  startBeep();
}

stopBtn.addEventListener("click", () => {
  stopBeep();
  hideModal();
  ringingAlarmId = null;
});

snoozeBtn.addEventListener("click", () => {
  const a = state.alarms.find(x => x.id === ringingAlarmId);
  stopBeep();
  hideModal();

  if (a) {
    // Snooze: set a temporary one-time alarm 5 minutes from now
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const snoozeTime = hhmm(now);

    a.time = snoozeTime;
    a.lastFiredDay = null; // allow it to fire again
    a.label = (a.label || "Alarm") + " (Snooze)";
    saveState();
    renderAlarms();
  }

  ringingAlarmId = null;
});

// ---------- Main loop ----------
function buildNumbers() {
  if (!numbersEl) return;
  numbersEl.innerHTML = "";

  // radius: how far from center the numbers sit
  const radiusPct = 38; // tweak: 36–40 looks good

  for (let n = 1; n <= 12; n++) {
    const angleDeg = n * 30 - 90; // -90 puts 12 at the top
    const rad = (angleDeg * Math.PI) / 180;

    const x = Math.cos(rad) * radiusPct;
    const y = Math.sin(rad) * radiusPct;

    const div = document.createElement("div");
    div.className = "clock-number" + (n === 12 ? "" : " small");
    div.textContent = String(n);

    // Position from center using calc(50% + x%) so percentages are relative to face
    div.style.left = `calc(50% + ${x}%)`;
    div.style.top = `calc(50% + ${y}%)`;
    div.style.transform = `translate(-50%, -50%)`;

    numbersEl.appendChild(div);
  }
}

function tick() {
  const now = new Date();

  digital.textContent = formatDigital(now);
  dateLine.textContent = formatDate(now);

  setHands(now);

  checkAlarms(now);

  requestAnimationFrame(tick);
}

function checkAlarms(now) {
  const nowHHMM = hhmm(now);
  const today = now.toDateString();

  for (const a of state.alarms) {
    if (!a.enabled) continue;
    if (a.time !== nowHHMM) continue;

    // prevent firing repeatedly within the same minute & same day
    if (a.lastFiredDay === today) continue;

    a.lastFiredDay = today;
    saveState();
    renderAlarms();
    ringAlarm(a);
    break;
  }
}

// init UI
// build clock numbers and init UI
buildNumbers();
renderAlarms();

// start main loop
tick();

// WebAudio + UI wiring
let audioCtx = null;
let soundEnabled = false;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function enableSound() {
  const ctx = ensureAudio();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  soundEnabled = true;
  if (enableSoundToggle) {
    enableSoundToggle.checked = true;
  }
  if (enableSoundLabel) {
    enableSoundLabel.textContent = "Sound On";
  }
}

async function disableSound() {
  stopBeep();
  soundEnabled = false;
  if (audioCtx && audioCtx.state === 'running') {
    try { await audioCtx.suspend(); } catch (e) {}
  }
  if (enableSoundToggle) enableSoundToggle.checked = false;
  if (enableSoundLabel) enableSoundLabel.textContent = 'Sound Off';
}

if (enableSoundToggle) {
  // initialize label from toggle state
  enableSoundLabel.textContent = enableSoundToggle.checked ? 'Sound On' : 'Sound Off';
  enableSoundToggle.addEventListener('change', () => {
    if (enableSoundToggle.checked) {
      enableSound().catch(() => {});
    } else {
      disableSound();
    }
  });
}

if (colorPicker) {
  // apply initial color
  document.documentElement.style.setProperty('--accent', colorPicker.value);
  colorPicker.addEventListener('input', (e) => {
    document.documentElement.style.setProperty('--accent', e.target.value);
  });
}

function playBeepOnce() {
  if (!soundEnabled) return;

  const ctx = ensureAudio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();

  // beep tone + envelope
  o.type = "sine";
  o.frequency.value = 880; // A5-ish

  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

  o.connect(g);
  g.connect(ctx.destination);

  o.start();
  o.stop(ctx.currentTime + 0.27);
}

let beepInterval = null;

function startBeep() {
  if (!soundEnabled) return; // won't spam errors
  if (beepInterval) clearInterval(beepInterval);

  playBeepOnce();
  beepInterval = setInterval(playBeepOnce, 650);
}

function stopBeep() {
  if (beepInterval) clearInterval(beepInterval);
  beepInterval = null;
}

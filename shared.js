// ════════════════════════════════════════════════════════════
//  🦋 CAFÉ MADDRE — SHARED.JS
//  Código común a las 3 superficies: index.html (club), admin.html, pos.html
// ════════════════════════════════════════════════════════════

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylSrBu84KEaLl19Jny5YSt2iTgRdUfdVEfpseT_KMdjkGvA2Z-5y5pC-XqSto-Lz99GQ/exec";

// ── State ─────────────────────────────────────────────────────
let state = {
  correo: null,
  profile: null,
  adminPass: null,
  posPin: null,
  adminNombre: null,
  flashTimerInterval: null,
};

// ── API ───────────────────────────────────────────────────────
async function api(action, params = {}) {
  const qs  = new URLSearchParams({ action, ...params }).toString();
  // Apps Script requiere follow redirect pero con mode cors
  const res = await fetch(SCRIPT_URL + "?" + qs, {
    method: "GET",
    redirect: "follow",
    headers: { "Content-Type": "text/plain" },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    // Si Google redirige a echo, extraer JSON del body
    const match = text.match(/\{.*\}/s);
    if (match) return JSON.parse(match[0]);
    return { ok: false, error: "Error de conexión con el servidor" };
  }
}

// ── Screens ───────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, duration = 3500) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), duration);
}

function showErr(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }
function hideErr(el) { el.classList.add("hidden"); }

// ── Loading ───────────────────────────────────────────────────
let loadingEl;
function showLoading() {
  if (!loadingEl) {
    loadingEl = document.createElement("div");
    loadingEl.style.cssText = "position:fixed;inset:0;background:rgba(250,246,239,.75);display:flex;align-items:center;justify-content:center;z-index:9999;font-size:2.5rem;";
    loadingEl.textContent = "🦋";
    document.body.appendChild(loadingEl);
  }
  loadingEl.style.display = "flex";
}
function hideLoading() { if (loadingEl) loadingEl.style.display = "none"; }

// ════════════════════════════════════════════════════════════
//  PIN CAJA — pantalla de entrada para staff (pos.html y admin.html)
// ════════════════════════════════════════════════════════════
let pinValue = "";

function pinReset() {
  pinValue = "";
  updatePinDots();
  const errEl = document.getElementById("pin-error");
  if (errEl) errEl.classList.add("hidden");
  const destino = document.getElementById("pin-destino");
  if (destino) destino.classList.add("hidden");
  sessionStorage.removeItem("maddre_pos_pin");
  sessionStorage.removeItem("maddre_pos_nombre");
}

function pinPress(digit) {
  if (pinValue.length >= 4) return;
  pinValue += digit;
  updatePinDots();
  if (pinValue.length === 4) setTimeout(pinSubmit, 150);
}

function pinClear() {
  pinValue = pinValue.slice(0, -1);
  updatePinDots();
}

function updatePinDots() {
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById("pin-dot-" + i);
    if (dot) dot.classList.toggle("filled", i <= pinValue.length);
  }
}

async function pinSubmit() {
  if (pinValue.length < 4) { return; }
  showLoading();
  const res = await api("posAuth", { pin: pinValue });
  hideLoading();
  if (!res.ok) {
    document.getElementById("pin-error").textContent = "PIN incorrecto";
    document.getElementById("pin-error").classList.remove("hidden");
    pinValue = "";
    updatePinDots();
    return;
  }
  state.posPin      = pinValue;
  state.adminNombre = res.nombre || "";
  sessionStorage.setItem("maddre_pos_pin",    pinValue);
  sessionStorage.setItem("maddre_pos_nombre", res.nombre || "");
  // Mostrar botones de destino
  document.getElementById("pin-destino").classList.remove("hidden");
}

// Navega a la caja o al panel admin — cada página resuelve el caso "ya estoy acá".
function pinIrA(destino) {
  if (destino === "pos") {
    if (window.location.pathname.endsWith("pos.html")) {
      showScreen("pos");
      initPOS();
    } else {
      window.location.href = "pos.html";
    }
  } else {
    if (window.location.pathname.endsWith("admin.html")) {
      showScreen("admin");
      mostrarSaludoAdmin();
      loadAdminSummary();
      initPullToRefresh();
    } else {
      window.location.href = "admin.html";
    }
  }
}

function mostrarSaludoAdmin() {
  const nombre = state.adminNombre
    ? state.adminNombre.charAt(0).toUpperCase() + state.adminNombre.slice(1).toLowerCase()
    : "Admin";
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const el = document.getElementById("admin-saludo");
  if (el) el.textContent = saludo + ", " + nombre + " — todo listo para hoy 🦋";
}

// ── Pull to refresh (genérico, cada página wirea su propia pantalla) ──
function _wirePTR(screen, ind, refreshFn) {
  if (!screen || !ind) return;
  let startY = 0, active = false;
  const THRESHOLD = 72;

  function setPtr(dy) {
    const pull = Math.min(dy * 0.45, 52);
    ind.style.transform = `translateX(-50%) translateY(${pull - 60}px)`;
    ind.style.opacity   = String(Math.min(dy / THRESHOLD, 1));
  }
  function resetPtr() {
    ind.classList.remove("ptr-spin");
    ind.style.transition = "transform .22s ease, opacity .22s ease";
    ind.style.transform  = "translateX(-50%) translateY(-60px)";
    ind.style.opacity    = "0";
    setTimeout(() => { ind.style.transition = ""; }, 220);
  }

  screen.addEventListener("touchstart", e => {
    if (screen.scrollTop <= 1) { startY = e.touches[0].clientY; active = true; }
  }, { passive: true });

  screen.addEventListener("touchmove", e => {
    if (!active) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) { active = false; resetPtr(); return; }
    setPtr(dy);
  }, { passive: true });

  screen.addEventListener("touchend", e => {
    if (!active) return;
    active = false;
    const dy = e.changedTouches[0].clientY - startY;
    if (dy >= THRESHOLD) {
      ind.style.transform = "translateX(-50%) translateY(8px)";
      ind.style.opacity   = "1";
      ind.classList.add("ptr-spin");
      const job = refreshFn();
      (job && job.finally) ? job.finally(resetPtr) : setTimeout(resetPtr, 1200);
    } else {
      resetPtr();
    }
  }, { passive: true });
}

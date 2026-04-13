// ════════════════════════════════════════════════════════════
//  PIN CAJA
// ════════════════════════════════════════════════════════════
let pinValue = "";

function pinReset() {
  pinValue = "";
  updatePinDots();
  document.getElementById("pin-error").classList.add("hidden");
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
    dot.classList.toggle("filled", i <= pinValue.length);
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
  state.adminPass = null; // POS no necesita admin pass
  state.posPin = pinValue;
  showScreen("pos");
  await initPOS();
}

// ============================================================
//  🦋 CAFÉ MADDRE — APP JS v2
//  Registro progresivo: correo → cédula → nombre/WA → cumple
// ============================================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylSrBu84KEaLl19Jny5YSt2iTgRdUfdVEfpseT_KMdjkGvA2Z-5y5pC-XqSto-Lz99GQ/exec";

// ── State ─────────────────────────────────────────────────────
let state = {
  correo: null,
  profile: null,
  adminPass: null,
  products: [],
  cart: {},
  scanStream: null,
  posClient: null,
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
window.addEventListener("load", () => setTimeout(() => showScreen("login"), 800));

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
//  FLUJO CLIENTE
// ════════════════════════════════════════════════════════════

// ── PASO 0: ingresar correo ───────────────────────────────────
async function doIniciar() {
  const correo = document.getElementById("login-correo").value.trim().toLowerCase();
  const errEl  = document.getElementById("login-error");
  hideErr(errEl);
  if (!correo || !correo.includes("@")) { showErr(errEl, "Ingresa un correo válido"); return; }

  showLoading();
  const res = await api("iniciar", { correo });
  hideLoading();

  if (!res.ok) { showErr(errEl, res.error); return; }

  state.correo = correo;

  // Si perfil completo (paso 4) → mostrar campo cédula
  if (res.paso >= 4) {
    document.getElementById("cedula-wrap").classList.remove("hidden");
    document.getElementById("btn-continuar").onclick = doLoginConCedula;
    document.getElementById("login-correo").disabled = true;
    return;
  }

  // Perfil incompleto → entra directo
  await loadAndShowProfile();
}

async function doLoginConCedula() {
  const cedula = document.getElementById("login-cedula").value.trim();
  const errEl  = document.getElementById("login-error");
  hideErr(errEl);
  if (!cedula) { showErr(errEl, "Ingresa tu cédula"); return; }

  showLoading();
  const res = await api("login", { correo: state.correo, cedula });
  hideLoading();

  if (!res.ok) { showErr(errEl, res.error); return; }
  state.profile = res;
  renderProfile(res);
  showScreen("profile");
}

// ── PASOS 1-3: completar datos ────────────────────────────────
function mostrarPaso(paso) {
  // Ocultar todos los pasos
  [1, 2, 3].forEach(n => {
    document.getElementById("paso-" + n).classList.add("hidden");
  });
  document.getElementById("paso-" + paso)?.classList.remove("hidden");
  showScreen("onboarding");
  actualizarBarraPasos(paso);
}

function actualizarBarraPasos(paso) {
  document.querySelectorAll(".paso-dot").forEach((d, i) => {
    d.classList.toggle("activo", i < paso);
  });
}

async function completarPaso(paso) {
  const errEl = document.getElementById("onboarding-error");
  hideErr(errEl);

  let params = { correo: state.correo, paso };

  if (paso === 1) {
    const cedula = document.getElementById("ob-cedula").value.trim();
    if (!cedula) { showErr(errEl, "Ingresa tu cédula"); return; }
    params.cedula = cedula;
  }
  if (paso === 2) {
    const nombre   = document.getElementById("ob-nombre").value.trim();
    const telefono = document.getElementById("ob-telefono").value.trim();
    if (!nombre || !telefono) { showErr(errEl, "Completa nombre y WhatsApp"); return; }
    params.nombre   = nombre;
    params.telefono = telefono;
  }
  if (paso === 3) {
    const fnac = document.getElementById("ob-fnac").value;
    if (!fnac) { showErr(errEl, "Ingresa tu fecha de nacimiento"); return; }
    params.fecha_nacimiento = fnac;
  }

  showLoading();
  const res = await api("completarPaso", params);
  hideLoading();

  if (!res.ok) { showErr(errEl, res.error); return; }

  if (res.puntosBono) toast("🎁 ¡+1 punto por completar tu perfil!");
  // Siempre regresa al perfil después de cada paso
  await loadAndShowProfile();
}

// ── PROFILE ───────────────────────────────────────────────────
async function loadAndShowProfile() {
  showLoading();
  const res = await api("getProfile", { correo: state.correo });
  hideLoading();
  if (!res.ok) { toast("Error: " + res.error); return; }
  state.profile = res;
  renderProfile(res);
  showScreen("profile");
}

async function loadProfile() {
  if (!state.correo) return;
  showLoading();
  const res = await api("getProfile", { correo: state.correo });
  hideLoading();
  if (!res.ok) { toast("Error al recargar"); return; }
  state.profile = res;
  renderProfile(res);
}

function renderProfile(res) {
  const { cliente, puntos, promos, flash } = res;

  const nombreDisplay = cliente.nombre ? cliente.nombre.split(" ")[0] : cliente.correo.split("@")[0];
  document.getElementById("prof-nombre").textContent = "Hola, " + nombreDisplay;
  document.getElementById("prof-correo").textContent = cliente.correo;

  const nivelEmoji = { "Vecino": "🌿", "Habitual": "☕", "De la casa": "🥐" };
  const badge = document.getElementById("prof-nivel-badge");
  badge.textContent = (nivelEmoji[cliente.nivel] || "") + " " + cliente.nivel;

  // Puntos
  document.getElementById("prof-puntos").textContent  = puntos.acumulados;
  document.getElementById("stat-total").textContent    = puntos.totalProductos;
  document.getElementById("stat-rollitos").textContent = puntos.rollitosCanjeados;
  document.getElementById("stat-nivel").textContent    = cliente.nivel;

  // Dots
  const dotsEl = document.getElementById("points-dots");
  dotsEl.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const d = document.createElement("span");
    d.className = "dot-emoji" + (i < puntos.acumulados ? " filled" : "");
    d.textContent = "🦋";
    dotsEl.appendChild(d);
  }
  document.getElementById("btn-redeem-pts").disabled = puntos.acumulados < 10;

  // QR — usa correo como identificador
  const qrEl = document.getElementById("qr-container");
  qrEl.innerHTML = "";
  new QRCode(qrEl, {
    text: cliente.correo,
    width: 180, height: 180,
    colorDark: "#5C3D2E", colorLight: "#FAF6EF",
    correctLevel: QRCode.CorrectLevel.M,
  });
  document.getElementById("prof-correo-qr").textContent = cliente.correo;

  // Promos
  renderPromos(promos, cliente);

  // Flash
  renderFlash(flash);

  // Completar perfil si faltan datos
  const nivelReg = Number(cliente.nivel_registro) || 1;
  const bannerEl = document.getElementById("perfil-incompleto-banner");
  if (nivelReg < 4) {
    bannerEl.classList.remove("hidden");
    const pct = Math.round((nivelReg / 4) * 100);
    document.getElementById("completar-pct").textContent = pct + "%";
    document.getElementById("completar-bar-fill").style.width = pct + "%";
    document.getElementById("btn-completar-perfil").onclick = () => mostrarPaso(nivelReg);
  } else {
    bannerEl.classList.add("hidden");
  }
}

function renderPromos(promos, cliente) {
  const btnCaja = document.getElementById("btn-caja");
  btnCaja.disabled = !promos.cajaSemanalDisponible;
  btnCaja.textContent = promos.cajaSemanalDisponible ? "Canjear" : "Ya canjeada ✓";

  const btnCumple  = document.getElementById("btn-cumple");
  const cumpleDesc = document.getElementById("cumple-desc");
  if (promos.cumpleDisponible) {
    btnCumple.disabled = false;
    cumpleDesc.textContent = "🎂 ¡Es tu mes! Rollito gratis";
  } else if (!promos.esMesCumple && promos.mesesParaCumple !== null && promos.mesesParaCumple > 0) {
    btnCumple.disabled = true;
    cumpleDesc.textContent = `Tu mes llega en ${promos.mesesParaCumple} mes(es)`;
  } else {
    btnCumple.disabled = true;
    cumpleDesc.textContent = "Durante tu mes de cumpleaños";
  }
}

function renderFlash(flashArr) {
  const banner = document.getElementById("flash-banner");
  if (!flashArr || flashArr.length === 0) { banner.classList.add("hidden"); return; }
  const f = flashArr[0];
  banner.classList.remove("hidden");
  document.getElementById("flash-text").textContent = f.texto;
  if (state.flashTimerInterval) clearInterval(state.flashTimerInterval);
  const timerEl = document.getElementById("flash-timer");
  function tick() {
    const ms = new Date(f.expira) - new Date();
    if (ms <= 0) { timerEl.textContent = "Expirado"; clearInterval(state.flashTimerInterval); return; }
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    timerEl.textContent = `Expira en ${h}h ${m}m ${s}s`;
  }
  tick();
  state.flashTimerInterval = setInterval(tick, 1000);
}

// ── REDENCIONES CLIENTE ───────────────────────────────────────
async function redeemPoints() {
  showLoading();
  const res = await api("redeemPoints", { correo: state.correo });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("🎉 ¡Rollito canjeado! Muestra esta pantalla en caja.");
  loadProfile();
}

async function redeemCaja() {
  showLoading();
  const res = await api("redeemCaja", { correo: state.correo });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("📦 ¡Caja semanal canjeada! 4 rollitos por $20.000");
  loadProfile();
}

async function redeemCumple() {
  showLoading();
  const res = await api("redeemCumple", { correo: state.correo });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("🎂 ¡Rollito cumpleañero canjeado! Feliz cumpleaños 🎉");
  loadProfile();
}

function logout() {
  state.correo = null;
  state.profile = null;
  if (state.flashTimerInterval) clearInterval(state.flashTimerInterval);
  showScreen("login");
}

// ════════════════════════════════════════════════════════════
//  ADMIN
// ════════════════════════════════════════════════════════════

function showAdminLogin() { showScreen("admin-login"); }

async function adminAuthAndGo(destination) {
  const pass  = document.getElementById("admin-pass-input").value;
  const errEl = document.getElementById("admin-login-error");
  hideErr(errEl);
  if (!pass) { showErr(errEl, "Ingresa la contraseña"); return; }

  showLoading();
  const res = await api("getDaySummary", { adminPassword: pass });
  hideLoading();
  if (!res.ok) { showErr(errEl, "Contraseña incorrecta"); return; }

  state.adminPass = pass;
  if (destination === "admin") {
    renderDaySummary(res);
    showScreen("admin");
  } else {
    showScreen("pos");
    await initPOS();
  }
}

function renderDaySummary(res) {
  document.getElementById("sum-ventas").textContent = res.ventasHoy      ?? "-";
  document.getElementById("sum-nuevos").textContent = res.clientesNuevos ?? "-";
  document.getElementById("sum-puntos").textContent = res.puntosEntregados ?? "-";
}

async function adminSearch() {
  const q = document.getElementById("admin-search").value.trim();
  if (!q) return;
  showLoading();
  const res = await api("searchClient", { q, adminPassword: state.adminPass });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  const container = document.getElementById("admin-search-results");
  container.innerHTML = "";
  if (!res.clientes.length) { container.innerHTML = "<p style='color:var(--text-lt);font-size:.85rem'>Sin resultados</p>"; return; }
  res.clientes.forEach(c => {
    const div = document.createElement("div");
    div.className = "search-result-item";
    div.innerHTML = `<p class='result-name'>${c.nombre || "(sin nombre)"}</p>
      <p class='result-sub'>${c.correo} · ${c.nivel} · Reseña: ${c.resena_maps ? "✅" : "❌"}</p>`;
    div.onclick = () => loadAdminClientDetail(c.correo);
    container.appendChild(div);
  });
}

async function loadAdminClientDetail(correo) {
  showLoading();
  const res = await api("getProfile", { correo });
  hideLoading();
  if (!res.ok) { toast("Error"); return; }
  const { cliente, puntos } = res;
  document.getElementById("admin-client-detail").classList.remove("hidden");
  document.getElementById("adm-client-name").textContent = cliente.nombre || correo;
  document.getElementById("adm-client-info").textContent =
    `${cliente.correo} · ${cliente.nivel} · Reseña: ${cliente.resena_maps ? "✅" : "❌"}`;
  document.getElementById("adm-client-pts").textContent = puntos.acumulados + " pts";
  document.getElementById("admin-client-detail").dataset.correo = correo;
  document.getElementById("btn-verify-resena").disabled = cliente.resena_maps === true;
  document.getElementById("btn-verify-resena").textContent =
    cliente.resena_maps ? "✅ Reseña ya verificada" : "✅ Verificar reseña Google Maps";
  document.getElementById("admin-client-detail").scrollIntoView({ behavior: "smooth" });
}

async function adminAdjPoints() {
  const correo = document.getElementById("admin-client-detail").dataset.correo;
  const delta  = Number(document.getElementById("adm-pts-delta").value);
  if (!delta) { toast("Ingresa un valor"); return; }
  showLoading();
  const res = await api("adminAdjPoints", { correo, delta, adminPassword: state.adminPass });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast(`✅ Puntos actualizados: ${res.puntosNuevos}`);
  loadAdminClientDetail(correo);
}

async function adminVerifyResena() {
  const correo = document.getElementById("admin-client-detail").dataset.correo;
  showLoading();
  const res = await api("verifyResena", { correo, adminPassword: state.adminPass });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("✅ Reseña verificada. Se envió correo al cliente.");
  loadAdminClientDetail(correo);
}

async function createFlash() {
  const texto          = document.getElementById("flash-texto").value.trim();
  const nivel_minimo   = document.getElementById("flash-nivel").value;
  const duracion_horas = document.getElementById("flash-horas").value;
  if (!texto) { toast("Escribe el mensaje del flash"); return; }
  showLoading();
  const res = await api("createFlash", { texto, nivel_minimo, duracion_horas, adminPassword: state.adminPass });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("⚡ Flash activado!");
  document.getElementById("flash-texto").value = "";
}

// ════════════════════════════════════════════════════════════
//  POS
// ════════════════════════════════════════════════════════════

let posState = {
  sector: null,
  items: [],       // [{nombre, variedad, cantidad, precio}]
  qty: 1,
  config: null,
};

async function initPOS() {
  showLoading();
  const res = await api("getProducts");
  hideLoading();
  if (!res.ok) { toast("Error cargando config"); return; }
  posState.config = res;
  renderSectores(res.sectores);
  renderProductoSelect(res.productos);
  posShowStep("sector");
}

// ── PASO 1: Sector ────────────────────────────────────────────
function renderSectores(sectores) {
  const el = document.getElementById("pos-sector-list");
  el.innerHTML = "";
  sectores.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = s;
    btn.onclick = () => posSelSector(s);
    el.appendChild(btn);
  });
}

function posSelSector(sector) {
  posState.sector = sector;
  posState.items = [];
  document.getElementById("pos-sector-label").textContent = sector;
  document.getElementById("pos-items-list").innerHTML = "";
  document.getElementById("pos-total-wrap").classList.add("hidden");
  posShowStep("pedido");
}

function posVolverSector() { posShowStep("sector"); }

// ── PASO 2: Pedido ────────────────────────────────────────────
function renderProductoSelect(productos) {
  const sel = document.getElementById("pos-sel-producto");
  sel.innerHTML = '<option value="">— selecciona —</option>';
  productos.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.nombre;
    opt.dataset.precio = p.precio;
    opt.textContent = `${p.nombre}  $${Number(p.precio).toLocaleString("es-CO")}`;
    sel.appendChild(opt);
  });
}

function posProductoChange() {
  const sel   = document.getElementById("pos-sel-producto");
  const nombre = sel.value.toUpperCase();
  const varWrap = document.getElementById("pos-variedad-wrap");
  const varSel  = document.getElementById("pos-sel-variedad");

  varWrap.classList.add("hidden");
  varSel.innerHTML = '<option value="">— selecciona —</option>';

  let sabores = [];
  if (nombre.includes("ROLLITO")) sabores = posState.config.saboresRollito || [];
  else if (nombre.includes("BAGUETTE")) sabores = posState.config.saboresBaguette || [];

  if (sabores.length) {
    sabores.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s; opt.textContent = s;
      varSel.appendChild(opt);
    });
    varWrap.classList.remove("hidden");
  }
}

function posQtyChange(delta) {
  posState.qty = Math.max(1, (posState.qty || 1) + delta);
  document.getElementById("pos-qty-val").textContent = posState.qty;
}

function posAgregarItem() {
  const sel     = document.getElementById("pos-sel-producto");
  const nombre  = sel.value;
  const precio  = Number(sel.selectedOptions[0]?.dataset.precio || 0);
  const varSel  = document.getElementById("pos-sel-variedad");
  const varWrap = document.getElementById("pos-variedad-wrap");
  const variedad = !varWrap.classList.contains("hidden") ? varSel.value : "";
  const cantidad = posState.qty || 1;

  if (!nombre) { toast("Selecciona un producto"); return; }
  if (!varWrap.classList.contains("hidden") && !variedad) { toast("Selecciona la variedad"); return; }

  posState.items.push({ nombre, variedad, cantidad, precio });
  posState.qty = 1;
  document.getElementById("pos-qty-val").textContent = 1;
  sel.value = "";
  varWrap.classList.add("hidden");
  renderItemsList();
}

function renderItemsList() {
  const el = document.getElementById("pos-items-list");
  el.innerHTML = "";
  let total = 0;
  posState.items.forEach((item, idx) => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
    const div = document.createElement("div");
    div.className = "pos-item-row";
    div.innerHTML = `
      <div class="pos-item-info">
        <p class="pos-item-name">${item.nombre}${item.variedad ? " · " + item.variedad : ""}</p>
        <p class="pos-item-detail">x${item.cantidad} · $${subtotal.toLocaleString("es-CO")}</p>
      </div>
      <button class="pos-item-del" onclick="posEliminarItem(${idx})">✕</button>`;
    el.appendChild(div);
  });

  const totalWrap = document.getElementById("pos-total-wrap");
  if (posState.items.length > 0) {
    totalWrap.classList.remove("hidden");
    document.getElementById("pos-total-val").textContent = "$" + total.toLocaleString("es-CO");
  } else {
    totalWrap.classList.add("hidden");
  }
}

function posEliminarItem(idx) {
  posState.items.splice(idx, 1);
  renderItemsList();
}

function posSiguienteCliente() {
  document.getElementById("pos-correo-manual").value = "";
  posShowStep("cliente");
}

// ── PASO 3: Cliente ───────────────────────────────────────────
async function posConfirmarConCliente() {
  const correo = document.getElementById("pos-correo-manual").value.trim().toLowerCase();
  if (!correo) { toast("Ingresa el correo o factura sin cliente"); return; }
  await posRegistrarVenta(correo);
}

async function posConfirmarSinCliente() {
  await posRegistrarVenta(null);
}

async function posRegistrarVenta(correo) {
  const productos = posState.items.map(i =>
    `${i.nombre}${i.variedad ? " (" + i.variedad + ")" : ""} x${i.cantidad}`
  ).join(", ");
  const total = posState.items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  showLoading();
  const res = await api("registerSale", {
    correo: correo || "",
    sector: posState.sector,
    productos,
    total,
    puntos_sumados: correo ? 1 : 0,
  });
  hideLoading();

  if (!res.ok) { toast("❌ " + res.error); return; }

  const resumen = correo
    ? `${posState.sector} · $${total.toLocaleString("es-CO")} · +1 pto para ${correo.split("@")[0]}`
    : `${posState.sector} · $${total.toLocaleString("es-CO")} · sin cliente`;

  document.getElementById("pos-ok-resumen").textContent = resumen;
  posShowStep("ok");
  // Cargar resumen del día
  const sumRes = await api("getDaySummary", { adminPassword: state.adminPass || "", pin: state.posPin || "" });
  if (sumRes.ok) {
    document.getElementById("dia-ventas").textContent = sumRes.ventasHoy;
    document.getElementById("dia-total").textContent = "$" + (sumRes.totalHoy || 0).toLocaleString("es-CO");
    document.getElementById("dia-pts").textContent = sumRes.puntosEntregados;
  }
}

// ── Nav ───────────────────────────────────────────────────────
function posShowStep(step) {
  ["sector", "pedido", "cliente", "ok"].forEach(s => {
    document.getElementById("pos-step-" + s).classList.add("hidden");
  });
  document.getElementById("pos-step-" + step).classList.remove("hidden");
}

function posReset() {
  posState = { sector: null, items: [], qty: 1, config: posState.config };
  if (posState.config) {
    posShowStep("sector");
  } else {
    showScreen("admin-login");
  }
}

// ── QR Scanner (guardado para después) ───────────────────────
async function startScan() {
  const wrap  = document.getElementById("pos-camera-wrap");
  const video = document.getElementById("pos-video");
  if (!wrap || !video) return;
  wrap.classList.remove("hidden");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    state.scanStream = stream;
    video.srcObject = stream;
    if (!window.jsQR) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js");
    const canvas = document.getElementById("pos-canvas");
    const ctx = canvas.getContext("2d");
    function tick() {
      if (!state.scanStream) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width  = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (code) { stopScan(); posLoadClient(code.data.trim()); return; }
      }
      requestAnimationFrame(tick);
    }
    tick();
  } catch(err) { toast("❌ No se pudo acceder a la cámara"); stopScan(); }
}

function stopScan() {
  if (state.scanStream) { state.scanStream.getTracks().forEach(t => t.stop()); state.scanStream = null; }
  const wrap = document.getElementById("pos-camera-wrap");
  if (wrap) wrap.classList.add("hidden");
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

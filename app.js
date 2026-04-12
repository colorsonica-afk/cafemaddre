// ============================================================
//  🦋 CAFÉ MADDRE — APP JS
//  IMPORTANTE: Cambia SCRIPT_URL por la URL de tu Apps Script
//  después de desplegarlo como Web App.
// ============================================================

const SCRIPT_URL = "PEGA_AQUI_TU_URL_DE_APPS_SCRIPT";

// ── State ────────────────────────────────────────────────────
let state = {
  cedula: null,
  profile: null,
  adminPass: null,
  products: [],
  cart: {},           // { productId: quantity }
  scanStream: null,
  posClient: null,
  flashTimerInterval: null,
};

// ── API ───────────────────────────────────────────────────────
async function api(action, params = {}) {
  const body = JSON.stringify({ action, ...params });
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    body,
  });
  return res.json();
}

// ── Screen router ─────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, duration = 3000) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), duration);
}

// ── Loading ───────────────────────────────────────────────────
window.addEventListener("load", () => {
  // Show login after brief splash
  setTimeout(() => showScreen("login"), 800);
});

// ── LOGIN ─────────────────────────────────────────────────────
async function doLogin() {
  const cedula = document.getElementById("login-cedula").value.trim();
  const password = document.getElementById("login-pass").value.trim();
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");

  if (!cedula || !password) { showErr(errEl, "Completa los campos"); return; }

  showLoading();
  const res = await api("login", { cedula, password });
  hideLoading();

  if (!res.ok) { showErr(errEl, res.error); return; }

  state.cedula = cedula;
  state.profile = res;
  renderProfile(res);
  showScreen("profile");
}

// ── REGISTER ──────────────────────────────────────────────────
async function doRegister() {
  const cedula         = document.getElementById("reg-cedula").value.trim();
  const nombre         = document.getElementById("reg-nombre").value.trim();
  const telefono       = document.getElementById("reg-tel").value.trim();
  const correo         = document.getElementById("reg-correo").value.trim();
  const fecha_nacimiento = document.getElementById("reg-fnac").value;
  const referido_por   = document.getElementById("reg-ref").value.trim();
  const errEl          = document.getElementById("reg-error");
  errEl.classList.add("hidden");

  if (!cedula || !nombre || !telefono) { showErr(errEl, "Completa los campos obligatorios (*)"); return; }

  showLoading();
  const res = await api("register", { cedula, nombre, telefono, correo, fecha_nacimiento, referido_por });
  hideLoading();

  if (!res.ok) { showErr(errEl, res.error); return; }

  state.cedula = cedula;
  state.profile = res;
  renderProfile(res);
  showScreen("profile");
  toast("🎉 Bienvenido al Club Maddre!");
}

// ── PROFILE ───────────────────────────────────────────────────
async function loadProfile() {
  if (!state.cedula) return;
  showLoading();
  const res = await api("getProfile", { cedula: state.cedula });
  hideLoading();
  if (!res.ok) { toast("Error al cargar perfil"); return; }
  state.profile = res;
  renderProfile(res);
}

function renderProfile(res) {
  const { cliente, puntos, promos, flash } = res;

  document.getElementById("prof-nombre").textContent = "Hola, " + cliente.nombre.split(" ")[0];
  document.getElementById("prof-cedula").textContent = "CC " + cliente.cedula;
  document.getElementById("prof-cedula-qr").textContent = cliente.cedula;
  document.getElementById("ref-code-val").textContent = cliente.cedula;

  // Nivel
  const nivelEmoji = { "Vecino": "🌿", "Habitual": "☕", "De la casa": "🥐" };
  const badge = document.getElementById("prof-nivel-badge");
  badge.textContent = (nivelEmoji[cliente.nivel] || "") + " " + cliente.nivel;

  // Points
  document.getElementById("prof-puntos").textContent = puntos.acumulados;
  document.getElementById("stat-total").textContent   = puntos.totalProductos;
  document.getElementById("stat-rollitos").textContent = puntos.rollitosCanjeados;
  document.getElementById("stat-nivel").textContent   = cliente.nivel;

  // Dots progress bar
  const dotsEl = document.getElementById("points-dots");
  dotsEl.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const d = document.createElement("div");
    d.className = "dot" + (i < puntos.acumulados ? " filled" : "");
    dotsEl.appendChild(d);
  }
  document.getElementById("btn-redeem-pts").disabled = puntos.acumulados < 10;

  // QR
  const qrEl = document.getElementById("qr-container");
  qrEl.innerHTML = "";
  new QRCode(qrEl, {
    text: String(cliente.cedula),
    width: 180,
    height: 180,
    colorDark: "#5C3D2E",
    colorLight: "#FAF6EF",
    correctLevel: QRCode.CorrectLevel.M,
  });

  // Promos
  renderPromos(promos, cliente);

  // Flash
  renderFlash(flash);
}

function renderPromos(promos, cliente) {
  // Caja semanal
  const btnCaja = document.getElementById("btn-caja");
  btnCaja.disabled = !promos.cajaSemanalDisponible;
  btnCaja.textContent = promos.cajaSemanalDisponible ? "Canjear" : "Ya canjeada";

  // Cumpleaños
  const btnCumple = document.getElementById("btn-cumple");
  const cumpleDesc = document.getElementById("cumple-desc");
  if (promos.cumpleDisponible) {
    btnCumple.disabled = false;
    cumpleDesc.textContent = "🎂 ¡Es tu mes! Rollito gratis";
  } else if (promos.esMesCumple && !cliente.resena_maps) {
    btnCumple.disabled = true;
    cumpleDesc.textContent = "Necesitas reseña en Maps verificada";
  } else if (!promos.esMesCumple && promos.mesesParaCumple !== null) {
    btnCumple.disabled = true;
    cumpleDesc.textContent = promos.mesesParaCumple === 0 ? "¡Es este mes!" :
      `Tu mes llega en ${promos.mesesParaCumple} mese(s)`;
  } else {
    btnCumple.disabled = true;
    cumpleDesc.textContent = "Durante tu mes de cumpleaños";
  }
}

function renderFlash(flashArr) {
  const banner = document.getElementById("flash-banner");
  if (!flashArr || flashArr.length === 0) {
    banner.classList.add("hidden");
    return;
  }
  const f = flashArr[0];
  banner.classList.remove("hidden");
  document.getElementById("flash-text").textContent = f.texto;

  if (state.flashTimerInterval) clearInterval(state.flashTimerInterval);
  const timerEl = document.getElementById("flash-timer");
  function tick() {
    const ms = new Date(f.expira) - new Date();
    if (ms <= 0) { timerEl.textContent = "Expirado"; clearInterval(state.flashTimerInterval); return; }
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    timerEl.textContent = `Expira en ${h}h ${m}m ${s}s`;
  }
  tick();
  state.flashTimerInterval = setInterval(tick, 1000);
}

// ── PROMOS CLIENTE ────────────────────────────────────────────
async function redeemPoints() {
  showLoading();
  const res = await api("redeemPoints", { cedula: state.cedula });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("🎉 ¡Rollito canjeado! Muestra esta pantalla en caja.");
  loadProfile();
}

async function redeemCaja() {
  showLoading();
  const res = await api("redeemCaja", { cedula: state.cedula });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("📦 ¡Caja semanal canjeada! 4 rollitos por $20.000");
  loadProfile();
}

async function redeemCumple() {
  showLoading();
  const res = await api("redeemCumple", { cedula: state.cedula });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("🎂 ¡Rollito cumpleañero canjeado! Feliz cumpleaños 🎉");
  loadProfile();
}

// ── ADMIN ─────────────────────────────────────────────────────
function showAdminLogin() { showScreen("admin-login"); }

async function adminAuthAndGo(destination) {
  const pass = document.getElementById("admin-pass-input").value;
  const errEl = document.getElementById("admin-login-error");
  errEl.classList.add("hidden");
  if (!pass) { showErr(errEl, "Ingresa la contraseña"); return; }

  // Quick check — real auth happens server-side on each request
  showLoading();
  const res = await api("getDaySummary", { adminPassword: pass });
  hideLoading();

  if (!res.ok) { showErr(errEl, "Contraseña incorrecta"); return; }

  state.adminPass = pass;

  if (destination === "admin") {
    renderDaySummary(res);
    showScreen("admin");
  } else {
    await loadProducts();
    showScreen("pos");
  }
}

function renderDaySummary(res) {
  document.getElementById("sum-ventas").textContent = res.ventasHoy ?? "-";
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
  if (res.clientes.length === 0) {
    container.innerHTML = "<p style='color:var(--text-lt);font-size:.85rem'>Sin resultados</p>";
    return;
  }
  res.clientes.forEach(c => {
    const div = document.createElement("div");
    div.className = "search-result-item";
    div.innerHTML = `<p class='result-name'>${c.nombre}</p>
      <p class='result-sub'>CC ${c.cedula} · ${c.nivel} · ${c.correo || "sin correo"}</p>`;
    div.onclick = () => loadAdminClientDetail(c.cedula);
    container.appendChild(div);
  });
}

async function loadAdminClientDetail(cedula) {
  showLoading();
  const res = await api("getProfile", { cedula });
  hideLoading();
  if (!res.ok) { toast("Error"); return; }
  const { cliente, puntos } = res;

  document.getElementById("admin-client-detail").classList.remove("hidden");
  document.getElementById("adm-client-name").textContent = cliente.nombre;
  document.getElementById("adm-client-info").textContent =
    `CC ${cliente.cedula} · ${cliente.nivel} · Reseña: ${cliente.resena_maps ? "✅" : "❌"}`;
  document.getElementById("adm-client-pts").textContent = puntos.acumulados + " pts";

  // Store for actions
  document.getElementById("admin-client-detail").dataset.cedula = cedula;
  document.getElementById("btn-verify-resena").disabled = cliente.resena_maps === true;
  document.getElementById("btn-verify-resena").textContent =
    cliente.resena_maps ? "✅ Reseña ya verificada" : "✅ Verificar reseña Google Maps";

  document.getElementById("admin-client-detail").scrollIntoView({ behavior: "smooth" });
}

async function adminAdjPoints() {
  const cedula = document.getElementById("admin-client-detail").dataset.cedula;
  const delta = Number(document.getElementById("adm-pts-delta").value);
  const nota  = document.getElementById("adm-pts-nota").value;
  if (!delta) { toast("Ingresa un valor"); return; }

  showLoading();
  const res = await api("adminAdjPoints", { cedula, delta, nota, adminPassword: state.adminPass });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast(`✅ Puntos actualizados: ${res.puntosNuevos}`);
  loadAdminClientDetail(cedula);
}

async function adminVerifyResena() {
  const cedula = document.getElementById("admin-client-detail").dataset.cedula;
  showLoading();
  const res = await api("verifyResena", { cedula, adminPassword: state.adminPass });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("✅ Reseña verificada. Se envió correo al cliente.");
  loadAdminClientDetail(cedula);
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
  toast("⚡ Flash activado y correos enviados!");
  document.getElementById("flash-texto").value = "";
}

// ── POS ───────────────────────────────────────────────────────
async function loadProducts() {
  const res = await api("getProducts");
  if (res.ok) state.products = res.productos;
}

async function posLoadManual() {
  const cedula = document.getElementById("pos-cedula-manual").value.trim();
  if (!cedula) return;
  await posLoadClient(cedula);
}

async function posLoadClient(cedula) {
  showLoading();
  const res = await api("getProfile", { cedula });
  hideLoading();
  if (!res.ok) { toast("❌ Cliente no encontrado"); return; }

  state.posClient = res;
  renderPosClient(res);
}

function renderPosClient(res) {
  const { cliente, puntos, promos } = res;
  document.getElementById("pos-client-card").classList.remove("hidden");
  document.getElementById("pos-products-section").classList.remove("hidden");
  document.getElementById("pos-client-name").textContent = cliente.nombre;

  const nivelEmoji = { "Vecino": "🌿", "Habitual": "☕", "De la casa": "🥐" };
  document.getElementById("pos-client-nivel").textContent =
    (nivelEmoji[cliente.nivel] || "") + " " + cliente.nivel;
  document.getElementById("pos-client-pts").textContent = puntos.acumulados;

  // Promos
  const promosEl = document.getElementById("pos-promos");
  promosEl.innerHTML = "";

  if (puntos.acumulados >= 10) {
    const btn = document.createElement("button");
    btn.className = "pos-promo-btn";
    btn.textContent = `🎁 Tiene ${puntos.acumulados} puntos — canjear rollito`;
    btn.onclick = async () => {
      const r = await api("redeemPoints", { cedula: cliente.cedula });
      toast(r.ok ? "🎁 Rollito canjeado!" : "❌ " + r.error);
      if (r.ok) posLoadClient(cliente.cedula);
    };
    promosEl.appendChild(btn);
  }

  if (promos.cajaSemanalDisponible) {
    const btn = document.createElement("button");
    btn.className = "pos-promo-btn";
    btn.textContent = "📦 Caja semanal disponible — canjear";
    btn.onclick = async () => {
      const r = await api("redeemCaja", { cedula: cliente.cedula });
      toast(r.ok ? "📦 Caja canjeada!" : "❌ " + r.error);
      if (r.ok) posLoadClient(cliente.cedula);
    };
    promosEl.appendChild(btn);
  }

  if (promos.cumpleDisponible) {
    const btn = document.createElement("button");
    btn.className = "pos-promo-btn";
    btn.style.background = "var(--dorado)";
    btn.textContent = "🎂 Rollito cumpleañero disponible — canjear";
    btn.onclick = async () => {
      const r = await api("redeemCumple", { cedula: cliente.cedula });
      toast(r.ok ? "🎂 Rollito cumpleañero canjeado!" : "❌ " + r.error);
      if (r.ok) posLoadClient(cliente.cedula);
    };
    promosEl.appendChild(btn);
  }

  // Products
  state.cart = {};
  renderProductList();
}

function renderProductList() {
  const listEl = document.getElementById("pos-product-list");
  listEl.innerHTML = "";
  state.products.forEach(p => {
    const qty = state.cart[p.id] || 0;
    const div = document.createElement("div");
    div.className = "product-item";
    div.id = "prod-item-" + p.id;
    div.innerHTML = `
      <div>
        <p class='product-name'>${p.nombre}</p>
        <p class='product-price'>$${p.precio.toLocaleString("es-CO")} · ${p.puntos} pto</p>
      </div>
      <div class='qty-ctrl'>
        <button class='qty-btn' onclick='changeQty("${p.id}", -1)'>−</button>
        <span class='qty-num' id='qty-${p.id}'>${qty}</span>
        <button class='qty-btn' onclick='changeQty("${p.id}", 1)'>+</button>
      </div>`;
    listEl.appendChild(div);
  });
  updateCartTotal();
}

function changeQty(productId, delta) {
  state.cart[productId] = Math.max(0, (state.cart[productId] || 0) + delta);
  document.getElementById("qty-" + productId).textContent = state.cart[productId];
  updateCartTotal();
}

function updateCartTotal() {
  let total = 0;
  state.products.forEach(p => { total += (state.cart[p.id] || 0) * p.puntos; });
  document.getElementById("pos-total-pts").textContent = total;
}

async function confirmSale() {
  if (!state.posClient) return;
  const cedula = state.posClient.cliente.cedula;

  const items = state.products
    .filter(p => (state.cart[p.id] || 0) > 0)
    .map(p => `${p.nombre} x${state.cart[p.id]}`);

  if (items.length === 0) { toast("Selecciona al menos un producto"); return; }

  const puntos_sumados = state.products.reduce((s, p) => s + (state.cart[p.id] || 0) * p.puntos, 0);
  const productos = items.join(", ");

  showLoading();
  const res = await api("registerSale", { cedula, productos, puntos_sumados });
  hideLoading();

  if (!res.ok) { toast("❌ " + res.error); return; }
  toast(`✅ Venta registrada. +${puntos_sumados} pts para ${state.posClient.cliente.nombre}`);

  // Reset
  state.cart = {};
  state.posClient = null;
  document.getElementById("pos-client-card").classList.add("hidden");
  document.getElementById("pos-products-section").classList.add("hidden");
  document.getElementById("pos-cedula-manual").value = "";
}

// ── QR SCANNER ────────────────────────────────────────────────
async function startScan() {
  const wrap  = document.getElementById("pos-camera-wrap");
  const video = document.getElementById("pos-video");
  wrap.classList.remove("hidden");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    state.scanStream = stream;
    video.srcObject = stream;

    const canvas = document.getElementById("pos-canvas");
    const ctx = canvas.getContext("2d");

    // Load jsQR dynamically
    if (!window.jsQR) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js");
    }

    function tick() {
      if (!state.scanStream) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width  = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          stopScan();
          posLoadClient(code.data.trim());
          return;
        }
      }
      requestAnimationFrame(tick);
    }
    tick();
  } catch (err) {
    toast("❌ No se pudo acceder a la cámara");
    stopScan();
  }
}

function stopScan() {
  if (state.scanStream) {
    state.scanStream.getTracks().forEach(t => t.stop());
    state.scanStream = null;
  }
  document.getElementById("pos-camera-wrap").classList.add("hidden");
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── UTILS ─────────────────────────────────────────────────────
function logout() {
  state.cedula = null;
  state.profile = null;
  if (state.flashTimerInterval) clearInterval(state.flashTimerInterval);
  showScreen("login");
}

function showErr(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}

let loadingEl;
function showLoading() {
  if (!loadingEl) {
    loadingEl = document.createElement("div");
    loadingEl.style.cssText = `
      position:fixed;inset:0;background:rgba(250,246,239,.7);
      display:flex;align-items:center;justify-content:center;
      z-index:9999;font-size:2.5rem;
    `;
    loadingEl.textContent = "🦋";
    document.body.appendChild(loadingEl);
  }
  loadingEl.style.display = "flex";
}
function hideLoading() {
  if (loadingEl) loadingEl.style.display = "none";
}

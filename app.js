// ============================================================
//  🦋 CAFÉ MADDRE — APP JS v2
//  Registro progresivo: correo → cédula → nombre/WA → cumple
// ============================================================

const SCRIPT_URL = "PEGA_AQUI_TU_URL_DE_APPS_SCRIPT";

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
  const res = await fetch(SCRIPT_URL + "?" + qs, { method: "GET", redirect: "follow" });
  return res.json();
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
    await loadProducts();
    showScreen("pos");
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

async function loadProducts() {
  const res = await api("getProducts");
  if (res.ok) state.products = res.productos;
}

async function posLoadManual() {
  const correo = document.getElementById("pos-correo-manual").value.trim().toLowerCase();
  if (!correo) return;
  await posLoadClient(correo);
}

async function posLoadClient(correo) {
  showLoading();
  const res = await api("getProfile", { correo });
  hideLoading();
  if (!res.ok) { toast("❌ Cliente no encontrado"); return; }
  state.posClient = res;
  renderPosClient(res);
}

function renderPosClient(res) {
  const { cliente, puntos, promos } = res;
  document.getElementById("pos-client-card").classList.remove("hidden");
  document.getElementById("pos-products-section").classList.remove("hidden");
  const nombreDisplay = cliente.nombre || cliente.correo.split("@")[0];
  document.getElementById("pos-client-name").textContent = nombreDisplay;
  const nivelEmoji = { "Vecino": "🌿", "Habitual": "☕", "De la casa": "🥐" };
  document.getElementById("pos-client-nivel").textContent = (nivelEmoji[cliente.nivel] || "") + " " + cliente.nivel;
  document.getElementById("pos-client-pts").textContent = puntos.acumulados;

  const promosEl = document.getElementById("pos-promos");
  promosEl.innerHTML = "";

  if (puntos.acumulados >= 10) {
    addPosPromoBtn(promosEl, `🎁 ${puntos.acumulados} puntos — canjear rollito`, async () => {
      const r = await api("redeemPoints", { correo: cliente.correo });
      toast(r.ok ? "🎁 Rollito canjeado!" : "❌ " + r.error);
      if (r.ok) posLoadClient(cliente.correo);
    });
  }
  if (promos.cajaSemanalDisponible) {
    addPosPromoBtn(promosEl, "📦 Caja semanal — canjear", async () => {
      const r = await api("redeemCaja", { correo: cliente.correo });
      toast(r.ok ? "📦 Caja canjeada!" : "❌ " + r.error);
      if (r.ok) posLoadClient(cliente.correo);
    });
  }
  if (promos.cumpleDisponible) {
    addPosPromoBtn(promosEl, "🎂 Rollito cumpleañero — canjear", async () => {
      const r = await api("redeemCumple", { correo: cliente.correo });
      toast(r.ok ? "🎂 Rollito cumpleañero canjeado!" : "❌ " + r.error);
      if (r.ok) posLoadClient(cliente.correo);
    }, "var(--dorado)");
  }

  state.cart = {};
  renderProductList();
}

function addPosPromoBtn(container, label, onClick, bg) {
  const btn = document.createElement("button");
  btn.className = "pos-promo-btn";
  if (bg) btn.style.background = bg;
  btn.textContent = label;
  btn.onclick = onClick;
  container.appendChild(btn);
}

function renderProductList() {
  const listEl = document.getElementById("pos-product-list");
  listEl.innerHTML = "";
  state.products.forEach(p => {
    const qty = state.cart[p.id] || 0;
    const div = document.createElement("div");
    div.className = "product-item";
    div.innerHTML = `
      <div>
        <p class='product-name'>${p.nombre}</p>
        <p class='product-price'>$${p.precio.toLocaleString("es-CO")} · ${p.puntos} pto</p>
      </div>
      <div class='qty-ctrl'>
        <button class='qty-btn' onclick='changeQty("${p.id}",-1)'>−</button>
        <span class='qty-num' id='qty-${p.id}'>${qty}</span>
        <button class='qty-btn' onclick='changeQty("${p.id}",1)'>+</button>
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
  const total = state.products.reduce((s, p) => s + (state.cart[p.id] || 0) * p.puntos, 0);
  document.getElementById("pos-total-pts").textContent = total;
}

async function confirmSale() {
  if (!state.posClient) return;
  const correo = state.posClient.cliente.correo;
  const items  = state.products.filter(p => (state.cart[p.id] || 0) > 0)
                               .map(p => `${p.nombre} x${state.cart[p.id]}`);
  if (!items.length) { toast("Selecciona al menos un producto"); return; }
  const puntos_sumados = state.products.reduce((s, p) => s + (state.cart[p.id] || 0) * p.puntos, 0);
  showLoading();
  const res = await api("registerSale", { correo, productos: items.join(", "), puntos_sumados });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast(`✅ Venta registrada. +${puntos_sumados} pts para ${state.posClient.cliente.nombre || correo}`);
  state.cart = {};
  state.posClient = null;
  document.getElementById("pos-client-card").classList.add("hidden");
  document.getElementById("pos-products-section").classList.add("hidden");
  document.getElementById("pos-correo-manual").value = "";
}

// ── QR SCANNER ────────────────────────────────────────────────
async function startScan() {
  const wrap  = document.getElementById("pos-camera-wrap");
  const video = document.getElementById("pos-video");
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
  document.getElementById("pos-camera-wrap").classList.add("hidden");
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

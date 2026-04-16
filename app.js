// ════════════════════════════════════════════════════════════
//  PIN CAJA
// ════════════════════════════════════════════════════════════
let pinValue = "";

function pinReset() {
  pinValue = "";
  updatePinDots();
  const errEl = document.getElementById("pin-error");
  if (errEl) errEl.classList.add("hidden");
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
  state.posPin      = pinValue;
  state.adminNombre = res.nombre || "";
  sessionStorage.setItem("maddre_pos_pin",    pinValue);
  sessionStorage.setItem("maddre_pos_nombre", res.nombre || "");
  // Mostrar botones de destino
  document.getElementById("pin-destino").classList.remove("hidden");
}

async function pinIrA(destino) {
  if (destino === "pos") {
    if (window.POS_MODE) {
      showScreen("pos");
      await initPOS();
    } else {
      window.location.href = "pos.html";
    }
  } else {
    // admin
    if (window.POS_MODE) {
      sessionStorage.setItem("pos_pin_verified", state.posPin || "1");
      window.location.href = "index.html#admin";
    } else {
      state.adminPass = POS_PIN_CLIENT;
      showScreen("admin");
      mostrarSaludoAdmin();
      await loadAdminSummary();
    }
  }
}

function mostrarSaludoAdmin() {
  const nombre = state.adminNombre
    ? state.adminNombre.charAt(0).toUpperCase() + state.adminNombre.slice(1).toLowerCase()
    : "Admin";
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  document.getElementById("admin-saludo").textContent = saludo + ", " + nombre + " — todo listo para hoy 🦋";
}

const POS_PIN_CLIENT = "__pin__"; // marcador interno

// ============================================================
//  🦋 CAFÉ MADDRE — APP JS v2
//  Registro progresivo: correo → cédula → nombre/WA → cumple
// ============================================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylSrBu84KEaLl19Jny5YSt2iTgRdUfdVEfpseT_KMdjkGvA2Z-5y5pC-XqSto-Lz99GQ/exec";

// ── Frases del día (editar aquí o conectar a Sheets más adelante) ──
const FRASES_DIA = [
  "Hoy también mereces algo rico ☕",
  "Los mejores momentos huelen a canela 🌿",
  "Gracias por ser parte del barrio 🦋",
  "Un pequeño placer hace grande el día",
  "Los vecinos hacen el barrio más bonito",
  "Cada rollito es hecho con cariño para ti",
  "Hay historias que solo se cuentan con café",
  "El barrio es más dulce contigo en él",
  "Lo casero siempre sabe diferente",
  "Hoy también hay un lugar cálido para ti",
  "Los buenos planes empiezan con un tinto ☕",
  "Cocinar con amor se nota en cada mordisco",
  "El café siempre tiene algo que contar 🦋",
  "Un poco de dulce y mucho barrio 🌿",
  "La tarde siempre mejora con algo dulce",
  "Cada visita es nuestra favorita del día",
  "Los mejores días tienen sabor a casa",
  "Hoy también te esperamos con algo rico 🦋",
  "La canela lo hace todo mejor",
  "Cada vecino hace este lugar más especial",
  "Un rollito puede cambiar el rumbo de la tarde",
  "Los rollitos, como tú, son únicos",
  "El barrio nos une, el café nos reúne ☕",
  "Hoy también hay canela para ti",
  "Gracias por cuidar el barrio con tu presencia",
  "Los momentos bonitos siempre huelen rico 🌿",
  "Hay días que solo piden algo dulce",
  "Hoy es un buen día para un rollito 🦋",
  "Cada mordisco tiene historia detrás",
  "Aquí siempre hay algo hecho con amor ☕",
];

function getFraseDelDia() {
  const inicio = new Date(new Date().getFullYear(), 0, 0);
  const diaDelAnio = Math.floor((new Date() - inicio) / 86400000);
  return FRASES_DIA[diaDelAnio % FRASES_DIA.length];
}

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
window.addEventListener("load", () => setTimeout(() => {
  if (window.POS_MODE) {
    const savedPin    = sessionStorage.getItem("maddre_pos_pin");
    const savedNombre = sessionStorage.getItem("maddre_pos_nombre");
    const bypass      = sessionStorage.getItem("maddre_pos_bypass");
    if (bypass) {
      sessionStorage.removeItem("maddre_pos_bypass");
      state.adminPass   = bypass;
      state.adminNombre = "Admin";
      showScreen("pos");
      initPOS();
    } else if (savedPin) {
      state.posPin      = savedPin;
      state.adminNombre = savedNombre || "";
      showScreen("pos");
      initPOS();
    } else {
      showScreen("pin");
    }
    return;
  }
  // Llegó desde pos.html con PIN ya verificado → entrar directo al admin
  if (window.location.hash === "#admin" && sessionStorage.getItem("pos_pin_verified")) {
    history.replaceState(null, "", window.location.pathname);
    state.posPin   = sessionStorage.getItem("pos_pin_verified");
    state.adminPass = POS_PIN_CLIENT;
    sessionStorage.removeItem("pos_pin_verified");
    showScreen("admin");
    mostrarSaludoAdmin();
    loadAdminSummary();
    initPullToRefresh();
    return;
  }
  // Llegó a admin-login sin PIN verificado (acceso directo desde club)
  if (window.location.hash === "#admin") {
    history.replaceState(null, "", window.location.pathname);
    sessionStorage.setItem("admin_desde_pos", "1");
    showScreen("admin-login");
    return;
  }
  const savedCorreo = localStorage.getItem("maddre_correo");
  if (savedCorreo) {
    restaurarSesion(savedCorreo);
  } else {
    mostrarVistaInvitado();
    iniciarTimerRegistro();
  }
  initMoodChips();
  initPullToRefresh();
}, 800));

async function restaurarSesion(correo) {
  state.correo = correo;
  showLoading();
  const res = await api("getProfile", { correo });
  hideLoading();
  if (!res.ok) {
    // Sesión inválida — limpiar y mostrar como invitado
    localStorage.removeItem("maddre_correo");
    state.correo = null;
    mostrarVistaInvitado();
    iniciarTimerRegistro();
    return;
  }
  state.profile = res;
  renderProfile(res);
  showScreen("profile");
}

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
//  MODO INVITADO + MODALES DE REGISTRO
// ════════════════════════════════════════════════════════════

function mostrarVistaInvitado() {
  document.getElementById("prof-nombre").textContent = "Hola, vecino 🦋";
  document.getElementById("prof-correo").textContent  = getFraseDelDia();
  document.getElementById("prof-nivel-badge").textContent = "🌿 Vecino";
  document.getElementById("prof-puntos").textContent  = "—";
  document.getElementById("btn-redeem-pts").disabled  = true;
  // Botones header: modo invitado
  const btnIzq = document.getElementById("prof-btn-izq");
  const btnDer = document.getElementById("prof-btn-der");
  btnIzq.textContent = "→"; btnIzq.className = "icon-btn"; btnIzq.onclick = abrirModalRegistro;
  btnDer.textContent = "↻"; btnDer.className = "icon-btn"; btnDer.onclick = loadProfile;
  document.getElementById("perfil-incompleto-banner").classList.add("hidden");
  document.getElementById("flash-banner").classList.add("hidden");
  const estadoEl = document.getElementById("estado-tienda");
  if (estadoEl) {
    const ab = calcularEstadoTienda();
    estadoEl.textContent = ab ? "● Abierto" : "● Cerrado";
    estadoEl.className   = "estado-pill " + (ab ? "abierto" : "cerrado");
  }
  showScreen("profile");
  loadMusica();
  loadTrueque();
  // Cargar sabores para la reserva aunque sea invitado
  api("getProducts").then(r => {
    if (r.ok && r.saboresRollito) initReservaSabores(r.saboresRollito);
  });
}

// Timer: muestra el popup de registro al minuto
let _registroTimer = null;
function enPerfilInvitado() {
  return !state.correo && document.getElementById("screen-profile")?.classList.contains("active");
}
function iniciarTimerRegistro() {
  clearTimeout(_registroTimer);
  _registroTimer = setTimeout(() => { if (enPerfilInvitado()) abrirModalRegistro(); }, 60000);
}

function abrirModalRegistro() {
  clearTimeout(_registroTimer);
  if (!enPerfilInvitado()) return;
  document.getElementById("modal-registro").classList.remove("hidden");
  setTimeout(() => document.getElementById("modal-correo-input")?.focus(), 120);
}
function cerrarModalRegistro() {
  document.getElementById("modal-registro").classList.add("hidden");
  // Si cierra sin registrarse, vuelve a preguntar en 3 min
  if (!state.correo) _registroTimer = setTimeout(() => { if (enPerfilInvitado()) abrirModalRegistro(); }, 180000);
}
function cerrarModalBloqueado() {
  document.getElementById("modal-bloqueado").classList.add("hidden");
}
function abrirRegistroDesdeBloqueo() {
  cerrarModalBloqueado();
  abrirModalRegistro();
}

// Guarda acción bloqueada y muestra modal de registro
function requireAuth(accion = "hacer esto") {
  if (state.correo) return true;
  document.getElementById("modal-bloqueado-accion").textContent = accion;
  document.getElementById("modal-bloqueado").classList.remove("hidden");
  return false;
}

// Submit del modal de correo
async function modalContinuarRegistro() {
  const correo = document.getElementById("modal-correo-input").value.trim().toLowerCase();
  const errEl  = document.getElementById("modal-correo-error");
  hideErr(errEl);
  if (!correo || !correo.includes("@")) { showErr(errEl, "Ingresa un correo válido"); return; }

  showLoading();
  const res = await api("iniciar", { correo });
  hideLoading();
  if (!res.ok) { showErr(errEl, res.error); return; }

  state.correo = correo;
  localStorage.setItem("maddre_correo", correo);
  document.getElementById("modal-registro").classList.add("hidden");

  if (res.paso >= 4) {
    // Usuario completo → pedir cédula
    document.getElementById("modal-cedula").classList.remove("hidden");
    setTimeout(() => document.getElementById("modal-cedula-input")?.focus(), 120);
    return;
  }
  // Nuevo o incompleto → onboarding / perfil directo
  await loadAndShowProfile();
}

// Submit del modal de cédula (usuarios existentes)
async function modalLoginCedula() {
  const cedula = document.getElementById("modal-cedula-input").value.trim();
  const errEl  = document.getElementById("modal-cedula-error");
  hideErr(errEl);
  if (!cedula) { showErr(errEl, "Ingresa tu cédula"); return; }

  showLoading();
  const res = await api("login", { correo: state.correo, cedula });
  hideLoading();
  if (!res.ok) { showErr(errEl, res.error); return; }

  document.getElementById("modal-cedula").classList.add("hidden");
  state.profile = res;
  renderProfile(res);
  showScreen("profile");
}

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
  localStorage.setItem("maddre_correo", state.correo);
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
  localStorage.setItem("maddre_correo", state.correo);
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
  document.getElementById("prof-correo").textContent = res.fraseDelDia || getFraseDelDia();

  const nivelEmoji = { "Vecino": "🌿", "Habitual": "☕", "De la casa": "🌀" };
  const badge = document.getElementById("prof-nivel-badge");
  badge.textContent = (nivelEmoji[cliente.nivel] || "") + " " + cliente.nivel;

  // Botones header: modo logueado
  const inicial = (cliente.nombre || cliente.correo || "?")[0].toUpperCase();
  const btnIzqL = document.getElementById("prof-btn-izq");
  const btnDerL = document.getElementById("prof-btn-der");
  btnIzqL.textContent = "↩"; btnIzqL.className = "icon-btn"; btnIzqL.onclick = logout;
  btnDerL.textContent = inicial; btnDerL.className = "icon-btn icon-btn-inicial"; btnDerL.onclick = loadProfile;

  // Puntos
  document.getElementById("prof-puntos").textContent = puntos.acumulados;
  const elTotal    = document.getElementById("stat-total");    if (elTotal)    elTotal.textContent    = puntos.totalProductos;
  const elRollitos = document.getElementById("stat-rollitos"); if (elRollitos) elRollitos.textContent = puntos.rollitosCanjeados;
  const elNivel    = document.getElementById("stat-nivel");    if (elNivel)    elNivel.textContent    = cliente.nivel;

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

  // Promos
  renderPromos(promos, cliente);

  // Estado tienda (abierto/cerrado)
  const estadoEl = document.getElementById("estado-tienda");
  if (estadoEl) {
    const abierto = calcularEstadoTienda();
    estadoEl.textContent = abierto ? "● Abierto" : "● Cerrado";
    estadoEl.className   = "estado-pill " + (abierto ? "abierto" : "cerrado");
  }

  // Flash
  renderFlash(flash);

  // Load extras
  loadMusica();
  loadTrueque();
  if (state.profile?.config?.saboresRollito) {
    initReservaSabores(state.profile.config.saboresRollito);
  } else {
    // Load sabores from config
    api("getProducts").then(r => {
      if (r.ok && r.saboresRollito) initReservaSabores(r.saboresRollito);
    });
  }

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
    cumpleDesc.textContent = "🎂 ¡Feliz cumpleaños! Rollito gratis hoy";
  } else if (promos.esDiaCumple === false && promos.esMesCumple) {
    btnCumple.disabled = true;
    cumpleDesc.textContent = "Solo disponible el día exacto de tu cumpleaños";
  } else if (promos.mesesParaCumple !== null && promos.mesesParaCumple > 0) {
    btnCumple.disabled = true;
    cumpleDesc.textContent = `Tu cumpleaños llega en ${promos.mesesParaCumple} mes(es)`;
  } else {
    btnCumple.disabled = true;
    cumpleDesc.textContent = "Solo el día de tu cumpleaños";
  }
}

function calcularEstadoTienda() {
  const ahora = new Date();
  const dia   = ahora.getDay(); // 0=dom,1=lun,2=mar,3=mie,4=jue,5=vie,6=sab
  const hora  = ahora.getHours() + ahora.getMinutes() / 60;
  const diasAbiertos = [0, 3, 4, 5, 6]; // dom, mié, jue, vie, sáb
  return diasAbiertos.includes(dia) && hora >= 15 && hora < 19;
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


// ── STATS CLIENTE ─────────────────────────────────────────────
async function loadClienteStats(correo) {
  const res = await api("getClienteStats", { correo });
  if (!res.ok) return;
  document.getElementById("stat-favorito").textContent = res.favorito || "—";
  document.getElementById("stat-canciones").textContent = res.canciones || 0;
}

// ── RESERVA ───────────────────────────────────────────────────
let reservaState = { qty: 1, sabor: null, tiempo: null };

function reservaQty(delta) {
  reservaState.qty = Math.max(1, reservaState.qty + delta);
  document.getElementById("reserva-qty").textContent = reservaState.qty;
}

function initReservaSabores(sabores) {
  const grid = document.getElementById("reserva-sabores-grid");
  if (!grid) return;
  grid.innerHTML = "";
  sabores.forEach(s => {
    const btn = document.createElement("button");
    btn.className = "sabor-chip";
    btn.textContent = s;
    btn.onclick = () => {
      document.querySelectorAll(".sabor-chip").forEach(b => b.classList.remove("sel"));
      btn.classList.add("sel");
      reservaState.sabor = s;
    };
    grid.appendChild(btn);
  });
}

function selTiempo(btn, val) {
  document.querySelectorAll(".t-btn").forEach(b => b.classList.remove("sel"));
  btn.classList.add("sel");
  reservaState.tiempo = val;
}

async function enviarReserva() {
  if (!requireAuth("reservar tu rollito")) return;
  const errEl = document.getElementById("reserva-error");
  errEl.classList.add("hidden");
  if (!reservaState.sabor) { errEl.textContent = "Elige un sabor"; errEl.classList.remove("hidden"); return; }
  if (!reservaState.tiempo) { errEl.textContent = "¿En cuánto llegas?"; errEl.classList.remove("hidden"); return; }

  showLoading();
  const res = await api("crearReserva", {
    correo: state.correo,
    cantidad: reservaState.qty,
    sabor: reservaState.sabor,
    tiempo: reservaState.tiempo,
  });
  hideLoading();

  if (!res.ok) { errEl.textContent = res.error; errEl.classList.remove("hidden"); return; }
  toast("🦋 ¡Listo! Ya te guardamos los rollitos");
  // Reset
  reservaState = { qty: 1, sabor: null, tiempo: null };
  document.getElementById("reserva-qty").textContent = 1;
  document.querySelectorAll(".sabor-chip").forEach(b => b.classList.remove("sel"));
  document.querySelectorAll(".t-btn").forEach(b => b.classList.remove("sel"));
}

// ── INSTALAR PWA ──────────────────────────────────────────────
let _pwaPrompt = null;

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  _pwaPrompt = e;
  const btn = document.getElementById("btn-instalar-app");
  if (btn) btn.classList.remove("hidden");
});

window.addEventListener("appinstalled", () => {
  const btn = document.getElementById("btn-instalar-app");
  if (btn) btn.classList.add("hidden");
  _pwaPrompt = null;
});

async function instalarApp() {
  if (_pwaPrompt) {
    _pwaPrompt.prompt();
    const { outcome } = await _pwaPrompt.userChoice;
    if (outcome === "accepted") _pwaPrompt = null;
  } else {
    // iOS: no soporta prompt nativo, mostrar instrucciones
    toast("En iPhone: toca Compartir → 'Añadir a inicio' 🦋", 5000);
  }
}

// ── COMPARTIR APP ─────────────────────────────────────────────
function compartirApp() {
  const url  = "https://is.gd/clubmaddre";
  const text = "¡Mira el club de Café Maddre! Acumula puntos, pide domicilio y más 🦋";
  if (navigator.share) {
    navigator.share({ title: "Club Maddre 🦋", text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url)
      .then(() => toast("📋 Link copiado al portapapeles"))
      .catch(() => toast("Comparte este link: " + url));
  }
}

// ── TALLER ────────────────────────────────────────────────────
async function alertarTaller() {
  if (!requireAuth("apartar cupo en el taller")) return;
  showLoading();
  const res = await api("alertaTaller", { correo: state.correo });
  hideLoading();
  toast(res.ok ? "🎨 ¡Listo! Te contactamos para confirmar tu cupo" : "❌ " + res.error);
}

// ── PULL TO REFRESH ───────────────────────────────────────────
function initPullToRefresh() {
  _wirePTR(
    document.getElementById("screen-profile"),
    document.getElementById("ptr-indicator"),
    () => state.correo
      ? loadProfile()
      : Promise.allSettled([loadMusica(), loadTrueque()])
  );
  _wirePTR(
    document.getElementById("screen-admin"),
    document.getElementById("ptr-indicator-admin"),
    () => loadAdminSummary()
  );
}

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

// ── TRUEQUE DE LIBROS ─────────────────────────────────────────
let _moodSeleccionado = "para llorar";

function initMoodChips() {
  document.querySelectorAll(".mood-chip").forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll(".mood-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      _moodSeleccionado = chip.dataset.mood;
    };
  });
}

async function loadTrueque() {
  const res = await api("getTrueque", { correo: state.correo || "" });
  if (!res.ok) return;

  // Input visible solo si no tiene libro publicado
  const inputWrap = document.getElementById("trueque-input-wrap");
  const miLibroWrap = document.getElementById("mi-libro-wrap");
  if (res.miLibro) {
    inputWrap.classList.add("hidden");
    miLibroWrap.classList.remove("hidden");
    miLibroWrap.innerHTML = `
      <div class="mi-libro-chip">
        <span>📖 <strong>${res.miLibro.titulo}</strong> · <em>${res.miLibro.mood}</em></span>
        <button onclick="retirarLibro('${res.miLibro.id}')" class="retirar-btn">Retirar</button>
      </div>`;
  } else {
    inputWrap.classList.remove("hidden");
    miLibroWrap.classList.add("hidden");
    miLibroWrap.innerHTML = "";
    initMoodChips();
  }

  renderTruequeWall(res.libros, res.miLibro);
  renderPropuestas(res.propuestas);
  renderSabadoBanner(res.matchesSabado);
}

function renderTruequeWall(libros, miLibro) {
  const wall = document.getElementById("trueque-wall");
  if (!libros || !libros.length) {
    wall.innerHTML = "<p class='trueque-empty'>Sé el primero en poner un libro 📖</p>";
    return;
  }
  wall.innerHTML = "";
  libros.forEach(l => {
    const esMio = miLibro && String(l.id) === String(miLibro.id);
    const div = document.createElement("div");
    div.className = "trueque-book-card";
    div.innerHTML = `
      <span class="trueque-book-icon">📖</span>
      <div class="trueque-book-info">
        <p class="trueque-book-title">${l.titulo}</p>
        <p class="trueque-book-meta">por ${l.nombre || l.correo.split("@")[0]}</p>
        <span class="trueque-mood-tag">${l.mood}</span>
      </div>
      ${esMio
        ? `<span class="trueque-tuyo">tuyo</span>`
        : `<button class="trueque-heart ${l.yaDiHeart ? 'active' : ''}" onclick="heartLibro('${l.id}')">♥ ${l.hearts || 0}</button>`
      }`;
    wall.appendChild(div);
  });
}

function renderPropuestas(propuestas) {
  const card = document.getElementById("trueque-propuestas-card");
  const list = document.getElementById("trueque-propuestas-list");
  if (!propuestas || !propuestas.length) { card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  list.innerHTML = "";
  propuestas.forEach(p => {
    const div = document.createElement("div");
    div.className = "trueque-propuesta";
    div.innerHTML = `
      <div class="propuesta-header">
        <div>
          <p class="propuesta-user">de ${p.nombre_oferta || p.correo_oferta.split("@")[0]}</p>
          <p class="propuesta-book">${p.libro_oferta_titulo}</p>
          <p class="propuesta-offer">a cambio de tu "<em>${p.libro_receptor_titulo}</em>"</p>
        </div>
        <span class="propuesta-badge">${p.mood_oferta || ""}</span>
      </div>
      <div class="propuesta-actions">
        <button class="btn-aceptar" onclick="responderPropuesta('${p.id}','aceptado')">Aceptar</button>
        <button class="btn-rechazar" onclick="responderPropuesta('${p.id}','rechazado')">Rechazar</button>
      </div>`;
    list.appendChild(div);
  });
}

function renderSabadoBanner(count) {
  const banner = document.getElementById("trueque-sabado");
  if (!count) { banner.classList.add("hidden"); return; }
  banner.classList.remove("hidden");
  document.getElementById("trueque-match-num").textContent = count;
}

async function publicarLibro() {
  if (!requireAuth("publicar un libro en el trueque")) return;
  const titulo = document.getElementById("trueque-titulo").value.trim();
  if (!titulo) { toast("Escribe el título del libro 📖"); return; }
  showLoading();
  const res = await api("publicarLibro", { correo: state.correo, titulo, mood: _moodSeleccionado });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  document.getElementById("trueque-titulo").value = "";
  toast("📚 ¡Libro publicado! A ver quién lo quiere");
  loadTrueque();
}

async function heartLibro(id) {
  if (!requireAuth("proponer un trueque")) return;
  showLoading();
  const res = await api("heartLibro", { correo: state.correo, id });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("💌 ¡Propuesta enviada! El dueño decidirá si acepta");
  loadTrueque();
}

async function responderPropuesta(id, accion) {
  showLoading();
  const res = await api("responderPropuesta", { correo: state.correo, id, accion });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast(accion === "aceptado"
    ? "🎉 ¡Match! Se verán el sábado en Maddre 📚"
    : "Propuesta rechazada");
  loadTrueque();
}

async function retirarLibro(id) {
  showLoading();
  const res = await api("retirarLibro", { correo: state.correo, id });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("📖 Libro retirado del trueque");
  loadTrueque();
}

// ── MÚSICA ────────────────────────────────────────────────────
async function loadMusica() {
  const res = await api("getMusica");
  if (!res.ok) return;
  renderMusicaWall(res.canciones);
}

function renderMusicaWall(canciones) {
  const wall = document.getElementById("musica-wall");
  if (!wall) return;
  wall.innerHTML = "";
  if (!canciones.length) {
    wall.innerHTML = "<p style='color:rgba(255,255,255,.4);font-size:.85rem;text-align:center;padding:.5rem'>Sé el primero en sugerir una canción hoy 🎵</p>";
    return;
  }
  const MAX = 8;
  const visibles = canciones.slice(0, MAX);
  visibles.forEach(c => {
    const div = document.createElement("div");
    div.className = "musica-item";
    div.innerHTML = `
      <div>
        <p class="musica-nombre">🎵 ${c.cancion}</p>
        <p class="musica-quien">por ${c.nombre || c.correo.split("@")[0]}</p>
      </div>
      <button class="musica-votar" onclick="votarCancion('${c.id}')">
        ♥ ${c.votos || 0}
      </button>`;
    wall.appendChild(div);
  });
  if (canciones.length > MAX) {
    const more = document.createElement("p");
    more.style.cssText = "color:rgba(255,255,255,.35);font-size:.78rem;text-align:center;padding:.5rem 0";
    more.textContent = `+ ${canciones.length - MAX} canciones más hoy`;
    wall.appendChild(more);
  }
}

async function sugerirCancion() {
  if (!requireAuth("sugerir canciones")) return;
  const input = document.getElementById("musica-input");
  const cancion = input.value.trim();
  if (!cancion) return;
  showLoading();
  const res = await api("crearSugerencia", { correo: state.correo, cancion });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  input.value = "";
  toast("🎵 ¡Sugerencia enviada!");
  loadMusica();
}

async function votarCancion(id) {
  if (!requireAuth("votar canciones")) return;
  showLoading();
  const res = await api("votarCancion", { id, correo: state.correo });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  loadMusica();
}

// ── REDENCIONES CLIENTE ───────────────────────────────────────
async function redeemPoints() {
  if (!requireAuth("canjear puntos")) return;
  showLoading();
  const res = await api("redeemPoints", { correo: state.correo });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("🎉 ¡Rollito canjeado! Muestra esta pantalla en caja.");
  loadProfile();
}

async function redeemCaja() {
  if (!requireAuth("canjear la caja semanal")) return;
  showLoading();
  const res = await api("redeemCaja", { correo: state.correo });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("📦 ¡Caja semanal canjeada! 4 rollitos por $20.000");
  loadProfile();
}

async function redeemCumple() {
  if (!requireAuth("canjear tu rollito cumpleañero")) return;
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
  localStorage.removeItem("maddre_correo");
  if (state.flashTimerInterval) clearInterval(state.flashTimerInterval);
  mostrarVistaInvitado();
  iniciarTimerRegistro();
}

// ════════════════════════════════════════════════════════════
//  ADMIN
// ════════════════════════════════════════════════════════════

function showAdminLogin() { showScreen("admin-login"); }

function adminLoginVolver() {
  // Si llegamos desde pos.html (via #admin), volver a pos
  // Si llegamos desde el club, volver al login
  if (document.referrer.includes("pos.html") || sessionStorage.getItem("admin_desde_pos")) {
    sessionStorage.removeItem("admin_desde_pos");
    window.location.href = "pos.html";
  } else {
    showScreen("login");
  }
}

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
    showScreen("admin");
    await loadAdminSummary();
  } else {
    showScreen("pos");
    await initPOS();
  }
}

// ── ADMIN TABS ────────────────────────────────────────────────
function adminTab(btn, tab) {
  document.querySelectorAll(".admin-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".admin-section").forEach(s => s.classList.add("hidden"));
  document.getElementById("admin-tab-" + tab).classList.remove("hidden");
  if (tab === "resumen") loadAdminSummary();
  if (tab === "clientes") {
    document.getElementById("admin-search").value = "";
    document.getElementById("admin-client-detail").classList.add("hidden");
    loadAllClientes();
  }
}

async function loadAdminSummary() {
  showLoading();
  const res = await api("getAdminSummary", { pin: state.posPin || "", adminPassword: state.adminPass || "" });
  hideLoading();
  if (!res.ok) return;

  document.getElementById("adm-total-ventas").textContent = "$" + (res.totalVentas || 0).toLocaleString("es-CO");
  document.getElementById("adm-transacciones").textContent = res.transacciones || 0;
  document.getElementById("adm-vecinos").textContent = res.vecinos || 0;
  document.getElementById("adm-rollitos").textContent = res.rollitosCanjeados || 0;
  document.getElementById("adm-libros").textContent   = res.librosDisponibles || 0;
  document.getElementById("adm-recipients-pill").textContent = `👥 ${res.vecinos || 0} vecinos recibirán este mensaje`;

  // Nuevos vecinos esta semana
  const nuevosEl = document.getElementById("admin-nuevos-list");
  if (nuevosEl) {
    if (!res.nuevosVecinos || !res.nuevosVecinos.length) {
      nuevosEl.innerHTML = "<p style='color:var(--text-lt);font-size:.82rem'>Ninguno esta semana aún 🦋</p>";
    } else {
      nuevosEl.innerHTML = res.nuevosVecinos.map(v => {
        const nombre  = v.nombre || v.correo.split("@")[0];
        const fecha   = v.fecha_registro ? new Date(v.fecha_registro).toLocaleDateString("es-CO", { day:"numeric", month:"short" }) : "";
        const paso    = Number(v.nivel_registro) || 1;
        const pasoTag = paso < 4
          ? `<span class="nuevo-paso-tag">paso ${paso}/4</span>`
          : `<span class="nuevo-paso-tag completo">✓ completo</span>`;
        return `<div class="nuevo-vecino-row">
          <span class="nuevo-vecino-avatar">${nombre[0]?.toUpperCase() || "?"}</span>
          <div class="nuevo-vecino-info">
            <p class="nuevo-vecino-nombre">${nombre}</p>
            <p class="nuevo-vecino-correo">${v.correo}</p>
          </div>
          <div style="text-align:right">
            ${pasoTag}
            <p class="nuevo-vecino-fecha">${fecha}</p>
          </div>
        </div>`;
      }).join("");
    }
  }

  // Status abierto/cerrado
  const badge = document.getElementById("admin-status-badge");
  if (res.abierto) {
    badge.textContent = "● Abierto";
    badge.className = "status-badge abierto";
  } else {
    badge.textContent = "● Cerrado";
    badge.className = "status-badge cerrado";
  }

  // Top canciones
  const list = document.getElementById("adm-canciones");
  list.innerHTML = "";
  if (!res.topCanciones || !res.topCanciones.length) {
    list.innerHTML = "<p style='color:var(--text-lt);font-size:.85rem'>Nadie ha sugerido canciones hoy</p>";
  } else {
    res.topCanciones.forEach((c, i) => {
      const div = document.createElement("div");
      div.className = "song-row";
      const rank = i === 0 ? '<span class="song-rank gold">♛</span>' : `<span class="song-rank">${i+1}</span>`;
      div.innerHTML = `${rank}
        <div class="song-info">
          <p class="song-name">${c.cancion}</p>
          <p class="song-sub">sugerida por ${c.nombre || c.correo?.split("@")[0] || "—"}</p>
        </div>
        <span class="song-likes">♥ ${c.votos || 0}</span>`;
      list.appendChild(div);
    });
  }
}

// ── LISTA Y BÚSQUEDA DE CLIENTES ADMIN ───────────────────────
function renderClientesList(clientes, container) {
  container.innerHTML = "";
  if (!clientes.length) {
    container.innerHTML = "<p style='color:var(--text-lt);font-size:.85rem;padding:.5rem 0'>No encontramos ese vecino 🦋</p>";
    return;
  }
  clientes.forEach(c => {
    const div = document.createElement("div");
    div.className = "search-result-item";
    const nivelEmoji = { "Vecino": "🌿", "Habitual": "☕", "De la casa": "🌀" };
    const emoji = nivelEmoji[c.nivel] || "🌿";
    div.innerHTML = `<p class='result-name'>${c.nombre || "(sin nombre)"}</p>
      <p class='result-sub'>${c.correo} · ${emoji} ${c.nivel}</p>`;
    div.onclick = () => loadAdminClientDetail(c.correo);
    container.appendChild(div);
  });
}

async function adminAgregarCliente() {
  const input  = document.getElementById("admin-nuevo-correo");
  const msgEl  = document.getElementById("admin-nuevo-msg");
  const correo = input.value.trim().toLowerCase();
  msgEl.classList.add("hidden");
  if (!correo || !correo.includes("@")) {
    msgEl.textContent = "❌ Correo inválido";
    msgEl.style.color = "var(--flash)";
    msgEl.classList.remove("hidden");
    return;
  }
  showLoading();
  const res = await api("iniciar", { correo });
  hideLoading();
  msgEl.classList.remove("hidden");
  if (!res.ok) {
    msgEl.textContent = "❌ " + res.error;
    msgEl.style.color = "var(--flash)";
  } else if (res.esNuevo) {
    msgEl.textContent = "✅ Vecino agregado — correo de bienvenida enviado";
    msgEl.style.color = "var(--verde)";
    input.value = "";
    loadAllClientes();
  } else {
    msgEl.textContent = "ℹ️ Ya existe en el club (paso " + res.paso + " de 4)";
    msgEl.style.color = "var(--text-md)";
  }
}

async function loadAllClientes() {
  const container = document.getElementById("admin-search-results");
  container.innerHTML = "<p style='color:var(--text-lt);font-size:.82rem;padding:.5rem 0'>Cargando vecinos…</p>";
  const res = await api("searchClient", { q: "@", adminPassword: state.adminPass || "", pin: state.posPin || "" });
  if (!res.ok) { container.innerHTML = ""; return; }
  renderClientesList(res.clientes, container);
}

let adminSearchTimer2 = null;
async function adminSearchDynamic() {
  const q = document.getElementById("admin-search").value.trim();
  const container = document.getElementById("admin-search-results");
  document.getElementById("admin-client-detail").classList.add("hidden");
  clearTimeout(adminSearchTimer2);
  if (q.length < 2) { loadAllClientes(); return; }
  adminSearchTimer2 = setTimeout(async () => {
    const res = await api("searchClient", { q, adminPassword: state.adminPass || "", pin: state.posPin || "" });
    renderClientesList(res.ok ? res.clientes : [], container);
  }, 400);
}

async function loadAdminClientDetail(correo) {
  showLoading();
  const res = await api("getClienteHistorial", { correo, pin: state.posPin || "", adminPassword: state.adminPass || "" });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }

  document.getElementById("admin-search-results").innerHTML = "";
  document.getElementById("admin-client-detail").classList.remove("hidden");

  const inicial = (res.cliente.nombre || correo)[0].toUpperCase();
  document.getElementById("adm-avatar").textContent = inicial;
  document.getElementById("adm-client-name").textContent = res.cliente.nombre || "(sin nombre)";
  document.getElementById("adm-client-info").textContent = res.cliente.correo + " · " + res.cliente.nivel;
  document.getElementById("adm-client-pts").textContent = res.puntos;

  // Compras
  const comprasEl = document.getElementById("adm-compras");
  comprasEl.innerHTML = "";
  if (!res.compras.length) {
    comprasEl.innerHTML = "<p style='color:var(--text-lt);font-size:.85rem'>Sin compras registradas</p>";
  } else {
    res.compras.forEach(c => {
      const div = document.createElement("div");
      div.className = "compra-item";
      div.innerHTML = `<p class='compra-fecha'>${c.fecha} · ${c.sector || ""}</p>
        <p class='compra-productos'>${c.productos}</p>
        <p class='compra-total'>$${(c.total||0).toLocaleString("es-CO")}</p>`;
      comprasEl.appendChild(div);
    });
  }

  // Promos
  const promosEl = document.getElementById("adm-promos-list");
  promosEl.innerHTML = "";
  if (!res.promosCanjeadas.length) {
    promosEl.innerHTML = "<p style='color:var(--text-lt);font-size:.85rem'>Sin promos canjeadas</p>";
  } else {
    res.promosCanjeadas.forEach(p => {
      const div = document.createElement("div");
      div.className = "promo-hist-item";
      div.textContent = p;
      promosEl.appendChild(div);
    });
  }

  document.getElementById("admin-client-detail").scrollIntoView({ behavior: "smooth" });
}

// ── ENVÍO MASIVO ──────────────────────────────────────────────
function updateEmailPreview() {
  const msg = document.getElementById("masivo-mensaje").value;
  document.getElementById("email-preview-body").textContent = msg || "Tu mensaje aparecerá aquí...";
}

async function enviarMasivo() {
  const asunto  = document.getElementById("masivo-asunto").value.trim();
  const mensaje = document.getElementById("masivo-mensaje").value.trim();
  if (!asunto || !mensaje) { toast("Completa asunto y mensaje"); return; }
  if (!confirm(`¿Enviar este correo a todos los vecinos?`)) return;
  showLoading();
  const res = await api("enviarMasivo", { asunto, mensaje, pin: state.posPin || "", adminPassword: state.adminPass || "" });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast(`✅ Correo enviado a ${res.enviados} vecinos`);
  document.getElementById("masivo-asunto").value = "";
  document.getElementById("masivo-mensaje").value = "";
  document.getElementById("email-preview-body").textContent = "Tu mensaje aparecerá aquí...";
}



async function createFlash() {
  const texto        = document.getElementById("flash-texto").value.trim();
  const nivel_minimo = document.getElementById("flash-nivel").value;
  const hora_fin     = document.getElementById("flash-horas").value;
  if (!texto) { toast("Escribe el mensaje del flash"); return; }
  showLoading();
  const res = await api("createFlash", { texto, nivel_minimo, hora_fin, adminPassword: state.adminPass || "", pin: state.posPin || "" });
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
  const sel     = document.getElementById("pos-sel-producto");
  const nombre  = sel.value.toUpperCase();
  const varWrap = document.getElementById("pos-variedad-wrap");
  const chipsEl = document.getElementById("pos-variedad-chips");

  varWrap.classList.add("hidden");
  chipsEl.innerHTML = "";

  let sabores = [];
  if (nombre.includes("ROLLITO")) sabores = posState.config.saboresRollito || [];
  else if (nombre.includes("BAGUETTE")) sabores = posState.config.saboresBaguette || [];

  if (sabores.length) {
    sabores.forEach(s => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pos-var-chip";
      btn.textContent = s;
      btn.dataset.value = s;
      btn.onclick = () => btn.classList.toggle("selected");
      chipsEl.appendChild(btn);
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
  const varWrap = document.getElementById("pos-variedad-wrap");
  const selectedChips = varWrap.querySelectorAll(".pos-var-chip.selected");
  const variedad = Array.from(selectedChips).map(b => b.dataset.value).join(", ");
  const cantidad = posState.qty || 1;

  if (!nombre) { toast("Selecciona un producto"); return; }
  if (!varWrap.classList.contains("hidden") && !variedad) { toast("Elige al menos una variedad"); return; }

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
  document.getElementById("pos-search-cliente").value = "";
  document.getElementById("pos-search-results").innerHTML = "";
  document.getElementById("pos-cliente-seleccionado").classList.add("hidden");
  posState.clienteSeleccionado = null;
  posShowStep("cliente");
}

// ── PASO 3: Cliente búsqueda dinámica ─────────────────────────
let posSearchTimer = null;
async function posBuscarCliente() {
  const q = document.getElementById("pos-search-cliente").value.trim();
  const resultsEl = document.getElementById("pos-search-results");
  document.getElementById("pos-cliente-seleccionado").classList.add("hidden");
  posState.clienteSeleccionado = null;

  if (q.length < 2) { resultsEl.innerHTML = ""; return; }

  clearTimeout(posSearchTimer);
  posSearchTimer = setTimeout(async () => {
    const res = await api("searchClientPOS", { q });
    resultsEl.innerHTML = "";
    const crearWrap = document.getElementById("pos-crear-cliente-wrap");
    const crearMsg  = document.getElementById("pos-crear-msg");
    if (!res.ok || !res.clientes.length) {
      resultsEl.innerHTML = "<p style='color:var(--text-lt);font-size:.85rem;padding:.5rem 0'>No encontrado</p>";
      if (q.includes("@")) {
        posState.correoNuevo = q;
        crearMsg.textContent = "¿Agregar " + q + " al club?";
        crearWrap.classList.remove("hidden");
      }
      return;
    }
    crearWrap && crearWrap.classList.add("hidden");
    res.clientes.forEach(c => {
      const div = document.createElement("div");
      div.className = "search-result-item";
      div.innerHTML = `<p class='result-name'>${c.nombre || "(sin nombre)"}</p>
        <p class='result-sub'>${c.correo} · ${c.nivel}</p>`;
      div.onclick = () => posSeleccionarCliente(c);
      resultsEl.appendChild(div);
    });
  }, 400);
}

async function posCrearCliente() {
  const correo = posState.correoNuevo;
  if (!correo) return;
  showLoading();
  const res = await api("iniciar", { correo });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast("✅ " + correo.split("@")[0] + " agregado al club");
  document.getElementById("pos-crear-cliente-wrap").classList.add("hidden");
  posSeleccionarCliente({ correo, nombre: correo.split("@")[0], nivel: "Vecino" });
}

function posSeleccionarCliente(c) {
  posState.clienteSeleccionado = c;
  document.getElementById("pos-search-results").innerHTML = "";
  const crearWrap = document.getElementById("pos-crear-cliente-wrap");
  if (crearWrap) crearWrap.classList.add("hidden");
  document.getElementById("pos-cliente-sel-nombre").textContent = c.nombre || c.correo.split("@")[0];
  document.getElementById("pos-cliente-sel-correo").textContent = c.correo + " · " + c.nivel;
  document.getElementById("pos-cliente-seleccionado").classList.remove("hidden");
}

async function posConfirmarConCliente() {
  const c = posState.clienteSeleccionado;
  if (!c) { toast("Selecciona un cliente de la lista"); return; }
  await posRegistrarVenta(c.correo);
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
  // Esperar 1.5s para que el Sheet procese la venta
  await new Promise(r => setTimeout(r, 1500));
  const sumRes = await api("getDaySummary", { adminPassword: state.adminPass || "", pin: state.posPin || "" });
  if (sumRes.ok) {
    document.getElementById("dia-ventas").textContent = sumRes.ventasHoy;
    document.getElementById("dia-total").textContent = "$" + (sumRes.totalHoy || 0).toLocaleString("es-CO");
    document.getElementById("dia-pts").textContent = sumRes.puntosEntregados;
    const topEl = document.getElementById("dia-top");
    if (topEl) topEl.textContent = sumRes.topProducto || "-";

    const listEl = document.getElementById("dia-pedidos-list");
    if (listEl && sumRes.ultimas) {
      listEl.innerHTML = sumRes.ultimas.map(v => `
        <div class="dia-pedido-row">
          <div style="flex:1;min-width:0">
            <p class="dia-pedido-prod">${v.productos}</p>
            <p class="dia-pedido-sub">${v.sector}${v.correo ? " · " + v.correo.split("@")[0] : " · sin cliente"}</p>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <p class="dia-pedido-total">$${(v.total||0).toLocaleString("es-CO")}</p>
            <p class="dia-pedido-hora">${v.hora}</p>
          </div>
        </div>`).join("") || "<p style='color:var(--text-lt);font-size:.82rem'>Sin ventas aún</p>";
    }
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
  } else if (window.POS_MODE) {
    showScreen("pin");
  } else {
    showScreen("admin-login");
  }
}

function posIrAdmin() {
  if (window.POS_MODE) {
    sessionStorage.setItem("pos_pin_verified", state.posPin || "1");
    window.location.href = "index.html#admin";
  } else {
    showScreen("admin");
  }
}

function adminIrACaja() {
  if (state.posPin) {
    sessionStorage.setItem("maddre_pos_pin",    state.posPin);
    sessionStorage.setItem("maddre_pos_nombre", state.adminNombre || "");
  } else if (state.adminPass) {
    sessionStorage.setItem("maddre_pos_bypass", state.adminPass);
  }
  window.location.href = "pos.html";
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

// ════════════════════════════════════════════════════════════
//  🦋 CAFÉ MADDRE — CLIENT.JS
//  Lógica exclusiva del club de clientes (index.html)
//  Requiere shared.js cargado antes.
// ════════════════════════════════════════════════════════════

// ── Frases del día ──
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

// ── Entrada a la app ──────────────────────────────────────────
window.addEventListener("load", () => setTimeout(() => {
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

function initPullToRefresh() {
  _wirePTR(
    document.getElementById("screen-profile"),
    document.getElementById("ptr-indicator"),
    () => state.correo
      ? loadProfile()
      : Promise.allSettled([loadMusica(), loadTrueque()])
  );
}

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
  iniciarTimerRegistro();
}

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

// Timer: muestra el popup de promo/registro apenas se entra al perfil
let _registroTimer = null;
function enPerfilInvitado() {
  return !state.correo && document.getElementById("screen-profile")?.classList.contains("active");
}
function enPantallaPerfil() {
  return document.getElementById("screen-profile")?.classList.contains("active");
}
function iniciarTimerRegistro() {
  clearTimeout(_registroTimer);
  // Delay chico solo para que la pantalla de perfil termine de renderizar primero.
  _registroTimer = setTimeout(() => { if (enPantallaPerfil()) abrirModalRegistro(); }, 600);
}

// El modal sale siempre (logueado o invitado): a invitados les pide el correo,
// a clientes ya logueados solo les muestra la promo con un botón de cerrar.
function abrirModalRegistro() {
  clearTimeout(_registroTimer);
  if (!enPantallaPerfil()) return;
  const form  = document.getElementById("modal-registro-form");
  const okBtn = document.getElementById("modal-registro-ok-btn");
  if (state.correo) {
    form.classList.add("hidden");
    okBtn.classList.remove("hidden");
  } else {
    form.classList.remove("hidden");
    okBtn.classList.add("hidden");
  }
  document.getElementById("modal-registro").classList.remove("hidden");
  if (!state.correo) setTimeout(() => document.getElementById("modal-correo-input")?.focus(), 120);
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
  // ── Caja semanal ─────────────────────────────────────────
  const cajaCard = document.getElementById("promo-caja-card");
  const btnCaja  = document.getElementById("btn-caja");
  const cajaDesc = document.getElementById("caja-desc");
  if (cajaCard) cajaCard.style.display = promos.cajaSemanalActiva === false ? "none" : "";
  if (cajaDesc) cajaDesc.textContent = promos.cajaSemanalDesc || "4 rollitos por $20.000";
  if (btnCaja) {
    btnCaja.disabled    = !promos.cajaSemanalDisponible;
    btnCaja.textContent = promos.cajaSemanalDisponible ? "Canjear" : "Ya canjeada ✓";
  }

  // ── Cumpleaños ───────────────────────────────────────────
  const cumpleCard = document.getElementById("promo-cumple-card");
  const btnCumple  = document.getElementById("btn-cumple");
  const cumpleDesc = document.getElementById("cumple-desc");
  if (cumpleCard) cumpleCard.style.display = promos.cumpleActivo === false ? "none" : "";
  if (cumpleDesc) {
    if (promos.cumpleDisponible) {
      cumpleDesc.textContent = promos.cumpleDesc || "🎂 ¡Rollito gratis hoy!";
    } else if (promos.esMesCumple) {
      cumpleDesc.textContent = "Solo disponible el día exacto de tu cumpleaños";
    } else if (promos.mesesParaCumple > 0) {
      cumpleDesc.textContent = `Tu cumpleaños llega en ${promos.mesesParaCumple} mes(es)`;
    } else {
      cumpleDesc.textContent = promos.cumpleDesc || "Solo el día de tu cumpleaños";
    }
  }
  if (btnCumple) btnCumple.disabled = !promos.cumpleDisponible;
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
  const desc = state.profile?.promos?.cajaSemanalDesc || "4 rollitos por $20.000";
  toast("📦 ¡Caja semanal canjeada! " + desc);
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

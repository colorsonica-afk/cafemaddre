// ════════════════════════════════════════════════════════════
//  🦋 CAFÉ MADDRE — ADMIN.JS
//  Lógica exclusiva del panel de administración (admin.html)
//  Requiere shared.js cargado antes.
// ════════════════════════════════════════════════════════════

const POS_PIN_CLIENT = "__pin__"; // marcador interno: "ya hay un PIN de staff válido"

// ── Plantillas de correo (HTML) ───────────────────────────────
// Cada plantilla es una página HTML en /emails/ con un <div id="email-contenido">
// adentro — eso es lo único que se carga en el mensaje masivo (el logo y pie de
// página del correo real los agrega el backend aparte). Para agregar una plantilla
// nueva: crear el archivo en /emails/ y sumarlo a esta lista.
const PLANTILLAS_CORREO = [
  { nombre: "🌀 Promo 2x1 Frutos Rojos", archivo: "emails/2x1-frutos-rojos.html" },
  { nombre: "📱 Escaneá y entrá al club (QR)", archivo: "emails/2-qr-app.html" },
];

function initPlantillasCorreo() {
  const sel = document.getElementById("masivo-plantilla");
  if (!sel) return;
  sel.innerHTML = '<option value="">— sin plantilla, escribo el mensaje —</option>' +
    PLANTILLAS_CORREO.map(p => `<option value="${p.archivo}">${p.nombre}</option>`).join("");
}

async function cargarPlantillaCorreo() {
  const sel = document.getElementById("masivo-plantilla");
  const archivo = sel.value;
  if (!archivo) return;
  showLoading();
  try {
    const res = await fetch(archivo);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const contenido = doc.querySelector("#email-contenido");
    document.getElementById("masivo-mensaje").value = (contenido ? contenido.innerHTML : html).trim();
    updateEmailPreview();
  } catch (e) {
    toast("❌ No se pudo cargar la plantilla");
  }
  hideLoading();
}

// ── Entrada al panel ────────────────────────────────────────
window.addEventListener("load", () => {
  initPlantillasCorreo();
  const savedPin = sessionStorage.getItem("maddre_pos_pin");
  if (savedPin) {
    // Ya se validó un PIN de staff en esta sesión (acá o en pos.html) — entra directo.
    state.posPin      = savedPin;
    state.adminNombre = sessionStorage.getItem("maddre_pos_nombre") || "";
    showScreen("admin");
    mostrarSaludoAdmin();
    loadAdminSummary();
    initPullToRefresh();
    return;
  }
  if (window.location.hash === "#admin") {
    // Acceso directo con contraseña de admin (sin PIN de staff)
    history.replaceState(null, "", window.location.pathname);
    showScreen("admin-login");
    return;
  }
  showScreen("pin");
});

function initPullToRefresh() {
  _wirePTR(
    document.getElementById("screen-admin"),
    document.getElementById("ptr-indicator-admin"),
    () => loadAdminSummary()
  );
}

function adminLoginVolver() {
  showScreen("pin");
  pinReset();
}

async function adminAuthAndGo() {
  const pass  = document.getElementById("admin-pass-input").value;
  const errEl = document.getElementById("admin-login-error");
  hideErr(errEl);
  if (!pass) { showErr(errEl, "Ingresa la contraseña"); return; }
  showLoading();
  const res = await api("getDaySummary", { adminPassword: pass });
  hideLoading();
  if (!res.ok) { showErr(errEl, "Contraseña incorrecta"); return; }
  state.adminPass = pass;
  showScreen("admin");
  mostrarSaludoAdmin();
  await loadAdminSummary();
}

// ── Semáforo de margen neto ───────────────────────────────────
function setMargenCard(pctId, subId, pct, ventas, mp) {
  const pctEl = document.getElementById(pctId);
  const subEl = document.getElementById(subId);
  if (!pctEl) return;
  if (pct === null || pct === undefined || isNaN(pct)) {
    pctEl.textContent = "—";
    pctEl.className   = "meta-neta-pct";
    if (subEl) subEl.textContent = "sin datos de insumos aún";
    return;
  }
  pctEl.textContent = pct + "%";
  pctEl.className   = "meta-neta-pct " + (pct >= 30 ? "semaforo-verde" : pct >= 0 ? "semaforo-naranja" : "semaforo-rojo");
  if (subEl) subEl.textContent =
    "$" + (ventas||0).toLocaleString("es-CO") + " ventas · $" + (mp||0).toLocaleString("es-CO") + " insumos";
}

// ── Materia prima ─────────────────────────────────────────────
async function registrarMateriaPrima() {
  const fecha    = document.getElementById("mp-fecha")?.value;
  const proveedor= document.getElementById("mp-proveedor")?.value;
  const valor    = document.getElementById("mp-valor")?.value;
  if (!fecha || !valor || Number(valor) <= 0) { toast("Completa fecha y valor"); return; }
  showLoading();
  const res = await api("registrarMateriaPrima", {
    fecha, proveedor, valor,
    adminPassword: state.adminPass || "",
    pin: state.posPin || "",
  });
  hideLoading();
  if (!res.ok) { toast("❌ " + (res.error || "Error")); return; }
  toast("✅ Compra registrada — actualizando márgenes…");
  document.getElementById("mp-valor").value = "";
  loadAdminSummary(); // refresca márgenes automáticamente
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
  if (tab === "pedidos") loadAdminPedidos();
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
  document.getElementById("adm-libros").textContent          = res.librosDisponibles  || 0;
  document.getElementById("adm-cajas-semana").textContent    = res.cajasEsemana      ?? "—";
  document.getElementById("adm-rollitos-semana").textContent = res.rollitosEsemana   ?? "—";
  document.getElementById("adm-recipients-pill").textContent = `👥 ${res.vecinos || 0} vecinos recibirán este mensaje`;

  // Márgenes netos
  setMargenCard("adm-margen-historico", "adm-margen-hist-sub",
    res.margenHistorico, res.totalVentas, res.mpTotal);
  setMargenCard("adm-margen-mes", "adm-margen-mes-sub",
    res.margenMes, res.ventasMes, res.mpMes);
  const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const lblMes = document.getElementById("adm-margen-mes-lbl");
  if (lblMes) lblMes.textContent = MESES[new Date().getMonth()];

  // Setear fecha de hoy en form materia prima si aún vacía
  const mpFechaEl = document.getElementById("mp-fecha");
  if (mpFechaEl && !mpFechaEl.value) {
    mpFechaEl.value = new Date().toISOString().slice(0, 10);
  }

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
  const previewEl = document.getElementById("email-preview-body");
  if (!msg) {
    previewEl.textContent = "Tu mensaje aparecerá aquí...";
    return;
  }
  // Si parece HTML (tiene una etiqueta), se renderiza tal cual para previsualizar
  // cómo va a quedar de verdad — si no, se muestra como texto plano.
  if (/<[a-z][\s\S]*>/i.test(msg)) {
    previewEl.innerHTML = msg;
  } else {
    previewEl.textContent = msg;
  }
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

// ── Pedidos de hoy (tab) ────────────────────────────────────
async function loadAdminPedidos() {
  const listEl = document.getElementById("admin-pedidos-list");
  if (!listEl) return;
  listEl.innerHTML = "<p style='color:var(--text-lt);font-size:.82rem'>Cargando…</p>";
  const res = await api("getDaySummary", { adminPassword: state.adminPass || "", pin: state.posPin || "" });
  if (!res.ok) {
    listEl.innerHTML = "<p style='color:var(--text-lt);font-size:.82rem'>Error al cargar</p>";
    return;
  }
  const pedidos = res.ultimas || [];
  if (!pedidos.length) {
    listEl.innerHTML = "<p style='color:var(--text-lt);font-size:.82rem'>Sin ventas hoy</p>";
    return;
  }
  listEl.innerHTML = "";
  pedidos.forEach(v => {
    const row = document.createElement("div");
    row.className = "admin-pedido-row";
    if (v.id) row.id = "adm-pedido-" + v.id;
    row.innerHTML = `
      <div class="admin-pedido-info">
        <p class="dia-pedido-prod">${v.productos}</p>
        <p class="dia-pedido-sub">${v.sector} · ${v.hora}</p>
      </div>
      <div class="admin-pedido-right">
        <p class="dia-pedido-total">$${(v.total||0).toLocaleString("es-CO")}</p>
        ${v.correo
          ? `<p class="admin-pedido-cliente">👤 ${v.correo.split("@")[0]}</p>`
          : `<span class="admin-sin-cliente-tag">sin cliente</span>
             ${v.id ? `<button class="admin-pedido-asignar-btn" data-id="${v.id}">+ Asignar cliente</button>` : ""}`
        }
      </div>`;
    // Evento seguro en el botón asignar
    const asignarBtn = row.querySelector(".admin-pedido-asignar-btn");
    if (asignarBtn) {
      asignarBtn.addEventListener("click", () => adminAsignarCliente(v.id));
    }
    listEl.appendChild(row);
  });
}

function adminAsignarCliente(id) {
  const row = document.getElementById("adm-pedido-" + id);
  if (!row) return;
  const right = row.querySelector(".admin-pedido-right");
  right.innerHTML = `
    <div class="admin-asignar-wrap">
      <input type="email" inputmode="email" class="admin-asignar-input"
             id="adm-asignar-input-${id}"
             placeholder="correo del cliente"
             oninput="adminBuscarParaAsignar('${id}')">
      <div id="adm-asignar-results-${id}" class="admin-asignar-results search-results"></div>
      <button class="btn-link" style="font-size:.75rem" onclick="loadAdminPedidos()">cancelar</button>
    </div>`;
  document.getElementById("adm-asignar-input-" + id)?.focus();
}

let admAsignarTimer = null;
async function adminBuscarParaAsignar(id) {
  const q = document.getElementById("adm-asignar-input-" + id)?.value?.trim();
  const resultsEl = document.getElementById("adm-asignar-results-" + id);
  if (!resultsEl) return;
  if (!q || q.length < 2) { resultsEl.innerHTML = ""; return; }
  clearTimeout(admAsignarTimer);
  admAsignarTimer = setTimeout(async () => {
    const res = await api("searchClientPOS", { q });
    resultsEl.innerHTML = "";
    if (!res.ok || !res.clientes?.length) {
      resultsEl.innerHTML = "<p style='color:var(--text-lt);font-size:.8rem;padding:.3rem 0'>No encontrado</p>";
      return;
    }
    res.clientes.forEach(c => {
      const div = document.createElement("div");
      div.className = "search-result-item";
      div.innerHTML = `<p class='result-name'>${c.nombre || c.correo.split("@")[0]}</p>
                       <p class='result-sub'>${c.correo}</p>`;
      div.onclick = () => adminConfirmarAsignacion(id, c.correo);
      resultsEl.appendChild(div);
    });
  }, 350);
}

async function adminConfirmarAsignacion(id, correo) {
  showLoading();
  const res = await api("asignarClienteVenta", {
    id,
    correo,
    adminPassword: state.adminPass || "",
    pin: state.posPin || ""
  });
  hideLoading();
  if (!res.ok) { toast("❌ " + (res.error || "Error")); return; }
  toast("✅ 1 punto asignado a " + correo.split("@")[0]);
  await loadAdminPedidos();
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

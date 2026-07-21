// ════════════════════════════════════════════════════════════
//  🦋 CAFÉ MADDRE — POS.JS
//  Lógica exclusiva de la caja (pos.html)
//  Requiere shared.js cargado antes.
// ════════════════════════════════════════════════════════════

// ── Entrada a la caja ──────────────────────────────────────────
window.addEventListener("load", () => setTimeout(() => {
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
}, 800));

let posState = {
  sector: null,
  items: [],         // [{nombre, variedad, cantidad, precio}]
  qty: 1,
  config: null,
  editandoId: null,  // id de la venta en edición (null = nueva venta)
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
  loadPedidosHoy(); // carga panel persistente en background
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

async function posSelSector(sector) {
  posState.sector = sector;
  posState.items = [];
  posState.editandoId = null;
  posCancelarEdicion();
  document.getElementById("pos-sector-label").textContent = sector;
  document.getElementById("pos-items-list").innerHTML = "";
  document.getElementById("pos-total-wrap").classList.add("hidden");
  posShowStep("pedido");
  await cargarMesaAbierta(sector);
  renderItemsList();
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
  syncMesaItems();
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
        <p class="pos-item-name">${item.confianzaBaja ? "⚠️ " : ""}${item.nombre}${item.variedad ? " · " + item.variedad : ""}</p>
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
  syncMesaItems();
}

// ── Mesa abierta: persistencia en el backend (Sheet MESAS) ─────
// Fire-and-forget: si el backend todavía no tiene estas acciones desplegadas,
// el POS sigue funcionando igual que hoy (carrito en memoria), solo no sobrevive
// un cambio de mesa/recarga hasta que se despliegue.
async function cargarMesaAbierta(sector) {
  try {
    const res = await api("getMesaAbierta", { sector });
    if (res && res.ok && Array.isArray(res.items)) {
      posState.items = res.items;
    }
  } catch (e) { /* backend sin esta acción todavía */ }
}

function syncMesaItems() {
  api("guardarMesa", {
    sector: posState.sector,
    items: JSON.stringify(posState.items),
  }).catch(() => {});
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
  const res = await api("cerrarMesa", {
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
    const venEl = document.getElementById("dia-ventas");
    const totEl = document.getElementById("dia-total");
    const ptsEl = document.getElementById("dia-pts");
    const topEl = document.getElementById("dia-top");
    if (venEl) venEl.textContent = sumRes.ventasHoy;
    if (totEl) totEl.textContent = "$" + (sumRes.totalHoy || 0).toLocaleString("es-CO");
    if (ptsEl) ptsEl.textContent = sumRes.puntosEntregados;
    if (topEl) topEl.textContent = sumRes.topProducto || "-";
    // Actualizar panel persistente
    const resumenEl = document.getElementById("pos-pedidos-hoy-resumen");
    if (resumenEl) resumenEl.textContent = `${sumRes.ventasHoy} venta(s) · $${(sumRes.totalHoy || 0).toLocaleString("es-CO")} hoy`;
    renderPedidosHoyList(sumRes.ultimas || []);
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
  posCancelarEdicion();
  if (posState.config) {
    posShowStep("sector");
  } else {
    showScreen("pin");
  }
}

function posIrAdmin() {
  // El PIN ya validado en esta caja también sirve para entrar al panel admin.
  sessionStorage.setItem("maddre_pos_pin", state.posPin || "1");
  sessionStorage.setItem("maddre_pos_nombre", state.adminNombre || "");
  window.location.href = "admin.html";
}

// ── POS: Pedidos de hoy (panel persistente) ───────────────────
async function loadPedidosHoy() {
  const listEl = document.getElementById("pos-pedidos-hoy-list");
  const resumenEl = document.getElementById("pos-pedidos-hoy-resumen");
  if (!listEl) return;
  const sumRes = await api("getDaySummary", { pin: state.posPin || "", adminPassword: state.adminPass || "" });
  if (!sumRes.ok) {
    listEl.innerHTML = "<p style='color:var(--text-lt);font-size:.82rem'>Sin conexión</p>";
    if (resumenEl) resumenEl.textContent = "";
    return;
  }
  if (resumenEl) {
    resumenEl.textContent = `${sumRes.ventasHoy} venta(s) · $${(sumRes.totalHoy || 0).toLocaleString("es-CO")} hoy`;
  }
  renderPedidosHoyList(sumRes.ultimas || []);
}

function renderPedidosHoyList(ultimas) {
  const listEl = document.getElementById("pos-pedidos-hoy-list");
  if (!listEl) return;
  if (!ultimas.length) {
    listEl.innerHTML = "<p style='color:var(--text-lt);font-size:.82rem'>Sin ventas aún hoy</p>";
    return;
  }
  listEl.innerHTML = "";
  ultimas.forEach(v => {
    const row = document.createElement("div");
    row.className = "dia-pedido-row";
    row.innerHTML = `
      <div style="flex:1;min-width:0">
        <p class="dia-pedido-prod">${v.productos}</p>
        <p class="dia-pedido-sub">${v.sector}${v.correo ? " · " + v.correo.split("@")[0] : " · sin cliente"}</p>
      </div>
      <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:.15rem">
        <p class="dia-pedido-total">$${(v.total||0).toLocaleString("es-CO")}</p>
        <p class="dia-pedido-hora">${v.hora}</p>
        ${v.id ? `
          <div style="display:flex;gap:.4rem">
            <button class="pos-pedido-edit-btn" data-id="${v.id}">✏️ Editar</button>
            <button class="pos-pedido-del-btn" data-id="${v.id}">🗑</button>
          </div>` : ""}
      </div>`;
    // Adjuntar datos seguros en el botón para evitar problemas con comillas/HTML
    const editBtn = row.querySelector(".pos-pedido-edit-btn");
    if (editBtn) {
      editBtn._ventaData = { id: v.id, productos: v.productos, sector: v.sector };
      editBtn.addEventListener("click", () => {
        const d = editBtn._ventaData;
        posEditarVenta(d.id, d.productos, d.sector);
      });
    }
    const delBtn = row.querySelector(".pos-pedido-del-btn");
    if (delBtn) {
      delBtn.addEventListener("click", () => posEliminarVenta(v.id, v.productos));
    }
    listEl.appendChild(row);
  });
}

async function posEliminarVenta(id, productos) {
  if (!confirm("¿Borrar este pedido?\n" + productos)) return;
  showLoading();
  const res = await api("eliminarVenta", { id, pin: state.posPin || "" });
  hideLoading();
  if (!res.ok) { toast("❌ " + (res.error || "Error")); return; }
  toast("🗑 Pedido eliminado");
  await loadPedidosHoy();
}

// Parsea string "PRODUCTO (VAR) x2, OTRO x1" → array de items con precios
function parsearProductosStr(str) {
  const items = [];
  if (!str) return items;
  str.split(",").map(s => s.trim()).filter(Boolean).forEach(part => {
    const match = part.match(/^(.+?)\s+x(\d+)$/i);
    if (!match) return;
    let nombre = match[1].trim();
    const cantidad = parseInt(match[2], 10) || 1;
    const varMatch = nombre.match(/^(.+?)\s+\(([^)]+)\)$/);
    let variedad = "";
    if (varMatch) {
      nombre = varMatch[1].trim();
      variedad = varMatch[2].replace(/_/g, " ");
    }
    const prod = (posState.config?.productos || []).find(p =>
      p.nombre.toUpperCase() === nombre.toUpperCase()
    );
    const precio = prod ? Number(prod.precio) : 0;
    items.push({ nombre, variedad, cantidad, precio });
  });
  return items;
}

// Entra en modo edición para una venta existente
function posEditarVenta(id, productosStr, sector) {
  if (!id) { toast("❌ Esta venta no tiene ID — redesplega el backend"); return; }
  posState.editandoId = id;
  posState.sector = sector;
  posState.items = parsearProductosStr(productosStr);
  document.getElementById("pos-sector-label").textContent = sector;
  renderItemsList();
  // Swap botones
  const continuar = document.getElementById("pos-continuar-btn");
  const guardar   = document.getElementById("pos-guardar-edicion-btn");
  const cancelar  = document.getElementById("pos-cancelar-edicion-btn");
  if (continuar) continuar.classList.add("hidden");
  if (guardar)   guardar.classList.remove("hidden");
  if (cancelar)  cancelar.classList.remove("hidden");
  posShowStep("pedido");
  document.querySelector(".scroll-wrap")?.scrollTo({ top: 0, behavior: "smooth" });
}

async function posGuardarEdicion() {
  const id = posState.editandoId;
  if (!id) return;
  if (!posState.items.length) { toast("Agrega al menos un producto"); return; }
  const productos = posState.items.map(i =>
    `${i.nombre}${i.variedad ? " (" + i.variedad.replace(/ /g, "_") + ")" : ""} x${i.cantidad}`
  ).join(", ");
  const total = posState.items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  showLoading();
  const res = await api("editarVenta", { id, productos, total, pin: state.posPin || "" });
  hideLoading();
  if (!res.ok) { toast("❌ " + (res.error || "Error")); return; }
  toast("✅ Pedido actualizado");
  posCancelarEdicion();
  await loadPedidosHoy();
  posShowStep("sector");
}

function posCancelarEdicion() {
  posState.editandoId = null;
  const continuar = document.getElementById("pos-continuar-btn");
  const guardar   = document.getElementById("pos-guardar-edicion-btn");
  const cancelar  = document.getElementById("pos-cancelar-edicion-btn");
  if (continuar) continuar.classList.remove("hidden");
  if (guardar)   guardar.classList.add("hidden");
  if (cancelar)  cancelar.classList.add("hidden");
}

// ── Micrófono: reconocimiento de voz + matching contra catálogo ──
const POS_NUMEROS_TEXTO = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};

function posNormalizarTexto(s) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function posLevenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Mejor match de `textoNorm` contra una lista de strings candidatos.
// Devuelve {valor, score} (score 0–1, 1 = match perfecto) o null si nada pasa el umbral.
function posMejorMatch(textoNorm, candidatos) {
  let mejor = null;
  candidatos.forEach(c => {
    const cNorm = posNormalizarTexto(c);
    if (!cNorm) return;
    let score;
    if (textoNorm.includes(cNorm) || cNorm.includes(textoNorm)) {
      score = cNorm.length / Math.max(cNorm.length, textoNorm.length);
    } else {
      const dist = posLevenshtein(textoNorm, cNorm);
      score = 1 - dist / Math.max(cNorm.length, textoNorm.length, 1);
    }
    if (!mejor || score > mejor.score) mejor = { valor: c, score };
  });
  return mejor && mejor.score >= 0.45 ? mejor : null;
}

// Busca el mejor sabor (uno o varios tokens) dentro de tokens[inicio, limite),
// ignorando posiciones ya usadas. Igual criterio que el matching de productos:
// n-gramas exactos por posición, no un string único (evita que conectores diluyan el score).
function buscarSaborEnVentana(tokens, usado, inicio, limite, sabores) {
  const candidatosSabor = sabores
    .map(s => ({ sabor: s, palabras: posNormalizarTexto(s).split(" ").filter(Boolean) }))
    .filter(c => c.palabras.length > 0)
    .sort((a, b) => b.palabras.length - a.palabras.length);

  let mejor = null;
  candidatosSabor.forEach(({ sabor, palabras }) => {
    const n = palabras.length;
    const nombreNorm = palabras.join(" ");
    for (let i = inicio; i <= limite - n; i++) {
      if (usado.slice(i, i + n).some(Boolean)) continue;
      const ventana = tokens.slice(i, i + n).join(" ");
      const score = ventana === nombreNorm
        ? 1
        : 1 - posLevenshtein(ventana, nombreNorm) / Math.max(ventana.length, nombreNorm.length, 1);
      if (score >= 0.55 && (!mejor || score > mejor.score)) mejor = { idx: i, n, valor: sabor, score };
    }
  });
  return mejor;
}

// Texto transcripto → array de items {nombre, variedad, cantidad, precio, confianzaBaja}
// Escanea TODO el texto buscando cada producto del catálogo (no depende de "y"/comas
// como separador, porque el reconocimiento de voz casi nunca transcribe comas y una
// enumeración como "un moca, un capuchino y un latte" solo trae un "y" para 3 ítems).
function parsearPedidoVoz(textoCrudo) {
  const productos = posState.config?.productos || [];
  const saboresRollito = posState.config?.saboresRollito || [];
  const saboresBaguette = posState.config?.saboresBaguette || [];

  const tokens = posNormalizarTexto(textoCrudo).split(" ").filter(Boolean);
  const usado = new Array(tokens.length).fill(false);
  const encontrados = [];

  // Productos de varias palabras primero, para que "ROLLITO DE CANELA" no le gane
  // el match a un "ROLLITO" suelto y se coma tokens que corresponden a otro ítem.
  const saboresRollitoNorm = saboresRollito.map(s => posNormalizarTexto(s));
  const saboresBaguetteNorm = saboresBaguette.map(s => posNormalizarTexto(s));
  const candidatos = productos
    .map(p => {
      let palabras = posNormalizarTexto(p.nombre).split(" ").filter(Boolean);
      // "ROLLITO DE CANELA" termina en "canela", que TAMBIÉN es un sabor válido —
      // si se exige esa palabra para matchear el producto, un sabor distinto
      // (ej. "durazno") se confunde con una mala transcripción de "canela" y se
      // pierde. Se saca del nombre exigido y queda para que lo resuelva el sabor.
      const sabores = p.nombre.includes("ROLLITO") ? saboresRollitoNorm
        : p.nombre.includes("BAGUETTE") ? saboresBaguetteNorm : [];
      const ultima = palabras[palabras.length - 1];
      if (palabras.length > 1 && sabores.includes(ultima)) palabras = palabras.slice(0, -1);
      return { prod: p, palabras };
    })
    .filter(c => c.palabras.length > 0)
    .sort((a, b) => b.palabras.length - a.palabras.length);

  // Atajo: si un producto de varias palabras tiene una palabra "distintiva" (la más
  // larga, ignorando conectores) que no aparece en NINGÚN otro producto del catálogo,
  // se agrega como alias de una sola palabra — así "rollito" solo (sin "de canela")
  // también reconoce "ROLLITO DE CANELA", que es el único producto rollito que existe.
  // Va SIEMPRE marcado como confianza baja por ser una inferencia parcial.
  const STOPWORDS_ALIAS = new Set(["de", "con", "x", "y", "del", "la", "el", "los", "las", "al"]);
  const palabraAProductos = {};
  candidatos.forEach(({ prod, palabras }) => {
    new Set(palabras).forEach(w => {
      (palabraAProductos[w] = palabraAProductos[w] || new Set()).add(prod.nombre);
    });
  });
  candidatos.slice().forEach(({ prod, palabras }) => {
    if (palabras.length <= 1) return;
    const distintivas = palabras.filter(p => !STOPWORDS_ALIAS.has(p));
    if (!distintivas.length) return;
    const palabra = distintivas.reduce((a, b) => (b.length > a.length ? b : a));
    if (palabraAProductos[palabra] && palabraAProductos[palabra].size === 1) {
      candidatos.push({ prod, palabras: [palabra], esAlias: true });
    }
  });

  candidatos.forEach(({ prod, palabras, esAlias }) => {
    const n = palabras.length;
    const nombreNorm = palabras.join(" ");
    const umbral = n === 1 ? 0.75 : 0.6;

    // Repetir mientras se sigan encontrando menciones de este producto
    // (ej. "dos capuchinos y otro capuchino" = 2 ítems separados)
    while (true) {
      let mejorIdx = -1, mejorScore = 0;
      for (let i = 0; i <= tokens.length - n; i++) {
        if (usado.slice(i, i + n).some(Boolean)) continue;
        const ventana = tokens.slice(i, i + n).join(" ");
        const score = ventana === nombreNorm
          ? 1
          : 1 - posLevenshtein(ventana, nombreNorm) / Math.max(ventana.length, nombreNorm.length, 1);
        if (score > mejorScore) { mejorScore = score; mejorIdx = i; }
      }
      if (mejorIdx === -1 || mejorScore < umbral) break;

      // Cantidad: mirar hasta 2 tokens antes del match (dígito o número en palabras)
      let cantidad = 1;
      for (let back = 1; back <= 2; back++) {
        const j = mejorIdx - back;
        if (j < 0 || usado[j]) break;
        const t = tokens[j];
        if (/^\d+$/.test(t)) { cantidad = parseInt(t, 10); usado[j] = true; break; }
        if (POS_NUMEROS_TEXTO[t] != null) { cantidad = POS_NUMEROS_TEXTO[t]; usado[j] = true; break; }
      }

      // Sabor: mirar hasta 5 tokens después del match (solo para rollito/baguette).
      // Se escanea token a token (no como un string único) para que conectores
      // como "con"/"y"/"un" no diluyan el score de coincidencia del sabor.
      let variedad = "";
      let confianzaBaja = mejorScore < 0.95 || !!esAlias;
      if (prod.nombre.includes("ROLLITO") || prod.nombre.includes("BAGUETTE")) {
        const sabores = prod.nombre.includes("ROLLITO") ? saboresRollito : saboresBaguette;
        const finProd = mejorIdx + n;
        const limiteSabor = Math.min(tokens.length, finProd + 5);
        // "canela" es a la vez parte del nombre base ("rollito DE CANELA") y un sabor
        // válido — se prueba primero cualquier OTRO sabor, y solo se cae en "canela"
        // si no se dijo ningún otro (si no, "rollito de canela con nutella" agarraría
        // "canela" antes de llegar a "nutella", que es el sabor real que se pidió).
        const saboresSinCanela = sabores.filter(s => posNormalizarTexto(s) !== "canela");
        const matchSabor = buscarSaborEnVentana(tokens, usado, finProd, limiteSabor, saboresSinCanela)
          || buscarSaborEnVentana(tokens, usado, finProd, limiteSabor, sabores);
        if (matchSabor) {
          variedad = matchSabor.valor;
          for (let k = 0; k < matchSabor.n; k++) usado[matchSabor.idx + k] = true;
          if (matchSabor.score < 0.75) confianzaBaja = true;
        } else {
          confianzaBaja = true; // rollito/baguette sin sabor reconocido — revisar a mano
        }
      }

      for (let k = 0; k < n; k++) usado[mejorIdx + k] = true;
      encontrados.push({ idx: mejorIdx, nombre: prod.nombre, variedad, cantidad, precio: Number(prod.precio), confianzaBaja });
    }
  });

  // Sabor mencionado suelto, sin decir el producto (ej. solo "durazno") — se infiere
  // el producto dueño de ese sabor (rollito o baguette). Confianza baja siempre,
  // por ser una inferencia. Corre sobre los tokens que quedaron libres.
  function inferirPorSaborSuelto(sabores, prod) {
    if (!sabores.length || !prod) return;
    const candidatosSabor = sabores
      .map(s => ({ sabor: s, palabras: posNormalizarTexto(s).split(" ").filter(Boolean) }))
      .filter(c => c.palabras.length > 0)
      .sort((a, b) => b.palabras.length - a.palabras.length);

    candidatosSabor.forEach(({ sabor, palabras }) => {
      const n = palabras.length;
      const nombreNorm = palabras.join(" ");
      const umbral = n === 1 ? 0.75 : 0.6;
      while (true) {
        let mejorIdx = -1, mejorScore = 0;
        for (let i = 0; i <= tokens.length - n; i++) {
          if (usado.slice(i, i + n).some(Boolean)) continue;
          const ventana = tokens.slice(i, i + n).join(" ");
          const score = ventana === nombreNorm
            ? 1
            : 1 - posLevenshtein(ventana, nombreNorm) / Math.max(ventana.length, nombreNorm.length, 1);
          if (score > mejorScore) { mejorScore = score; mejorIdx = i; }
        }
        if (mejorIdx === -1 || mejorScore < umbral) break;

        let cantidad = 1;
        for (let back = 1; back <= 2; back++) {
          const j = mejorIdx - back;
          if (j < 0 || usado[j]) break;
          const t = tokens[j];
          if (/^\d+$/.test(t)) { cantidad = parseInt(t, 10); usado[j] = true; break; }
          if (POS_NUMEROS_TEXTO[t] != null) { cantidad = POS_NUMEROS_TEXTO[t]; usado[j] = true; break; }
        }

        for (let k = 0; k < n; k++) usado[mejorIdx + k] = true;
        encontrados.push({ idx: mejorIdx, nombre: prod.nombre, variedad: sabor, cantidad, precio: Number(prod.precio), confianzaBaja: true });
      }
    });
  }
  // "canela" queda afuera acá: es parte del nombre base del rollito, así que una
  // mención suelta de "canela" que sobró sin consumir (ej. dicha de más junto a otro
  // sabor real) no debe inventar un segundo rollito fantasma.
  inferirPorSaborSuelto(saboresRollito.filter(s => posNormalizarTexto(s) !== "canela"), productos.find(p => p.nombre.includes("ROLLITO")));
  inferirPorSaborSuelto(saboresBaguette, productos.find(p => p.nombre.includes("BAGUETTE")));

  // Devolver en el orden en que se mencionaron, no en el orden del catálogo
  return encontrados.sort((a, b) => a.idx - b.idx).map(({ idx, ...item }) => item);
}

function posAgregarItemsDesdeVoz(items) {
  if (!items.length) { toast("🎤 No se reconoció ningún producto — prueba de nuevo"); return; }
  items.forEach(it => posState.items.push(it));
  renderItemsList();
  syncMesaItems();
  const dudosos = items.filter(i => i.confianzaBaja).length;
  toast(dudosos
    ? `🎤 ${items.length} producto(s) agregado(s) — revisa ${dudosos} marcado(s) con ⚠️`
    : `🎤 ${items.length} producto(s) agregado(s)`);
}

let posRecognition = null;
let posGrabando = false; // intención de la mesera: sigue querendo grabar hasta que toque "Detener"
let posUltimoTexto = "";     // texto de la última tanda "final" procesada
let posUltimoTextoTs = 0;    // cuándo se procesó, para saber si la siguiente tanda es continuación
let posUltimosItems = [];    // ítems que agregó esa última tanda (para poder deshacerlos si era un refinamiento)

function posToggleGrabacion() {
  if (posGrabando) {
    posGrabando = false;
    posRecognition?.stop();
    return;
  }
  posUltimoTexto = "";
  posUltimoTextoTs = 0;
  posUltimosItems = [];
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Este navegador no soporta reconocimiento de voz"); return; }
  posGrabando = true;
  posIniciarReconocimiento(SR, 0);
}

// Procesa una tanda de texto "final" del reconocedor. En modo continuo, el motor
// a veces no separa limpio: re-emite la misma frase que se venía diciendo, cada vez
// un poco más completa (ej. "un rollito de canela" → "un rollito de canela" de nuevo
// → "un rollito de canela de durazno"), en vez de una sola tanda por pausa real.
// Si la tanda nueva empieza igual que la anterior (o es un subconjunto de ella),
// se trata como una corrección: se deshacen los ítems que había agregado la tanda
// vieja y se reemplazan por los de la tanda nueva, más completa.
// ¿"a" y "b" son básicamente la misma frase (una contenida en la otra, o muy
// parecidas)? No solo prefijo: el motor a veces cambia palabras sueltas del
// principio entre tanda y tanda (ej. "un capuchino" → "capuchino", sin el "un"),
// así que "empieza igual" no alcanza — hace falta "una está adentro de la otra".
function posTextosRelacionados(a, b) {
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const sim = 1 - posLevenshtein(a, b) / Math.max(a.length, b.length, 1);
  return sim >= 0.6;
}

function posProcesarTextoFinal(texto) {
  const ahora = Date.now();
  const textoNorm = posNormalizarTexto(texto);
  const anteriorNorm = posNormalizarTexto(posUltimoTexto);
  // Sin límite de tiempo a propósito: en sesiones largas con reinicios automáticos
  // (cada ~20s en algunos Android) el motor puede volver a captar/alucinar la misma
  // palabra mucho después de la tanda anterior — lo que importa es si el contenido
  // se repite o extiende, no cuánto pasó entre una tanda y la otra.
  const esContinuacion = posUltimoTexto && textoNorm && posTextosRelacionados(textoNorm, anteriorNorm);

  if (esContinuacion && posUltimosItems.length) {
    posUltimosItems.forEach(it => {
      const idx = posState.items.indexOf(it);
      if (idx !== -1) posState.items.splice(idx, 1);
    });
  }

  posUltimoTexto = texto;
  posUltimoTextoTs = ahora;

  const items = parsearPedidoVoz(texto);
  posUltimosItems = items;

  if (items.length) {
    posAgregarItemsDesdeVoz(items);
  } else if (esContinuacion) {
    // La tanda nueva no reconoció nada pero sí borramos lo de la tanda vieja — refrescar la lista
    renderItemsList();
    syncMesaItems();
  }
}

// `intentos` cuenta reinicios seguidos SIN haber reconocido nada — protege contra
// un navegador que corta el motor una y otra vez sin dejarlo arrancar de nuevo
// (ej. permiso de mic que expira en sesiones largas). Si de verdad reconoce algo,
// el contador se resetea, así que una grabación larga con pausas normales no corta.
function posIniciarReconocimiento(SR, intentos) {
  const btn = document.getElementById("pos-mic-btn");
  const status = document.getElementById("pos-mic-status");

  if (intentos > 3) {
    posGrabando = false;
    if (btn) { btn.textContent = "🎤 Grabar"; btn.classList.remove("recording"); }
    if (status) status.textContent = "Se cortó el micrófono — toca Grabar para seguir";
    return;
  }

  posRecognition = new SR();
  posRecognition.lang = "es-CO";
  // continuous=false a propósito: en este dispositivo el modo "continuo" del
  // navegador termina re-escuchando (o alucinando) la misma palabra varias veces
  // dentro de una sola sesión larga. Con cada tanda como una escucha aislada y
  // el reinicio inmediato de abajo, cada resultado es una captura limpia — el
  // efecto de "seguir escuchando a través de pausas" lo da el auto-reinicio, no
  // el modo continuo del navegador.
  posRecognition.continuous = false;
  posRecognition.interimResults = true;
  posRecognition.maxAlternatives = 1;

  let huboResultado = false;

  posRecognition.onstart = () => {
    if (btn) { btn.textContent = "⏹ Detener"; btn.classList.add("recording"); }
    if (status) status.textContent = "Escuchando…";
  };
  posRecognition.onresult = (e) => {
    huboResultado = true;
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) {
        const texto = res[0].transcript.trim();
        if (status) status.textContent = `"${texto}"`;
        posProcesarTextoFinal(texto);
      } else {
        interim += res[0].transcript;
      }
    }
    if (interim && status) status.textContent = `"${interim}…"`;
  };
  posRecognition.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      posGrabando = false;
      if (status) status.textContent = "Permiso de micrófono denegado";
    }
    // otros errores (ej. "no-speech") se dejan pasar: onend decide si reiniciar
  };
  posRecognition.onend = () => {
    if (!posGrabando) {
      if (btn) { btn.textContent = "🎤 Grabar"; btn.classList.remove("recording"); }
      return;
    }
    // El navegador cortó el reconocimiento solo (silencio/timeout interno),
    // pero la mesera todavía no tocó "Detener" — se reinicia sin que se note.
    const siguiente = huboResultado ? 0 : intentos + 1;
    setTimeout(() => { if (posGrabando) posIniciarReconocimiento(SR, siguiente); }, 300);
  };

  try {
    posRecognition.start();
  } catch (e) {
    setTimeout(() => { if (posGrabando) posIniciarReconocimiento(SR, intentos + 1); }, 300);
  }
}

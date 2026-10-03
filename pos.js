// ════════════════════════════════════════════════════════════
//  🦋 CAFÉ MADDRE — POS.JS
//  Lógica exclusiva de la caja (pos.html)
//  Requiere shared.js cargado antes.
//
//  Dinámica (desde oct 2026): sin mesa, sin variedad, sin cliente.
//  Cuadrícula de productos → cada toque suma 1 → Facturar = una venta.
//  Cada venta queda como "TICKET NN" del día (se guarda en la columna sector).
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
  productos: [],     // [{nombre, precio}] desde la pestaña CONFIG
  ticket: {},        // { NOMBRE: cantidad } — orden de inserción = orden del ticket
  numTicket: 1,      // número del próximo ticket del día
  editandoId: null,  // id de la venta en edición (null = ticket nuevo)
  enviando: false,
};

async function initPOS() {
  showLoading();
  const res = await api("getProducts");
  hideLoading();
  if (!res.ok) { toast("Error cargando config"); return; }
  posState.productos = (res.productos || []).map(p => ({ nombre: p.nombre, precio: Number(p.precio) || 0 }));
  renderGrid();
  renderTicket();
  loadPedidosHoy();
}

// ── Emoji por producto ────────────────────────────────────────
// Se busca por palabra clave en el nombre; el primero que coincide gana,
// así que las claves más específicas van antes ("CAFE X" antes que "CAFE").
const TK_EMOJIS = [
  ["ROLLITO", "🌀"], ["CROISSANT", "🥐"], ["WAFFLE", "🧇"], ["BAGUETTE", "🥖"],
  ["PAN", "🍞"], ["CAMPESINO", "🌾"], ["SANDIWCH", "🥪"], ["SANDWICH", "🥪"],
  ["TINTO", "☕"], ["LATTE", "🥛"], ["AROMATICA", "🍵"], ["CAPUCHINO", "☕"],
  ["MOCA", "🍫"], ["MOKA", "🍫"], ["MILO", "🥤"], ["SODA", "🫧"], ["BAILEYS", "🥃"],
  ["MALTEADA", "🍨"], ["PASTEL", "🍰"], ["EMPANADA", "🥟"], ["DEDITO", "🧀"],
  ["TALLER", "🎨"], ["CAFE X", "🫘"], ["GRANO", "🫘"], ["GALLETA", "🍪"],
  ["JUGO", "🧃"], ["AGUA", "💧"], ["TE ", "🍵"], ["CAFE", "☕"],
];

// Productos que no tienen emoji propio: ícono dibujado a mano (SVG).
const TK_ICONOS = {
  ROLLITO: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="tkRollMasa" cx="38%" cy="32%" r="75%">
        <stop offset="0" stop-color="#F6C98A"/><stop offset=".6" stop-color="#E3A35E"/><stop offset="1" stop-color="#B9733A"/>
      </radialGradient>
    </defs>
    <ellipse cx="32" cy="58.5" rx="21" ry="3.5" fill="#000" opacity=".13"/>
    <circle cx="32" cy="31" r="26" fill="url(#tkRollMasa)" stroke="#9C5A26" stroke-width="2"/>
    <path d="M32 31 a3 3 0 0 1 6 0 a6 6 0 0 1 -12 0 a9 9 0 0 1 18 0 a12 12 0 0 1 -24 0 a15 15 0 0 1 30 0 a18 18 0 0 1 -36 0 a21 21 0 0 1 42 0"
      fill="none" stroke="#7E3F15" stroke-width="3.4" stroke-linecap="round" opacity=".9"/>
    <path d="M13 22 q3 -7 10 -5 q5 2 9 -1 q6 -3 11 0 q5 2 8 6 q1 3 -2 3 q-2 0 -2 4 q0 3 -2 3 q-2 0 -2 -3 q0 -3 -3 -2 q-4 1 -7 -1 q-3 -1 -5 2 q-1 5 -3 5 q-2 0 -2 -4 q0 -3 -3 -2 q-4 1 -5 -2 z"
      fill="#FFF8EE" stroke="#EADBC6" stroke-width=".8"/>
    <ellipse cx="22" cy="20" rx="4" ry="1.4" fill="#fff" opacity=".9"/>
    <circle cx="44" cy="44" r="1" fill="#7E3F15"/><circle cx="20" cy="42" r=".9" fill="#7E3F15"/><circle cx="34" cy="49" r=".9" fill="#7E3F15"/>
  </svg>`,
};

// Devuelve HTML (emoji o ícono propio) para mostrar junto al producto.
function tkIcono(nombre) {
  const n = " " + nombre.toUpperCase() + " ";
  const clave = Object.keys(TK_ICONOS).find(k => n.includes(" " + k));
  return clave ? `<span class="tk-ico">${TK_ICONOS[clave]}</span>` : tkEmoji(nombre);
}

function tkEmoji(nombre) {
  // La clave tiene que estar al inicio de una palabra: "PAN" no debe agarrar "EMPANADA".
  const n = " " + nombre.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + " ";
  const hit = TK_EMOJIS.find(([clave]) => n.includes(" " + clave));
  return hit ? hit[1] : "🦋";
}

const fmt = n => "$" + Number(n || 0).toLocaleString("es-CO");
const tkNumStr = n => "TICKET " + String(n).padStart(2, "0");

// ── Cuadrícula ────────────────────────────────────────────────
function renderGrid() {
  const el = document.getElementById("tk-grid");
  el.innerHTML = "";
  posState.productos.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tk-tile";
    btn.dataset.nombre = p.nombre;
    btn.innerHTML = `
      <span class="tk-tile-emoji">${tkIcono(p.nombre)}</span>
      <span class="tk-tile-name"></span>
      <span class="tk-tile-price">${fmt(p.precio)}</span>
      <span class="tk-tile-badge hidden"></span>`;
    btn.querySelector(".tk-tile-name").textContent = p.nombre;
    btn.onclick = () => tkSumar(p.nombre, 1);
    el.appendChild(btn);
  });
}

function tkSumar(nombre, delta) {
  const actual = posState.ticket[nombre] || 0;
  const nueva = actual + delta;
  if (nueva <= 0) delete posState.ticket[nombre];
  else posState.ticket[nombre] = nueva;
  renderTicket();
}

function tkPrecio(nombre) {
  return posState.productos.find(p => p.nombre === nombre)?.precio || 0;
}

function tkTotal() {
  return Object.entries(posState.ticket).reduce((s, [n, q]) => s + tkPrecio(n) * q, 0);
}

// ── Ticket actual ─────────────────────────────────────────────
function renderTicket() {
  const entries = Object.entries(posState.ticket);
  const total = tkTotal();
  const unidades = entries.reduce((s, [, q]) => s + q, 0);

  document.getElementById("tk-num").textContent = posState.editandoId ? "EDITANDO" : tkNumStr(posState.numTicket);
  document.getElementById("tk-total").textContent = fmt(total);
  document.getElementById("tk-count").textContent = unidades ? `${unidades} ítem${unidades === 1 ? "" : "s"}` : "";

  const itemsEl = document.getElementById("tk-items");
  if (!entries.length) {
    itemsEl.innerHTML = "<p class='tk-empty'>Toca un producto para agregarlo</p>";
  } else {
    itemsEl.innerHTML = "";
    entries.forEach(([nombre, qty]) => {
      const row = document.createElement("div");
      row.className = "tk-item";
      row.innerHTML = `
        <button class="tk-item-btn" aria-label="Quitar uno">−</button>
        <span class="tk-item-qty">${qty}</span>
        <span class="tk-item-name"><span class="tk-item-ico">${tkIcono(nombre)}</span> <span></span></span>
        <span class="tk-item-sub">${fmt(tkPrecio(nombre) * qty)}</span>`;
      row.querySelector(".tk-item-name > span:last-child").textContent = nombre;
      row.querySelector(".tk-item-btn").onclick = () => tkSumar(nombre, -1);
      itemsEl.appendChild(row);
    });
  }

  // Contador sobre cada tile de la cuadrícula
  document.querySelectorAll(".tk-tile").forEach(t => {
    const q = posState.ticket[t.dataset.nombre] || 0;
    const badge = t.querySelector(".tk-tile-badge");
    badge.textContent = q;
    badge.classList.toggle("hidden", !q);
    t.classList.toggle("on", q > 0);
  });

  document.getElementById("tk-facturar-btn").disabled = !entries.length || posState.enviando;
  document.getElementById("tk-facturar-btn").textContent = posState.editandoId ? "✓ Guardar cambios" : "Facturar";
  document.getElementById("tk-cancelar-edicion-btn").classList.toggle("hidden", !posState.editandoId);
  document.getElementById("tk-calc").classList.toggle("hidden", !entries.length);
  tkCalcVueltas();
}

// En celular el ticket es una barra abajo; tocar la cabecera lo expande/colapsa.
function tkTogglePanel() {
  document.getElementById("tk-panel").classList.toggle("open");
}

function tkLimpiar() {
  posState.ticket = {};
  document.getElementById("tk-paga").value = "";
  renderTicket();
}

// ── Calculadora de vueltas ────────────────────────────────────
function tkPagaCon(valor) {
  const total = tkTotal();
  const input = document.getElementById("tk-paga");
  input.value = valor === "exacto" ? total.toLocaleString("es-CO") : Number(valor).toLocaleString("es-CO");
  tkCalcVueltas();
}

function tkCalcVueltas() {
  const input = document.getElementById("tk-paga");
  const out = document.getElementById("tk-vueltas");
  const digitos = input.value.replace(/\D/g, "");
  if (input.value && input.value !== Number(digitos).toLocaleString("es-CO")) {
    input.value = digitos ? Number(digitos).toLocaleString("es-CO") : "";
  }
  const paga = Number(digitos) || 0;
  const total = tkTotal();
  if (!paga || !total) { out.textContent = ""; out.className = "tk-vueltas"; return; }
  const diff = paga - total;
  if (diff >= 0) {
    out.textContent = `Vueltas: ${fmt(diff)}`;
    out.className = "tk-vueltas ok";
  } else {
    out.textContent = `Faltan: ${fmt(-diff)}`;
    out.className = "tk-vueltas falta";
  }
}

// ── Facturar ──────────────────────────────────────────────────
function tkProductosStr() {
  return Object.entries(posState.ticket).map(([n, q]) => `${n} x${q}`).join(", ");
}

async function tkFacturar() {
  if (posState.enviando || !Object.keys(posState.ticket).length) return;
  if (posState.editandoId) return tkGuardarEdicion();

  const numero = tkNumStr(posState.numTicket);
  const productos = tkProductosStr();
  const total = tkTotal();

  posState.enviando = true;
  renderTicket();
  showLoading();
  const res = await api("registerSale", { correo: "", sector: numero, productos, total, puntos_sumados: 0 })
    .catch(() => ({ ok: false, error: "Sin conexión" }));
  hideLoading();
  posState.enviando = false;

  if (!res.ok) { renderTicket(); toast("❌ " + (res.error || "Error")); return; }

  toast(`✅ ${numero} · ${fmt(total)}`);
  posState.numTicket++;
  document.getElementById("tk-panel").classList.remove("open");
  tkLimpiar();
  loadPedidosHoy();
}

// ── Navegación ────────────────────────────────────────────────
function posIrAdmin() {
  // El PIN ya validado en esta caja también sirve para entrar al panel admin.
  sessionStorage.setItem("maddre_pos_pin", state.posPin || "1");
  sessionStorage.setItem("maddre_pos_nombre", state.adminNombre || "");
  window.location.href = "admin.html";
}

// ── Tickets de hoy (panel persistente) ────────────────────────
async function loadPedidosHoy() {
  const listEl = document.getElementById("pos-pedidos-hoy-list");
  const resumenEl = document.getElementById("pos-pedidos-hoy-resumen");
  if (!listEl) return;
  const sumRes = await api("getDaySummary", { pin: state.posPin || "", adminPassword: state.adminPass || "" })
    .catch(() => ({ ok: false }));
  if (!sumRes.ok) {
    listEl.innerHTML = "<p style='color:var(--text-lt);font-size:.82rem'>Sin conexión</p>";
    if (resumenEl) resumenEl.textContent = "";
    return;
  }
  if (resumenEl) {
    resumenEl.textContent = `${sumRes.ventasHoy} venta(s) · ${fmt(sumRes.totalHoy)} hoy`;
  }
  // Próximo número: el mayor entre "ventas de hoy + 1" y el último TICKET NN visto + 1
  // (así no se repite aunque se haya borrado alguno, ni si hay dos cajas abiertas).
  const maxVisto = (sumRes.ultimas || []).reduce((m, v) => {
    const match = String(v.sector || "").match(/TICKET\s+(\d+)/i);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  posState.numTicket = Math.max(posState.numTicket, (sumRes.ventasHoy || 0) + 1, maxVisto + 1);
  renderTicket();
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
        <p class="dia-pedido-sub" style="font-weight:600"></p>
        <p class="dia-pedido-prod"></p>
      </div>
      <div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:.15rem">
        <p class="dia-pedido-total">${fmt(v.total)}</p>
        <p class="dia-pedido-hora">${v.hora}</p>
        ${v.id ? `
          <div style="display:flex;gap:.4rem">
            <button class="pos-pedido-edit-btn">✏️ Editar</button>
            <button class="pos-pedido-del-btn">🗑</button>
          </div>` : ""}
      </div>`;
    row.querySelector(".dia-pedido-sub").textContent = v.sector || "—";
    row.querySelector(".dia-pedido-prod").textContent = v.productos;
    row.querySelector(".pos-pedido-edit-btn")?.addEventListener("click", () => tkEditarVenta(v.id, v.productos));
    row.querySelector(".pos-pedido-del-btn")?.addEventListener("click", () => posEliminarVenta(v.id, v.sector, v.productos));
    listEl.appendChild(row);
  });
}

async function posEliminarVenta(id, numero, productos) {
  if (!confirm(`¿Borrar ${numero || "este ticket"}?\n${productos}`)) return;
  showLoading();
  const res = await api("eliminarVenta", { id, pin: state.posPin || "" });
  hideLoading();
  if (!res.ok) { toast("❌ " + (res.error || "Error")); return; }
  toast("🗑 Ticket eliminado");
  await loadPedidosHoy();
}

// ── Editar un ticket ya facturado ─────────────────────────────
// Parsea "TINTO x2, LATTE x1" (también acepta el formato viejo con variedad
// "ROLLITO DE CANELA (NUTELLA) x1", que se suma al producto base).
function parsearProductosStr(str) {
  const ticket = {};
  String(str || "").split(",").map(s => s.trim()).filter(Boolean).forEach(part => {
    const match = part.match(/^(.+?)\s+x(\d+)$/i);
    if (!match) return;
    const nombre = match[1].replace(/\s*\([^)]*\)\s*$/, "").trim();
    const prod = posState.productos.find(p => p.nombre.toUpperCase() === nombre.toUpperCase());
    if (!prod) return;
    ticket[prod.nombre] = (ticket[prod.nombre] || 0) + (parseInt(match[2], 10) || 1);
  });
  return ticket;
}

function tkEditarVenta(id, productosStr) {
  if (!id) { toast("❌ Esta venta no tiene ID"); return; }
  posState.editandoId = id;
  posState.ticket = parsearProductosStr(productosStr);
  document.getElementById("tk-paga").value = "";
  document.getElementById("tk-panel").classList.add("open");
  renderTicket();
  document.querySelector(".tk-grid-wrap")?.scrollTo({ top: 0, behavior: "smooth" });
}

async function tkGuardarEdicion() {
  const id = posState.editandoId;
  posState.enviando = true;
  showLoading();
  const res = await api("editarVenta", { id, productos: tkProductosStr(), total: tkTotal(), pin: state.posPin || "" })
    .catch(() => ({ ok: false, error: "Sin conexión" }));
  hideLoading();
  posState.enviando = false;
  if (!res.ok) { renderTicket(); toast("❌ " + (res.error || "Error")); return; }
  toast("✅ Ticket actualizado");
  tkCancelarEdicion();
  await loadPedidosHoy();
}

function tkCancelarEdicion() {
  posState.editandoId = null;
  document.getElementById("tk-panel").classList.remove("open");
  tkLimpiar();
}

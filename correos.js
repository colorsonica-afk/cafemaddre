// ════════════════════════════════════════════════════════════
//  🦋 CAFÉ MADDRE — CORREOS.JS
//  Envío masivo con plantillas (correos.html)
//  Página separada de admin.html a propósito — así una URL nueva
//  siempre carga fresco, sin depender de que el navegador limpie
//  caché de una página vieja.
//  Requiere shared.js cargado antes.
// ════════════════════════════════════════════════════════════

// ── Entrada — misma sesión de staff que admin.html/pos.html ───
window.addEventListener("load", () => {
  const savedPin = localStorage.getItem("maddre_pos_pin");
  if (!savedPin) {
    // Sin PIN validado en esta sesión — no hay pantalla de login acá,
    // manda al panel para que entre por el flujo normal.
    window.location.href = "admin.html";
    return;
  }
  state.posPin      = savedPin;
  state.adminNombre = localStorage.getItem("maddre_pos_nombre") || "";
  initPlantillasCorreo();
  cargarDestinatarios();
});

async function cargarDestinatarios() {
  const res = await api("getAdminSummary", { pin: state.posPin || "", adminPassword: state.adminPass || "" });
  const pill = document.getElementById("adm-recipients-pill");
  if (pill) pill.textContent = res.ok ? `👥 ${res.vecinos || 0} vecinos recibirán este mensaje` : "👥 — vecinos recibirán este mensaje";
}

function volverAlPanel() {
  window.location.href = "admin.html";
}

// ── Plantillas de correo (HTML) ───────────────────────────────
// Cada plantilla es una página HTML en /emails/ con un <div id="email-contenido">
// adentro — eso es lo único que se carga en el mensaje masivo (el logo y pie de
// página del correo real los agrega el backend aparte). Para agregar una plantilla
// nueva: crear el archivo en /emails/ y sumarlo a esta lista.
const PLANTILLAS_CORREO = [
  { nombre: "🌀 Promo 2x1 Frutos Rojos", archivo: "emails/2x1-frutos-rojos.html" },
  { nombre: "📱 Escanea y entra al club (QR)", archivo: "emails/2-qr-app.html" },
  { nombre: "🧇 Invitación a probar los waffles", archivo: "emails/3-waffles.html" },
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
    // Sin cache: bust con timestamp para no servir una version vieja del template
    const res = await fetch(archivo + "?t=" + Date.now(), { cache: "no-store" });
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

// El backend decodifica los parámetros como Latin-1, y las tildes y emojis
// llegaban dañados al correo ("reciÃ©n", "ðŸ§‡"). Pasando todo carácter no
// ASCII a entidad HTML (&#233;, &#129479;) el mensaje viaja en ASCII puro y el
// cliente de correo lo muestra bien. El asunto es texto plano y no admite
// entidades: eso se corrige en el Apps Script.
function htmlSoloAscii(texto) {
  const esHtml = /<[a-z][\s\S]*>/i.test(texto);
  let out = "";
  for (const ch of texto) {
    const cp = ch.codePointAt(0);
    if (cp < 128) out += ch;
    else out += "&#" + cp + ";";
  }
  // Texto plano: se envuelve para conservar los saltos de línea al volverlo HTML
  return esHtml ? out : '<div style="white-space:pre-wrap">' + out + '</div>';
}

async function enviarMasivo() {
  const asunto  = document.getElementById("masivo-asunto").value.trim();
  const mensaje = document.getElementById("masivo-mensaje").value.trim();
  if (!asunto || !mensaje) { toast("Completa asunto y mensaje"); return; }
  if (!confirm(`¿Enviar este correo a todos los vecinos?`)) return;
  showLoading();
  const res = await api("enviarMasivo", { asunto, mensaje: htmlSoloAscii(mensaje), pin: state.posPin || "", adminPassword: state.adminPass || "" });
  hideLoading();
  if (!res.ok) { toast("❌ " + res.error); return; }
  toast(`✅ Correo enviado a ${res.enviados} vecinos`);
  document.getElementById("masivo-asunto").value = "";
  document.getElementById("masivo-mensaje").value = "";
  document.getElementById("masivo-plantilla").value = "";
  document.getElementById("email-preview-body").textContent = "Tu mensaje aparecerá aquí...";
}

(() => {
  const cfg = window.AV_CONFIG || {};
  const WHATSAPP = cfg.WHATSAPP_NUMBER || "525632753982";
  const SUPABASE_URL = (cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const SUPABASE_KEY = cfg.SUPABASE_ANON_KEY || "";
  const API_TIMEOUT_MS = 14000;

  let producto = null;
  let fotoActiva = 0;

  const id = (nombre) => document.getElementById(nombre);
  const limpiar = (valor) => String(valor ?? "").trim();
  const normalizar = (texto) => limpiar(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  document.addEventListener("DOMContentLoaded", iniciar);

  async function iniciar() {
    const productoId = limpiar(new URLSearchParams(window.location.search).get("id"));
    if (!productoId) {
      mostrarError("No recibimos el ID de la pieza. Regresa al catálogo y abre una autoparte.");
      return;
    }

    try {
      producto = await cargarProducto(productoId);
      if (!producto) {
        mostrarError(`No encontramos la pieza con ID ${productoId}. Escríbenos por WhatsApp para revisarla.`);
        return;
      }
      renderProducto(producto);
    } catch (error) {
      console.error("No se pudo cargar la pieza:", error);
      mostrarError("No pudimos cargar esta pieza. Escríbenos por WhatsApp para confirmar disponibilidad.");
    }
  }

  async function cargarProducto(productoId) {
    const desdeSupabase = await cargarProductoSupabase(productoId).catch(() => null);
    if (desdeSupabase) return desdeSupabase;
    return await cargarProductoRespaldo(productoId);
  }

  async function cargarProductoSupabase(productoId) {
    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes("AQUI") || SUPABASE_KEY.includes("AQUI")) return null;

    const params = new URLSearchParams({
      select: "id,folio,pieza,marca,modelo,anio,color,lado,estado,precio,numero_parte,descripcion,disponible,vendido_en",
      limit: "1"
    });
    params.set("or", `(folio.eq.${productoId},id.eq.${productoId})`);

    const piezas = await fetchJSON(`${SUPABASE_URL}/rest/v1/piezas?${params.toString()}`);
    const row = Array.isArray(piezas) ? piezas[0] : null;
    if (!row || row.disponible === false || row.vendido_en) return null;

    const p = normalizarProducto(row, "supabase");
    if (p.uuid) {
      const fotos = await cargarFotosSupabase(p.uuid).catch(() => []);
      if (fotos.length) {
        p.fotos = fotos.map((foto) => prepararUrlFoto(foto.url)).filter(Boolean);
        p.fotoCount = p.fotos.length;
      }
    }
    return p;
  }

  async function cargarFotosSupabase(uuid) {
    const params = new URLSearchParams({ select: "url,orden", pieza_id: `eq.${uuid}`, order: "orden.asc" });
    const fotos = await fetchJSON(`${SUPABASE_URL}/rest/v1/fotos?${params.toString()}`);
    return Array.isArray(fotos) ? fotos : [];
  }

  async function cargarProductoRespaldo(productoId) {
    const response = await fetch(`datos.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;
    const buscado = normalizar(productoId);
    const row = data.find((item) => normalizar(item.id || item.folio || item.uuid) === buscado);
    return row ? normalizarProducto(row, "respaldo") : null;
  }

  async function fetchJSON(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizarProducto(row, origen = "supabase") {
    const uuid = limpiar(row.uuid || row.id || "");
    const folio = limpiar(row.folio || row.id || "");
    return {
      uuid,
      id: folio || uuid,
      pieza: limpiar(row.pieza || row.Pieza),
      marca: limpiar(row.marca || row.Marca),
      modelo: limpiar(row.modelo || row.Modelo),
      anio: limpiar(row.anio || row.año || row.Anio || row.Año),
      color: limpiar(row.color || row.Color),
      lado: limpiar(row.lado || row.Lado),
      estado: limpiar(row.estado || row.Estado) || "Disponible",
      precio: row.precio ?? row.Precio,
      numeroParte: limpiar(row.numero_parte || row.numeroParte || row["numero parte"] || row["No. Parte"]),
      descripcion: limpiar(row.descripcion || row.notas || row.Notas || row.descripcionSeo),
      fotos: fotosDesdeRow(row, origen)
    };
  }

  function fotosDesdeRow(row, origen) {
    if (Array.isArray(row.fotos)) return row.fotos.filter((foto) => foto && foto.url).sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((foto) => prepararUrlFoto(foto.url)).filter(Boolean);
    if (origen === "respaldo") return [row.fotoPrincipal, row.foto2, row.foto3, row.foto4, row.foto5, row.foto6, row.link].map(prepararUrlFoto).filter(Boolean);
    return [];
  }

  function prepararUrlFoto(url) {
    const texto = limpiar(url);
    if (!texto) return "";
    const driveFile = texto.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (driveFile?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFile[1])}&sz=w1400`;
    const driveOpen = texto.match(/[?&]id=([^&]+)/i);
    if (texto.includes("drive.google.com") && driveOpen?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveOpen[1])}&sz=w1400`;
    return texto;
  }

  function renderProducto(p) {
    document.title = `${tituloProducto(p)} | AUTOPARTES VENCES`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = `${tituloProducto(p)} en AUTOPARTES VENCES. Confirma disponibilidad, compatibilidad y precio por WhatsApp.`;

    id("productId").textContent = `ID: ${p.id || "N/A"}`;
    id("productStatus").textContent = p.estado || "Disponible";
    id("productTitle").textContent = tituloProducto(p);
    id("productMeta").textContent = [p.marca, p.modelo, p.anio].filter(Boolean).join(" · ") || "Autoparte disponible";
    id("productPrice").textContent = formatearPrecio(p.precio);
    id("productDescription").textContent = p.descripcion || "Sin descripción adicional. Te recomendamos confirmar compatibilidad por WhatsApp antes de cerrar la compra.";
    id("productDetails").innerHTML = detalleHTML("Pieza", p.pieza) + detalleHTML("Marca", p.marca) + detalleHTML("Modelo", p.modelo) + detalleHTML("Año", p.anio) + detalleHTML("Lado", mostrarLadoHumano(p.lado)) + detalleHTML("Color", p.color) + detalleHTML("No. parte", p.numeroParte) + detalleHTML("Estado", p.estado);
    id("productWhatsapp").href = crearWhatsAppProducto(p);

    pintarFoto();
    pintarMiniaturas();
    pintarSEO(p);
    id("productLoading").hidden = true;
    id("productContent").hidden = false;
  }

  function pintarFoto() {
    const wrap = id("productMainImage");
    if (!wrap || !producto) return;
    if (producto.fotos.length) {
      wrap.innerHTML = `<img src="${escaparAttr(producto.fotos[fotoActiva])}" alt="${escaparAttr(tituloProducto(producto))}" loading="eager" decoding="async">`;
    } else {
      wrap.innerHTML = `<div class="empty"><h3>Sin foto publicada</h3><p>Pregunta por WhatsApp para confirmar fotos y estado.</p></div>`;
    }
  }

  function pintarMiniaturas() {
    const cont = id("productThumbs");
    if (!cont || !producto) return;
    cont.innerHTML = "";
    producto.fotos.forEach((url, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = index === fotoActiva ? "activo" : "";
      btn.innerHTML = `<img src="${escaparAttr(url)}" alt="Foto ${index + 1}" loading="lazy" decoding="async">`;
      btn.addEventListener("click", () => { fotoActiva = index; pintarFoto(); pintarMiniaturas(); });
      cont.appendChild(btn);
    });
  }

  function pintarSEO(p) {
    id("productJsonLd").textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: tituloProducto(p),
      sku: p.id || undefined,
      brand: p.marca ? { "@type": "Brand", name: p.marca } : undefined,
      image: p.fotos[0] || "https://www.autopartesvences.com/imagenes/logo-vences.jpeg",
      description: p.descripcion || `Autoparte usada original ${tituloProducto(p)} disponible en AUTOPARTES VENCES.`,
      offers: {
        "@type": "Offer",
        priceCurrency: "MXN",
        availability: "https://schema.org/InStock",
        url: window.location.href,
        price: Number(p.precio || 0) || undefined
      }
    });
  }

  function mostrarError(mensaje) {
    id("productLoading").hidden = true;
    const error = id("productError");
    error.hidden = false;
    error.querySelector("p").textContent = mensaje;
    error.querySelector("a").href = crearWhatsAppBusqueda(mensaje);
  }

  function tituloProducto(p) {
    const lado = p.lado ? mostrarLadoHumano(p.lado) : "";
    return [p.pieza, lado !== "N/A" ? lado : "", p.marca, p.modelo, p.anio].filter(Boolean).join(" ") || "Autoparte disponible";
  }

  function mostrarLadoHumano(lado) {
    const original = limpiar(lado);
    const t = normalizar(original).replace(/[^a-z0-9ñ]+/g, " ");
    if (!original) return "N/A";
    const tieneDelantero = /\bdelanter|\bfront/.test(t) || /^d[-\s/]/i.test(original);
    const tieneTrasero = /\btraser|\bposterior|\bback/.test(t) || /^t[-\s/]/i.test(original);
    const tieneDerecho = /\bdd\b|\bderech|\brh\b/.test(t) || /d[-\s]?d/i.test(original);
    const tieneIzquierdo = /\bdi\b|\bizquierd|\blh\b/.test(t) || /d[-\s]?i|i[-\s]?d/i.test(original);
    const partes = [];
    if (tieneDelantero) partes.push("Delantero");
    if (tieneTrasero) partes.push("Trasero");
    if (tieneDerecho) partes.push("derecho");
    if (tieneIzquierdo) partes.push("izquierdo");
    return partes.length ? capitalizar(partes.join(" ")) : original;
  }

  function crearWhatsAppProducto(p) {
    const mensaje = [
      "Hola, quiero revisar esta autoparte:",
      "",
      `ID: ${p.id || "N/A"}`,
      `Pieza: ${tituloProducto(p)}`,
      `Número de parte: ${p.numeroParte || "N/A"}`,
      `Precio: ${formatearPrecio(p.precio)}`,
      `Link: ${window.location.href}`,
      "",
      "Entiendo que están ubicados en Ecatepec, Estado de México.",
      "¿Me puedes confirmar disponibilidad, compatibilidad y forma de pago?"
    ].join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  }

  function crearWhatsAppBusqueda(busqueda) {
    const mensaje = ["Hola, busco una autoparte que no encontré en el catálogo.", limpiar(busqueda), "¿Me puedes ayudar a revisar si la tienen disponible?"].filter(Boolean).join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  }

  function detalleHTML(label, value) {
    return `<div><dt>${escapar(label)}</dt><dd>${escapar(value || "N/A")}</dd></div>`;
  }

  function formatearPrecio(precio) {
    const numero = Number(precio || 0);
    if (!numero) return "Consultar";
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(numero);
  }

  function capitalizar(texto) {
    const limpio = limpiar(texto);
    return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : "";
  }

  function escapar(texto) {
    return String(texto ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function escaparAttr(texto) { return escapar(texto).replaceAll("`", "&#096;"); }
})();

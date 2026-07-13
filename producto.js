(() => {
  const cfg = window.AV_CONFIG || {};
  const WHATSAPP = cfg.WHATSAPP_NUMBER || "525632753982";
  const SUPABASE_URL = (cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const SUPABASE_KEY = cfg.SUPABASE_ANON_KEY || "";
  const API_TIMEOUT_MS = 7000;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  let producto = null;
  let fotoActiva = 0;
  let touchInicio = null;

  const id = (nombre) => document.getElementById(nombre);
  const limpiar = (valor) => String(valor ?? "").trim();
  const normalizar = (texto) => limpiar(texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  document.addEventListener("DOMContentLoaded", iniciar);

  async function iniciar() {
    conectarGaleria();

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

  function conectarGaleria() {
    const galeria = id("productMainImage");
    if (!galeria) return;

    galeria.addEventListener("touchstart", (event) => {
      const toque = event.changedTouches?.[0];
      if (!toque) return;
      touchInicio = { x: toque.clientX, y: toque.clientY };
    }, { passive: true });

    galeria.addEventListener("touchend", (event) => {
      if (!touchInicio || !producto || producto.fotos.length < 2) return;
      const toque = event.changedTouches?.[0];
      if (!toque) return;

      const dx = toque.clientX - touchInicio.x;
      const dy = toque.clientY - touchInicio.y;
      touchInicio = null;

      if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
      cambiarFoto(dx < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      if (!producto || producto.fotos.length < 2) return;
      if (event.key === "ArrowLeft") cambiarFoto(-1);
      if (event.key === "ArrowRight") cambiarFoto(1);
    });
  }

  async function cargarProducto(productoId) {
    const configurado = SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("AQUI") && !SUPABASE_KEY.includes("AQUI");

    if (configurado) {
      try {
        return await cargarProductoSupabase(productoId);
      } catch (error) {
        console.warn("Supabase no respondió; se intentará el respaldo local:", error);
      }
    }

    return await cargarProductoRespaldo(productoId);
  }

  async function cargarProductoSupabase(productoId) {
    const params = new URLSearchParams({
      select: "id,folio,pieza,marca,modelo,anio,color,lado,estado,precio,numero_parte,descripcion,disponible,vendido_en",
      disponible: "eq.true",
      vendido_en: "is.null",
      limit: "1"
    });

    if (UUID_RE.test(productoId)) params.set("id", `eq.${productoId}`);
    else params.set("folio", `eq.${productoId}`);

    const piezas = await fetchJSON(`${SUPABASE_URL}/rest/v1/piezas?${params.toString()}`);
    const row = Array.isArray(piezas) ? piezas[0] : null;
    if (!row) return null;

    const p = normalizarProducto(row, "supabase");
    if (p.uuid) {
      const fotos = await cargarFotosSupabase(p.uuid).catch(() => []);
      p.fotos = fotos
        .map((foto) => prepararUrlFoto(urlPublicaStorage(foto.storage_path) || foto.url, 1400))
        .filter(Boolean);
      p.miniaturas = fotos
        .map((foto) => prepararUrlFoto(foto.url || urlPublicaStorage(foto.storage_path), 520))
        .filter(Boolean);
      p.fotoCount = p.fotos.length;
    }
    return p;
  }

  async function cargarFotosSupabase(uuid) {
    const params = new URLSearchParams({ select: "url,storage_path,orden", pieza_id: `eq.${uuid}`, order: "orden.asc" });
    const fotos = await fetchJSON(`${SUPABASE_URL}/rest/v1/fotos?${params.toString()}`);
    return Array.isArray(fotos) ? fotos : [];
  }

  async function cargarProductoRespaldo(productoId) {
    const response = await fetch("datos.json", { cache: "default" });
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
      if (!response.ok) {
        const detalle = await response.text().catch(() => "");
        throw new Error(`Error ${response.status}${detalle ? `: ${detalle}` : ""}`);
      }
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizarProducto(row, origen = "supabase") {
    const uuid = limpiar(row.uuid || row.id || "");
    const folio = limpiar(row.folio || row.id || "");
    const medios = mediosDesdeRow(row, origen);
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
      fotos: medios.fotos,
      miniaturas: medios.miniaturas
    };
  }

  function mediosDesdeRow(row, origen) {
    if (Array.isArray(row.fotos)) {
      const ordenadas = row.fotos
        .filter((foto) => foto && (foto.url || foto.storage_path || foto.urlCompleta))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));
      return {
        fotos: ordenadas
          .map((foto) => prepararUrlFoto(foto.urlCompleta || urlPublicaStorage(foto.storage_path) || foto.url, 1400))
          .filter(Boolean),
        miniaturas: ordenadas
          .map((foto) => prepararUrlFoto(foto.miniatura || foto.url || urlPublicaStorage(foto.storage_path), 520))
          .filter(Boolean)
      };
    }
    if (origen === "respaldo") {
      const urls = [row.fotoPrincipal, row.foto2, row.foto3, row.foto4, row.foto5, row.foto6, row.link].filter(esUrlFotoValida);
      return {
        fotos: urls.map((url) => prepararUrlFoto(url, 1400)).filter(Boolean),
        miniaturas: urls.map((url) => prepararUrlFoto(url, 520)).filter(Boolean)
      };
    }
    return { fotos: [], miniaturas: [] };
  }

  function urlPublicaStorage(storagePath) {
    const path = limpiar(storagePath).replace(/^\/+/, "");
    const bucket = limpiar(cfg.STORAGE_BUCKET || "fotos-piezas");
    if (!path || !SUPABASE_URL || !bucket) return "";
    return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  function esUrlFotoValida(url) {
    const texto = limpiar(url);
    if (!texto) return false;
    if (/drive\.google\.com\/(?:drive\/)?folders\//i.test(texto)) return false;
    return true;
  }

  function prepararUrlFoto(url, anchoDrive = 1200) {
    const texto = limpiar(url);
    if (!texto) return "";
    const driveFile = texto.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (driveFile?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFile[1])}&sz=w${anchoDrive}`;
    const driveOpen = texto.match(/[?&]id=([^&]+)/i);
    if (texto.includes("drive.google.com") && driveOpen?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveOpen[1])}&sz=w${anchoDrive}`;
    return texto;
  }

  function renderProducto(p) {
    const titulo = tituloProducto(p);
    const descripcionMeta = `${titulo} en AUTOPARTES VENCES. Confirma disponibilidad, compatibilidad y precio por WhatsApp.`;

    document.title = `${titulo} | AUTOPARTES VENCES`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = descripcionMeta;

    id("productId").textContent = `ID: ${p.id || "N/A"}`;
    id("productStatus").textContent = p.estado || "Disponible";
    id("productTitle").textContent = titulo;
    id("productMeta").textContent = [p.marca, p.modelo, p.anio].filter(Boolean).join(" · ") || "Autoparte disponible";
    id("productPrice").textContent = formatearPrecio(p.precio);
    id("productDescription").textContent = p.descripcion || "Sin descripción adicional. Te recomendamos confirmar compatibilidad por WhatsApp antes de cerrar la compra.";
    id("productDetails").innerHTML = detalleHTML("Pieza", p.pieza) + detalleHTML("Marca", p.marca) + detalleHTML("Modelo", p.modelo) + detalleHTML("Año", p.anio) + detalleHTML("Lado", mostrarLadoHumano(p.lado)) + detalleHTML("Color", p.color) + detalleHTML("No. parte", p.numeroParte) + detalleHTML("Estado", p.estado);
    id("productWhatsapp").href = crearWhatsAppProducto(p);

    pintarFoto();
    pintarMiniaturas();
    pintarSEO(p, descripcionMeta);
    id("productLoading").hidden = true;
    id("productError").hidden = true;
    id("productContent").hidden = false;
  }

  function pintarFoto() {
    const wrap = id("productMainImage");
    if (!wrap || !producto) return;

    const total = producto.fotos.length;
    if (!total) {
      wrap.innerHTML = `<div class="empty"><h3>Sin foto publicada</h3><p>Pregunta por WhatsApp para confirmar fotos y estado.</p></div>`;
      return;
    }

    const multiples = total > 1;
    wrap.innerHTML = `
      <img src="${escaparAttr(producto.fotos[fotoActiva])}" alt="${escaparAttr(tituloProducto(producto))}. Foto ${fotoActiva + 1} de ${total}" loading="eager" decoding="async" fetchpriority="high">
      <button class="product-gallery-arrow previous" type="button" data-gallery-prev aria-label="Foto anterior" ${multiples ? "" : "hidden"}>‹</button>
      <button class="product-gallery-arrow next" type="button" data-gallery-next aria-label="Foto siguiente" ${multiples ? "" : "hidden"}>›</button>
      <span class="product-gallery-count" aria-live="polite">${fotoActiva + 1} / ${total}</span>`;

    wrap.querySelector("[data-gallery-prev]")?.addEventListener("click", () => cambiarFoto(-1));
    wrap.querySelector("[data-gallery-next]")?.addEventListener("click", () => cambiarFoto(1));
  }

  function pintarMiniaturas() {
    const cont = id("productThumbs");
    if (!cont || !producto) return;
    cont.innerHTML = "";

    producto.fotos.forEach((url, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = index === fotoActiva ? "activo" : "";
      btn.setAttribute("aria-label", `Ver foto ${index + 1}`);
      const miniatura = producto.miniaturas?.[index] || url;
      btn.innerHTML = `<img src="${escaparAttr(miniatura)}" alt="Miniatura ${index + 1}" loading="lazy" decoding="async">`;
      btn.addEventListener("click", () => {
        fotoActiva = index;
        pintarFoto();
        pintarMiniaturas();
      });
      cont.appendChild(btn);
    });

    cont.querySelector("button.activo")?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  function cambiarFoto(delta) {
    if (!producto || producto.fotos.length < 2) return;
    fotoActiva = (fotoActiva + delta + producto.fotos.length) % producto.fotos.length;
    pintarFoto();
    pintarMiniaturas();
  }

  function pintarSEO(p, descripcionMeta) {
    const titulo = tituloProducto(p);
    const imagen = p.fotos[0] || "https://www.autopartesvences.com/imagenes/og-autopartes-vences.png";
    const canonicalUrl = new URL(window.location.pathname, window.location.origin);
    canonicalUrl.searchParams.set("id", p.id || p.uuid || "");
    const url = canonicalUrl.toString();

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = url;

    actualizarMeta('meta[property="og:title"]', `${titulo} | AUTOPARTES VENCES`);
    actualizarMeta('meta[property="og:description"]', descripcionMeta);
    actualizarMeta('meta[property="og:url"]', url);
    actualizarMeta('meta[property="og:image"]', imagen);
    actualizarMeta('meta[name="twitter:title"]', `${titulo} | AUTOPARTES VENCES`);
    actualizarMeta('meta[name="twitter:description"]', descripcionMeta);
    actualizarMeta('meta[name="twitter:image"]', imagen);

    id("productJsonLd").textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: titulo,
      sku: p.id || undefined,
      brand: p.marca ? { "@type": "Brand", name: p.marca } : undefined,
      image: p.fotos.length ? p.fotos : [imagen],
      description: p.descripcion || `Autoparte usada original ${titulo} disponible en AUTOPARTES VENCES.`,
      offers: {
        "@type": "Offer",
        priceCurrency: "MXN",
        availability: "https://schema.org/InStock",
        url,
        price: Number(p.precio || 0) || undefined
      }
    });
  }

  function actualizarMeta(selector, contenido) {
    const meta = document.querySelector(selector);
    if (meta && contenido) meta.setAttribute("content", contenido);
  }

  function mostrarError(mensaje) {
    id("productLoading").hidden = true;
    id("productContent").hidden = true;
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

  function escaparAttr(texto) {
    return escapar(texto).replaceAll("`", "&#096;");
  }
})();

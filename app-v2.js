(() => {
  const cfg = window.AV_CONFIG || {};
  const WHATSAPP = cfg.WHATSAPP_NUMBER || "525632753982";
  const SUPABASE_URL = (cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const SUPABASE_KEY = cfg.SUPABASE_ANON_KEY || "";
  const CART_KEY = "carritoAutopartesVencesV2";
  const CACHE_KEY = "avCatalogoPublicoCacheV3";
  const PAGE_SIZE = 12;
  const INITIAL_BATCH_SIZE = 60;
  const REST_PAGE_SIZE = 1000;
  const PHOTO_BATCH_SIZE = 60;
  const SEARCH_DEBOUNCE_MS = 220;
  const API_TIMEOUT_MS = 14000;
  const PRODUCT_PAGE = "producto.html";
  const BUSQUEDAS_RAPIDAS = [
    ["faro", "Faros"],
    ["calavera", "Calaveras"],
    ["puerta", "Puertas"],
    ["defensa", "Defensas"],
    ["espejo", "Espejos"],
    ["cofre", "Cofres"],
    ["mazda", "Mazda"],
    ["nissan", "Nissan"],
    ["chevrolet", "Chevrolet"],
    ["honda", "Honda"]
  ];

  let productos = [];
  let filtrados = [];
  let carrito = [];
  let productoDetalle = null;
  let indiceFotoDetalle = 0;
  let piezasVisibles = PAGE_SIZE;
  let filtroTimer = null;
  let cargaInventarioVersion = 0;
  let cacheSaveTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const id = (nombre) => document.getElementById(nombre);

  document.addEventListener("DOMContentLoaded", iniciar);

  function iniciar() {
    carrito = leerCarrito();
    activarMenu();
    conectarEventos();
    pintarCarrito();
    cargarInventario();
  }

  function activarMenu() {
    id("menuBtn")?.addEventListener("click", () => id("navLinks")?.classList.toggle("open"));
    $$("#navLinks a").forEach((link) => link.addEventListener("click", () => id("navLinks")?.classList.remove("open")));
  }

  function conectarEventos() {
    ["searchInput", "piezaSelect", "marcaSelect", "modeloSelect", "anioSelect", "ladoSelect"].forEach((elementId) => {
      const el = id(elementId);
      if (!el) return;
      const evento = elementId === "searchInput" ? "input" : "change";

      el.addEventListener(evento, () => {
        const aplicarFiltro = () => {
          actualizarOpcionesFiltros(elementId);
          filtrar();
          actualizarSugerenciasBusqueda();
          actualizarLinkPiezaNoEncontrada();
        };

        if (elementId === "searchInput") {
          actualizarSugerenciasBusqueda();
          actualizarLinkPiezaNoEncontrada();
          window.clearTimeout(filtroTimer);
          filtroTimer = window.setTimeout(aplicarFiltro, SEARCH_DEBOUNCE_MS);
          return;
        }

        aplicarFiltro();
      });
    });

    id("refreshBtn")?.addEventListener("click", () => cargarInventario({ forzarRed: true }));
    id("clearFiltersBtn")?.addEventListener("click", limpiarFiltros);
    id("mobileFilterToggle")?.addEventListener("click", alternarFiltrosMoviles);
    id("mobileApplyFiltersBtn")?.addEventListener("click", aplicarFiltrosMoviles);
    id("mobileClearFiltersBtn")?.addEventListener("click", () => {
      limpiarFiltros();
      cerrarFiltrosMoviles();
    });
    id("navCartBtn")?.addEventListener("click", abrirCarrito);
    id("heroCartBtn")?.addEventListener("click", abrirCarrito);

    $$("[data-search-chip]").forEach((btn) => {
      btn.addEventListener("click", () => buscarConTexto(btn.dataset.searchChip || btn.textContent || ""));
    });

    id("searchInput")?.addEventListener("focus", actualizarSugerenciasBusqueda);

    document.addEventListener("click", (event) => {
      const sugerencias = id("smartSuggestions");
      const buscador = id("searchInput");
      if (!sugerencias || sugerencias.hidden) return;
      if (sugerencias.contains(event.target) || event.target === buscador) return;
      sugerencias.hidden = true;
    });

    id("detailBackdrop")?.addEventListener("click", cerrarDetalle);
    id("detailClose")?.addEventListener("click", cerrarDetalle);
    id("detailImageBtn")?.addEventListener("click", () => cambiarFotoDetalle(1));
    id("detailAddCart")?.addEventListener("click", () => productoDetalle && agregarAlCarrito(productoDetalle));

    id("cartBackdrop")?.addEventListener("click", cerrarCarrito);
    id("cartClose")?.addEventListener("click", cerrarCarrito);
    id("clearCartBtn")?.addEventListener("click", vaciarCarrito);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cerrarDetalle();
        cerrarCarrito();
      }
      if (!id("detailModal")?.classList.contains("open")) return;
      if (event.key === "ArrowLeft") cambiarFotoDetalle(-1);
      if (event.key === "ArrowRight") cambiarFotoDetalle(1);
    });
  }

  function alternarFiltrosMoviles() {
    const filtros = id("catalogFilters");
    const boton = id("mobileFilterToggle");
    if (!filtros || !boton) return;

    const abierto = !filtros.classList.contains("mobile-filters-open");
    filtros.classList.toggle("mobile-filters-open", abierto);
    document.body.classList.toggle("mobile-filter-panel-open", abierto);
    boton.setAttribute("aria-expanded", String(abierto));
  }

  function cerrarFiltrosMoviles() {
    const filtros = id("catalogFilters");
    const boton = id("mobileFilterToggle");
    filtros?.classList.remove("mobile-filters-open");
    document.body.classList.remove("mobile-filter-panel-open");
    boton?.setAttribute("aria-expanded", "false");
  }

  function aplicarFiltrosMoviles() {
    cerrarFiltrosMoviles();
    const destino = id("statusCatalogo") || id("productsGrid");
    destino?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function actualizarControlesMoviles() {
    const filtros = getFiltros();
    const activos = [filtros.pieza, filtros.marca, filtros.modelo, filtros.anio, filtros.lado].filter(Boolean).length;
    const badge = id("mobileFilterBadge");
    if (badge) {
      badge.textContent = String(activos);
      badge.hidden = activos === 0;
    }
  }

  async function cargarInventario(opciones = {}) {
    const version = ++cargaInventarioVersion;
    const mantenerActual = productos.length > 0;
    const cache = opciones.forzarRed ? null : leerCache();

    if (!mantenerActual && cache?.length) {
      usarInventario(
        cache.map((row) => normalizarProducto(row, "cache")),
        "Mostrando inventario guardado mientras comprobamos novedades.",
        "ok"
      );
    } else if (mantenerActual) {
      setStatus("Actualizando inventario sin ocultar las piezas actuales...", "");
    } else {
      setStatus("Cargando piezas disponibles...", "");
    }

    try {
      const primeraPagina = await cargarPaginaPiezas(0, INITIAL_BATCH_SIZE);
      if (version !== cargaInventarioVersion) return;

      const primeros = reconciliarProductos(
        primeraPagina.map(normalizarProducto),
        productos
      );

      if (primeraPagina.length < INITIAL_BATCH_SIZE) {
        usarInventario(primeros, textoConteoPiezas(primeros.length));
        programarGuardarCache();
        return;
      }

      const inventarioProvisional = fusionarConInventarioActual(primeros, productos);
      usarInventario(
        inventarioProvisional,
        `Mostrando las piezas más recientes. Completando el catálogo en segundo plano...`,
        "ok",
        { mantenerLimite: mantenerActual }
      );

      cargarRestoInventarioEnSegundoPlano(primeraPagina, version);
    } catch (error) {
      console.warn("No se pudo cargar Supabase REST:", error);
      if (version !== cargaInventarioVersion) return;

      if (productos.length) {
        setStatus("Mostrando inventario guardado. La actualización en vivo no respondió; puedes seguir navegando.", "");
        return;
      }

      try {
        const respaldo = await cargarDatosJsonRespaldo();
        if (version !== cargaInventarioVersion) return;
        usarInventario(
          respaldo.map((row) => normalizarProducto(row, "respaldo")),
          "Mostrando respaldo local. Confirma disponibilidad por WhatsApp."
        );
      } catch (fallbackError) {
        console.warn("No se pudo cargar respaldo local:", fallbackError);
        usarInventario([], "No pudimos cargar el inventario. Escríbenos por WhatsApp para revisar disponibilidad.", "err");
      }
    }
  }

  async function cargarRestoInventarioEnSegundoPlano(primeraPagina, version) {
    const filas = [...primeraPagina];
    let offset = primeraPagina.length;

    try {
      while (offset < 100000) {
        const pagina = await cargarPaginaPiezas(offset, REST_PAGE_SIZE);
        if (version !== cargaInventarioVersion) return;
        filas.push(...pagina);
        offset += pagina.length;
        if (pagina.length < REST_PAGE_SIZE) break;
      }

      const completos = reconciliarProductos(filas.map(normalizarProducto), productos);
      usarInventario(completos, textoConteoPiezas(completos.length), "ok", { mantenerLimite: true });
      programarGuardarCache();
    } catch (error) {
      console.warn("No se pudo completar el resto del inventario:", error);
      if (version === cargaInventarioVersion) {
        setStatus("El catálogo ya está disponible. Algunas piezas antiguas podrían tardar en incorporarse.", "");
      }
    }
  }

  function usarInventario(lista, mensaje, tipo = "ok", opciones = {}) {
    productos = lista;
    filtrados = productos;
    actualizarTodosLosFiltros();
    actualizarStats(productos);
    actualizarSEO(productos);
    filtrar({ mantenerLimite: Boolean(opciones.mantenerLimite) });
    setStatus(mensaje, tipo);
  }

  async function cargarPaginaPiezas(offset, limit) {
    validarConfigREST();
    const url = restURL("piezas", {
      select: "id,folio,pieza,marca,modelo,anio,color,lado,estado,precio,numero_parte,descripcion,disponible,created_at,vendido_en",
      disponible: "eq.true",
      vendido_en: "is.null",
      order: "created_at.desc",
      limit: String(limit),
      offset: String(offset)
    });

    const pagina = await fetchJSON(url, API_TIMEOUT_MS);
    if (!Array.isArray(pagina)) throw new Error("Respuesta inesperada del inventario.");
    return pagina;
  }

  function reconciliarProductos(nuevos, anteriores = []) {
    const previos = new Map(anteriores.map((p) => [p.uuid, p]));

    return nuevos.map((nuevo) => {
      const anterior = previos.get(nuevo.uuid);
      if (!anterior) return nuevo;

      const fotos = anterior.fotos?.length ? anterior.fotos : nuevo.fotos;
      const fotoCount = Math.max(anterior.fotoCount || 0, nuevo.fotoCount || 0, fotos.length);
      const fotosCargadas = Boolean(anterior.fotosCargadas || nuevo.fotosCargadas || fotos.length);
      const fotosCompletas = Boolean(anterior.fotosCompletas || nuevo.fotosCompletas || fotos.length);
      const fotosCargando = Boolean(anterior.fotosCargando);

      Object.assign(anterior, nuevo, {
        fotos,
        fotoCount,
        fotosCargadas,
        fotosCompletas,
        fotosCargando
      });
      return anterior;
    });
  }

  function fusionarConInventarioActual(primeros, actuales) {
    const idsPrimeros = new Set(primeros.map((p) => p.uuid));
    return primeros.concat(actuales.filter((p) => p.uuid && !idsPrimeros.has(p.uuid)));
  }

  async function cargarDatosJsonRespaldo() {
    const response = await fetch("datos.json?v=1", { cache: "force-cache" });
    if (!response.ok) throw new Error("No se pudo leer datos.json");
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  function validarConfigREST() {
    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes("AQUI") || SUPABASE_KEY.includes("AQUI")) {
      throw new Error("Falta configuración de Supabase.");
    }
  }

  function restURL(tabla, params = {}) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${tabla}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
  }

  async function fetchJSON(url, timeout = API_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });

      if (!response.ok) {
        const texto = await response.text().catch(() => "");
        throw new Error(`Error ${response.status}: ${texto || response.statusText}`);
      }

      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizarProducto(row, origen = "supabase") {
    const fotos = fotosDesdeRow(row, origen);
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
      disponible: row.disponible !== false,
      fotos,
      fotoCount: fotos.length,
      fotosCargadas: fotos.length > 0 || origen === "respaldo",
      fotosCompletas: fotos.length > 0 || origen === "respaldo",
      fotosCargando: false
    };
  }

  function fotosDesdeRow(row, origen) {
    if (Array.isArray(row.fotos)) {
      return row.fotos
        .filter((foto) => foto && foto.url)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
        .map((foto) => prepararUrlFoto(foto.url))
        .filter(Boolean);
    }

    if (origen === "respaldo") {
      return [row.fotoPrincipal, row.foto2, row.foto3, row.foto4, row.foto5, row.foto6, row.link]
        .map(prepararUrlFoto)
        .filter(Boolean);
    }

    return [];
  }

  function prepararUrlFoto(url) {
    const texto = limpiar(url);
    if (!texto) return "";

    const driveFile = texto.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (driveFile?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFile[1])}&sz=w720`;

    const driveOpen = texto.match(/[?&]id=([^&]+)/i);
    if (texto.includes("drive.google.com") && driveOpen?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveOpen[1])}&sz=w720`;

    return texto;
  }

  function limpiar(valor) { return String(valor ?? "").trim(); }

  function normalizar(texto) {
    return limpiar(texto)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  const PALABRAS_RUIDO_BUSQUEDA = new Set([
    "de", "del", "la", "las", "el", "los", "un", "una", "unos", "unas",
    "para", "por", "con", "sin", "en", "al", "a", "y", "o", "que", "pieza", "piezas"
  ]);

  const GRUPOS_SINONIMOS_BUSQUEDA = [
    ["faro", "faros", "lampara", "lamparas", "luz", "luces"],
    ["calavera", "calaveras", "stop", "stops", "mica", "micas"],
    ["defensa", "defensas", "facia", "facias", "fascia", "fascias", "parachoques"],
    ["cofre", "capot", "capo", "bonete"],
    ["salpicadera", "salpicaderas", "lodera", "loderas", "guardafango", "guardafangos"],
    ["retrovisor", "retrovisores", "espejo", "espejos"],
    ["parrilla", "parrillas", "rejilla", "rejillas", "grilla"],
    ["puerta", "puertas", "puuerta", "portezuela"],
    ["rin", "rines", "llanta", "llantas", "rueda", "ruedas"],
    ["direccional", "direccionales", "cuarto", "cuartos", "intermitente", "intermitentes"],
    ["tolva", "tolvas", "guardapolvo", "guardapolvos"],
    ["radiador", "radiadores", "condensador", "condensadores"],
    ["fascia", "facia", "defensa"],
    ["derecho", "derecha", "dd", "rh"],
    ["izquierdo", "izquierda", "di", "lh"]
  ];

  const MAPA_SINONIMOS_BUSQUEDA = crearMapaSinonimosBusqueda();

  function crearMapaSinonimosBusqueda() {
    const mapa = new Map();
    GRUPOS_SINONIMOS_BUSQUEDA.forEach((grupo) => {
      const normalizados = [...new Set(grupo.map(normalizar).filter(Boolean))];
      normalizados.forEach((token) => mapa.set(token, normalizados));
    });
    return mapa;
  }

  function prepararTextoParaTokens(texto) {
    return normalizar(texto)
      .replace(/\b(luz|luces|lampara|lamparas)\s+(delantera|delanteras|delantero|delanteros|frontal|frontales)\b/g, " faro ")
      .replace(/\b(luz|luces|mica|micas|stop|stops|lampara|lamparas)\s+(trasera|traseras|trasero|traseros)\b/g, " calavera ")
      .replace(/\bd\s*[-/]\s*d\b/g, " dd ")
      .replace(/\bd\s*[-/]\s*i\b/g, " di ")
      .replace(/\bi\s*[-/]\s*d\b/g, " di ")
      .replace(/\bder\b/g, " derecho ")
      .replace(/\bizq\b/g, " izquierdo ")
      .replace(/[^a-z0-9ñ]+/g, " ");
  }

  function tokenizarBusqueda(texto) {
    return prepararTextoParaTokens(texto)
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token && !PALABRAS_RUIDO_BUSQUEDA.has(token) && (token.length > 1 || /^\d+$/.test(token)))
      .map(corregirTokenBusqueda);
  }

  function corregirTokenBusqueda(token) {
    const correcciones = {
      lampara: "lampara",
      lamparas: "lamparas",
      puuerta: "puerta",
      fasia: "facia",
      facias: "facia",
      calabera: "calavera",
      calaberas: "calavera",
      tuson: "tucson",
      tucon: "tucson",
      hiunday: "hyundai",
      hundai: "hyundai",
      chevroleth: "chevrolet",
      chevy: "chevrolet"
    };
    return correcciones[token] || token;
  }

  function expandirTokenBusqueda(token) {
    const grupo = MAPA_SINONIMOS_BUSQUEDA.get(token) || [];
    const singular = singularizarTokenBusqueda(token);
    const extra = singular && singular !== token ? [singular, ...(MAPA_SINONIMOS_BUSQUEDA.get(singular) || [])] : [];
    return [...new Set([token, ...grupo, ...extra])];
  }

  function singularizarTokenBusqueda(token) {
    if (token === "luces") return "luz";
    if (token === "rines") return "rin";
    if (token.endsWith("es") && token.length > 5) return token.slice(0, -2);
    if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
    return token;
  }

  function gruposBusqueda(texto) {
    return tokenizarBusqueda(texto).map(expandirTokenBusqueda);
  }

  function textoLadoBusqueda(lado) {
    const texto = prepararTextoParaTokens(lado);
    if (/\bdd\b|\bderech/.test(texto)) return "derecho derecha dd rh";
    if (/\bdi\b|\bizquierd/.test(texto)) return "izquierdo izquierda di lh";
    return texto;
  }

  function textoProducto(p) {
    if (p._textoBusqueda) return p._textoBusqueda;

    const textoBase = [
      p.id,
      p.pieza,
      p.marca,
      p.modelo,
      p.anio,
      extraerAnios(p.anio).join(" "),
      p.color,
      p.lado,
      textoLadoBusqueda(p.lado),
      p.estado,
      p.numeroParte,
      p.descripcion
    ].join(" ");

    const tokens = tokenizarBusqueda(textoBase);
    const textoExpandido = tokens.flatMap(expandirTokenBusqueda).join(" ");
    p._textoBusqueda = `${prepararTextoParaTokens(textoBase)} ${textoExpandido}`;
    return p._textoBusqueda;
  }

  function tokensProductoBusqueda(p) {
    if (p._tokensBusqueda) return p._tokensBusqueda;
    p._tokensBusqueda = [...new Set(textoProducto(p).split(/\s+/).filter(Boolean))];
    return p._tokensBusqueda;
  }

  function tokenAceptaCoincidenciaParcial(token) {
    return /^[a-zñ]{3,}$/.test(token);
  }

  function coincideTokenBusqueda(token, texto, tokensProducto) {
    if (texto.includes(` ${token} `)) return true;

    if (!tokenAceptaCoincidenciaParcial(token)) return false;

    return tokensProducto.some((tokenProducto) =>
      tokenProducto.length > token.length && tokenProducto.startsWith(token)
    );
  }

  function coincideBusquedaInteligente(producto, busqueda) {
    const grupos = gruposBusqueda(busqueda);
    if (!grupos.length) return true;

    const texto = ` ${textoProducto(producto)} `;
    const tokensProducto = tokensProductoBusqueda(producto);

    return grupos.every((grupo) =>
      grupo.some((token) => coincideTokenBusqueda(token, texto, tokensProducto))
    );
  }

  function buscarConTexto(texto) {
    const input = id("searchInput");
    if (!input) return;
    input.value = limpiar(texto);
    actualizarOpcionesFiltros("searchInput");
    filtrar();
    actualizarSugerenciasBusqueda();
    actualizarLinkPiezaNoEncontrada();
    input.focus();
  }

  function actualizarSugerenciasBusqueda() {
    const cont = id("smartSuggestions");
    const input = id("searchInput");
    if (!cont || !input) return;

    const texto = limpiar(input.value);
    if (texto.length < 2 || !productos.length) {
      cont.hidden = true;
      cont.innerHTML = "";
      return;
    }

    const sugerencias = crearSugerenciasBusqueda(texto);
    if (!sugerencias.length) {
      cont.hidden = true;
      cont.innerHTML = "";
      return;
    }

    cont.innerHTML = `
      <span>Sugerencias rápidas:</span>
      ${sugerencias.map((s) => `<button type="button" data-suggestion="${escaparAttr(s)}">${escapar(s)}</button>`).join("")}
    `;
    cont.hidden = false;

    cont.querySelectorAll("[data-suggestion]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        buscarConTexto(btn.dataset.suggestion || "");
        cont.hidden = true;
      });
    });
  }

  function crearSugerenciasBusqueda(texto) {
    const tokens = tokenizarBusqueda(texto);
    const candidatos = productos
      .filter((p) => coincideTokensFlexibles(p, tokens))
      .slice(0, 18);

    const sugerencias = [];
    const agregar = (valor) => {
      const limpio = limpiar(valor);
      if (!limpio) return;
      const llave = normalizar(limpio);
      if (!llave || sugerencias.some((s) => normalizar(s) === llave)) return;
      sugerencias.push(limpio);
    };

    candidatos.forEach((p) => {
      agregar([p.pieza, p.marca, p.modelo].filter(Boolean).join(" "));
      agregar([p.pieza, p.marca, p.modelo, p.anio].filter(Boolean).join(" "));
    });

    if (sugerencias.length < 6) {
      BUSQUEDAS_RAPIDAS.forEach(([valor]) => {
        if (normalizar(valor).includes(normalizar(texto)) || normalizar(texto).includes(normalizar(valor).slice(0, 3))) agregar(valor);
      });
    }

    return sugerencias.slice(0, 6);
  }

  function coincideTokensFlexibles(producto, tokens) {
    if (!tokens.length) return true;
    const texto = ` ${textoProducto(producto)} `;
    const tokensProducto = tokensProductoBusqueda(producto);
    return tokens.every((token) => {
      const grupo = expandirTokenBusqueda(token);
      return grupo.some((opcion) => texto.includes(` ${opcion} `) || tokensProducto.some((tp) => tp.startsWith(opcion)));
    });
  }

  function describirCoincidencia(producto) {
    const busqueda = getFiltros().busqueda;
    const grupos = gruposBusqueda(busqueda);
    if (!busqueda || !grupos.length) return "";

    const texto = ` ${textoProducto(producto)} `;
    const tokensProducto = tokensProductoBusqueda(producto);
    const etiquetas = [];

    grupos.forEach((grupo) => {
      const tokenOriginal = grupo[0];
      const encontrado = grupo.some((token) => coincideTokenBusqueda(token, texto, tokensProducto));
      if (encontrado) etiquetas.push(capitalizar(tokenOriginal));
    });

    return etiquetas.length ? `Coincide con: ${etiquetas.slice(0, 4).join(" + ")}` : "";
  }

  function capitalizar(texto) {
    const limpio = limpiar(texto);
    return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : "";
  }

  function actualizarLinkPiezaNoEncontrada() {
    const link = id("missingPieceBtn");
    if (!link) return;
    link.href = crearWhatsAppBusqueda(textoSolicitudActual());
  }

  function textoSolicitudActual() {
    const f = getFiltros();
    return limpiar([f.busqueda, f.pieza, f.marca, f.modelo, f.anio, f.lado ? mostrarLadoHumano(f.lado) : ""].filter(Boolean).join(" "));
  }

  function getFiltros() {
    return {
      busqueda: id("searchInput")?.value || "",
      pieza: id("piezaSelect")?.value || "",
      marca: id("marcaSelect")?.value || "",
      modelo: id("modeloSelect")?.value || "",
      anio: id("anioSelect")?.value || "",
      lado: id("ladoSelect")?.value || ""
    };
  }

  function filtrar(opciones = {}) {
    const f = getFiltros();
    actualizarLinkPiezaNoEncontrada();

    filtrados = productos.filter((p) => {
      const coincideBusqueda = coincideBusquedaInteligente(p, f.busqueda);
      const coincidePieza = !f.pieza || p.pieza === f.pieza;
      const coincideMarca = !f.marca || p.marca === f.marca;
      const coincideModelo = !f.modelo || p.modelo === f.modelo;
      const coincideAnio = !f.anio || productoIncluyeAnio(p, f.anio);
      const coincideLado = !f.lado || p.lado === f.lado;
      return coincideBusqueda && coincidePieza && coincideMarca && coincideModelo && coincideAnio && coincideLado;
    });

    if (!opciones.mantenerLimite) piezasVisibles = PAGE_SIZE;
    piezasVisibles = Math.max(PAGE_SIZE, piezasVisibles);
    actualizarControlesMoviles();
    mostrarProductos(filtrados);
  }

  function productoIncluyeAnio(p, anio) {
    if (!anio) return true;
    const anios = extraerAnios(p.anio);
    if (anios.length) return anios.includes(String(anio));
    return normalizar(p.anio).includes(normalizar(anio));
  }

  function extraerAnios(texto) {
    const original = limpiar(texto);
    if (!original) return [];

    const normal = original.replace(/[–—]/g, "-");
    const range = normal.match(/(\d{2,4})\s*-\s*(\d{2,4})/);
    if (range) {
      let start = expandirAnio(range[1]);
      let end = expandirAnio(range[2]);
      if (!start || !end) return [];
      if (end < start) [start, end] = [end, start];
      const out = [];
      for (let y = start; y <= end; y++) out.push(String(y));
      return out;
    }

    return [...new Set((normal.match(/\d{2,4}/g) || []).map(expandirAnio).filter(Boolean).map(String))];
  }

  function expandirAnio(valor) {
    const n = Number(valor);
    if (!n) return null;
    if (n >= 1900) return n;
    if (n <= 35) return 2000 + n;
    return 1900 + n;
  }

  function actualizarTodosLosFiltros() {
    llenarSelect("piezaSelect", valoresUnicos(productos, "pieza"), "Todas");
    llenarSelect("marcaSelect", valoresUnicos(productos, "marca"), "Todas");
    llenarSelect("modeloSelect", valoresUnicos(productos, "modelo"), "Todos");
    llenarSelect("anioSelect", valoresAnios(productos), "Todos");
    llenarSelect("ladoSelect", valoresUnicos(productos, "lado"), "Todos");
  }

  function actualizarOpcionesFiltros(cambiado) {
    const actual = getFiltros();

    const basePara = (campo) => productos.filter((p) => {
      if (actual.busqueda && !coincideBusquedaInteligente(p, actual.busqueda)) return false;
      if (campo !== "pieza" && actual.pieza && p.pieza !== actual.pieza) return false;
      if (campo !== "marca" && actual.marca && p.marca !== actual.marca) return false;
      if (campo !== "modelo" && actual.modelo && p.modelo !== actual.modelo) return false;
      if (campo !== "anio" && actual.anio && !productoIncluyeAnio(p, actual.anio)) return false;
      if (campo !== "lado" && actual.lado && p.lado !== actual.lado) return false;
      return true;
    });

    if (cambiado !== "piezaSelect") llenarSelect("piezaSelect", valoresUnicos(basePara("pieza"), "pieza"), "Todas");
    if (cambiado !== "marcaSelect") llenarSelect("marcaSelect", valoresUnicos(basePara("marca"), "marca"), "Todas");
    if (cambiado !== "modeloSelect") llenarSelect("modeloSelect", valoresUnicos(basePara("modelo"), "modelo"), "Todos");
    if (cambiado !== "anioSelect") llenarSelect("anioSelect", valoresAnios(basePara("anio")), "Todos");
    if (cambiado !== "ladoSelect") llenarSelect("ladoSelect", valoresUnicos(basePara("lado"), "lado"), "Todos");
  }

  function valoresUnicos(lista, campo) {
    return [...new Set(lista.map((p) => p[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  }

  function valoresAnios(lista) {
    return [...new Set(lista.flatMap((p) => extraerAnios(p.anio)))]
      .sort((a, b) => Number(b) - Number(a));
  }

  function llenarSelect(selectId, valores, etiqueta) {
    const select = id(selectId);
    if (!select) return;
    const valorActual = select.value;
    select.innerHTML = `<option value="">${escapar(etiqueta)}</option>` + valores.map((valor) => `<option value="${escaparAttr(valor)}">${escapar(selectId === "ladoSelect" ? mostrarLadoHumano(valor) : valor)}</option>`).join("");
    if (valores.includes(valorActual)) select.value = valorActual;
  }

  function limpiarFiltros() {
    id("searchInput").value = "";
    ["piezaSelect", "marcaSelect", "modeloSelect", "anioSelect", "ladoSelect"].forEach((selectId) => {
      const select = id(selectId);
      if (select) select.value = "";
    });
    actualizarTodosLosFiltros();
    filtrar();
  }

  function actualizarStats(lista) {
    const total = id("statTotal");
    const marcas = id("statMarcas");
    const fotos = id("statConFotos");

    if (total) total.textContent = lista.length;
    if (marcas) marcas.textContent = valoresUnicos(lista, "marca").length;
    if (fotos) fotos.textContent = "✓";

    [total, marcas, fotos].forEach((el) => el?.classList.remove("stat-loading"));
  }

  function mostrarProductos(lista) {
    const grid = id("productsGrid");
    const template = id("productTemplate");
    if (!grid || !template) return;

    const total = lista.length;
    const visibles = lista.slice(0, piezasVisibles);
    const contadorMovil = id("mobileCatalogCount");
    if (contadorMovil) contadorMovil.textContent = total === 1 ? "1 pieza encontrada" : `${total} piezas encontradas`;

    grid.innerHTML = "";
    grid.classList.toggle("one-item", visibles.length === 1);
    grid.classList.toggle("two-items", visibles.length === 2);

    if (!total) {
      mostrarSinResultados(grid);
      actualizarBotonCargarMas(0, 0);
      setStatus("No hay resultados con esos filtros, pero todavía podemos revisarlo por WhatsApp.", "");
      return;
    }

    const fragment = document.createDocumentFragment();

    visibles.forEach((producto, index) => {
      const node = template.content.cloneNode(true);
      const card = node.querySelector(".product-card");
      const photoBtn = node.querySelector(".product-photo");
      const title = node.querySelector("h3");
      const meta = node.querySelector(".meta");
      const details = node.querySelector(".details");
      const price = node.querySelector(".price");
      const viewBtn = node.querySelector(".view-btn");
      const cartBtn = node.querySelector(".cart-btn");
      const matchReason = node.querySelector(".match-reason");

      card.dataset.productUuid = producto.uuid || "";
      node.querySelector(".id-tag").textContent = `ID: ${producto.id || "N/A"}`;
      node.querySelector(".status-tag").textContent = producto.estado || "Disponible";
      title.textContent = tituloProducto(producto);
      meta.textContent = [producto.marca, producto.modelo, producto.anio].filter(Boolean).join(" · ") || "Autoparte disponible";
      details.innerHTML = detalleHTML("Lado", mostrarLadoHumano(producto.lado)) + detalleHTML("Color", producto.color) + detalleHTML("No. parte", producto.numeroParte) + detalleHTML("Estado", producto.estado);
      price.textContent = formatearPrecio(producto.precio);
      if (cartBtn) cartBtn.textContent = "Preguntar";
      if (matchReason) {
        const motivo = describirCoincidencia(producto);
        matchReason.textContent = motivo;
        matchReason.hidden = !motivo;
      }
      card.style.setProperty("--card-index", String(index));

      const productUrl = crearUrlProducto(producto);
      photoBtn.href = productUrl;
      viewBtn.href = productUrl;

      card.addEventListener("click", (event) => {
        if (event.target.closest("a, button")) return;
        window.location.assign(productUrl);
      });
      cartBtn.addEventListener("click", (event) => { event.stopPropagation(); agregarAlCarrito(producto); });

      pintarFotoTarjeta(card, producto, index);
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    actualizarBotonCargarMas(total, visibles.length);
    actualizarEstadoCatalogo(total, visibles.length);

    cargarFotosParaProductos(visibles).then((huboCambios) => {
      if (!huboCambios) return;
      actualizarFotosTarjetas(filtrados.slice(0, piezasVisibles));
      programarGuardarCache();
    }).catch((error) => console.warn("No se pudieron cargar fotos visibles:", error));
  }

  function pintarFotoTarjeta(card, producto, index) {
    const photoBtn = card.querySelector(".product-photo");
    const count = card.querySelector(".photo-count");
    if (!photoBtn || !count) return;

    let img = photoBtn.querySelector("img");
    let placeholder = photoBtn.querySelector("[data-photo-placeholder]");

    if (producto.fotos.length) {
      if (!img) {
        img = document.createElement("img");
        photoBtn.prepend(img);
      }
      placeholder?.remove();
      photoBtn.classList.remove("sin-foto");
      img.hidden = false;
      img.alt = tituloProducto(producto);
      img.loading = index === 0 ? "eager" : "lazy";
      img.decoding = "async";
      img.fetchPriority = index === 0 ? "high" : "low";
      if (img.src !== producto.fotos[0]) img.src = producto.fotos[0];
      const cantidad = producto.fotoCount || producto.fotos.length;
      count.textContent = cantidad > 1 ? `${cantidad} fotos` : "Ver foto";
      return;
    }

    if (img) {
      img.removeAttribute("src");
      img.hidden = true;
    }
    if (!placeholder) {
      placeholder = document.createElement("span");
      placeholder.dataset.photoPlaceholder = "";
      photoBtn.prepend(placeholder);
    }
    placeholder.textContent = producto.fotosCargando ? "Cargando foto" : "Sin foto";
    count.textContent = producto.fotosCargando ? "Cargando foto" : "Sin foto";
    photoBtn.classList.add("sin-foto");
  }

  function actualizarFotosTarjetas(lista) {
    const grid = id("productsGrid");
    if (!grid) return;
    const mapa = new Map(lista.map((p) => [p.uuid, p]));
    grid.querySelectorAll(".product-card[data-product-uuid]").forEach((card, index) => {
      const producto = mapa.get(card.dataset.productUuid);
      if (producto) pintarFotoTarjeta(card, producto, index);
    });
  }

  function mostrarSinResultados(grid) {
    const solicitud = textoSolicitudActual();
    const whatsapp = crearWhatsAppBusqueda(solicitud);
    const intentos = sugerirBusquedasAlternas(solicitud);

    grid.classList.remove("one-item", "two-items");
    grid.innerHTML = `
      <div class="empty smart-empty">
        <span class="empty-icon">🔎</span>
        <h3>No encontramos “${escapar(solicitud || "esa búsqueda")}”</h3>
        <p>Puede estar escrita diferente, pendiente de foto o todavía no publicada. Te ayudamos a revisarla directo por WhatsApp.</p>
        <div class="empty-actions">
          <a class="btn primary" href="${escaparAttr(whatsapp)}" target="_blank" rel="noopener">Preguntar por esta pieza</a>
          <button class="btn ghost" type="button" data-empty-clear>Limpiar búsqueda</button>
        </div>
        ${intentos.length ? `<div class="empty-suggestions"><strong>También prueba:</strong>${intentos.map((s) => `<button type="button" data-empty-search="${escaparAttr(s)}">${escapar(s)}</button>`).join("")}</div>` : ""}
      </div>`;

    grid.querySelector("[data-empty-clear]")?.addEventListener("click", limpiarFiltros);
    grid.querySelectorAll("[data-empty-search]").forEach((btn) => {
      btn.addEventListener("click", () => buscarConTexto(btn.dataset.emptySearch || ""));
    });
  }

  function sugerirBusquedasAlternas(texto) {
    const tokens = tokenizarBusqueda(texto);
    const sugerencias = [];
    const agregar = (valor) => {
      const limpio = limpiar(valor);
      if (limpio && !sugerencias.some((s) => normalizar(s) === normalizar(limpio))) sugerencias.push(limpio);
    };

    if (tokens.length > 1) agregar(tokens.filter((t) => !/^\d{4}$/.test(t)).join(" "));
    tokens.forEach((token) => {
      if (token.length >= 3) agregar(token);
    });
    BUSQUEDAS_RAPIDAS.slice(0, 5).forEach(([valor]) => agregar(valor));
    return sugerencias.filter((s) => normalizar(s) !== normalizar(texto)).slice(0, 5);
  }

  async function cargarFotosParaProductos(lista) {
    validarConfigREST();
    const pendientes = lista.filter((p) => p.uuid && !p.fotosCargadas && !p.fotosCargando);
    if (!pendientes.length) return false;

    pendientes.forEach((p) => { p.fotosCargando = true; });

    try {
      const fotosPorPieza = await consultarFotosPorPiezas(pendientes.map((p) => p.uuid));
      pendientes.forEach((p) => {
        const fotos = fotosPorPieza.get(p.uuid) || [];
        p.fotos = fotos.map((foto) => prepararUrlFoto(foto.url)).filter(Boolean);
        p.fotoCount = fotos.length;
        p.fotosCargadas = true;
        p.fotosCompletas = true;
        p.fotosCargando = false;
      });
      return true;
    } catch (error) {
      pendientes.forEach((p) => {
        p.fotosCargando = false;
        p.fotosCargadas = false;
      });
      throw error;
    }
  }

  async function consultarFotosPorPiezas(ids) {
    const mapa = new Map();
    const limpios = ids.map(limpiar).filter(Boolean);

    for (const lote of partirEnLotes(limpios, PHOTO_BATCH_SIZE)) {
      const url = restURL("fotos", {
        select: "pieza_id,url,orden",
        pieza_id: `in.(${lote.join(",")})`,
        order: "orden.asc"
      });
      const data = await fetchJSON(url, API_TIMEOUT_MS);
      (data || []).forEach((foto) => {
        const piezaId = limpiar(foto.pieza_id);
        if (!mapa.has(piezaId)) mapa.set(piezaId, []);
        mapa.get(piezaId).push(foto);
      });
    }

    mapa.forEach((fotos) => fotos.sort((a, b) => (a.orden || 0) - (b.orden || 0)));
    return mapa;
  }


  function partirEnLotes(lista, tamano) {
    const lotes = [];
    for (let i = 0; i < lista.length; i += tamano) lotes.push(lista.slice(i, i + tamano));
    return lotes;
  }

  function actualizarEstadoCatalogo(total, visibles) {
    if (!total) return;
    const hayFiltros = filtrosActivos();
    const unidad = total === 1 ? "pieza" : "piezas";
    const contexto = hayFiltros ? (total === 1 ? "resultado" : "resultados") : `${unidad} disponible${total === 1 ? "" : "s"}`;

    if (visibles < total) {
      setStatus(`Mostrando ${visibles} de ${total} ${contexto}.`, "ok");
      return;
    }

    if (hayFiltros) {
      setStatus(total === 1 ? "1 resultado encontrado." : `${total} resultados encontrados.`, "ok");
      return;
    }

    setStatus(textoConteoPiezas(total), "ok");
  }

  function filtrosActivos() {
    const f = getFiltros();
    return Boolean(f.busqueda || f.pieza || f.marca || f.modelo || f.anio || f.lado);
  }

  function actualizarBotonCargarMas(total, visibles) {
    const boton = obtenerBotonCargarMas();
    const wrap = boton?.parentElement;
    if (!boton || !wrap) return;

    const restantes = Math.max(total - visibles, 0);
    if (!restantes) {
      wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    boton.textContent = `Ver ${Math.min(PAGE_SIZE, restantes)} piezas más`;
    boton.setAttribute("aria-label", `Ver más piezas. Faltan ${restantes}.`);
  }

  function obtenerBotonCargarMas() {
    let boton = id("loadMoreBtn");
    if (boton) return boton;

    const grid = id("productsGrid");
    if (!grid) return null;

    const wrap = document.createElement("div");
    wrap.className = "load-more-wrap";
    wrap.hidden = true;

    boton = document.createElement("button");
    boton.id = "loadMoreBtn";
    boton.type = "button";
    boton.className = "btn primary load-more-btn";
    boton.textContent = "Ver más piezas";
    boton.addEventListener("click", () => {
      piezasVisibles += PAGE_SIZE;
      mostrarProductos(filtrados);
    });

    wrap.appendChild(boton);
    grid.insertAdjacentElement("afterend", wrap);
    return boton;
  }

  function mostrarLadoHumano(lado) {
    const original = limpiar(lado);
    const t = prepararTextoParaTokens(original);
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

    if (partes.length) return capitalizar(partes.join(" "));
    return original;
  }

  function tituloProducto(p) {
    const lado = p.lado ? mostrarLadoHumano(p.lado) : "";
    return [p.pieza, lado !== "N/A" ? lado : "", p.marca, p.modelo, p.anio].filter(Boolean).join(" ") || "Autoparte disponible";
  }

  function detalleHTML(label, value) {
    return `
      <div>
        <dt>${escapar(label)}</dt>
        <dd>${escapar(value || "N/A")}</dd>
      </div>`;
  }

  function formatearPrecio(precio) {
    const numero = Number(precio || 0);
    if (!numero) return "Consultar";
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(numero);
  }

  function abrirDetalle(producto) {
    productoDetalle = producto;
    indiceFotoDetalle = 0;

    id("detailId").textContent = `ID: ${producto.id || "N/A"}`;
    id("detailStatus").textContent = producto.estado || "Disponible";
    id("detailTitle").textContent = tituloProducto(producto);
    id("detailMeta").textContent = [producto.marca, producto.modelo, producto.anio].filter(Boolean).join(" · ") || "Autoparte disponible";
    id("detailPrice").textContent = formatearPrecio(producto.precio);
    id("detailDescription").textContent = producto.descripcion || "Sin descripción adicional. Te recomendamos confirmar compatibilidad por WhatsApp antes de cerrar la compra.";
    id("detailWhatsapp").href = crearWhatsAppProducto(producto);
    id("detailList").innerHTML = detalleHTML("Pieza", producto.pieza) + detalleHTML("Marca", producto.marca) + detalleHTML("Modelo", producto.modelo) + detalleHTML("Año", producto.anio) + detalleHTML("Lado", mostrarLadoHumano(producto.lado)) + detalleHTML("Color", producto.color) + detalleHTML("No. parte", producto.numeroParte) + detalleHTML("Estado", producto.estado);

    pintarFotoDetalle();
    pintarThumbsDetalle();

    id("detailModal").classList.add("open");
    id("detailModal").setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    if (!producto.fotosCompletas && producto.uuid) {
      cargarFotosParaProductos([producto]).then(() => {
        if (productoDetalle === producto) {
          indiceFotoDetalle = 0;
          pintarFotoDetalle();
          pintarThumbsDetalle();
        }
      }).catch((error) => console.warn("No se pudieron cargar fotos del detalle:", error));
    }
  }

  function pintarFotoDetalle() {
    if (!productoDetalle) return;
    const fotos = productoDetalle.fotos;
    const img = id("detailImage");
    const count = id("detailPhotoCount");
    if (fotos.length) {
      img.src = fotos[indiceFotoDetalle];
      img.alt = tituloProducto(productoDetalle);
      img.loading = "eager";
      img.decoding = "async";
      img.fetchPriority = "high";
      count.textContent = `${indiceFotoDetalle + 1} / ${fotos.length}`;
    } else {
      img.removeAttribute("src");
      img.alt = "Sin foto disponible";
      count.textContent = productoDetalle.fotosCargando ? "Cargando fotos" : "Sin foto";
    }
  }

  function pintarThumbsDetalle() {
    const thumbs = id("detailThumbs");
    if (!thumbs || !productoDetalle) return;
    const fotos = productoDetalle.fotos;
    thumbs.innerHTML = "";
    if (!fotos.length) return;
    fotos.forEach((url, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = index === indiceFotoDetalle ? "activo" : "";
      btn.innerHTML = `<img src="${escaparAttr(url)}" alt="Miniatura ${index + 1}" loading="lazy" decoding="async">`;
      btn.addEventListener("click", () => {
        indiceFotoDetalle = index;
        pintarFotoDetalle();
        pintarThumbsDetalle();
      });
      thumbs.appendChild(btn);
    });
  }

  function cambiarFotoDetalle(delta) {
    if (!productoDetalle || !productoDetalle.fotos.length) return;
    indiceFotoDetalle = (indiceFotoDetalle + delta + productoDetalle.fotos.length) % productoDetalle.fotos.length;
    pintarFotoDetalle();
    pintarThumbsDetalle();
  }

  function cerrarDetalle() {
    const modal = id("detailModal");
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    productoDetalle = null;
  }

  function crearUrlProducto(p) {
    const url = new URL(PRODUCT_PAGE, window.location.href);
    url.searchParams.set("id", p.id || p.uuid || "");
    return url.toString();
  }

  function crearWhatsAppProducto(p) {
    const mensaje = [
      "Hola, quiero revisar esta autoparte:",
      "",
      `ID: ${p.id || "N/A"}`,
      `Pieza: ${tituloProducto(p)}`,
      `Número de parte: ${p.numeroParte || "N/A"}`,
      `Precio: ${formatearPrecio(p.precio)}`,
      `Link: ${crearUrlProducto(p)}`,
      "",
      "Entiendo que están ubicados en Ecatepec, Estado de México.",
      "¿Me puedes confirmar disponibilidad, compatibilidad y forma de pago?"
    ].join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  }

  function crearWhatsAppBusqueda(busqueda) {
    const texto = limpiar(busqueda);
    const mensaje = [
      "Hola, busco una autoparte que no encontré en el catálogo.",
      texto ? `Búsqueda: ${texto}` : "",
      "",
      "¿Me puedes ayudar a revisar si la tienen disponible?"
    ].filter((linea) => linea !== "").join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  }

  function agregarAlCarrito(producto) {
    if (!producto?.id) return;
    if (!carrito.includes(producto.id)) carrito.push(producto.id);
    guardarCarrito();
    pintarCarrito();
    abrirCarrito();
  }

  function leerCarrito() {
    try {
      const data = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(data) ? data.map(String) : [];
    } catch {
      return [];
    }
  }

  function guardarCarrito() {
    localStorage.setItem(CART_KEY, JSON.stringify(carrito));
  }

  function productosCarrito() {
    return carrito.map((pid) => productos.find((p) => p.id === pid)).filter(Boolean);
  }

  function pintarCarrito() {
    const items = productosCarrito();
    id("navCartCount").textContent = String(items.length);
    const cont = id("cartItems");
    const link = id("cartWhatsapp");
    if (!cont || !link) return;

    if (!items.length) {
      cont.innerHTML = `<div class="empty"><h3>Tu carrito está vacío</h3><p>Agrega una o varias piezas para cotizarlas por WhatsApp.</p></div>`;
      link.href = `https://wa.me/${WHATSAPP}`;
      link.classList.add("disabled");
      return;
    }

    link.classList.remove("disabled");
    cont.innerHTML = items.map((p) => `
      <div class="cart-item">
        ${p.fotos[0] ? `<img src="${escaparAttr(p.fotos[0])}" alt="${escaparAttr(tituloProducto(p))}" loading="lazy" decoding="async">` : `<div class="no-img">Sin foto</div>`}
        <div>
          <strong>${escapar(tituloProducto(p))}</strong>
          <small>ID: ${escapar(p.id)} · ${escapar(formatearPrecio(p.precio))}</small>
        </div>
        <button class="cart-remove" type="button" data-remove="${escaparAttr(p.id)}">Quitar</button>
      </div>
    `).join("");

    cont.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => quitarDelCarrito(btn.dataset.remove));
    });

    link.href = crearWhatsAppCarrito(items);
  }

  function crearWhatsAppCarrito(items) {
    const lineas = ["Hola, quiero revisar estas autopartes:", ""];
    items.forEach((p, i) => {
      lineas.push(`${i + 1}. ${tituloProducto(p)}`);
      lineas.push(`ID: ${p.id || "N/A"}`);
      lineas.push(`Precio: ${formatearPrecio(p.precio)}`);
      lineas.push(`No. parte: ${p.numeroParte || "N/A"}`);
      lineas.push(`Link: ${crearUrlProducto(p)}`);
      lineas.push("");
    });
    lineas.push("Entiendo que están ubicados en Ecatepec, Estado de México.");
    lineas.push("¿Me puedes confirmar disponibilidad, compatibilidad y forma de pago?");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lineas.join("\n"))}`;
  }

  function quitarDelCarrito(pid) {
    carrito = carrito.filter((idItem) => idItem !== pid);
    guardarCarrito();
    pintarCarrito();
  }

  function vaciarCarrito() {
    carrito = [];
    guardarCarrito();
    pintarCarrito();
  }

  function abrirCarrito() {
    pintarCarrito();
    id("cartPanel")?.classList.add("open");
    id("cartPanel")?.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function cerrarCarrito() {
    id("cartPanel")?.classList.remove("open");
    id("cartPanel")?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function actualizarSEO(lista) {
    let script = id("seoProductsJson");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "seoProductsJson";
      document.head.appendChild(script);
    }

    const items = lista.slice(0, 50).map((p, index) => {
      const item = {
        "@type": "ListItem",
        position: index + 1,
        item: {
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
            url: crearUrlProducto(p),
            price: Number(p.precio || 0) || undefined
          }
        }
      };
      return limpiarObjeto(item);
    });

    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: items
    });
  }

  function limpiarObjeto(obj) {
    if (Array.isArray(obj)) return obj.map(limpiarObjeto).filter((v) => v !== undefined && v !== null);
    if (!obj || typeof obj !== "object") return obj;
    const limpio = {};
    Object.entries(obj).forEach(([k, v]) => {
      const val = limpiarObjeto(v);
      if (val !== undefined && val !== null && val !== "") limpio[k] = val;
    });
    return limpio;
  }

  function textoConteoPiezas(total) {
    return `${total} ${total === 1 ? "pieza disponible cargada" : "piezas disponibles cargadas"}.`;
  }

  function leerCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!cache?.data || !Array.isArray(cache.data)) return null;
      return cache.data;
    } catch {
      return null;
    }
  }

  function programarGuardarCache() {
    const ejecutar = () => {
      cacheSaveTimer = null;
      guardarCache(productos);
    };

    if (cacheSaveTimer) {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(cacheSaveTimer);
      else window.clearTimeout(cacheSaveTimer);
    }

    if (typeof window.requestIdleCallback === "function") {
      cacheSaveTimer = window.requestIdleCallback(ejecutar, { timeout: 1800 });
    } else {
      cacheSaveTimer = window.setTimeout(ejecutar, 500);
    }
  }

  function guardarCache(lista) {
    try {
      const data = lista.map((p) => ({
        uuid: p.uuid,
        id: p.id,
        pieza: p.pieza,
        marca: p.marca,
        modelo: p.modelo,
        anio: p.anio,
        color: p.color,
        lado: p.lado,
        estado: p.estado,
        precio: p.precio,
        numeroParte: p.numeroParte,
        descripcion: p.descripcion,
        disponible: p.disponible,
        fotos: p.fotos.slice(0, 1).map((url, orden) => ({ url, orden })),
        fotoCount: p.fotoCount || p.fotos.length
      }));
      localStorage.setItem(CACHE_KEY, JSON.stringify({ creadoEn: Date.now(), data }));
    } catch (_) {}
  }

  function setStatus(mensaje, tipo = "") {
    const el = id("statusCatalogo");
    if (!el) return;
    el.textContent = mensaje;
    el.className = `catalog-status ${tipo}`.trim();
  }

  function escapar(texto) {
    return String(texto ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escaparAttr(texto) { return escapar(texto).replaceAll("`", "&#096;"); }
})();

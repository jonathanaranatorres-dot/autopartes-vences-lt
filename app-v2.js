(() => {
  const WHATSAPP = window.AV_CONFIG?.WHATSAPP_NUMBER || "525632753982";
  const CART_KEY = "carritoAutopartesVencesV2";
  const PAGE_SIZE = 12;
  const SEARCH_DEBOUNCE_MS = 220;
  const db = window.autopartesSupabase || window.avDB;

  let productos = [];
  let filtrados = [];
  let carrito = [];
  let productoDetalle = null;
  let indiceFotoDetalle = 0;
  let piezasVisibles = PAGE_SIZE;
  let filtroTimer = null;

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
        };

        if (elementId === "searchInput") {
          window.clearTimeout(filtroTimer);
          filtroTimer = window.setTimeout(aplicarFiltro, SEARCH_DEBOUNCE_MS);
          return;
        }

        aplicarFiltro();
      });
    });

    id("refreshBtn")?.addEventListener("click", cargarInventario);
    id("clearFiltersBtn")?.addEventListener("click", limpiarFiltros);
    id("navCartBtn")?.addEventListener("click", abrirCarrito);
    id("heroCartBtn")?.addEventListener("click", abrirCarrito);

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

  async function cargarInventario() {
    setStatus("Cargando piezas disponibles...", "");

    if (!db) {
      setStatus("No pudimos cargar el inventario. Escríbenos por WhatsApp para revisar disponibilidad.", "err");
      mostrarProductos([]);
      return;
    }

    const { data, error } = await db
      .from("piezas")
      .select("*, fotos(url, orden)")
      .eq("disponible", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatus("Error cargando inventario: " + error.message, "err");
      mostrarProductos([]);
      return;
    }

    productos = (data || []).map(normalizarProducto);
    filtrados = productos;
    piezasVisibles = PAGE_SIZE;

    actualizarTodosLosFiltros();
    actualizarStats(productos);
    actualizarSEO(productos);
    filtrar();
  }

  function textoConteoPiezas(total) {
    return `${total} ${total === 1 ? "pieza disponible cargada" : "piezas disponibles cargadas"}.`;
  }

  function normalizarProducto(row) {
    const fotos = [...(row.fotos || [])]
      .filter((foto) => foto && foto.url)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((foto) => foto.url);

    return {
      uuid: String(row.id || "").trim(),
      id: String(row.folio || row.id || "").trim(),
      pieza: limpiar(row.pieza),
      marca: limpiar(row.marca),
      modelo: limpiar(row.modelo),
      anio: limpiar(row.anio),
      color: limpiar(row.color),
      lado: limpiar(row.lado),
      estado: limpiar(row.estado) || "Disponible",
      precio: row.precio,
      numeroParte: limpiar(row.numero_parte),
      descripcion: limpiar(row.descripcion),
      disponible: Boolean(row.disponible),
      fotos
    };
  }

  function limpiar(valor) { return String(valor ?? "").trim(); }

  function normalizar(texto) {
    return limpiar(texto)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function textoProducto(p) {
    return normalizar([
      p.id, p.pieza, p.marca, p.modelo, p.anio, p.color, p.lado, p.estado, p.numeroParte, p.descripcion
    ].join(" "));
  }

  function getFiltros() {
    return {
      busqueda: normalizar(id("searchInput")?.value || ""),
      pieza: id("piezaSelect")?.value || "",
      marca: id("marcaSelect")?.value || "",
      modelo: id("modeloSelect")?.value || "",
      anio: id("anioSelect")?.value || "",
      lado: id("ladoSelect")?.value || ""
    };
  }

  function filtrar() {
    const f = getFiltros();

    filtrados = productos.filter((p) => {
      const coincideBusqueda = !f.busqueda || textoProducto(p).includes(f.busqueda);
      const coincidePieza = !f.pieza || p.pieza === f.pieza;
      const coincideMarca = !f.marca || p.marca === f.marca;
      const coincideModelo = !f.modelo || p.modelo === f.modelo;
      const coincideAnio = !f.anio || productoIncluyeAnio(p, f.anio);
      const coincideLado = !f.lado || p.lado === f.lado;
      return coincideBusqueda && coincidePieza && coincideMarca && coincideModelo && coincideAnio && coincideLado;
    });

    piezasVisibles = PAGE_SIZE;
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
    select.innerHTML = `<option value="">${escapar(etiqueta)}</option>` + valores.map((valor) => `<option value="${escaparAttr(valor)}">${escapar(valor)}</option>`).join("");
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
    if (fotos) fotos.textContent = lista.filter((p) => p.fotos.length).length;

    [total, marcas, fotos].forEach((el) => el?.classList.remove("stat-loading"));
  }

  function mostrarProductos(lista) {
    const grid = id("productsGrid");
    const template = id("productTemplate");
    if (!grid || !template) return;

    const total = lista.length;
    const visibles = lista.slice(0, piezasVisibles);

    grid.innerHTML = "";
    grid.classList.toggle("one-item", visibles.length === 1);
    grid.classList.toggle("two-items", visibles.length === 2);

    if (!total) {
      grid.innerHTML = `
        <div class="empty">
          <h3>No encontramos piezas con esos filtros</h3>
          <p>Prueba con otra búsqueda o escríbenos por WhatsApp para revisar disponibilidad.</p>
        </div>`;
      actualizarBotonCargarMas(0, 0);
      setStatus("No hay resultados con esos filtros.", "");
      return;
    }

    const fragment = document.createDocumentFragment();

    visibles.forEach((producto, index) => {
      const node = template.content.cloneNode(true);
      const card = node.querySelector(".product-card");
      const photoBtn = node.querySelector(".product-photo");
      const img = node.querySelector("img");
      const count = node.querySelector(".photo-count");
      const title = node.querySelector("h3");
      const meta = node.querySelector(".meta");
      const details = node.querySelector(".details");
      const price = node.querySelector(".price");
      const viewBtn = node.querySelector(".view-btn");
      const cartBtn = node.querySelector(".cart-btn");

      node.querySelector(".id-tag").textContent = `ID: ${producto.id || "N/A"}`;
      node.querySelector(".status-tag").textContent = producto.estado || "Disponible";
      title.textContent = tituloProducto(producto);
      meta.textContent = [producto.marca, producto.modelo, producto.anio].filter(Boolean).join(" · ") || "Autoparte disponible";
      details.innerHTML = detalleHTML("Lado", producto.lado) + detalleHTML("Color", producto.color) + detalleHTML("No. parte", producto.numeroParte) + detalleHTML("Estado", producto.estado);
      price.textContent = formatearPrecio(producto.precio);
      card.style.setProperty("--card-index", String(index));

      const abrir = () => abrirDetalle(producto);
      card.addEventListener("click", abrir);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          abrirDetalle(producto);
        }
      });
      viewBtn.addEventListener("click", (event) => { event.stopPropagation(); abrirDetalle(producto); });
      cartBtn.addEventListener("click", (event) => { event.stopPropagation(); agregarAlCarrito(producto); });
      photoBtn.addEventListener("click", (event) => { event.stopPropagation(); abrirDetalle(producto); });

      if (producto.fotos.length) {
        img.src = producto.fotos[0];
        img.alt = tituloProducto(producto);
        img.loading = "lazy";
        img.decoding = "async";
        img.fetchPriority = index < 3 ? "auto" : "low";
        count.textContent = `${producto.fotos.length} foto${producto.fotos.length === 1 ? "" : "s"}`;
      } else {
        img.remove();
        count.textContent = "Sin foto";
        photoBtn.classList.add("sin-foto");
        photoBtn.insertAdjacentHTML("afterbegin", "<span>Sin foto</span>");
      }

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    actualizarBotonCargarMas(total, visibles.length);
    actualizarEstadoCatalogo(total, visibles.length);
  }

  function actualizarEstadoCatalogo(total, visibles) {
    if (!total) return;
    const hayFiltros = filtrosActivos();
    const unidad = total === 1 ? "pieza" : "piezas";
    const contexto = hayFiltros ? "resultado" : `${unidad} disponible${total === 1 ? "" : "s"}`;

    if (visibles < total) {
      setStatus(`Mostrando ${visibles} de ${total} ${contexto}.`, "ok");
      return;
    }

    if (hayFiltros) {
      setStatus(`${total} ${total === 1 ? "resultado" : "resultados"} encontrados.`, "ok");
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

  function tituloProducto(p) {
    return [p.pieza, p.lado, p.marca, p.modelo, p.anio].filter(Boolean).join(" ") || "Autoparte disponible";
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
    id("detailList").innerHTML = detalleHTML("Pieza", producto.pieza) + detalleHTML("Marca", producto.marca) + detalleHTML("Modelo", producto.modelo) + detalleHTML("Año", producto.anio) + detalleHTML("Lado", producto.lado) + detalleHTML("Color", producto.color) + detalleHTML("No. parte", producto.numeroParte) + detalleHTML("Estado", producto.estado);

    pintarFotoDetalle();
    pintarThumbsDetalle();

    id("detailModal").classList.add("open");
    id("detailModal").setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function pintarFotoDetalle() {
    if (!productoDetalle) return;
    const fotos = productoDetalle.fotos;
    const img = id("detailImage");
    const count = id("detailPhotoCount");
    if (fotos.length) {
      img.src = fotos[indiceFotoDetalle];
      img.alt = tituloProducto(productoDetalle);
      count.textContent = `${indiceFotoDetalle + 1} / ${fotos.length}`;
    } else {
      img.removeAttribute("src");
      img.alt = "Sin foto disponible";
      count.textContent = "Sin foto";
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
      btn.innerHTML = `<img src="${escaparAttr(url)}" alt="Miniatura ${index + 1}">`;
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

  function crearWhatsAppProducto(p) {
    const mensaje = [
      "Hola, quiero revisar esta autoparte:",
      "",
      `ID: ${p.id || "N/A"}`,
      `Pieza: ${tituloProducto(p)}`,
      `Número de parte: ${p.numeroParte || "N/A"}`,
      `Precio: ${formatearPrecio(p.precio)}`,
      "",
      "Entiendo que están ubicados en Ecatepec, Estado de México.",
      "¿Me puedes confirmar disponibilidad, compatibilidad y forma de pago?"
    ].join("\n");
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
            url: "https://www.autopartesvences.com/",
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

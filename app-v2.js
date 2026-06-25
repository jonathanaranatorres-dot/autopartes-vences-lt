(() => {
  const WHATSAPP = window.AV_CONFIG?.WHATSAPP_NUMBER || "525632753982";
  const db = window.autopartesSupabase || window.avDB;

  let productos = [];
  let filtrados = [];
  let galeriaActual = [];
  let indiceFoto = 0;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const id = (nombre) => document.getElementById(nombre);

  document.addEventListener("DOMContentLoaded", iniciar);

  function iniciar() {
    activarMenu();
    conectarEventos();
    cargarInventario();
  }

  function activarMenu() {
    id("menuBtn")?.addEventListener("click", () => id("navLinks")?.classList.toggle("open"));
    $$("#navLinks a").forEach((link) => link.addEventListener("click", () => id("navLinks")?.classList.remove("open")));
  }

  function conectarEventos() {
    id("searchInput")?.addEventListener("input", filtrar);
    id("marcaSelect")?.addEventListener("change", () => {
      llenarSelect("modeloSelect", valoresUnicos(productos.filter(p => !id("marcaSelect").value || p.marca === id("marcaSelect").value), "modelo"), "Todos");
      llenarSelect("anioSelect", valoresUnicos(productos, "anio"), "Todos");
      filtrar();
    });
    id("modeloSelect")?.addEventListener("change", filtrar);
    id("anioSelect")?.addEventListener("change", filtrar);
    id("refreshBtn")?.addEventListener("click", cargarInventario);
    id("modalBackdrop")?.addEventListener("click", cerrarModal);
    id("modalClose")?.addEventListener("click", cerrarModal);
    id("modalPrev")?.addEventListener("click", () => cambiarFoto(-1));
    id("modalNext")?.addEventListener("click", () => cambiarFoto(1));
    document.addEventListener("keydown", (event) => {
      if (!id("photoModal")?.classList.contains("open")) return;
      if (event.key === "Escape") cerrarModal();
      if (event.key === "ArrowLeft") cambiarFoto(-1);
      if (event.key === "ArrowRight") cambiarFoto(1);
    });
  }

  async function cargarInventario() {
    setStatus("Cargando inventario...", "");

    if (!db) {
      setStatus("No se encontró la conexión con Supabase. Revisa supabase-config.js.", "err");
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

    llenarSelect("marcaSelect", valoresUnicos(productos, "marca"), "Todas");
    llenarSelect("modeloSelect", valoresUnicos(productos, "modelo"), "Todos");
    llenarSelect("anioSelect", valoresUnicos(productos, "anio"), "Todos");
    actualizarStats(productos);
    mostrarProductos(productos);
    setStatus(`${productos.length} piezas disponibles cargadas.`, "ok");
  }

  function normalizarProducto(row) {
    const fotos = [...(row.fotos || [])]
      .filter((foto) => foto && foto.url)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((foto) => foto.url);

    return {
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

  function limpiar(valor) {
    return String(valor ?? "").trim();
  }

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

  function filtrar() {
    const busqueda = normalizar(id("searchInput")?.value || "");
    const marca = id("marcaSelect")?.value || "";
    const modelo = id("modeloSelect")?.value || "";
    const anio = id("anioSelect")?.value || "";

    filtrados = productos.filter((p) => {
      const coincideBusqueda = !busqueda || textoProducto(p).includes(busqueda);
      const coincideMarca = !marca || p.marca === marca;
      const coincideModelo = !modelo || p.modelo === modelo;
      const coincideAnio = !anio || p.anio === anio;
      return coincideBusqueda && coincideMarca && coincideModelo && coincideAnio;
    });

    mostrarProductos(filtrados);
    setStatus(`${filtrados.length} resultado(s).`, filtrados.length ? "ok" : "");
  }

  function valoresUnicos(lista, campo) {
    return [...new Set(lista.map((p) => p[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  }

  function llenarSelect(selectId, valores, etiqueta) {
    const select = id(selectId);
    if (!select) return;
    const valorActual = select.value;
    select.innerHTML = `<option value="">${escapar(etiqueta)}</option>` + valores.map((valor) => `<option value="${escaparAttr(valor)}">${escapar(valor)}</option>`).join("");
    if (valores.includes(valorActual)) select.value = valorActual;
  }

  function actualizarStats(lista) {
    id("statTotal").textContent = lista.length;
    id("statMarcas").textContent = valoresUnicos(lista, "marca").length;
    id("statConFotos").textContent = lista.filter((p) => p.fotos.length).length;
  }

  function mostrarProductos(lista) {
    const grid = id("productsGrid");
    const template = id("productTemplate");
    if (!grid || !template) return;

    grid.innerHTML = "";

    if (!lista.length) {
      grid.innerHTML = `
        <div class="empty">
          <h3>No hay piezas para mostrar</h3>
          <p>Sube piezas desde el panel admin o revisa los filtros.</p>
        </div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    lista.forEach((producto) => {
      const node = template.content.cloneNode(true);
      const card = node.querySelector(".product-card");
      const photoBtn = node.querySelector(".product-photo");
      const img = node.querySelector("img");
      const count = node.querySelector(".photo-count");
      const title = node.querySelector("h3");
      const meta = node.querySelector(".meta");
      const details = node.querySelector(".details");
      const price = node.querySelector(".price");
      const whatsapp = node.querySelector(".whatsapp-btn");

      node.querySelector(".id-tag").textContent = `ID: ${producto.id || "N/A"}`;
      node.querySelector(".status-tag").textContent = producto.estado || "Disponible";
      title.textContent = tituloProducto(producto);
      meta.textContent = [producto.marca, producto.modelo, producto.anio].filter(Boolean).join(" · ") || "Autoparte disponible";
      details.innerHTML = detalleHTML("Lado", producto.lado) + detalleHTML("Color", producto.color) + detalleHTML("No. parte", producto.numeroParte) + detalleHTML("Estado", producto.estado);
      price.textContent = formatearPrecio(producto.precio);
      whatsapp.href = crearWhatsApp(producto);

      if (producto.fotos.length) {
        img.src = producto.fotos[0];
        img.alt = tituloProducto(producto);
        count.textContent = `${producto.fotos.length} foto${producto.fotos.length === 1 ? "" : "s"}`;
        photoBtn.addEventListener("click", () => abrirModal(producto));
      } else {
        img.remove();
        count.textContent = "Sin foto";
        photoBtn.classList.add("sin-foto");
        photoBtn.insertAdjacentHTML("afterbegin", "<span>Sin foto</span>");
        photoBtn.disabled = true;
      }

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
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

  function crearWhatsApp(p) {
    const mensaje = [
      "Hola, quiero revisar esta autoparte:",
      "",
      `ID: ${p.id || "N/A"}`,
      `Pieza: ${tituloProducto(p)}`,
      `Precio: ${formatearPrecio(p.precio)}`,
      "",
      "¿Me puedes confirmar disponibilidad y compatibilidad?"
    ].join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
  }

  function abrirModal(producto) {
    if (!producto.fotos.length) return;
    galeriaActual = producto.fotos;
    indiceFoto = 0;
    id("photoModal").classList.add("open");
    id("photoModal").setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    pintarFotoModal(producto);
  }

  function pintarFotoModal(producto) {
    id("modalImage").src = galeriaActual[indiceFoto];
    id("modalImage").alt = tituloProducto(producto || {});
    id("modalCaption").textContent = `${indiceFoto + 1} / ${galeriaActual.length}`;
  }

  function cambiarFoto(direccion) {
    if (!galeriaActual.length) return;
    indiceFoto = (indiceFoto + direccion + galeriaActual.length) % galeriaActual.length;
    id("modalImage").src = galeriaActual[indiceFoto];
    id("modalCaption").textContent = `${indiceFoto + 1} / ${galeriaActual.length}`;
  }

  function cerrarModal() {
    id("photoModal")?.classList.remove("open");
    id("photoModal")?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    id("modalImage").src = "";
    galeriaActual = [];
    indiceFoto = 0;
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

  function escaparAttr(texto) {
    return escapar(texto).replaceAll("`", "&#096;");
  }
})();

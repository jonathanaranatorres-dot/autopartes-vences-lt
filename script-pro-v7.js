(() => {
  const WHATSAPP = "525632753982";
  const STORAGE_KEY = "carritoAutopartesVences";

  let todosLosProductos = [];
  let productosFiltrados = [];
  let categoriaActiva = "";
  let carrito = [];
  let toastTimer = null;

  document.addEventListener("DOMContentLoaded", iniciar);

  function iniciar() {
    carrito = leerCarrito();

    crearModalProducto();
    crearCarrito();
    crearToast();
    activarMenu();
    activarChipsCategorias();
    conectarEventosBase();

    cargarInventario();
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function id(nombre) {
    return document.getElementById(nombre);
  }

  function conectarEventosBase() {
    id("busqueda")?.addEventListener("input", filtrar);
    id("filtroMarca")?.addEventListener("change", () => {
      cargarModelos(filtrarSoloPorMarca());
      cargarAnios(filtrarSoloPorMarcaYModelo());
      filtrar();
    });
    id("filtroModelo")?.addEventListener("change", () => {
      cargarAnios(filtrarSoloPorMarcaYModelo());
      filtrar();
    });
    id("filtroAnio")?.addEventListener("change", filtrar);
    id("limpiarFiltros")?.addEventListener("click", limpiarFiltros);
    id("compartirCatalogo")?.addEventListener("click", compartirCatalogo);
    id("navCartBtn")?.addEventListener("click", abrirCarrito);
  }

  function activarMenu() {
    const menuToggle = id("menuToggle");
    const navLinks = id("navLinks");

    if (!menuToggle || !navLinks) return;

    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("abierto");
    });

    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => navLinks.classList.remove("abierto"));
    });
  }

  function activarChipsCategorias() {
    const chips = id("chipsCategorias");
    if (!chips) return;

    chips.addEventListener("click", event => {
      const boton = event.target.closest("button");
      if (!boton) return;

      categoriaActiva = boton.dataset.chip || "";

      chips.querySelectorAll("button").forEach(chip => chip.classList.remove("activo"));
      boton.classList.add("activo");

      filtrar();
    });

    const primerChip = chips.querySelector("button");
    if (primerChip) primerChip.classList.add("activo");
  }

  function cargarInventario() {
    fetch("datos.json?v=17")
      .then(response => {
        if (!response.ok) throw new Error("No se pudo cargar datos.json");
        return response.json();
      })
      .then(data => {
        todosLosProductos = normalizarInventario(data);
        productosFiltrados = todosLosProductos;

        cargarMarcas(todosLosProductos);
        cargarModelos(todosLosProductos);
        cargarAnios(todosLosProductos);
        actualizarEstadisticas(todosLosProductos);
        mostrarProductos(todosLosProductos);
        actualizarCarrito();
      })
      .catch(error => {
        console.error(error);
        const contador = id("contador");
        const contenedor = id("productos") || $(".productos");

        if (contador) contador.textContent = "No se pudo cargar el inventario.";
        if (contenedor) {
          contenedor.innerHTML = `
            <div class="mensaje-vacio">
              <h2>Error cargando inventario</h2>
              <p>Revisa que el archivo datos.json esté en la misma carpeta que index.html.</p>
            </div>
          `;
        }
      });
  }

  function normalizarInventario(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.productos)) return data.productos;
    if (Array.isArray(data.inventario)) return data.inventario;
    return [];
  }

  function normalizarTexto(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function textoBusqueda(texto) {
    return normalizarTexto(texto).replace(/[^a-z0-9]/g, "");
  }

  function escaparHTML(texto) {
    return String(texto ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function obtenerValor(producto, nombres) {
    if (!producto || typeof producto !== "object") return "";

    const llaves = Object.keys(producto);

    for (const nombre of nombres) {
      const objetivo = textoBusqueda(nombre);

      for (const llave of llaves) {
        if (textoBusqueda(llave) === objetivo) {
          return producto[llave] ?? "";
        }
      }
    }

    return "";
  }

  function obtenerDatosProducto(producto, indice = 0) {
    const idProducto = obtenerValor(producto, ["id", "ID", "sku", "SKU", "codigo", "Código"]) || `AV-${String(indice + 1).padStart(4, "0")}`;

    const fotosExtra = [
      obtenerValor(producto, ["foto2", "Foto 2", "imagen2", "Imagen 2"]),
      obtenerValor(producto, ["foto3", "Foto 3", "imagen3", "Imagen 3"]),
      obtenerValor(producto, ["foto4", "Foto 4", "imagen4", "Imagen 4"]),
      obtenerValor(producto, ["foto5", "Foto 5", "imagen5", "Imagen 5"]),
      obtenerValor(producto, ["foto6", "Foto 6", "imagen6", "Imagen 6"])
    ].filter(Boolean);

    return {
      id: String(idProducto),
      marca: obtenerValor(producto, ["marca", "Marca"]),
      modelo: obtenerValor(producto, ["modelo", "Modelo"]),
      anio: obtenerValor(producto, ["anio", "año", "Año", "year", "Year"]),
      pieza: obtenerValor(producto, ["pieza", "Pieza", "nombre", "Nombre", "producto", "Producto"]),
      lado: obtenerValor(producto, ["lado", "Lado", "posición", "posicion", "Ubicacion", "ubicación"]),
      color: obtenerValor(producto, ["color", "Color"]),
      estado: obtenerValor(producto, ["estado", "Estado", "condicion", "Condición"]),
      precio: obtenerValor(producto, ["precio", "Precio", "costo", "Costo"]),
      numeroParte: obtenerValor(producto, ["numero_parte", "número de parte", "numero de parte", "No Parte", "no_parte", "parte"]),
      fotoPrincipal: obtenerValor(producto, [
        "fotoPrincipal",
        "Foto Principal",
        "foto principal",
        "Foto_Principal",
        "foto_principal",
        "imagen",
        "Imagen",
        "foto",
        "Foto"
      ]),
      linkFotos: obtenerValor(producto, ["link", "Link", "galeria", "Galería", "fotos", "Fotos"]),
      fotosExtra
    };
  }

  function convertirDriveAImagen(link) {
    if (!link) return "";

    const texto = String(link).trim();

    if (texto.includes("drive.google.com")) {
      let driveId = "";

      const matchFile = texto.match(/\/d\/([^/]+)/);
      if (matchFile && matchFile[1]) driveId = matchFile[1];

      const matchId = texto.match(/[?&]id=([^&]+)/);
      if (!driveId && matchId && matchId[1]) driveId = matchId[1];

      if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
    }

    return texto;
  }

  function formatearPrecio(precio) {
    const limpio = String(precio || "").replace(/,/g, "").replace(/[^0-9.]/g, "");
    const numero = Number(limpio);

    if (!numero) return precio ? String(precio) : "Consultar";

    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0
    }).format(numero);
  }


  function obtenerNumeroPrecio(precio) {
    const limpio = String(precio || "").replace(/,/g, "").replace(/[^0-9.]/g, "");
    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
  }

  function calcularTotalCarrito() {
    return carrito.reduce((total, item) => total + obtenerNumeroPrecio(item.precio), 0);
  }

  function valoresUnicos(productos, nombresCampo) {
    return [
      ...new Set(
        productos
          .map(producto => obtenerValor(producto, nombresCampo))
          .filter(valor => String(valor).trim() !== "")
      )
    ].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
  }

  function limpiarSelect(selectId, textoInicial) {
    const select = id(selectId);
    if (!select) return;
    select.innerHTML = `<option value="">${escaparHTML(textoInicial)}</option>`;
  }

  function cargarMarcas(productos) {
    limpiarSelect("filtroMarca", "Todas");

    const select = id("filtroMarca");
    if (!select) return;

    valoresUnicos(productos, ["marca", "Marca"]).forEach(marca => {
      select.insertAdjacentHTML("beforeend", `<option value="${escaparHTML(marca)}">${escaparHTML(marca)}</option>`);
    });
  }

  function cargarModelos(productos) {
    limpiarSelect("filtroModelo", "Todos");

    const select = id("filtroModelo");
    if (!select) return;

    valoresUnicos(productos, ["modelo", "Modelo"]).forEach(modelo => {
      select.insertAdjacentHTML("beforeend", `<option value="${escaparHTML(modelo)}">${escaparHTML(modelo)}</option>`);
    });
  }

  function cargarAnios(productos) {
    limpiarSelect("filtroAnio", "Todos");

    const select = id("filtroAnio");
    if (!select) return;

    valoresUnicos(productos, ["anio", "año", "Año"]).forEach(anio => {
      select.insertAdjacentHTML("beforeend", `<option value="${escaparHTML(anio)}">${escaparHTML(anio)}</option>`);
    });
  }

  function actualizarEstadisticas(productos) {
    const total = productos.length;
    const marcas = valoresUnicos(productos, ["marca", "Marca"]).length;
    const fotos = productos.filter((producto, index) => obtenerDatosProducto(producto, index).fotoPrincipal).length;

    if (id("statTotal")) id("statTotal").textContent = total;
    if (id("statMarcas")) id("statMarcas").textContent = marcas;
    if (id("statFotos")) id("statFotos").textContent = fotos;
  }

  function filtrarSoloPorMarca() {
    const marcaSeleccionada = id("filtroMarca")?.value || "";

    return todosLosProductos.filter(producto => {
      const marca = obtenerValor(producto, ["marca", "Marca"]);
      return !marcaSeleccionada || marca === marcaSeleccionada;
    });
  }

  function filtrarSoloPorMarcaYModelo() {
    const marcaSeleccionada = id("filtroMarca")?.value || "";
    const modeloSeleccionado = id("filtroModelo")?.value || "";

    return todosLosProductos.filter(producto => {
      const marca = obtenerValor(producto, ["marca", "Marca"]);
      const modelo = obtenerValor(producto, ["modelo", "Modelo"]);

      return (!marcaSeleccionada || marca === marcaSeleccionada) &&
        (!modeloSeleccionado || modelo === modeloSeleccionado);
    });
  }

  function filtrar() {
    const texto = textoBusqueda(id("busqueda")?.value || "");
    const marcaSeleccionada = id("filtroMarca")?.value || "";
    const modeloSeleccionado = id("filtroModelo")?.value || "";
    const anioSeleccionado = id("filtroAnio")?.value || "";
    const categoria = textoBusqueda(categoriaActiva);

    productosFiltrados = todosLosProductos.filter((producto, index) => {
      const datos = obtenerDatosProducto(producto, index);

      const textoProducto = textoBusqueda(`
        ${datos.id}
        ${datos.marca}
        ${datos.modelo}
        ${datos.anio}
        ${datos.pieza}
        ${datos.lado}
        ${datos.color}
        ${datos.estado}
        ${datos.numeroParte}
      `);

      return textoProducto.includes(texto) &&
        (!categoria || textoBusqueda(datos.pieza).includes(categoria)) &&
        (!marcaSeleccionada || datos.marca === marcaSeleccionada) &&
        (!modeloSeleccionado || datos.modelo === modeloSeleccionado) &&
        (!anioSeleccionado || String(datos.anio) === String(anioSeleccionado));
    });

    mostrarProductos(productosFiltrados);
  }

  function limpiarFiltros() {
    if (id("busqueda")) id("busqueda").value = "";
    if (id("filtroMarca")) id("filtroMarca").value = "";

    cargarModelos(todosLosProductos);
    cargarAnios(todosLosProductos);

    if (id("filtroModelo")) id("filtroModelo").value = "";
    if (id("filtroAnio")) id("filtroAnio").value = "";

    categoriaActiva = "";
    id("chipsCategorias")?.querySelectorAll("button").forEach((chip, index) => {
      chip.classList.toggle("activo", index === 0);
    });

    mostrarProductos(todosLosProductos);
  }

  function compartirCatalogo() {
    const datos = {
      title: "AUTOPARTES VENCES",
      text: "Catálogo digital de autopartes disponibles.",
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(datos).catch(() => {});
      return;
    }

    navigator.clipboard?.writeText(window.location.href);
    alert("Link del catálogo copiado.");
  }

  function mostrarProductos(productos) {
    const contenedor = id("productos") || $(".productos");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    const contador = id("contador");
    if (contador) {
      contador.innerHTML = `Mostrando <strong>${productos.length}</strong> de <strong>${todosLosProductos.length}</strong> piezas publicadas`;
    }

    if (productos.length === 0) {
      contenedor.innerHTML = `
        <div class="mensaje-vacio">
          <h2>No encontramos piezas con esos filtros</h2>
          <p>Intenta cambiar marca, modelo, año o escríbenos por WhatsApp para revisar disponibilidad.</p>
          <a href="https://wa.me/${WHATSAPP}?text=Hola,%20busco%20una%20autoparte%20que%20no%20aparece%20en%20el%20cat%C3%A1logo" target="_blank" rel="noopener">
            Preguntar por WhatsApp
          </a>
        </div>
      `;
      return;
    }

    const html = productos.map((producto, index) => {
      const datos = obtenerDatosProducto(producto, index);
      const foto = convertirDriveAImagen(datos.fotoPrincipal);
      const titulo = `${datos.pieza || "Autoparte"} ${datos.lado || ""}`.trim();
      const subtitulo = `${datos.marca || ""} ${datos.modelo || ""} ${datos.anio || ""}`.trim();

      const mensajeWhatsApp = encodeURIComponent(
        `Hola, buen día. Vi esta pieza en el catálogo de AUTOPARTES VENCES y me interesa:\n\n` +
        `${titulo}\n` +
        `${subtitulo}\n` +
        `ID: ${datos.id || "N/C"}\n` +
        `Precio: ${formatearPrecio(datos.precio)}\n\n` +
        `¿Me pueden confirmar si sigue disponible y si es compatible con mi vehículo?\n\n` +
        `También quisiera saber si puedo recogerla en el negocio o si manejan envío.`
      );

      return `
        <article class="producto" data-id="${escaparHTML(datos.id)}">
          <div class="product-media">
            ${
              foto
                ? `<img class="foto-producto" src="${escaparHTML(foto)}" alt="${escaparHTML(titulo)} ${escaparHTML(subtitulo)}" loading="lazy">`
                : `<div class="sin-foto">Sin foto principal</div>`
            }
            <span class="product-badge">${escaparHTML(datos.estado || "Disponible")}</span>
          </div>

          <div class="product-body">
            <span class="product-id">ID ${escaparHTML(datos.id || "N/C")}</span>

            <h2>${escaparHTML(titulo)}</h2>
            <h3>${escaparHTML(subtitulo || "Consultar compatibilidad")}</h3>

            <div class="product-specs">
              <span><b>Lado</b>${escaparHTML(datos.lado || "N/C")}</span>
              <span><b>Color</b>${escaparHTML(datos.color || "N/C")}</span>
              <span><b>No. Parte</b>${escaparHTML(datos.numeroParte || "N/C")}</span>
            </div>

            <strong class="precio">${formatearPrecio(datos.precio)}</strong>

            <p class="envio-mini">Envíos a domicilio con cargo al cliente.</p>

            <div class="product-actions">
              <button type="button" class="btn-ver" data-action="ver" data-id="${escaparHTML(datos.id)}">Ver pieza</button>
              <button type="button" class="btn-carrito" data-action="agregar" data-id="${escaparHTML(datos.id)}">Agregar al carrito</button>
              <a href="https://wa.me/${WHATSAPP}?text=${mensajeWhatsApp}" target="_blank" rel="noopener" data-action="whatsapp">WhatsApp</a>
            </div>
          </div>
        </article>
      `;
    }).join("");

    contenedor.innerHTML = html;

    contenedor.querySelectorAll(".producto").forEach(card => {
      card.addEventListener("click", event => {
        const accion = event.target.closest("[data-action]");
        const productId = card.dataset.id;

        if (accion?.dataset.action === "agregar") {
          event.preventDefault();
          event.stopPropagation();
          agregarAlCarritoPorId(productId, { abrirPanel: true, toast: true });
          return;
        }

        if (accion?.dataset.action === "ver") {
          event.preventDefault();
          event.stopPropagation();
          abrirProductoPorId(productId);
          return;
        }

        if (accion?.dataset.action === "whatsapp") {
          event.stopPropagation();
          return;
        }

        abrirProductoPorId(productId);
      });
    });
  }

  function buscarProductoPorId(productId) {
    return todosLosProductos.find((producto, index) => {
      return String(obtenerDatosProducto(producto, index).id) === String(productId);
    });
  }

  function abrirProductoPorId(productId) {
    const producto = buscarProductoPorId(productId);
    if (!producto) return;
    abrirModalProducto(producto);
  }

  function crearModalProducto() {
    if (id("modalProducto")) return;

    const modal = document.createElement("div");
    modal.id = "modalProducto";
    modal.className = "modal-producto";
    modal.innerHTML = `
      <div class="modal-backdrop" data-cerrar-modal></div>
      <section class="modal-card" role="dialog" aria-modal="true" aria-label="Detalle de producto">
        <button class="modal-cerrar" type="button" data-cerrar-modal aria-label="Cerrar">×</button>
        <div id="modalContenido"></div>
      </section>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target.closest("[data-cerrar-modal]")) cerrarModalProducto();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") cerrarModalProducto();
    });
  }

  function abrirModalProducto(producto) {
    const index = todosLosProductos.indexOf(producto);
    const datos = obtenerDatosProducto(producto, index);
    const foto = convertirDriveAImagen(datos.fotoPrincipal);
    const titulo = `${datos.pieza || "Autoparte"} ${datos.lado || ""}`.trim();
    const subtitulo = `${datos.marca || ""} ${datos.modelo || ""} ${datos.anio || ""}`.trim();

    const mensajeWhatsApp = encodeURIComponent(
      `Hola, buen día. Vi esta pieza en el catálogo de AUTOPARTES VENCES y me interesa:\n\n` +
      `${titulo}\n` +
      `${subtitulo}\n` +
      `ID: ${datos.id || "N/C"}\n` +
      `No. Parte: ${datos.numeroParte || "N/C"}\n` +
      `Precio: ${formatearPrecio(datos.precio)}\n\n` +
      `¿Me pueden confirmar si sigue disponible y si es compatible con mi vehículo?\n\n` +
      `También quisiera saber si puedo recogerla en el negocio o si manejan envío.`
    );

    const contenido = id("modalContenido");
    if (!contenido) return;

    contenido.innerHTML = `
      <div class="detalle-grid">
        <div class="detalle-imagen">
          ${
            foto
              ? `<img src="${escaparHTML(foto)}" alt="${escaparHTML(titulo)}">`
              : `<div class="sin-foto detalle-sin-foto">Sin foto principal</div>`
          }

          ${
            datos.linkFotos
              ? `<a class="detalle-galeria" href="${escaparHTML(datos.linkFotos)}" target="_blank" rel="noopener">Ver galería completa</a>`
              : ""
          }
        </div>

        <div class="detalle-info">
          <span class="detalle-id">ID ${escaparHTML(datos.id || "N/C")}</span>

          <h2>${escaparHTML(titulo)}</h2>
          <h3>${escaparHTML(subtitulo || "Consultar compatibilidad")}</h3>

          <strong class="detalle-precio">${formatearPrecio(datos.precio)}</strong>

          <p class="detalle-aviso">
            Agrega esta pieza al carrito y envíanos el pedido por WhatsApp.
            Confirmamos disponibilidad, compatibilidad y costo de envío antes de cerrar la venta.
          </p>

          <div class="detalle-confianza">
            <span>Fotos reales</span>
            <span>Envío con cargo al cliente</span>
            <span>Confirmación por WhatsApp</span>
          </div>

          <div class="detalle-tabla">
            <p><b>Marca</b>${escaparHTML(datos.marca || "N/C")}</p>
            <p><b>Modelo</b>${escaparHTML(datos.modelo || "N/C")}</p>
            <p><b>Año</b>${escaparHTML(datos.anio || "N/C")}</p>
            <p><b>Pieza</b>${escaparHTML(datos.pieza || "N/C")}</p>
            <p><b>Lado</b>${escaparHTML(datos.lado || "N/C")}</p>
            <p><b>Color</b>${escaparHTML(datos.color || "N/C")}</p>
            <p><b>Estado</b>${escaparHTML(datos.estado || "N/C")}</p>
            <p><b>No. Parte</b>${escaparHTML(datos.numeroParte || "N/C")}</p>
          </div>

          <div class="detalle-acciones">
            <button type="button" data-modal-agregar="${escaparHTML(datos.id)}">Agregar al carrito</button>
            <a href="https://wa.me/${WHATSAPP}?text=${mensajeWhatsApp}" target="_blank" rel="noopener">Preguntar por WhatsApp</a>
          </div>
        </div>
      </div>
    `;

    contenido.querySelector("[data-modal-agregar]")?.addEventListener("click", () => {
      cerrarModalProducto();
      agregarAlCarritoPorId(datos.id, { abrirPanel: true, toast: true });
    });

    id("modalProducto")?.classList.add("activo");
    document.body.classList.add("bloqueado");
  }

  function cerrarModalProducto() {
    id("modalProducto")?.classList.remove("activo");
    document.body.classList.remove("bloqueado");
  }

  function crearCarrito() {
    if (id("panelCarrito")) return;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <button class="boton-carrito-flotante" type="button" id="abrirCarritoBtn">
        Carrito <span id="contadorCarrito">0</span>
      </button>

      <aside id="panelCarrito" class="panel-carrito" aria-label="Carrito de autopartes">
        <div class="carrito-head">
          <div>
            <span>AUTOPARTES VENCES</span>
            <h2>Carrito</h2>
          </div>
          <button type="button" id="cerrarCarritoBtn" aria-label="Cerrar carrito">×</button>
        </div>

        <p class="carrito-aviso">
          Envíos a domicilio con cargo al cliente. Confirmamos disponibilidad antes de cerrar la venta.
        </p>

        <div id="itemsCarrito" class="items-carrito"></div>

        <div class="carrito-total" id="carritoTotalBox">
          <div class="carrito-total-row">
            <span>Total estimado</span>
            <strong id="totalCarrito">$0</strong>
          </div>
          <small>Precio, disponibilidad y envío sujetos a confirmación por WhatsApp.</small>
        </div>

        <div class="carrito-footer">
          <button type="button" class="enviar-carrito" id="enviarCarritoBtn">
            Enviar carrito por WhatsApp
          </button>

          <button type="button" class="seguir-comprando" id="seguirComprandoBtn">
            Seguir comprando
          </button>

          <button type="button" class="vaciar-carrito" id="vaciarCarritoBtn">
            Vaciar carrito
          </button>
        </div>
      </aside>

      <div id="carritoSombra" class="carrito-sombra"></div>
    `;

    document.body.appendChild(wrapper);

    id("abrirCarritoBtn")?.addEventListener("click", abrirCarrito);
    id("cerrarCarritoBtn")?.addEventListener("click", cerrarCarrito);
    id("carritoSombra")?.addEventListener("click", cerrarCarrito);
    id("enviarCarritoBtn")?.addEventListener("click", enviarCarritoWhatsApp);
    id("seguirComprandoBtn")?.addEventListener("click", cerrarCarrito);
    id("vaciarCarritoBtn")?.addEventListener("click", vaciarCarrito);
  }

  function crearToast() {
    if (id("toastCarrito")) return;

    const toast = document.createElement("div");
    toast.id = "toastCarrito";
    toast.className = "toast-carrito";
    toast.textContent = "Pieza agregada al carrito";
    document.body.appendChild(toast);
  }

  function mostrarToast(mensaje) {
    const toast = id("toastCarrito");
    if (!toast) return;

    toast.textContent = mensaje;
    toast.classList.add("activo");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("activo");
    }, 1800);
  }

  function leerCarrito() {
    try {
      const datos = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(datos) ? datos : [];
    } catch {
      return [];
    }
  }

  function guardarCarrito() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(carrito));
  }

  function agregarAlCarritoPorId(productId, opciones = {}) {
    const producto = buscarProductoPorId(productId);
    if (!producto) return;

    const index = todosLosProductos.indexOf(producto);
    const datos = obtenerDatosProducto(producto, index);

    const yaExiste = carrito.some(item => String(item.id) === String(datos.id));

    if (!yaExiste) {
      carrito.push({
        id: datos.id,
        pieza: datos.pieza,
        marca: datos.marca,
        modelo: datos.modelo,
        anio: datos.anio,
        lado: datos.lado,
        precio: datos.precio
      });

      guardarCarrito();
      if (opciones.toast) mostrarToast("Pieza agregada al carrito");
    } else if (opciones.toast) {
      mostrarToast("Esta pieza ya está en el carrito");
    }

    actualizarCarrito();

    if (opciones.abrirPanel !== false) {
      abrirCarrito();
    }
  }

  function actualizarCarrito() {
    const contador = id("contadorCarrito");
    const navContador = id("navCartCount");
    const items = id("itemsCarrito");
    const totalBox = id("carritoTotalBox");
    const totalCarrito = id("totalCarrito");

    if (contador) contador.textContent = carrito.length;
    if (navContador) navContador.textContent = carrito.length;
    if (totalCarrito) totalCarrito.textContent = formatearPrecio(calcularTotalCarrito());
    if (totalBox) totalBox.style.display = carrito.length ? "block" : "none";
    if (!items) return;

    if (carrito.length === 0) {
      items.innerHTML = `
        <div class="carrito-vacio">
          <h3>Tu carrito está vacío</h3>
          <p>Selecciona una pieza del catálogo para armar tu pedido.</p>
        </div>
      `;
      return;
    }

    items.innerHTML = carrito.map(item => `
      <div class="item-carrito">
        <div>
          <h3>${escaparHTML(item.pieza || "Autoparte")} ${escaparHTML(item.lado || "")}</h3>
          <p>${escaparHTML(item.marca || "")} ${escaparHTML(item.modelo || "")} ${escaparHTML(item.anio || "")}</p>
          <strong>${formatearPrecio(item.precio)}</strong>
        </div>

        <button type="button" data-quitar="${escaparHTML(item.id)}">Quitar</button>
      </div>
    `).join("");

    items.querySelectorAll("[data-quitar]").forEach(boton => {
      boton.addEventListener("click", () => quitarDelCarrito(boton.dataset.quitar));
    });
  }

  function abrirCarrito() {
    id("panelCarrito")?.classList.add("activo");
    id("carritoSombra")?.classList.add("activo");
  }

  function cerrarCarrito() {
    id("panelCarrito")?.classList.remove("activo");
    id("carritoSombra")?.classList.remove("activo");
  }

  function quitarDelCarrito(productId) {
    carrito = carrito.filter(item => String(item.id) !== String(productId));
    guardarCarrito();
    actualizarCarrito();
    mostrarToast("Pieza retirada del carrito");
  }

  function vaciarCarrito() {
    carrito = [];
    guardarCarrito();
    actualizarCarrito();
    mostrarToast("Carrito vacío");
  }

  function enviarCarritoWhatsApp() {
    if (carrito.length === 0) {
      alert("Agrega al menos una pieza al carrito.");
      return;
    }

    const lista = carrito.map((item, index) => {
      return `${index + 1}. ${item.pieza || "Autoparte"} ${item.lado || ""} ${item.marca || ""} ${item.modelo || ""} ${item.anio || ""} | ID: ${item.id || "N/C"} | Precio: ${formatearPrecio(item.precio)}`;
    }).join("\n");

    const mensaje = encodeURIComponent(
      `Hola, buen día. Vi estas piezas en el catálogo de AUTOPARTES VENCES y me interesan:\n\n` +
      `${lista}\n\n` +
      `Total estimado: ${formatearPrecio(calcularTotalCarrito())}\n\n` +
      `¿Me pueden confirmar si siguen disponibles y si son compatibles con mi vehículo?\n\n` +
      `También quisiera saber si puedo recogerlas en el negocio o si manejan envío.`
    );

    window.open(`https://wa.me/${WHATSAPP}?text=${mensaje}`, "_blank");
  }
})();

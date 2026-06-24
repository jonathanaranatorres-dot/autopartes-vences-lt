let todosLosProductos = [];
let carrito = JSON.parse(localStorage.getItem("carritoAutopartesVences")) || [];

const WHATSAPP = "525632753982";

document.addEventListener("DOMContentLoaded", () => {
  crearModalProducto();
  crearCarrito();

  fetch("datos.json")
    .then(response => {
      if (!response.ok) throw new Error("No se pudo cargar datos.json");
      return response.json();
    })
    .then(productos => {
      todosLosProductos = productos;

      cargarMarcas(productos);
      cargarModelos(productos);
      cargarAnios(productos);
      pintarChipsMarcas(productos);
      actualizarEstadisticas(productos);
      mostrarProductos(productos);
      actualizarCarrito();

      document.getElementById("busqueda").addEventListener("input", filtrar);

      document.getElementById("filtroMarca").addEventListener("change", () => {
        const productosMarca = filtrarPorMarca();
        cargarModelos(productosMarca);
        cargarAnios(productosMarca);
        filtrar();
      });

      document.getElementById("filtroModelo").addEventListener("change", () => {
        const productosMarcaModelo = filtrarPorMarcaYModelo();
        cargarAnios(productosMarcaModelo);
        filtrar();
      });

      document.getElementById("filtroAnio").addEventListener("change", filtrar);
      document.getElementById("limpiarFiltros").addEventListener("click", limpiarFiltros);
      document.getElementById("compartirCatalogo").addEventListener("click", compartirCatalogo);
    })
    .catch(error => {
      console.error("Error cargando datos.json:", error);
      document.getElementById("contador").textContent = "No se pudo cargar el inventario.";
      document.querySelector(".productos").innerHTML = `
        <div class="mensaje-vacio">
          <h2>Error cargando inventario</h2>
          <p>Revisa que el archivo datos.json esté en la misma carpeta que index.html.</p>
        </div>
      `;
    });
});

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function escaparHTML(texto) {
  return String(texto || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function obtenerValor(producto, nombres) {
  const llaves = Object.keys(producto);

  for (let nombre of nombres) {
    const nombreNormalizado = normalizarTexto(nombre);

    for (let llave of llaves) {
      if (normalizarTexto(llave) === nombreNormalizado) {
        return producto[llave] || "";
      }
    }
  }

  return "";
}

function obtenerDatosProducto(producto) {
  return {
    id: obtenerValor(producto, ["id", "ID"]),
    marca: obtenerValor(producto, ["marca", "Marca"]),
    modelo: obtenerValor(producto, ["modelo", "Modelo"]),
    anio: obtenerValor(producto, ["anio", "año", "Año"]),
    pieza: obtenerValor(producto, ["pieza", "Pieza"]),
    lado: obtenerValor(producto, ["lado", "Lado"]),
    color: obtenerValor(producto, ["color", "Color"]),
    estado: obtenerValor(producto, ["estado", "Estado"]),
    precio: obtenerValor(producto, ["precio", "Precio"]),
    numeroParte: obtenerValor(producto, ["numero_parte", "Numero de Parte", "Número de Parte"]),
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
    linkFotos: obtenerValor(producto, ["link", "Link", "fotos", "Fotos"])
  };
}

function convertirDriveAImagen(link) {
  if (!link) return "";

  let id = "";

  const matchFile = String(link).match(/\/d\/([^/]+)/);
  if (matchFile && matchFile[1]) id = matchFile[1];

  const matchId = String(link).match(/[?&]id=([^&]+)/);
  if (!id && matchId && matchId[1]) id = matchId[1];

  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;

  return link;
}

function formatearPrecio(precio) {
  const numero = Number(String(precio || "").replace(/[^0-9.]/g, ""));

  if (!numero) return precio || "Consultar";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(numero);
}

function limpiarSelect(selectId, textoInicial) {
  const select = document.getElementById(selectId);
  select.innerHTML = `<option value="">${textoInicial}</option>`;
}

function valoresUnicos(productos, nombresCampo) {
  return [
    ...new Set(
      productos
        .map(producto => obtenerValor(producto, nombresCampo))
        .filter(valor => valor !== "")
    )
  ].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
}

function cargarMarcas(productos) {
  limpiarSelect("filtroMarca", "Todas las marcas");

  const select = document.getElementById("filtroMarca");

  valoresUnicos(productos, ["marca", "Marca"]).forEach(marca => {
    select.innerHTML += `<option value="${escaparHTML(marca)}">${escaparHTML(marca)}</option>`;
  });
}

function cargarModelos(productos) {
  limpiarSelect("filtroModelo", "Todos los modelos");

  const select = document.getElementById("filtroModelo");

  valoresUnicos(productos, ["modelo", "Modelo"]).forEach(modelo => {
    select.innerHTML += `<option value="${escaparHTML(modelo)}">${escaparHTML(modelo)}</option>`;
  });
}

function cargarAnios(productos) {
  limpiarSelect("filtroAnio", "Todos los años");

  const select = document.getElementById("filtroAnio");

  valoresUnicos(productos, ["anio", "año", "Año"]).forEach(anio => {
    select.innerHTML += `<option value="${escaparHTML(anio)}">${escaparHTML(anio)}</option>`;
  });
}

function pintarChipsMarcas(productos) {
  const contenedor = document.getElementById("marcasDestacadas");
  const marcas = valoresUnicos(productos, ["marca", "Marca"]);

  contenedor.innerHTML = "";

  marcas.forEach(marca => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = marca;

    boton.addEventListener("click", () => {
      document.getElementById("filtroMarca").value = marca;

      const productosMarca = filtrarPorMarca();

      cargarModelos(productosMarca);
      cargarAnios(productosMarca);
      filtrar();

      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
    });

    contenedor.appendChild(boton);
  });
}

function actualizarEstadisticas(productos) {
  const total = productos.length;
  const marcas = valoresUnicos(productos, ["marca", "Marca"]).length;
  const fotos = productos.filter(producto => obtenerDatosProducto(producto).fotoPrincipal).length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statMarcas").textContent = marcas;
  document.getElementById("statFotos").textContent = fotos;
}

function filtrarPorMarca() {
  const marcaSeleccionada = document.getElementById("filtroMarca").value;

  return todosLosProductos.filter(producto => {
    const marca = obtenerValor(producto, ["marca", "Marca"]);
    return !marcaSeleccionada || marca === marcaSeleccionada;
  });
}

function filtrarPorMarcaYModelo() {
  const marcaSeleccionada = document.getElementById("filtroMarca").value;
  const modeloSeleccionado = document.getElementById("filtroModelo").value;

  return todosLosProductos.filter(producto => {
    const marca = obtenerValor(producto, ["marca", "Marca"]);
    const modelo = obtenerValor(producto, ["modelo", "Modelo"]);

    return (!marcaSeleccionada || marca === marcaSeleccionada) &&
      (!modeloSeleccionado || modelo === modeloSeleccionado);
  });
}

function filtrar() {
  const texto = normalizarTexto(document.getElementById("busqueda").value);
  const marcaSeleccionada = document.getElementById("filtroMarca").value;
  const modeloSeleccionado = document.getElementById("filtroModelo").value;
  const anioSeleccionado = document.getElementById("filtroAnio").value;

  const filtrados = todosLosProductos.filter(producto => {
    const datos = obtenerDatosProducto(producto);

    const textoProducto = normalizarTexto(`
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
      (!marcaSeleccionada || datos.marca === marcaSeleccionada) &&
      (!modeloSeleccionado || datos.modelo === modeloSeleccionado) &&
      (!anioSeleccionado || datos.anio === anioSeleccionado);
  });

  mostrarProductos(filtrados);
}

function limpiarFiltros() {
  document.getElementById("busqueda").value = "";
  document.getElementById("filtroMarca").value = "";

  cargarModelos(todosLosProductos);
  cargarAnios(todosLosProductos);

  document.getElementById("filtroModelo").value = "";
  document.getElementById("filtroAnio").value = "";

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
  } else {
    navigator.clipboard.writeText(window.location.href);
    alert("Link del catálogo copiado.");
  }
}

function mostrarProductos(productos) {
  const contenedor = document.querySelector(".productos");

  contenedor.innerHTML = "";

  document.getElementById("contador").innerHTML =
    `Mostrando <strong>${productos.length}</strong> de <strong>${todosLosProductos.length}</strong> piezas disponibles`;

  if (productos.length === 0) {
    contenedor.innerHTML = `
      <div class="mensaje-vacio">
        <h2>No encontramos piezas con esos filtros</h2>
        <p>Intenta cambiar marca, modelo, año o escríbenos por WhatsApp para revisar disponibilidad.</p>
        <a href="https://wa.me/${WHATSAPP}?text=Hola,%20busco%20una%20autoparte%20que%20no%20aparece%20en%20el%20catálogo" target="_blank">
          Preguntar por WhatsApp
        </a>
      </div>
    `;
    return;
  }

  productos.forEach(producto => {
    const datos = obtenerDatosProducto(producto);
    const foto = convertirDriveAImagen(datos.fotoPrincipal);

    const titulo = `${datos.pieza} ${datos.lado || ""}`.trim();
    const subtitulo = `${datos.marca} ${datos.modelo} ${datos.anio}`.trim();

    const mensajeWhatsApp = encodeURIComponent(
      `Hola, me interesa esta autoparte:\n\n` +
      `${titulo}\n` +
      `${subtitulo}\n` +
      `ID: ${datos.id || "N/C"}\n` +
      `Precio: ${formatearPrecio(datos.precio)}\n\n` +
      `¿Me puedes confirmar disponibilidad, compatibilidad y envío?`
    );

    contenedor.innerHTML += `
      <article class="producto producto-click" data-id="${escaparHTML(datos.id)}">
        <div class="product-media">
          ${
            foto
              ? `<img class="foto-producto" src="${escaparHTML(foto)}" alt="${escaparHTML(titulo)} ${escaparHTML(subtitulo)}">`
              : `<div class="sin-foto">Sin foto principal</div>`
          }
          <span class="product-badge">${escaparHTML(datos.estado || "Disponible")}</span>
        </div>

        <div class="product-body">
          <span class="product-id">ID ${escaparHTML(datos.id || "N/C")}</span>

          <h2>${escaparHTML(titulo || "Autoparte")}</h2>
          <h3>${escaparHTML(subtitulo || "Consultar compatibilidad")}</h3>

          <div class="product-specs">
            <span><b>Lado</b>${escaparHTML(datos.lado || "N/C")}</span>
            <span><b>Color</b>${escaparHTML(datos.color || "N/C")}</span>
            <span><b>No. Parte</b>${escaparHTML(datos.numeroParte || "N/C")}</span>
          </div>

          <strong class="precio">${formatearPrecio(datos.precio)}</strong>

          <p class="envio-mini">Envíos a domicilio con cargo al cliente.</p>

          <div class="product-actions">
            <button type="button" class="btn-ver" onclick="abrirProductoPorId('${escaparHTML(datos.id)}')">
              Ver pieza
            </button>

            <button type="button" class="btn-carrito" onclick="agregarAlCarritoPorId('${escaparHTML(datos.id)}')">
              Agregar
            </button>

            <a href="https://wa.me/${WHATSAPP}?text=${mensajeWhatsApp}" target="_blank" onclick="event.stopPropagation()">
              WhatsApp
            </a>
          </div>
        </div>
      </article>
    `;
  });

  document.querySelectorAll(".producto-click").forEach(card => {
    card.addEventListener("click", event => {
      if (event.target.closest("button") || event.target.closest("a")) return;
      abrirProductoPorId(card.dataset.id);
    });
  });
}

function buscarProductoPorId(id) {
  return todosLosProductos.find(producto => {
    const datos = obtenerDatosProducto(producto);
    return String(datos.id) === String(id);
  });
}

function abrirProductoPorId(id) {
  const producto = buscarProductoPorId(id);
  if (!producto) return;

  abrirModalProducto(producto);
}

function crearModalProducto() {
  const modal = document.createElement("div");

  modal.id = "modalProducto";
  modal.className = "modal-producto";
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="cerrarModalProducto()"></div>

    <section class="modal-card">
      <button class="modal-cerrar" type="button" onclick="cerrarModalProducto()">×</button>
      <div id="modalContenido"></div>
    </section>
  `;

  document.body.appendChild(modal);
}

function abrirModalProducto(producto) {
  const datos = obtenerDatosProducto(producto);
  const foto = convertirDriveAImagen(datos.fotoPrincipal);

  const titulo = `${datos.pieza} ${datos.lado || ""}`.trim();
  const subtitulo = `${datos.marca} ${datos.modelo} ${datos.anio}`.trim();

  const mensajeWhatsApp = encodeURIComponent(
    `Hola, quiero cotizar esta pieza:\n\n` +
    `${titulo}\n` +
    `${subtitulo}\n` +
    `ID: ${datos.id || "N/C"}\n` +
    `No. Parte: ${datos.numeroParte || "N/C"}\n` +
    `Precio: ${formatearPrecio(datos.precio)}\n\n` +
    `Mi ubicación es: `
  );

  document.getElementById("modalContenido").innerHTML = `
    <div class="detalle-grid">
      <div class="detalle-imagen">
        ${
          foto
            ? `<img src="${escaparHTML(foto)}" alt="${escaparHTML(titulo)}">`
            : `<div class="sin-foto detalle-sin-foto">Sin foto principal</div>`
        }

        ${
          datos.linkFotos
            ? `<a class="detalle-galeria" href="${escaparHTML(datos.linkFotos)}" target="_blank">Ver galería completa</a>`
            : ""
        }
      </div>

      <div class="detalle-info">
        <span class="detalle-id">ID ${escaparHTML(datos.id || "N/C")}</span>

        <h2>${escaparHTML(titulo || "Autoparte")}</h2>
        <h3>${escaparHTML(subtitulo || "Consultar compatibilidad")}</h3>

        <strong class="detalle-precio">${formatearPrecio(datos.precio)}</strong>

        <p class="detalle-aviso">
          Envíos a domicilio con cargo al cliente. Confirmamos disponibilidad,
          compatibilidad y costo de envío antes de cerrar la venta.
        </p>

        <div class="detalle-tabla">
          <p><b>Marca:</b> ${escaparHTML(datos.marca || "N/C")}</p>
          <p><b>Modelo:</b> ${escaparHTML(datos.modelo || "N/C")}</p>
          <p><b>Año:</b> ${escaparHTML(datos.anio || "N/C")}</p>
          <p><b>Pieza:</b> ${escaparHTML(datos.pieza || "N/C")}</p>
          <p><b>Lado:</b> ${escaparHTML(datos.lado || "N/C")}</p>
          <p><b>Color:</b> ${escaparHTML(datos.color || "N/C")}</p>
          <p><b>Estado:</b> ${escaparHTML(datos.estado || "N/C")}</p>
          <p><b>No. Parte:</b> ${escaparHTML(datos.numeroParte || "N/C")}</p>
        </div>

        <div class="detalle-acciones">
          <button type="button" onclick="agregarAlCarritoPorId('${escaparHTML(datos.id)}')">
            Agregar a cotización
          </button>

          <a href="https://wa.me/${WHATSAPP}?text=${mensajeWhatsApp}" target="_blank">
            Cotizar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  `;

  document.getElementById("modalProducto").classList.add("activo");
  document.body.classList.add("bloqueado");
}

function cerrarModalProducto() {
  document.getElementById("modalProducto").classList.remove("activo");
  document.body.classList.remove("bloqueado");
}

function crearCarrito() {
  const carritoHTML = document.createElement("div");

  carritoHTML.innerHTML = `
    <button class="boton-carrito-flotante" type="button" onclick="abrirCarrito()">
      Cotización <span id="contadorCarrito">0</span>
    </button>

    <aside id="panelCarrito" class="panel-carrito">
      <div class="carrito-head">
        <div>
          <span>AUTOPARTES VENCES</span>
          <h2>Tu cotización</h2>
        </div>
        <button type="button" onclick="cerrarCarrito()">×</button>
      </div>

      <p class="carrito-aviso">
        Envíos a domicilio con cargo al cliente.
      </p>

      <div id="itemsCarrito" class="items-carrito"></div>

      <div class="carrito-footer">
        <button type="button" class="enviar-cotizacion" onclick="enviarCarritoWhatsApp()">
          Enviar cotización por WhatsApp
        </button>

        <button type="button" class="vaciar-carrito" onclick="vaciarCarrito()">
          Vaciar cotización
        </button>
      </div>
    </aside>

    <div id="carritoSombra" class="carrito-sombra" onclick="cerrarCarrito()"></div>
  `;

  document.body.appendChild(carritoHTML);
}

function agregarAlCarritoPorId(id) {
  const producto = buscarProductoPorId(id);
  if (!producto) return;

  const datos = obtenerDatosProducto(producto);

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
  }

  actualizarCarrito();
  abrirCarrito();
}

function guardarCarrito() {
  localStorage.setItem("carritoAutopartesVences", JSON.stringify(carrito));
}

function actualizarCarrito() {
  const contador = document.getElementById("contadorCarrito");
  const items = document.getElementById("itemsCarrito");

  if (!contador || !items) return;

  contador.textContent = carrito.length;

  if (carrito.length === 0) {
    items.innerHTML = `
      <div class="carrito-vacio">
        <h3>Aún no agregas piezas</h3>
        <p>Selecciona una pieza del catálogo para armar tu cotización.</p>
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

      <button type="button" onclick="quitarDelCarrito('${escaparHTML(item.id)}')">
        Quitar
      </button>
    </div>
  `).join("");
}

function abrirCarrito() {
  document.getElementById("panelCarrito").classList.add("activo");
  document.getElementById("carritoSombra").classList.add("activo");
}

function cerrarCarrito() {
  document.getElementById("panelCarrito").classList.remove("activo");
  document.getElementById("carritoSombra").classList.remove("activo");
}

function quitarDelCarrito(id) {
  carrito = carrito.filter(item => String(item.id) !== String(id));
  guardarCarrito();
  actualizarCarrito();
}

function vaciarCarrito() {
  carrito = [];
  guardarCarrito();
  actualizarCarrito();
}

function enviarCarritoWhatsApp() {
  if (carrito.length === 0) {
    alert("Agrega al menos una pieza a la cotización.");
    return;
  }

  const lista = carrito.map((item, index) => {
    return `${index + 1}. ${item.pieza || "Autoparte"} ${item.lado || ""} ${item.marca || ""} ${item.modelo || ""} ${item.anio || ""} | ID: ${item.id || "N/C"} | Precio: ${formatearPrecio(item.precio)}`;
  }).join("\n");

  const mensaje = encodeURIComponent(
    `Hola, quiero cotizar estas autopartes:\n\n` +
    `${lista}\n\n` +
    `Envío a domicilio con cargo al cliente.\n` +
    `Mi ubicación es: \n` +
    `¿Me puedes confirmar disponibilidad, compatibilidad y costo de envío?`
  );

  window.open(`https://wa.me/${WHATSAPP}?text=${mensaje}`, "_blank");
}

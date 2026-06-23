let todosLosProductos = [];

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
    actualizarEstadisticas(productos);
    mostrarProductos(productos);

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

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
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

function obtenerFotoPrincipal(producto) {
  return obtenerValor(producto, [
    "fotoPrincipal",
    "Foto Principal",
    "foto principal",
    "Foto_Principal",
    "foto_principal",
    "imagen",
    "Imagen",
    "foto",
    "Foto"
  ]);
}

function convertirDriveAImagen(link) {
  if (!link) return "";

  let id = "";

  const matchFile = String(link).match(/\/d\/([^/]+)/);

  if (matchFile && matchFile[1]) {
    id = matchFile[1];
  }

  const matchId = String(link).match(/[?&]id=([^&]+)/);

  if (!id && matchId && matchId[1]) {
    id = matchId[1];
  }

  if (id) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  }

  return link;
}

function formatearPrecio(precio) {
  const numero = Number(String(precio || "").replace(/[^0-9.]/g, ""));

  if (!numero) {
    return precio || "Consultar";
  }

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
    select.innerHTML += `<option value="${marca}">${marca}</option>`;
  });
}

function cargarModelos(productos) {
  limpiarSelect("filtroModelo", "Todos los modelos");

  const select = document.getElementById("filtroModelo");

  valoresUnicos(productos, ["modelo", "Modelo"]).forEach(modelo => {
    select.innerHTML += `<option value="${modelo}">${modelo}</option>`;
  });
}

function cargarAnios(productos) {
  limpiarSelect("filtroAnio", "Todos los años");

  const select = document.getElementById("filtroAnio");

  valoresUnicos(productos, ["anio", "año", "Año"]).forEach(anio => {
    select.innerHTML += `<option value="${anio}">${anio}</option>`;
  });
}

function actualizarEstadisticas(productos) {
  const total = productos.length;
  const marcas = valoresUnicos(productos, ["marca", "Marca"]).length;
  const fotos = productos.filter(producto => obtenerFotoPrincipal(producto)).length;

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
  const texto = document.getElementById("busqueda").value.toLowerCase();
  const marcaSeleccionada = document.getElementById("filtroMarca").value;
  const modeloSeleccionado = document.getElementById("filtroModelo").value;
  const anioSeleccionado = document.getElementById("filtroAnio").value;

  const filtrados = todosLosProductos.filter(producto => {
    const marca = obtenerValor(producto, ["marca", "Marca"]);
    const modelo = obtenerValor(producto, ["modelo", "Modelo"]);
    const anio = obtenerValor(producto, ["anio", "año", "Año"]);
    const pieza = obtenerValor(producto, ["pieza", "Pieza"]);
    const lado = obtenerValor(producto, ["lado", "Lado"]);
    const color = obtenerValor(producto, ["color", "Color"]);
    const estado = obtenerValor(producto, ["estado", "Estado"]);
    const numeroParte = obtenerValor(producto, [
      "numero_parte",
      "Numero de Parte",
      "Número de Parte"
    ]);

    const textoProducto = `${marca} ${modelo} ${anio} ${pieza} ${lado} ${color} ${estado} ${numeroParte}`.toLowerCase();

    return textoProducto.includes(texto) &&
      (!marcaSeleccionada || marca === marcaSeleccionada) &&
      (!modeloSeleccionado || modelo === modeloSeleccionado) &&
      (!anioSeleccionado || anio === anioSeleccionado);
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
        <a href="https://wa.me/525632753982?text=Hola,%20busco%20una%20autoparte%20que%20no%20aparece%20en%20el%20catálogo" target="_blank">
          Preguntar por WhatsApp
        </a>
      </div>
    `;

    return;
  }

  productos.forEach(producto => {
    const id = obtenerValor(producto, ["id", "ID"]);
    const marca = obtenerValor(producto, ["marca", "Marca"]);
    const modelo = obtenerValor(producto, ["modelo", "Modelo"]);
    const anio = obtenerValor(producto, ["anio", "año", "Año"]);
    const pieza = obtenerValor(producto, ["pieza", "Pieza"]);
    const lado = obtenerValor(producto, ["lado", "Lado"]);
    const color = obtenerValor(producto, ["color", "Color"]);
    const estado = obtenerValor(producto, ["estado", "Estado"]);
    const precio = obtenerValor(producto, ["precio", "Precio"]);
    const numeroParte = obtenerValor(producto, [
      "numero_parte",
      "Numero de Parte",
      "Número de Parte"
    ]);
    const linkFotos = obtenerValor(producto, ["link", "Link"]);
    const fotoPrincipal = obtenerFotoPrincipal(producto);
    const foto = convertirDriveAImagen(fotoPrincipal);

    const mensajeWhatsApp = encodeURIComponent(
      `Hola, me interesa esta autoparte: ${pieza} ${lado} ${marca} ${modelo} ${anio}. ID: ${id}`
    );

    contenedor.innerHTML += `
      <article class="producto">
        <div class="product-media">
          ${
            foto
              ? `<img src="${foto}" alt="${pieza} ${marca} ${modelo}" class="foto-producto" loading="lazy" onerror="this.outerHTML='<div class=\\'sin-foto\\'>Foto no disponible</div>'">`
              : `<div class="sin-foto">Sin foto principal</div>`
          }

          <span class="estado-badge">${estado || "Disponible"}</span>
        </div>

        <div class="product-body">
          <div class="id-line">ID ${id || "N/C"}</div>

          <h2>${pieza} ${lado || ""}</h2>

          <h3>${marca} ${modelo} ${anio}</h3>

          <div class="detalles">
            <p>
              <strong>Lado</strong>
              <span>${lado || "N/C"}</span>
            </p>

            <p>
              <strong>Color</strong>
              <span>${color || "N/C"}</span>
            </p>

            <p>
              <strong>No. Parte</strong>
              <span>${numeroParte || "N/C"}</span>
            </p>
          </div>

          <div class="precio">${formatearPrecio(precio)}</div>

          <div class="acciones-producto">
            <a href="https://wa.me/525632753982?text=${mensajeWhatsApp}" target="_blank">
              <button>WhatsApp</button>
            </a>

            ${
              linkFotos
                ? `<a href="${linkFotos}" target="_blank"><button class="btn-fotos">Ver fotos</button></a>`
                : `<button class="btn-fotos" type="button">Sin galería</button>`
            }
          </div>
        </div>
      </article>
    `;
  });
}
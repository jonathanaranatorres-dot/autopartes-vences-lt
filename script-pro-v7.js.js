/* AUTOPARTES VENCES - Catálogo público conectado a Supabase
   Reemplaza tu script.js actual por este archivo.
   Si Supabase todavía no está configurado, usa datos.json como respaldo. */

let todosLosProductos = [];
let galeriaActual = [];
let fotoActual = 0;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function obtenerValor(producto, nombres) {
  const llaves = Object.keys(producto || {});
  for (const nombre of nombres) {
    const nombreNormalizado = normalizarTexto(nombre);
    for (const llave of llaves) {
      if (normalizarTexto(llave) === nombreNormalizado) return producto[llave] || "";
    }
  }
  return "";
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

function productoDesdeSupabase(row) {
  const fotosOrdenadas = [...(row.fotos || [])]
    .filter((foto) => foto && foto.url)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  return {
    id: row.folio || row.id,
    pieza: row.pieza || "",
    marca: row.marca || "",
    modelo: row.modelo || "",
    anio: row.anio || "",
    color: row.color || "",
    lado: row.lado || "",
    estado: row.estado || (row.disponible ? "Disponible" : "Vendido"),
    precio: row.precio || "",
    numero_parte: row.numero_parte || "",
    descripcion: row.descripcion || "",
    disponible: row.disponible,
    fotos: fotosOrdenadas.map((foto) => foto.url),
    fotoPrincipal: fotosOrdenadas[0]?.url || "",
    _raw: row
  };
}

function productoDesdeJson(row) {
  const fotoPrincipal = obtenerValor(row, [
    "fotoPrincipal", "Foto Principal", "foto principal", "Foto_Principal",
    "foto_principal", "imagen", "Imagen", "foto", "Foto"
  ]);

  const linkFotos = obtenerValor(row, ["link", "Link", "fotos", "Fotos"]);

  return {
    ...row,
    id: obtenerValor(row, ["id", "ID"]),
    pieza: obtenerValor(row, ["pieza", "Pieza"]),
    marca: obtenerValor(row, ["marca", "Marca"]),
    modelo: obtenerValor(row, ["modelo", "Modelo"]),
    anio: obtenerValor(row, ["anio", "año", "Año"]),
    color: obtenerValor(row, ["color", "Color"]),
    lado: obtenerValor(row, ["lado", "Lado"]),
    estado: obtenerValor(row, ["estado", "Estado"]),
    precio: obtenerValor(row, ["precio", "Precio"]),
    numero_parte: obtenerValor(row, ["numero_parte", "Numero de Parte", "Número de Parte"]),
    link: linkFotos,
    fotoPrincipal: convertirDriveAImagen(fotoPrincipal),
    fotos: fotoPrincipal ? [convertirDriveAImagen(fotoPrincipal)] : []
  };
}

async function cargarInventario() {
  const supabase = window.autopartesSupabase;

  if (supabase) {
    const { data, error } = await supabase
      .from("piezas")
      .select("*, fotos(url, orden)")
      .eq("disponible", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(productoDesdeSupabase);
  }

  const response = await fetch("datos.json");
  if (!response.ok) throw new Error("No se pudo cargar datos.json");
  const productosJson = await response.json();
  return (productosJson || []).map(productoDesdeJson);
}

function limpiarSelect(selectId, textoInicial) {
  const select = document.getElementById(selectId);
  if (select) select.innerHTML = `<option value="">${textoInicial}</option>`;
}

function valoresUnicos(productos, campo) {
  return [
    ...new Set(
      productos
        .map((producto) => producto[campo])
        .filter((valor) => valor !== undefined && valor !== null && String(valor).trim() !== "")
    )
  ].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
}

function cargarMarcas(productos) {
  limpiarSelect("filtroMarca", "Todas las marcas");
  const select = document.getElementById("filtroMarca");
  if (!select) return;
  valoresUnicos(productos, "marca").forEach((marca) => {
    select.innerHTML += `<option value="${escapeHtml(marca)}">${escapeHtml(marca)}</option>`;
  });
}

function cargarModelos(productos) {
  limpiarSelect("filtroModelo", "Todos los modelos");
  const select = document.getElementById("filtroModelo");
  if (!select) return;
  valoresUnicos(productos, "modelo").forEach((modelo) => {
    select.innerHTML += `<option value="${escapeHtml(modelo)}">${escapeHtml(modelo)}</option>`;
  });
}

function cargarAnios(productos) {
  limpiarSelect("filtroAnio", "Todos los años");
  const select = document.getElementById("filtroAnio");
  if (!select) return;
  valoresUnicos(productos, "anio").forEach((anio) => {
    select.innerHTML += `<option value="${escapeHtml(anio)}">${escapeHtml(anio)}</option>`;
  });
}

function pintarChipsMarcas(productos) {
  const contenedor = document.getElementById("marcasDestacadas");
  if (!contenedor) return;
  const marcas = valoresUnicos(productos, "marca");
  contenedor.innerHTML = "";

  marcas.forEach((marca) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = marca;
    boton.addEventListener("click", () => {
      const filtroMarca = document.getElementById("filtroMarca");
      if (filtroMarca) filtroMarca.value = marca;
      const productosMarca = filtrarPorMarca();
      cargarModelos(productosMarca);
      cargarAnios(productosMarca);
      filtrar();
      document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
    });
    contenedor.appendChild(boton);
  });
}

function actualizarEstadisticas(productos) {
  const total = productos.length;
  const marcas = valoresUnicos(productos, "marca").length;
  const fotos = productos.filter((producto) => producto.fotoPrincipal || producto.fotos?.length).length;

  if (document.getElementById("statTotal")) document.getElementById("statTotal").textContent = total;
  if (document.getElementById("statMarcas")) document.getElementById("statMarcas").textContent = marcas;
  if (document.getElementById("statFotos")) document.getElementById("statFotos").textContent = fotos;
}

function filtrarPorMarca() {
  const marcaSeleccionada = document.getElementById("filtroMarca")?.value || "";
  return todosLosProductos.filter((producto) => !marcaSeleccionada || producto.marca === marcaSeleccionada);
}

function filtrarPorMarcaYModelo() {
  const marcaSeleccionada = document.getElementById("filtroMarca")?.value || "";
  const modeloSeleccionado = document.getElementById("filtroModelo")?.value || "";

  return todosLosProductos.filter((producto) => {
    return (!marcaSeleccionada || producto.marca === marcaSeleccionada) &&
      (!modeloSeleccionado || producto.modelo === modeloSeleccionado);
  });
}

function filtrar() {
  const texto = normalizarTexto(document.getElementById("busqueda")?.value || "");
  const marcaSeleccionada = document.getElementById("filtroMarca")?.value || "";
  const modeloSeleccionado = document.getElementById("filtroModelo")?.value || "";
  const anioSeleccionado = document.getElementById("filtroAnio")?.value || "";

  const filtrados = todosLosProductos.filter((producto) => {
    const textoProducto = normalizarTexto([
      producto.marca,
      producto.modelo,
      producto.anio,
      producto.pieza,
      producto.lado,
      producto.color,
      producto.estado,
      producto.numero_parte,
      producto.descripcion,
      producto.id
    ].join(" "));

    return textoProducto.includes(texto) &&
      (!marcaSeleccionada || producto.marca === marcaSeleccionada) &&
      (!modeloSeleccionado || producto.modelo === modeloSeleccionado) &&
      (!anioSeleccionado || producto.anio === anioSeleccionado);
  });

  mostrarProductos(filtrados);
}

function limpiarFiltros() {
  if (document.getElementById("busqueda")) document.getElementById("busqueda").value = "";
  if (document.getElementById("filtroMarca")) document.getElementById("filtroMarca").value = "";
  cargarModelos(todosLosProductos);
  cargarAnios(todosLosProductos);
  if (document.getElementById("filtroModelo")) document.getElementById("filtroModelo").value = "";
  if (document.getElementById("filtroAnio")) document.getElementById("filtroAnio").value = "";
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

function crearMensajeWhatsApp(producto) {
  return encodeURIComponent(
    `Hola, me interesa esta autoparte:\n\n` +
    `${producto.pieza || "Pieza"} ${producto.lado || ""}\n` +
    `${producto.marca || ""} ${producto.modelo || ""} ${producto.anio || ""}\n` +
    `ID: ${producto.id || "N/C"}\n` +
    `Precio: ${formatearPrecio(producto.precio)}\n\n` +
    `¿Me puedes confirmar disponibilidad, compatibilidad y forma de entrega?`
  );
}

function mostrarProductos(productos) {
  const contenedor = document.querySelector(".productos");
  const contador = document.getElementById("contador");
  if (!contenedor) return;

  contenedor.innerHTML = "";
  if (contador) contador.innerHTML = `Mostrando ${productos.length} de ${todosLosProductos.length} piezas disponibles`;

  if (productos.length === 0) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <h3>No encontramos piezas con esos filtros</h3>
        <p>Intenta cambiar marca, modelo, año o escríbenos por WhatsApp para revisar disponibilidad.</p>
        <a href="https://wa.me/${window.AV_CONFIG?.WHATSAPP_NUMBER || "525632753982"}" target="_blank" rel="noopener">Preguntar por WhatsApp</a>
      </div>`;
    return;
  }

  productos.forEach((producto, index) => {
    const fotos = producto.fotos?.length ? producto.fotos : (producto.fotoPrincipal ? [producto.fotoPrincipal] : []);
    const foto = fotos[0] || "";
    const mensajeWhatsApp = crearMensajeWhatsApp(producto);
    const whatsappNumber = window.AV_CONFIG?.WHATSAPP_NUMBER || "525632753982";

    const card = document.createElement("article");
    card.className = "producto-card";
    card.innerHTML = `
      <div class="producto-img-wrap ${foto ? "con-foto" : "sin-foto"}" data-index="${index}">
        ${foto ? `<img src="${escapeAttr(foto)}" alt="${escapeAttr(producto.pieza)} ${escapeAttr(producto.marca)} ${escapeAttr(producto.modelo)}" loading="lazy">` : `<span>Sin foto principal</span>`}
        <div class="foto-count">${fotos.length ? `${fotos.length} foto${fotos.length === 1 ? "" : "s"}` : "Sin fotos"}</div>
      </div>

      <div class="producto-info">
        <div class="producto-topline">
          <span class="estado-pill">${escapeHtml(producto.estado || "Disponible")}</span>
          <span class="producto-id">ID ${escapeHtml(producto.id || "N/C")}</span>
        </div>
        <h3>${escapeHtml(producto.pieza || "Autoparte")} ${escapeHtml(producto.lado || "")}</h3>
        <h4>${escapeHtml(producto.marca || "")} ${escapeHtml(producto.modelo || "")} ${escapeHtml(producto.anio || "")}</h4>

        <div class="producto-detalles">
          <span><b>Lado</b>${escapeHtml(producto.lado || "N/C")}</span>
          <span><b>Color</b>${escapeHtml(producto.color || "N/C")}</span>
          <span><b>No. Parte</b>${escapeHtml(producto.numero_parte || "N/C")}</span>
        </div>

        <div class="producto-footer">
          <strong>${formatearPrecio(producto.precio)}</strong>
          <div class="producto-actions">
            <a class="btn-whatsapp" href="https://wa.me/${whatsappNumber}?text=${mensajeWhatsApp}" target="_blank" rel="noopener">WhatsApp</a>
            <button type="button" class="btn-fotos" data-index="${index}" ${fotos.length ? "" : "disabled"}>Ver fotos</button>
          </div>
        </div>
      </div>`;

    contenedor.appendChild(card);
  });

  $$(".producto-img-wrap.con-foto, .btn-fotos").forEach((elemento) => {
    elemento.addEventListener("click", () => {
      const index = Number(elemento.dataset.index);
      const producto = productos[index];
      const fotos = producto.fotos?.length ? producto.fotos : (producto.fotoPrincipal ? [producto.fotoPrincipal] : []);
      if (fotos.length) abrirGaleria(producto, fotos, 0);
    });
  });
}

function crearModalGaleria() {
  if (document.getElementById("modalGaleria")) return;

  const modal = document.createElement("div");
  modal.id = "modalGaleria";
  modal.className = "av-modal";
  modal.innerHTML = `
    <div class="av-modal-backdrop" data-cerrar="true"></div>
    <div class="av-modal-content">
      <button type="button" class="av-modal-close" data-cerrar="true">×</button>
      <div class="av-modal-title" id="modalTitulo"></div>
      <button type="button" class="av-modal-nav av-prev">‹</button>
      <img id="modalImagen" src="" alt="Foto de autoparte">
      <button type="button" class="av-modal-nav av-next">›</button>
      <div class="av-modal-counter" id="modalContador"></div>
    </div>`;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {
    if (event.target.dataset.cerrar) cerrarGaleria();
  });

  modal.querySelector(".av-prev").addEventListener("click", () => moverGaleria(-1));
  modal.querySelector(".av-next").addEventListener("click", () => moverGaleria(1));

  document.addEventListener("keydown", (event) => {
    if (!modal.classList.contains("abierto")) return;
    if (event.key === "Escape") cerrarGaleria();
    if (event.key === "ArrowLeft") moverGaleria(-1);
    if (event.key === "ArrowRight") moverGaleria(1);
  });
}

function abrirGaleria(producto, fotos, index) {
  crearModalGaleria();
  galeriaActual = fotos;
  fotoActual = index;
  document.getElementById("modalTitulo").textContent = `${producto.pieza || "Autoparte"} ${producto.marca || ""} ${producto.modelo || ""}`;
  actualizarGaleria();
  document.getElementById("modalGaleria").classList.add("abierto");
}

function cerrarGaleria() {
  document.getElementById("modalGaleria")?.classList.remove("abierto");
}

function moverGaleria(delta) {
  if (!galeriaActual.length) return;
  fotoActual = (fotoActual + delta + galeriaActual.length) % galeriaActual.length;
  actualizarGaleria();
}

function actualizarGaleria() {
  const img = document.getElementById("modalImagen");
  const contador = document.getElementById("modalContador");
  if (img) img.src = galeriaActual[fotoActual] || "";
  if (contador) contador.textContent = `${fotoActual + 1} / ${galeriaActual.length}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function registrarEventos() {
  document.getElementById("busqueda")?.addEventListener("input", filtrar);

  document.getElementById("filtroMarca")?.addEventListener("change", () => {
    const productosMarca = filtrarPorMarca();
    cargarModelos(productosMarca);
    cargarAnios(productosMarca);
    filtrar();
  });

  document.getElementById("filtroModelo")?.addEventListener("change", () => {
    const productosMarcaModelo = filtrarPorMarcaYModelo();
    cargarAnios(productosMarcaModelo);
    filtrar();
  });

  document.getElementById("filtroAnio")?.addEventListener("change", filtrar);
  document.getElementById("limpiarFiltros")?.addEventListener("click", limpiarFiltros);
  document.getElementById("compartirCatalogo")?.addEventListener("click", compartirCatalogo);
}

async function iniciarCatalogo() {
  try {
    todosLosProductos = await cargarInventario();
    cargarMarcas(todosLosProductos);
    cargarModelos(todosLosProductos);
    cargarAnios(todosLosProductos);
    pintarChipsMarcas(todosLosProductos);
    actualizarEstadisticas(todosLosProductos);
    mostrarProductos(todosLosProductos);
    registrarEventos();
  } catch (error) {
    console.error("Error cargando inventario:", error);
    const contador = document.getElementById("contador");
    const contenedor = document.querySelector(".productos");
    if (contador) contador.textContent = "No se pudo cargar el inventario.";
    if (contenedor) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <h3>Error cargando inventario</h3>
          <p>Revisa Supabase, datos.json o la conexión de la página.</p>
        </div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", iniciarCatalogo);

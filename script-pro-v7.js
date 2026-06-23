const WHATSAPP_NUMBER = "525632753982";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let inventario = [];
let filtroPiezaRapida = "";

const elementos = {
  menuToggle: $("#menuToggle"),
  navLinks: $("#navLinks"),
  busqueda: $("#busqueda"),
  marca: $("#filtroMarca"),
  modelo: $("#filtroModelo"),
  anio: $("#filtroAnio"),
  limpiar: $("#limpiarFiltros"),
  productos: $("#productos"),
  contador: $("#contador"),
  vacio: $("#mensajeVacio"),
  compartir: $("#compartirCatalogo"),
  statTotal: $("#statTotal"),
  statMarcas: $("#statMarcas"),
  statFotos: $("#statFotos")
};

elementos.menuToggle?.addEventListener("click", () => {
  elementos.navLinks?.classList.toggle("open");
});

elementos.navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => elementos.navLinks?.classList.remove("open"));
});

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function limpiarTexto(texto) {
  return normalizar(texto).replace(/[^a-z0-9]/g, "");
}

function obtenerValor(producto, nombres) {
  const llaves = Object.keys(producto || {});

  for (const nombre of nombres) {
    const buscada = limpiarTexto(nombre);
    const encontrada = llaves.find((llave) => limpiarTexto(llave) === buscada);
    if (encontrada && producto[encontrada] !== undefined && producto[encontrada] !== null) {
      return String(producto[encontrada]).trim();
    }
  }

  return "";
}

function datosProducto(producto) {
  return {
    id: obtenerValor(producto, ["id", "ID", "clave"]) || "",
    marca: obtenerValor(producto, ["marca", "Marca"]),
    modelo: obtenerValor(producto, ["modelo", "Modelo"]),
    anio: obtenerValor(producto, ["anio", "año", "Año", "ano", "year"]),
    pieza: obtenerValor(producto, ["pieza", "Pieza", "refaccion", "refacción"]),
    numeroParte: obtenerValor(producto, ["numero_parte", "numero parte", "número parte", "No Parte", "parte"]),
    lado: obtenerValor(producto, ["lado", "Lado"]),
    color: obtenerValor(producto, ["color", "Color"]),
    estado: obtenerValor(producto, ["estado", "Estado", "condicion", "condición"]),
    precio: obtenerValor(producto, ["precio", "Precio"]),
    fotoPrincipal: obtenerValor(producto, ["fotoPrincipal", "Foto Principal", "foto principal", "Foto_Principal", "foto_principal", "imagen", "Imagen", "foto", "Foto"]),
    link: obtenerValor(producto, ["link", "Link", "carpeta", "drive", "galeria", "galería"])
  };
}

function extraerDriveId(link) {
  const texto = String(link || "");

  const patrones = [
    /\/file\/d\/([^/]+)/,
    /\/d\/([^/]+)/,
    /[?&]id=([^&]+)/,
    /open\?id=([^&]+)/,
    /uc\?id=([^&]+)/
  ];

  for (const patron of patrones) {
    const match = texto.match(patron);
    if (match?.[1]) return match[1];
  }

  return "";
}

function convertirDriveAImagen(link) {
  if (!link) return "";
  const texto = String(link).trim();
  const id = extraerDriveId(texto);

  if (id) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  }

  return texto;
}

function numeroAYear(numero) {
  const n = Number(numero);
  if (!Number.isFinite(n)) return null;
  if (n < 100) return n >= 80 ? 1900 + n : 2000 + n;
  return n;
}

function obtenerAnios(producto) {
  const { anio } = datosProducto(producto);
  const numeros = String(anio || "").match(/\d{2,4}/g);

  if (!numeros) return [];

  const years = numeros.map(numeroAYear).filter(Boolean);

  if (years.length >= 2 && /[-–—a]/i.test(anio)) {
    const inicio = Math.min(years[0], years[1]);
    const fin = Math.max(years[0], years[1]);

    if (fin - inicio <= 35) {
      return Array.from({ length: fin - inicio + 1 }, (_, index) => inicio + index);
    }
  }

  return [...new Set(years)];
}

function formatoPrecio(precio) {
  const limpio = String(precio || "").replace(/[^\d.]/g, "");
  const numero = Number(limpio);

  if (!precio || normalizar(precio) === "n/c") return "Cotizar";
  if (!Number.isFinite(numero) || numero <= 0) return precio;

  return numero.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  });
}

function ordenarUnicos(valores) {
  return [...new Set(valores.filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
}

function llenarSelect(select, valores, textoBase) {
  if (!select) return;

  const valorActual = select.value;
  select.innerHTML = `<option value="">${textoBase}</option>`;

  valores.forEach((valor) => {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = valor;
    select.appendChild(option);
  });

  if ([...select.options].some((option) => option.value === valorActual)) {
    select.value = valorActual;
  }
}

function baseParaFiltros() {
  const marca = elementos.marca?.value || "";
  const modelo = elementos.modelo?.value || "";

  return inventario.filter((producto) => {
    const datos = datosProducto(producto);
    const coincideMarca = !marca || datos.marca === marca;
    const coincideModelo = !modelo || datos.modelo === modelo;
    return coincideMarca && coincideModelo;
  });
}

function actualizarFiltros(cambio = "") {
  const marcaSeleccionada = elementos.marca?.value || "";
  const modeloSeleccionado = elementos.modelo?.value || "";
  const anioSeleccionado = elementos.anio?.value || "";

  const marcas = ordenarUnicos(inventario.map((producto) => datosProducto(producto).marca));
  llenarSelect(elementos.marca, marcas, "Todas");

  if (marcaSeleccionada && marcas.includes(marcaSeleccionada)) {
    elementos.marca.value = marcaSeleccionada;
  }

  if (cambio === "marca") {
    elementos.modelo.value = "";
    elementos.anio.value = "";
  }

  if (cambio === "modelo") {
    elementos.anio.value = "";
  }

  const productosParaModelos = inventario.filter((producto) => {
    const datos = datosProducto(producto);
    return !elementos.marca.value || datos.marca === elementos.marca.value;
  });

  const modelos = ordenarUnicos(productosParaModelos.map((producto) => datosProducto(producto).modelo));
  llenarSelect(elementos.modelo, modelos, "Todos");

  if (modeloSeleccionado && modelos.includes(modeloSeleccionado) && cambio !== "marca") {
    elementos.modelo.value = modeloSeleccionado;
  }

  const productosParaAnios = baseParaFiltros();
  const anios = ordenarUnicos(productosParaAnios.flatMap(obtenerAnios)).sort((a, b) => b - a);
  llenarSelect(elementos.anio, anios, "Todos");

  if (anioSeleccionado && anios.map(String).includes(String(anioSeleccionado)) && cambio !== "marca" && cambio !== "modelo") {
    elementos.anio.value = anioSeleccionado;
  }
}

function productoCoincide(producto) {
  const datos = datosProducto(producto);
  const textoBusqueda = normalizar(elementos.busqueda?.value || "");
  const marca = elementos.marca?.value || "";
  const modelo = elementos.modelo?.value || "";
  const anio = elementos.anio?.value || "";

  const bolsaTexto = normalizar([
    datos.id,
    datos.marca,
    datos.modelo,
    datos.anio,
    datos.pieza,
    datos.numeroParte,
    datos.lado,
    datos.color,
    datos.estado,
    datos.precio
  ].join(" "));

  const coincideBusqueda = !textoBusqueda || bolsaTexto.includes(textoBusqueda);
  const coincideMarca = !marca || datos.marca === marca;
  const coincideModelo = !modelo || datos.modelo === modelo;
  const coincideAnio = !anio || obtenerAnios(producto).includes(Number(anio)) || normalizar(datos.anio).includes(normalizar(anio));
  const coincidePiezaRapida = !filtroPiezaRapida || normalizar(datos.pieza).includes(normalizar(filtroPiezaRapida));

  return coincideBusqueda && coincideMarca && coincideModelo && coincideAnio && coincidePiezaRapida;
}

function crearMensajeWhatsApp(datos) {
  const titulo = `${datos.pieza || "Pieza"} ${datos.marca || ""} ${datos.modelo || ""} ${datos.anio || ""}`.replace(/\s+/g, " ").trim();
  return `Hola Autopartes Vences, quiero cotizar: ${titulo}. ID: ${datos.id || "N/C"}. ¿Sigue disponible?`;
}

function imagenFallbackHTML() {
  return `<div class="img-fallback"><span>Foto no disponible<br>Pregunta por WhatsApp</span></div>`;
}

function mostrarProductos(lista) {
  if (!elementos.productos) return;

  const productosOrdenados = [...lista].sort((a, b) => {
    const da = datosProducto(a);
    const db = datosProducto(b);
    return `${da.marca} ${da.modelo} ${da.pieza}`.localeCompare(`${db.marca} ${db.modelo} ${db.pieza}`, "es", { numeric: true });
  });

  elementos.productos.innerHTML = "";

  productosOrdenados.forEach((producto) => {
    const datos = datosProducto(producto);
    const foto = convertirDriveAImagen(datos.fotoPrincipal);
    const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(crearMensajeWhatsApp(datos))}`;
    const titulo = `${datos.pieza || "Autoparte"} ${datos.marca || ""} ${datos.modelo || ""}`.replace(/\s+/g, " ").trim();

    const article = document.createElement("article");
    article.className = "producto";

    const imagenHTML = foto
      ? `<img src="${foto}" alt="${titulo}" loading="lazy">`
      : "";

    article.innerHTML = `
      <div class="producto-imagen">
        ${datos.link
          ? `<a class="foto-link" href="${datos.link}" target="_blank" rel="noopener" aria-label="Ver más fotos de ${titulo}">
              ${imagenHTML}
              ${imagenFallbackHTML()}
              <span class="foto-overlay">Ver más fotos</span>
            </a>`
          : `${imagenHTML}
             ${imagenFallbackHTML()}`}
        <span class="estado-badge">${datos.estado || "Disponible"}</span>
      </div>

      <div class="producto-info">
        <h3>${titulo}</h3>

        <div class="meta-grid">
          ${datos.marca ? `<span>${datos.marca}</span>` : ""}
          ${datos.modelo ? `<span>${datos.modelo}</span>` : ""}
          ${datos.anio ? `<span>${datos.anio}</span>` : ""}
          ${datos.lado && normalizar(datos.lado) !== "n/c" ? `<span>${datos.lado}</span>` : ""}
        </div>

        <div class="detalles">
          ${datos.numeroParte && normalizar(datos.numeroParte) !== "n/c" ? `<div><strong>No. parte:</strong> ${datos.numeroParte}</div>` : ""}
          ${datos.color && normalizar(datos.color) !== "n/c" ? `<div><strong>Color:</strong> ${datos.color}</div>` : ""}
          ${datos.id ? `<div><strong>ID:</strong> ${datos.id}</div>` : ""}
        </div>

        <div class="producto-footer">
          <div class="precio">
            <span>Precio</span>
            <strong>${formatoPrecio(datos.precio)}</strong>
          </div>

          <div class="producto-actions">
            <a class="btn btn-primary" href="${whatsapp}" target="_blank" rel="noopener">Cotizar por WhatsApp</a>
          </div>
        </div>
      </div>
    `;

    const img = article.querySelector(".producto-imagen img");
    const fallback = article.querySelector(".img-fallback");

    if (!img && fallback) {
      fallback.style.display = "grid";
    } else if (img && fallback) {
      img.addEventListener("error", () => {
        img.style.display = "none";
        fallback.style.display = "grid";
      });
    }

    elementos.productos.appendChild(article);
  });

  if (elementos.contador) {
    elementos.contador.textContent = `${productosOrdenados.length} pieza${productosOrdenados.length === 1 ? "" : "s"} encontrada${productosOrdenados.length === 1 ? "" : "s"}`;
  }

  if (elementos.vacio) {
    elementos.vacio.hidden = productosOrdenados.length !== 0;
  }
}

function filtrar() {
  const filtrados = inventario.filter(productoCoincide);
  mostrarProductos(filtrados);
}

function actualizarEstadisticas() {
  const piezas = inventario.length;
  const marcas = ordenarUnicos(inventario.map((producto) => datosProducto(producto).marca)).length;
  const fotos = inventario.filter((producto) => datosProducto(producto).fotoPrincipal).length;

  if (elementos.statTotal) elementos.statTotal.textContent = piezas;
  if (elementos.statMarcas) elementos.statMarcas.textContent = marcas;
  if (elementos.statFotos) elementos.statFotos.textContent = fotos;
}

function limpiarFiltros() {
  if (elementos.busqueda) elementos.busqueda.value = "";
  if (elementos.marca) elementos.marca.value = "";
  if (elementos.modelo) elementos.modelo.value = "";
  if (elementos.anio) elementos.anio.value = "";
  filtroPiezaRapida = "";

  $$(".chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.pieza === ""));

  actualizarFiltros();
  filtrar();
}

function compartirCatalogo() {
  const url = window.location.href.split("#")[0];
  const texto = "Catálogo de AUTOPARTES VENCES";

  if (navigator.share) {
    navigator.share({ title: texto, text: "Busca autopartes por marca, modelo, año o pieza.", url }).catch(() => {});
    return;
  }

  navigator.clipboard?.writeText(url);
  alert("Link del catálogo copiado.");
}

function conectarEventos() {
  elementos.busqueda?.addEventListener("input", filtrar);

  elementos.marca?.addEventListener("change", () => {
    actualizarFiltros("marca");
    filtrar();
  });

  elementos.modelo?.addEventListener("change", () => {
    actualizarFiltros("modelo");
    filtrar();
  });

  elementos.anio?.addEventListener("change", filtrar);
  elementos.limpiar?.addEventListener("click", limpiarFiltros);
  elementos.compartir?.addEventListener("click", compartirCatalogo);

  $$(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".chip").forEach((boton) => boton.classList.remove("active"));
      chip.classList.add("active");
      filtroPiezaRapida = chip.dataset.pieza || "";
      filtrar();
    });
  });
}

function cargarInventario() {
  fetch("datos.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar datos.json");
      return response.json();
    })
    .then((datos) => {
      inventario = Array.isArray(datos) ? datos : (datos.productos || datos.inventario || datos.data || []);

      actualizarFiltros();
      actualizarEstadisticas();
      conectarEventos();
      filtrar();
    })
    .catch((error) => {
      console.error("Error cargando inventario:", error);

      if (elementos.contador) {
        elementos.contador.textContent = "No se pudo cargar el inventario.";
      }

      if (elementos.productos) {
        elementos.productos.innerHTML = `
          <div class="mensaje-vacio">
            <h2>Error cargando inventario</h2>
            <p>Revisa que <strong>datos.json</strong> siga en la misma carpeta que <strong>index.html</strong>.</p>
          </div>
        `;
      }
    });
}

cargarInventario();

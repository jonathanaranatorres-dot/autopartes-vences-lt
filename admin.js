/* AUTOPARTES VENCES - Admin privado
   Requiere supabase-config.js y admin.html */

const avDB = window.autopartesSupabase;
const bucket = window.AV_CONFIG?.STORAGE_BUCKET || "fotos-piezas";

let piezas = [];
let archivosSeleccionados = [];
let fotosTrabajo = [];
let fotosEliminadas = [];
let contadorFotoTemporal = 0;
let filtroTabla = "";
let filtroFamilia = "";
let paginaTabla = 1;
let temporizadorBusquedaAdmin = null;
const FILAS_POR_PAGINA = 40;
let usuarioActual = null;
let perfilActual = null;
let perfilesPorId = new Map();
let ventasMes = [];
let extrasDisponibles = {
  perfiles: false,
  ventas: false,
  movimientos: false,
  auditoriaPiezas: false
};

const $ = (id) => document.getElementById(id);

function setStatus(id, mensaje, tipo = "") {
  const el = $(id);
  if (!el) return;
  el.textContent = mensaje || "";
  el.className = `status ${tipo}`.trim();
}

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const familiasAdmin = {
  faro: ["faro", "faros", "foco", "lampara", "lampara delantera", "optico", "optica"],
  calavera: ["calavera", "calaveras", "stop", "mica trasera", "faro trasero", "luz trasera", "luz posterior", "piloto trasero"],
  puerta: ["puerta", "puertas"],
  defensa: ["defensa", "defensas", "fascia", "facia", "parachoques", "bumper", "alma defensa", "absorbedor defensa", "refuerzo defensa"],
  cofre: ["cofre", "capo", "capot", "hood"],
  salpicadera: ["salpicadera", "salpicaderas", "guardafango", "guardafangos", "lodo", "lodera", "loderas"],
  espejo: ["espejo", "espejos", "retrovisor", "retrovisores"],
  parrilla: ["parrilla", "rejilla", "grille", "moldura parrilla"],
  cajuela: ["cajuela", "tapa cajuela", "tapa trasera", "compuerta", "quinta puerta", "5ta puerta", "maletero"],
  cristal: ["cristal", "vidrio", "parabrisas", "medallon", "quemacocos", "aleta", "ventana"],
  llanta: ["llanta", "llantas", "rin", "rines", "neumatico", "neumaticos", "tapón", "tapon", "centro rin"],
  motor: ["motor", "transmision", "caja", "alternador", "marcha", "radiador", "condensador", "ventilador", "compresor", "bomba", "manguera", "multiple", "inyeccion", "inyector", "sensor", "soporte motor"],
  interior: ["asiento", "asientos", "tablero", "bolsa de aire", "airbag", "volante", "consola", "guantera", "vestidura", "alfombra", "cinturon", "cinturon", "palanca", "moldura interior", "tapa interior"],
  electrico: ["modulo", "computadora", "ecu", "bcm", "arnes", "cableado", "switch", "boton", "control", "pantalla", "estereo", "cluster", "tablero instrumentos", "sensor", "chicote", "elevador", "motor elevador"]
};

const familiasCaptura = {
  CARROCERIA: { prefijo: "AVC", nombre: "Autopartes Vences Carrocería" },
  ILUMINACION: { prefijo: "AVI", nombre: "Autopartes Vences Iluminación" },
  ELECTRICO: { prefijo: "AVE", nombre: "Autopartes Vences Eléctrico" },
  MOTOR: { prefijo: "AVM", nombre: "Autopartes Vences Motor" },
  TRANSMISION: { prefijo: "AVT", nombre: "Autopartes Vences Transmisión" },
  SUSPENSION: { prefijo: "AVS", nombre: "Autopartes Vences Suspensión" },
  FRENOS: { prefijo: "AVF", nombre: "Autopartes Vences Frenos" },
  RINES_LLANTAS: { prefijo: "AVR", nombre: "Autopartes Vences Rines/Llantas" },
  ENFRIAMIENTO: { prefijo: "AVN", nombre: "Autopartes Vences Enfriamiento" },
  INTERIOR: { prefijo: "AVD", nombre: "Autopartes Vences Interior" },
  CRISTALES: { prefijo: "AVX", nombre: "Autopartes Vences Cristales" },
  ACCESORIOS: { prefijo: "AVA", nombre: "Autopartes Vences Accesorios" }
};

const camposMayusculas = ["folio", "pieza", "marca", "modelo", "anio", "color", "numeroParte", "descripcion"];
const ESTADO_DEFAULT_CAPTURA = "USADO ORIGINAL";
let ultimoFolioGenerado = "";


function mayusculas(valor) {
  return String(valor || "").toLocaleUpperCase("es-MX").trim();
}

function setFolioAyuda(mensaje, tipo = "") {
  const el = $("folioAyuda");
  if (!el) return;
  el.textContent = mensaje || "";
  el.style.color = tipo === "err" ? "var(--danger)" : tipo === "ok" ? "var(--ok)" : "";
}

function familiaDesdePrefijo(prefijo) {
  const limpio = mayusculas(prefijo);
  return Object.entries(familiasCaptura).find(([, info]) => info.prefijo === limpio)?.[0] || "";
}

function prefijoDesdeFolio(folio) {
  const match = mayusculas(folio).match(/^([A-Z]+)-\d+$/);
  return match?.[1] || "";
}

function numeroDesdeFolio(folio, prefijo) {
  const match = mayusculas(folio).match(new RegExp(`^${prefijo}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
}

function formatearFolio(prefijo, numero) {
  const ancho = numero <= 999 ? 3 : String(numero).length;
  return `${prefijo}-${String(numero).padStart(ancho, "0")}`;
}

function seleccionarFamiliaPorFolio(folio) {
  const familia = familiaDesdePrefijo(prefijoDesdeFolio(folio));
  const select = $("familiaCaptura");
  if (select) select.value = familia;
}

async function maximoFolioPorPrefijo(prefijo) {
  const prefijoLimpio = mayusculas(prefijo);
  if (!prefijoLimpio) return 0;

  let maximo = 0;
  (piezas || []).forEach((pieza) => {
    maximo = Math.max(maximo, numeroDesdeFolio(pieza.folio, prefijoLimpio));
  });

  try {
    const { data, error } = await avDB
      .from("piezas")
      .select("folio")
      .ilike("folio", `${prefijoLimpio}-%`)
      .range(0, 9999);

    if (error) throw error;
    (data || []).forEach((pieza) => {
      maximo = Math.max(maximo, numeroDesdeFolio(pieza.folio, prefijoLimpio));
    });
  } catch (error) {
    console.warn("No se pudo calcular folio desde Supabase. Se usará inventario cargado:", error.message);
  }

  return maximo;
}

async function generarSiguienteFolio(prefijo) {
  const maximo = await maximoFolioPorPrefijo(prefijo);
  return formatearFolio(prefijo, maximo + 1);
}

async function folioExiste(folio, idIgnorado = "") {
  const folioLimpio = mayusculas(folio);
  if (!folioLimpio) return false;

  const local = (piezas || []).find((pieza) => mayusculas(pieza.folio) === folioLimpio && pieza.id !== idIgnorado);
  if (local) return true;

  const { data, error } = await avDB
    .from("piezas")
    .select("id, folio")
    .eq("folio", folioLimpio)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data && data.id !== idIgnorado);
}

async function autollenarFolio(forzar = false) {
  const familia = $("familiaCaptura")?.value || "";
  const info = familiasCaptura[familia];
  const folioInput = $("folio");
  if (!info || !folioInput) {
    setFolioAyuda("");
    return "";
  }

  const valorActual = mayusculas(folioInput.value);
  const puedeReemplazar = forzar || !valorActual || valorActual === ultimoFolioGenerado;
  if (!puedeReemplazar) {
    setFolioAyuda("ID escrito manualmente. Presiona Generar siguiente ID si quieres reemplazarlo.");
    return valorActual;
  }

  setFolioAyuda("Calculando siguiente ID...");
  const siguiente = await generarSiguienteFolio(info.prefijo);
  folioInput.value = siguiente;
  ultimoFolioGenerado = siguiente;
  setFolioAyuda(`Siguiente libre sugerido: ${siguiente}`, "ok");
  return siguiente;
}

async function asegurarFolioAntesDeGuardar(payload, idActual) {
  if (idActual) return payload;

  const familia = $("familiaCaptura")?.value || "";
  const info = familiasCaptura[familia];

  if (!payload.folio && info) {
    payload.folio = await generarSiguienteFolio(info.prefijo);
    $("folio").value = payload.folio;
  }

  if (!payload.folio) {
    throw new Error("Selecciona una familia o escribe un ID antes de guardar.");
  }

  const existe = await folioExiste(payload.folio, idActual);
  if (!existe) return payload;

  if (!info) {
    throw new Error(`El ID ${payload.folio} ya existe. Cambia el ID o selecciona una familia para generar uno nuevo.`);
  }

  const nuevoFolio = await generarSiguienteFolio(info.prefijo);
  payload.folio = nuevoFolio;
  $("folio").value = nuevoFolio;
  ultimoFolioGenerado = nuevoFolio;
  setFolioAyuda(`El ID anterior ya existía. Se usará ${nuevoFolio}.`, "ok");
  return payload;
}

function configurarMayusculasAutomaticas() {
  camposMayusculas.forEach((idCampo) => {
    const campo = $(idCampo);
    if (!campo) return;

    campo.addEventListener("input", () => {
      const inicio = campo.selectionStart;
      const fin = campo.selectionEnd;
      const valor = campo.value;
      const convertido = valor.toLocaleUpperCase("es-MX");
      if (valor === convertido) return;
      campo.value = convertido;
      if (typeof campo.setSelectionRange === "function") {
        campo.setSelectionRange(inicio, fin);
      }
    });
  });
}

function configurarCapturaRapida() {
  configurarMayusculasAutomaticas();

  $("familiaCaptura")?.addEventListener("change", () => autollenarFolio(true));
  $("generarFolioBtn")?.addEventListener("click", () => autollenarFolio(true));
  $("folio")?.addEventListener("blur", () => {
    const folio = mayusculas($("folio").value);
    $("folio").value = folio;
    seleccionarFamiliaPorFolio(folio);
  });

  document.addEventListener("keydown", manejarAtajosCaptura);
}

function actualizarTextoBotonGuardar() {
  const boton = $("saveBtn");
  if (!boton) return;
  boton.textContent = $("piezaId")?.value ? "Guardar cambios" : "Guardar y capturar siguiente";
}

function manejarAtajosCaptura(event) {
  const tecla = String(event.key || "").toLowerCase();
  const esAtajo = (event.ctrlKey || event.metaKey) && (tecla === "enter" || tecla === "s");
  if (!esAtajo) return;

  const adminVisible = $("adminView") && !$("adminView").classList.contains("hidden");
  const formularioVisible = $("piezaForm")?.offsetParent !== null;
  if (!adminVisible || !formularioVisible || $("saveBtn")?.disabled) return;

  event.preventDefault();
  $("piezaForm").requestSubmit();
}

function textoFamiliaPieza(p) {
  return normalizar([
    p.pieza,
    p.descripcion,
    p.numero_parte
  ].filter(Boolean).join(" "));
}

function coincideFamilia(p, familia) {
  if (!familia) return true;
  const palabras = familiasAdmin[familia] || [];
  const texto = textoFamiliaPieza(p);
  return palabras.some((palabra) => texto.includes(normalizar(palabra)));
}

function slug(texto) {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "foto";
}

function dinero(valor) {
  const numero = Number(valor || 0);
  if (!numero) return "Consultar";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(numero);
}

function fechaCorta(valor) {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(fecha);
}

function inicioMesActualISO() {
  const fecha = new Date();
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1).toISOString();
}

function nombreDesdeEmail(email) {
  const base = String(email || "").split("@")[0] || "Usuario";
  return base
    .replace(/[._-]+/g, " ")
    .replace(/\w/g, (letra) => letra.toUpperCase());
}
function nombreUsuarioActual() {
  return perfilActual?.nombre || usuarioActual?.user_metadata?.name || nombreDesdeEmail(usuarioActual?.email);
}

function usuarioId() {
  return usuarioActual?.id || null;
}

function usuarioEmail() {
  return usuarioActual?.email || null;
}

function usuarioNombre() {
  return nombreUsuarioActual();
}

function esAdminActual() {
  return normalizar(perfilActual?.rol || "").includes("admin");
}

function nombrePerfil(id, fallback = "") {
  if (!id) return fallback || "";
  const perfil = perfilesPorId.get(id);
  return perfil?.nombre || nombreDesdeEmail(perfil?.email) || fallback || "Usuario";
}

function pintarUsuarioActual() {
  const nombreEl = $("sessionName");
  const roleEl = $("sessionRole");
  if (nombreEl) nombreEl.textContent = usuarioActual ? usuarioNombre() : "Sin sesión";
  if (roleEl) roleEl.textContent = usuarioActual ? (perfilActual?.rol || usuarioActual.email || "Usuario autorizado") : "Verificando usuario";
}

async function detectarExtras() {
  extrasDisponibles = {
    perfiles: false,
    ventas: false,
    movimientos: false,
    auditoriaPiezas: false
  };

  try {
    const { error } = await avDB.from("perfiles").select("id, nombre, email, rol").limit(1);
    extrasDisponibles.perfiles = !error;
  } catch (_) {}

  try {
    const { error } = await avDB.from("ventas").select("id").limit(1);
    extrasDisponibles.ventas = !error;
  } catch (_) {}

  try {
    const { error } = await avDB.from("movimientos_inventario").select("id").limit(1);
    extrasDisponibles.movimientos = !error;
  } catch (_) {}

  try {
    const { error } = await avDB
      .from("piezas")
      .select("creado_por, actualizado_por, actualizado_en, vendido_por, vendido_en, precio_venta, metodo_pago, nota_venta")
      .limit(1);
    extrasDisponibles.auditoriaPiezas = !error;
  } catch (_) {}
}

async function cargarPerfilActual() {
  perfilActual = null;
  if (!usuarioActual) return;

  const perfilBase = {
    id: usuarioActual.id,
    email: usuarioActual.email,
    nombre: usuarioActual.user_metadata?.name || nombreDesdeEmail(usuarioActual.email),
    rol: "vendedor",
    activo: true,
    updated_at: new Date().toISOString()
  };

  if (extrasDisponibles.perfiles) {
    try {
      // 1) Búsqueda principal por UID de Supabase Auth.
      const { data: porId, error: errorId } = await avDB
        .from("perfiles")
        .select("id, nombre, email, rol, activo")
        .eq("id", usuarioActual.id)
        .maybeSingle();

      if (errorId) console.warn("No se pudo leer perfil por ID:", errorId.message);

      if (porId) {
        perfilActual = porId;
      }

      // 2) Respaldo por correo. Esto ayuda si el perfil se capturó bien en tabla,
      // pero el navegador todavía no está cruzando el UID como esperamos.
      if (!perfilActual && usuarioActual.email) {
        const { data: porEmail, error: errorEmail } = await avDB
          .from("perfiles")
          .select("id, nombre, email, rol, activo")
          .eq("email", usuarioActual.email)
          .maybeSingle();

        if (errorEmail) console.warn("No se pudo leer perfil por email:", errorEmail.message);
        if (porEmail) perfilActual = porEmail;
      }

      // 3) Si no existe perfil, crea uno básico para que el admin no se quede sin nombre.
      if (!perfilActual) {
        const { data: creado, error: errorCrear } = await avDB
          .from("perfiles")
          .insert(perfilBase)
          .select("id, nombre, email, rol, activo")
          .single();

        if (errorCrear) console.warn("No se pudo crear perfil básico:", errorCrear.message);
        perfilActual = creado || perfilBase;
      }
    } catch (error) {
      console.warn("No se pudo cargar perfil. Se usará sesión básica:", error.message);
      perfilActual = perfilBase;
    }
  }

  if (!perfilActual) perfilActual = perfilBase;

  // Para ventas y movimientos usamos siempre el UID real de la sesión actual,
  // aunque el perfil se haya encontrado por correo.
  perfilesPorId.set(usuarioActual.id, { ...perfilActual, id: usuarioActual.id });
}
async function prepararSesionPrivada() {
  const { data } = await avDB.auth.getUser();
  usuarioActual = data?.user || null;
  await detectarExtras();
  await cargarPerfilActual();
  pintarUsuarioActual();
}

async function cargarPerfilesRelacionados() {
  perfilesPorId = new Map(perfilActual?.id ? [[perfilActual.id, perfilActual]] : []);
  if (!extrasDisponibles.perfiles) return;

  const ids = [...new Set(piezas.flatMap((p) => [p.creado_por, p.actualizado_por, p.vendido_por]).filter(Boolean))];
  if (!ids.length) return;

  try {
    const { data, error } = await avDB
      .from("perfiles")
      .select("id, nombre, email, rol")
      .in("id", ids);
    if (!error) {
      (data || []).forEach((perfil) => perfilesPorId.set(perfil.id, perfil));
    }
  } catch (_) {}
}

function auditarPayload(payload, tipo = "actualizar") {
  if (!extrasDisponibles.auditoriaPiezas || !usuarioId()) return payload;
  const ahora = new Date().toISOString();
  const auditado = { ...payload, actualizado_por: usuarioId(), actualizado_en: ahora };
  if (tipo === "crear") auditado.creado_por = usuarioId();
  return auditado;
}

async function registrarMovimiento(accion, pieza, detalle = {}) {
  if (!extrasDisponibles.movimientos || !usuarioId()) return;
  try {
    await avDB.from("movimientos_inventario").insert({
      pieza_id: pieza?.id || null,
      folio: pieza?.folio || null,
      pieza: pieza?.pieza || null,
      accion,
      detalle,
      usuario_id: usuarioId(),
      usuario_email: usuarioEmail(),
      usuario_nombre: usuarioNombre()
    });
  } catch (error) {
    console.warn("No se pudo registrar movimiento:", error.message);
  }
}

async function registrarVenta(pieza, venta) {
  if (!extrasDisponibles.ventas || !usuarioId()) return;
  try {
    await avDB.from("ventas").insert({
      pieza_id: pieza.id,
      folio: pieza.folio || null,
      pieza: pieza.pieza || null,
      marca: pieza.marca || null,
      modelo: pieza.modelo || null,
      anio: pieza.anio || null,
      precio_lista: pieza.precio || null,
      precio_venta: venta.precio_venta || pieza.precio || null,
      metodo_pago: venta.metodo_pago || null,
      nota: venta.nota || null,
      vendedor_id: usuarioId(),
      vendedor_email: usuarioEmail(),
      vendedor_nombre: usuarioNombre(),
      vendido_en: venta.vendido_en
    });
  } catch (error) {
    console.warn("No se pudo registrar venta:", error.message);
  }
}

async function cargarVentasMes() {
  ventasMes = [];
  const inicioMes = inicioMesActualISO();

  if (extrasDisponibles.ventas) {
    try {
      const { data, error } = await avDB
        .from("ventas")
        .select("id, pieza_id, folio, pieza, marca, modelo, anio, precio_lista, precio_venta, metodo_pago, nota, vendedor_id, vendedor_nombre, vendedor_email, vendido_en")
        .gte("vendido_en", inicioMes)
        .order("vendido_en", { ascending: false });
      if (!error) ventasMes = data || [];
      return;
    } catch (_) {}
  }

  ventasMes = piezas
    .filter((p) => !p.disponible && p.vendido_en && new Date(p.vendido_en).toISOString() >= inicioMes)
    .map((p) => ({
      pieza_id: p.id,
      folio: p.folio,
      pieza: p.pieza,
      marca: p.marca,
      modelo: p.modelo,
      anio: p.anio,
      precio_lista: p.precio,
      precio_venta: p.precio_venta || p.precio,
      metodo_pago: p.metodo_pago,
      nota: p.nota_venta,
      vendedor_id: p.vendido_por,
      vendedor_nombre: nombrePerfil(p.vendido_por, "Sin registrar"),
      vendedor_email: "",
      vendido_en: p.vendido_en
    }));
}

function resumenVendedores() {
  const mapa = new Map();
  ventasMes.forEach((venta) => {
    const nombre = venta.vendedor_nombre || nombrePerfil(venta.vendedor_id, nombreDesdeEmail(venta.vendedor_email)) || "Sin registrar";
    const actual = mapa.get(nombre) || { nombre, piezas: 0, total: 0 };
    actual.piezas += 1;
    actual.total += Number(venta.precio_venta || 0);
    mapa.set(nombre, actual);
  });
  return [...mapa.values()].sort((a, b) => b.total - a.total || b.piezas - a.piezas);
}

function limpiarFormulario(opciones = {}) {
  const preservarVehiculo = Boolean(opciones.preservarVehiculo && $("mantenerVehiculo")?.checked);
  const preservarFamilia = Boolean(opciones.preservarFamilia && $("mantenerFamilia")?.checked);
  const guardado = {
    familia: preservarFamilia ? ($("familiaCaptura")?.value || "") : "",
    marca: preservarVehiculo ? $("marca").value : "",
    modelo: preservarVehiculo ? $("modelo").value : "",
    anio: preservarVehiculo ? $("anio").value : ""
  };

  $("piezaId").value = "";
  if ($("familiaCaptura")) $("familiaCaptura").value = guardado.familia;
  $("folio").value = "";
  $("pieza").value = "";
  $("marca").value = guardado.marca;
  $("modelo").value = guardado.modelo;
  $("anio").value = guardado.anio;
  $("lado").value = "";
  $("color").value = "";
  $("estado").value = ESTADO_DEFAULT_CAPTURA;
  $("precio").value = "";
  $("numeroParte").value = "";
  $("descripcion").value = "";
  $("disponible").checked = true;
  resetFotosTrabajo();
  pintarPreview();
  $("formTitle").textContent = "Nueva pieza";
  ultimoFolioGenerado = "";
  setFolioAyuda("");
  actualizarTextoBotonGuardar();

  if (!opciones.conservarEstado) {
    setStatus("formStatus", "");
  }

  if (guardado.familia) {
    autollenarFolio(true);
  }

  if (opciones.enfocarPieza) {
    requestAnimationFrame(() => $("pieza")?.focus());
  }
}

function valoresRecientes(campo, extras = [], limite = 60) {
  const vistos = new Set();
  const salida = [];
  const candidatos = [
    ...(piezas || []).map((pieza) => pieza?.[campo]),
    ...extras
  ];

  candidatos.forEach((valor) => {
    const limpio = mayusculas(valor);
    if (!limpio || vistos.has(limpio) || salida.length >= limite) return;
    vistos.add(limpio);
    salida.push(limpio);
  });

  return salida;
}

function pintarDatalist(id, valores) {
  const lista = $(id);
  if (!lista) return;
  lista.innerHTML = valores.map((valor) => `<option value="${escapeHtml(valor)}"></option>`).join("");
}

function actualizarListasSugerencias() {
  pintarDatalist("listaModelos", valoresRecientes("modelo"));
  pintarDatalist("listaAnios", valoresRecientes("anio"));
  pintarDatalist("listaColores", valoresRecientes("color", [
    "NEGRO", "BLANCO", "GRIS", "PLATA", "ROJO", "AZUL", "VERDE", "BEIGE", "CAFÉ", "DORADO"
  ]));
}

function datosFormulario() {
  return {
    folio: mayusculas($("folio").value) || null,
    pieza: mayusculas($("pieza").value),
    marca: mayusculas($("marca").value) || null,
    modelo: mayusculas($("modelo").value) || null,
    anio: mayusculas($("anio").value) || null,
    color: mayusculas($("color").value) || null,
    lado: mayusculas($("lado").value) || null,
    estado: mayusculas($("estado").value) || ESTADO_DEFAULT_CAPTURA,
    precio: $("precio").value ? Number($("precio").value) : null,
    numero_parte: mayusculas($("numeroParte").value) || null,
    descripcion: mayusculas($("descripcion").value) || null,
    disponible: $("disponible").checked
  };
}

async function verificarSupabase() {
  if (!avDB) {
    $("loginStatus").innerHTML = "Falta configurar <b>supabase-config.js</b> con tu URL y anon key.";
    $("loginStatus").className = "status err";
    return false;
  }
  return true;
}

async function verificarSesion() {
  if (!(await verificarSupabase())) return;

  const { data } = await avDB.auth.getSession();
  if (data.session) {
    mostrarAdmin();
    await prepararSesionPrivada();
    await cargarPiezas();
  } else {
    mostrarLogin();
  }
}

function mostrarLogin() {
  $("loginView").classList.remove("hidden");
  $("adminView").classList.add("hidden");
}

function mostrarAdmin() {
  $("loginView").classList.add("hidden");
  $("adminView").classList.remove("hidden");
}

async function iniciarSesion(event) {
  event.preventDefault();
  if (!(await verificarSupabase())) return;

  setStatus("loginStatus", "Entrando...");
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const { error } = await avDB.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus("loginStatus", "No se pudo entrar: " + error.message, "err");
    return;
  }

  setStatus("loginStatus", "Listo.", "ok");
  mostrarAdmin();
  await prepararSesionPrivada();
  await cargarPiezas();
}

async function cerrarSesion() {
  await avDB.auth.signOut();
  usuarioActual = null;
  perfilActual = null;
  perfilesPorId = new Map();
  pintarUsuarioActual();
  mostrarLogin();
}

async function cargarPiezas() {
  setStatus("tableStatus", "Cargando inventario...");

  const { data, error } = await supabase
    .from("piezas")
    .select("*, fotos(id, url, storage_path, orden)")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus("tableStatus", "Error cargando piezas: " + error.message, "err");
    return;
  }

  piezas = (data || []).map(normalizarPiezaConFotos);

  await cargarPerfilesRelacionados();
  await cargarVentasMes();
  actualizarListasSugerencias();
  pintarTabla();
  pintarStats();
  pintarVentasResumen();
  pintarResumenFamilias();
  setStatus("tableStatus", `${piezas.length} piezas cargadas.`, "ok");
}

function normalizarPiezaConFotos(pieza) {
  return {
    ...pieza,
    fotos: [...(pieza?.fotos || [])].sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
  };
}

async function actualizarPiezaLocal(piezaId, opciones = {}) {
  const { data, error } = await avDB
    .from("piezas")
    .select("*, fotos(id, url, storage_path, orden)")
    .eq("id", piezaId)
    .single();

  if (error) throw error;

  const piezaActualizada = normalizarPiezaConFotos(data);
  const indice = piezas.findIndex((pieza) => pieza.id === piezaId);

  if (indice >= 0) {
    piezas[indice] = piezaActualizada;
  } else {
    piezas.unshift(piezaActualizada);
  }

  piezas.sort((a, b) => {
    const fechaA = new Date(a.created_at || 0).getTime();
    const fechaB = new Date(b.created_at || 0).getTime();
    return fechaB - fechaA;
  });

  if (opciones.irPrimeraPagina) paginaTabla = 1;
  actualizarListasSugerencias();
  pintarTabla();
  pintarStats();
  pintarResumenFamilias();
  return piezaActualizada;
}

async function refrescarPiezaGuardada(piezaId, opciones = {}) {
  try {
    return await actualizarPiezaLocal(piezaId, opciones);
  } catch (error) {
    console.warn("No se pudo actualizar solo la pieza guardada. Se recargará el inventario completo:", error.message);
    await cargarPiezas();
    return piezas.find((pieza) => pieza.id === piezaId) || null;
  }
}

function pintarStats() {
  const totalMes = ventasMes.reduce((suma, venta) => suma + Number(venta.precio_venta || 0), 0);
  const ranking = resumenVendedores();

  $("statTotal").textContent = piezas.length;
  $("statDisponibles").textContent = piezas.filter((p) => p.disponible).length;
  $("statFotos").textContent = piezas.filter((p) => p.fotos?.length).length;
  if ($("statVendidasMes")) $("statVendidasMes").textContent = ventasMes.length;
  if ($("statMontoMes")) $("statMontoMes").textContent = dinero(totalMes);
  if ($("statMejorVendedor")) $("statMejorVendedor").textContent = ranking[0]?.nombre || "Sin ventas";
}

function pintarVentasResumen() {
  const contenedor = $("ventasResumen");
  if (!contenedor) return;

  const ranking = resumenVendedores();
  if (!ventasMes.length) {
    contenedor.innerHTML = `<p class="empty-state">Todavía no hay ventas registradas este mes.</p>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="sales-grid">
      ${ranking.map((vendedor) => `
        <article class="seller-card">
          <strong>${escapeHtml(vendedor.nombre)}</strong>
          <span>${vendedor.piezas} pieza(s) vendida(s)</span>
          <b>${dinero(vendedor.total)}</b>
        </article>
      `).join("")}
    </div>
    <div class="mini-sales-list">
      ${ventasMes.slice(0, 8).map((venta) => `
        <div class="sale-row">
          <span>${escapeHtml(venta.folio || "S/F")} · ${escapeHtml(venta.pieza || "Pieza")}</span>
          <strong>${dinero(venta.precio_venta)}</strong>
          <small>${escapeHtml(venta.vendedor_nombre || nombreDesdeEmail(venta.vendedor_email))} · ${fechaCorta(venta.vendido_en)}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function resumenFamiliasCaptura() {
  return Object.entries(familiasCaptura).map(([clave, info]) => {
    const numeros = (piezas || [])
      .map((pieza) => numeroDesdeFolio(pieza.folio, info.prefijo))
      .filter((numero) => numero > 0);
    const maximo = numeros.length ? Math.max(...numeros) : 0;
    const ultimo = maximo ? formatearFolio(info.prefijo, maximo) : "Sin piezas";
    const siguiente = formatearFolio(info.prefijo, maximo + 1);
    return { clave, ...info, total: numeros.length, maximo, ultimo, siguiente };
  });
}

function pintarResumenFamilias() {
  const contenedor = $("familiasResumen");
  if (!contenedor) return;

  const resumen = resumenFamiliasCaptura();
  contenedor.innerHTML = `
    <div class="sales-grid">
      ${resumen.map((familia) => `
        <article class="seller-card">
          <strong>${escapeHtml(familia.prefijo)}</strong>
          <span>${escapeHtml(familia.nombre)} · ${familia.total} pieza(s)</span>
          <b>Sigue: ${escapeHtml(familia.siguiente)}</b>
          <small style="color:var(--muted)">Último: ${escapeHtml(familia.ultimo)}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function textoVentaPieza(p) {
  if (p.disponible) return `<span style="color:var(--muted)">Sin venta</span>`;
  const vendedor = p.vendido_por ? nombrePerfil(p.vendido_por, "Vendedor") : "Sin registrar";
  const fecha = fechaCorta(p.vendido_en);
  const precio = p.precio_venta ? dinero(p.precio_venta) : "";
  const metodo = p.metodo_pago ? ` · ${escapeHtml(p.metodo_pago)}` : "";
  return `<strong>${escapeHtml(vendedor)}</strong><br><span style="color:var(--muted)">${escapeHtml(fecha || "Fecha no registrada")}${precio ? ` · ${precio}` : ""}${metodo}</span>`;
}

function piezasFiltradas() {
  const q = normalizar(filtroTabla);

  return piezas.filter((p) => {
    const coincideBusqueda = !q || normalizar([
      p.folio,
      p.pieza,
      p.marca,
      p.modelo,
      p.anio,
      p.color,
      p.lado,
      p.estado,
      p.numero_parte,
      p.descripcion,
      p.metodo_pago,
      nombrePerfil(p.vendido_por)
    ].join(" ")).includes(q);

    return coincideBusqueda && coincideFamilia(p, filtroFamilia);
  });
}

function actualizarPaginacion(totalResultados, inicio, fin) {
  const totalPaginas = Math.max(1, Math.ceil(totalResultados / FILAS_POR_PAGINA));
  const info = $("paginaInfo");
  const anterior = $("paginaAnterior");
  const siguiente = $("paginaSiguiente");

  if (info) {
    info.textContent = totalResultados
      ? `Página ${paginaTabla} de ${totalPaginas} · ${inicio + 1}-${fin} de ${totalResultados}`
      : "Página 1 de 1 · Sin resultados";
  }
  if (anterior) anterior.disabled = paginaTabla <= 1 || !totalResultados;
  if (siguiente) siguiente.disabled = paginaTabla >= totalPaginas || !totalResultados;
}

function pintarTabla() {
  const tbody = $("tablaPiezas");
  const filtradas = piezasFiltradas();
  tbody.innerHTML = "";

  if (!filtradas.length) {
    paginaTabla = 1;
    tbody.innerHTML = `<tr><td colspan="8">No hay piezas con ese filtro.</td></tr>`;
    actualizarPaginacion(0, 0, 0);
    setStatus("tableStatus", "Sin resultados. Prueba otra familia o limpia los filtros.", "");
    return;
  }

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  paginaTabla = Math.min(Math.max(1, paginaTabla), totalPaginas);
  const inicio = (paginaTabla - 1) * FILAS_POR_PAGINA;
  const fin = Math.min(inicio + FILAS_POR_PAGINA, filtradas.length);
  const visibles = filtradas.slice(inicio, fin);

  const filtrosActivos = filtroTabla || filtroFamilia;
  if (filtrosActivos) {
    setStatus("tableStatus", `${filtradas.length} de ${piezas.length} pieza(s) encontradas. Mostrando ${inicio + 1}-${fin}.`, "ok");
  } else {
    setStatus("tableStatus", `${piezas.length} piezas cargadas. Mostrando ${inicio + 1}-${fin}.`, "ok");
  }

  visibles.forEach((p) => {
    const primeraFoto = p.fotos?.[0]?.url || "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="thumbs">
          ${primeraFoto ? `<img src="${escapeHtml(primeraFoto)}" alt="Foto de ${escapeHtml(p.pieza || "pieza")}" loading="lazy" decoding="async">` : ""}
          <span>${p.fotos?.length || 0}</span>
        </div>
      </td>
      <td>${escapeHtml(p.folio || p.id.slice(0, 8))}</td>
      <td><strong>${escapeHtml(p.pieza || "")}</strong><br><span style="color:var(--muted)">${escapeHtml(p.color || "")} ${escapeHtml(p.lado || "")}</span></td>
      <td>${escapeHtml(p.marca || "")} ${escapeHtml(p.modelo || "")}<br><span style="color:var(--muted)">${escapeHtml(p.anio || "")}</span></td>
      <td>${dinero(p.precio)}</td>
      <td><span class="pill ${p.disponible ? "" : "off"}">${p.disponible ? "Disponible" : "Vendido / oculto"}</span></td>
      <td>${textoVentaPieza(p)}</td>
      <td>
        <div class="row-actions">
          <button class="btn mini" data-action="toggle" data-id="${p.id}">${p.disponible ? "Marcar vendido" : "Publicar"}</button>
          <button class="btn mini" data-action="downloadPhotos" data-id="${p.id}" ${p.fotos?.length ? "" : "disabled"}>Descargar fotos</button>
          <button class="btn mini admin-only" data-action="edit" data-id="${p.id}">Editar</button>
          <button class="btn mini danger admin-only" data-action="delete" data-id="${p.id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  actualizarPaginacion(filtradas.length, inicio, fin);

  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => manejarAccionTabla(btn.dataset.action, btn.dataset.id));
  });

  if (typeof aplicarVistaPorRol === "function") {
    aplicarVistaPorRol();
  }
}

async function manejarAccionTabla(action, id) {
  const pieza = piezas.find((p) => p.id === id);
  if (!pieza) return;

  if (action === "edit") return editarPieza(pieza);
  if (action === "toggle") return toggleDisponibilidad(pieza);
  if (action === "downloadPhotos") return descargarFotosPieza(pieza);
  if (action === "delete") return eliminarPieza(pieza);
}


async function descargarFotosPieza(p) {
  const fotos = (p.fotos || []).filter((foto) => foto?.url || foto?.storage_path);

  if (!fotos.length) {
    alert("Esta pieza todavía no tiene fotos para descargar.");
    return;
  }

  const base = nombreBaseDescarga(p);
  const continuar = fotos.length > 1
    ? confirm(`Se descargarán ${fotos.length} fotos como imágenes separadas. Si tu navegador pide permiso para descargas múltiples, dale Permitir. ¿Continuar?`)
    : true;

  if (!continuar) return;

  setStatus("tableStatus", `Descargando ${fotos.length} foto(s) de ${p.folio || p.pieza || "la pieza"}...`);

  try {
    for (let i = 0; i < fotos.length; i++) {
      const foto = fotos[i];
      setStatus("tableStatus", `Descargando foto ${i + 1} de ${fotos.length}...`);

      const blob = await obtenerBlobFoto(foto);
      const extension = extensionFoto(foto, blob.type);
      const nombre = `${base}-${String(i + 1).padStart(2, "0")}.${extension}`;
      descargarBlob(blob, nombre);

      // Pausa pequeña para que Chrome/Edge no trate todas las descargas como un solo golpe.
      await esperar(450);
    }

    setStatus("tableStatus", `${fotos.length} foto(s) enviadas a descarga como imágenes separadas.`, "ok");
  } catch (error) {
    console.error("Error descargando fotos:", error);
    setStatus("tableStatus", "No se pudieron descargar las fotos: " + error.message, "err");
  }
}

async function obtenerBlobFoto(foto) {
  if (foto.storage_path && avDB?.storage) {
    const { data, error } = await avDB.storage.from(bucket).download(foto.storage_path);
    if (!error && data) return data;
  }

  if (foto.url) {
    const response = await fetch(foto.url, { mode: "cors" });
    if (!response.ok) throw new Error(`No se pudo leer una foto (${response.status}).`);
    return await response.blob();
  }

  throw new Error("Una foto no tiene URL ni ruta de almacenamiento.");
}

function nombreBaseDescarga(p) {
  const partes = [
    p.folio ? `ID-${p.folio}` : p.id?.slice(0, 8),
    p.pieza,
    p.marca,
    p.modelo,
    p.anio
  ].filter(Boolean);

  return slug(partes.join("-"))
    .replace(/-+/g, "-")
    .slice(0, 90) || "autoparte-vences";
}

function extensionFoto(foto, mime = "") {
  const desdeMime = String(mime || "").toLowerCase();
  if (desdeMime.includes("jpeg") || desdeMime.includes("jpg")) return "jpg";
  if (desdeMime.includes("png")) return "png";
  if (desdeMime.includes("webp")) return "webp";
  if (desdeMime.includes("avif")) return "avif";
  if (desdeMime.includes("heic")) return "heic";

  const texto = [foto.storage_path, foto.url, foto.nombre].filter(Boolean).join(" ").split("?")[0].toLowerCase();
  const match = texto.match(/\.([a-z0-9]{2,5})$/);
  const ext = match?.[1];
  return ["jpg", "jpeg", "png", "webp", "avif", "heic"].includes(ext) ? (ext === "jpeg" ? "jpg" : ext) : "jpg";
}

function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ZipSinCompresion {
  constructor() {
    this.files = [];
  }

  add(nombre, bytes) {
    const limpio = nombre.replace(/[\\/:*?"<>|]+/g, "-");
    this.files.push({ nombre: limpio, bytes, crc: crc32(bytes), fecha: new Date() });
  }

  blob() {
    const locales = [];
    const centrales = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = new TextEncoder().encode(file.nombre);
      const { time, date } = fechaZip(file.fecha);

      const local = bytesZip([
        u32(0x04034b50),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(time),
        u16(date),
        u32(file.crc),
        u32(file.bytes.length),
        u32(file.bytes.length),
        u16(nameBytes.length),
        u16(0),
        nameBytes,
        file.bytes
      ]);

      const central = bytesZip([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(time),
        u16(date),
        u32(file.crc),
        u32(file.bytes.length),
        u32(file.bytes.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes
      ]);

      locales.push(local);
      centrales.push(central);
      offset += local.length;
    }

    const centralOffset = offset;
    const centralSize = centrales.reduce((total, item) => total + item.length, 0);
    const end = bytesZip([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(this.files.length),
      u16(this.files.length),
      u32(centralSize),
      u32(centralOffset),
      u16(0)
    ]);

    return new Blob([...locales, ...centrales, end], { type: "application/zip" });
  }
}

function fechaZip(fecha) {
  const year = Math.max(1980, fecha.getFullYear());
  const time = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | Math.floor(fecha.getSeconds() / 2);
  const date = ((year - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  return { time, date };
}

function u16(value) {
  return Uint8Array.of(value & 255, (value >>> 8) & 255);
}

function u32(value) {
  return Uint8Array.of(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function bytesZip(partes) {
  const total = partes.reduce((suma, parte) => suma + parte.length, 0);
  const salida = new Uint8Array(total);
  let offset = 0;

  partes.forEach((parte) => {
    salida.set(parte, offset);
    offset += parte.length;
  });

  return salida;
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ tablaCrc32[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const tablaCrc32 = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function editarPieza(p) {
  $("piezaId").value = p.id;
  $("folio").value = p.folio || "";
  seleccionarFamiliaPorFolio(p.folio || "");
  ultimoFolioGenerado = "";
  setFolioAyuda("Editando pieza existente. El ID no se cambia automático.");
  $("pieza").value = p.pieza || "";
  $("marca").value = p.marca || "";
  $("modelo").value = p.modelo || "";
  $("anio").value = p.anio || "";
  $("lado").value = p.lado || "";
  $("color").value = p.color || "";
  $("estado").value = p.estado || ESTADO_DEFAULT_CAPTURA;
  $("precio").value = p.precio || "";
  $("numeroParte").value = p.numero_parte || "";
  $("descripcion").value = p.descripcion || "";
  $("disponible").checked = Boolean(p.disponible);
  resetFotosTrabajo();
  fotosTrabajo = (p.fotos || []).map((foto) => ({
    ...foto,
    tipo: "guardada",
    clave: `guardada-${foto.id}`
  }));
  pintarPreview();
  $("formTitle").textContent = `Editando ${p.folio || p.pieza || "pieza"}`;
  actualizarTextoBotonGuardar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function toggleDisponibilidad(p) {
  if (!p.disponible) {
    const confirmar = confirm(`¿Volver a publicar la pieza ${p.folio || p.pieza}?`);
    if (!confirmar) return;

    setStatus("tableStatus", "Publicando pieza...");
    const payload = auditarPayload({
      disponible: true,
      vendido_por: null,
      vendido_en: null,
      precio_venta: null,
      metodo_pago: null,
      nota_venta: null
    });

    const payloadSeguro = extrasDisponibles.auditoriaPiezas ? payload : { disponible: true };
    const { error } = await avDB.from("piezas").update(payloadSeguro).eq("id", p.id);

    if (error) {
      setStatus("tableStatus", "Error: " + error.message, "err");
      return;
    }

    await registrarMovimiento("publicar", p, { antes: "Vendido", despues: "Disponible" });
    await cargarPiezas();
    return;
  }

  const precioTexto = prompt(`Precio final de venta para ${p.folio || p.pieza}:`, p.precio || "");
  if (precioTexto === null) return;
  const precioVenta = numero(precioTexto) || p.precio || null;

  const metodoPago = prompt("Método de pago: efectivo, transferencia, TDC, TDD u otro", "Efectivo");
  if (metodoPago === null) return;

  const notaVenta = prompt("Nota opcional de la venta:", "");
  if (notaVenta === null) return;

  setStatus("tableStatus", "Registrando venta...");
  const vendidoEn = new Date().toISOString();
  const payloadVenta = auditarPayload({
    disponible: false,
    vendido_por: usuarioId(),
    vendido_en: vendidoEn,
    precio_venta: precioVenta,
    metodo_pago: metodoPago.trim() || null,
    nota_venta: notaVenta.trim() || null
  });
  const payloadSeguro = extrasDisponibles.auditoriaPiezas
    ? payloadVenta
    : { disponible: false };

  const { error } = await avDB.from("piezas").update(payloadSeguro).eq("id", p.id);

  if (error) {
    setStatus("tableStatus", "Error: " + error.message, "err");
    return;
  }

  await registrarVenta(p, {
    precio_venta: precioVenta,
    metodo_pago: metodoPago.trim() || null,
    nota: notaVenta.trim() || null,
    vendido_en: vendidoEn
  });
  await registrarMovimiento("marcar_vendido", p, {
    precio_venta: precioVenta,
    metodo_pago: metodoPago.trim() || null
  });

  await cargarPiezas();
}

async function eliminarPieza(p) {
  const confirmar = confirm(`¿Eliminar la pieza ${p.folio || p.pieza}? También se intentarán borrar sus fotos.`);
  if (!confirmar) return;

  setStatus("tableStatus", "Eliminando pieza...");

  const paths = [...new Set((p.fotos || []).flatMap(pathsFotoStorage).filter(Boolean))];
  if (paths.length) {
    const { error: storageError } = await avDB.storage.from(bucket).remove(paths);
    if (storageError) console.warn("No se pudieron borrar todos los archivos de foto:", storageError.message);
  }

  const { error } = await avDB.from("piezas").delete().eq("id", p.id);

  if (error) {
    setStatus("tableStatus", "Error eliminando: " + error.message, "err");
    return;
  }

  await registrarMovimiento("eliminar_pieza", p, { fotos_eliminadas: paths.length });
  limpiarFormulario();
  await cargarPiezas();
}

async function guardarPieza(event) {
  event.preventDefault();

  let payload = datosFormulario();
  if (!payload.pieza) {
    setStatus("formStatus", "La pieza es obligatoria.", "err");
    $("pieza")?.focus();
    return;
  }

  const idActual = $("piezaId").value;
  const esNueva = !idActual;
  const botonGuardar = $("saveBtn");
  botonGuardar.disabled = true;
  botonGuardar.setAttribute("aria-busy", "true");
  setStatus("formStatus", "Guardando publicación...");

  let piezaGuardada;

  try {
    payload = await asegurarFolioAntesDeGuardar(payload, idActual);
    if (idActual) {
      const payloadActualizado = auditarPayload(payload, "actualizar");
      const { data, error } = await avDB
        .from("piezas")
        .update(payloadActualizado)
        .eq("id", idActual)
        .select()
        .single();
      if (error) throw error;
      piezaGuardada = data;
      await registrarMovimiento("editar_pieza", piezaGuardada, { folio: piezaGuardada.folio || null });
    } else {
      const payloadNuevo = auditarPayload(payload, "crear");
      const { data, error } = await avDB
        .from("piezas")
        .insert(payloadNuevo)
        .select()
        .single();
      if (error) throw error;
      piezaGuardada = data;
      await registrarMovimiento("crear_pieza", piezaGuardada, { folio: piezaGuardada.folio || null });
    }

    const resumenFotos = await guardarFotosTrabajo(piezaGuardada.id);
    if (resumenFotos.subidas || resumenFotos.eliminadas || resumenFotos.reordenadas) {
      await registrarMovimiento("actualizar_fotos", piezaGuardada, resumenFotos);
    }

    await refrescarPiezaGuardada(piezaGuardada.id, { irPrimeraPagina: esNueva });

    const folioGuardado = piezaGuardada.folio || payload.folio || "La pieza";
    limpiarFormulario({
      preservarVehiculo: true,
      preservarFamilia: true,
      conservarEstado: true,
      enfocarPieza: true
    });
    setStatus(
      "formStatus",
      `${folioGuardado} quedó guardada correctamente. El formulario ya está listo para la siguiente pieza.`,
      "ok"
    );
  } catch (error) {
    setStatus("formStatus", "Error guardando: " + error.message, "err");
  } finally {
    botonGuardar.disabled = false;
    botonGuardar.removeAttribute("aria-busy");
    actualizarTextoBotonGuardar();
  }
}

async function guardarFotosTrabajo(piezaId) {
  const resumen = { subidas: 0, eliminadas: 0, reordenadas: 0 };

  if (!piezaId) return resumen;

  if (fotosEliminadas.length) {
    setStatus("formStatus", `Eliminando ${fotosEliminadas.length} foto(s)...`);

    const ids = fotosEliminadas.map((foto) => foto.id).filter(Boolean);
    const paths = [...new Set(fotosEliminadas.flatMap(pathsFotoStorage).filter(Boolean))];

    if (paths.length) {
      const { error: storageError } = await avDB.storage.from(bucket).remove(paths);
      if (storageError) throw storageError;
    }

    if (ids.length) {
      const { error: deleteError } = await avDB.from("fotos").delete().in("id", ids);
      if (deleteError) throw deleteError;
    }

    resumen.eliminadas = ids.length;
  }

  for (let orden = 0; orden < fotosTrabajo.length; orden++) {
    const foto = fotosTrabajo[orden];

    if (foto.tipo === "guardada") {
      if (Number(foto.orden ?? -1) !== orden) {
        const { error } = await avDB.from("fotos").update({ orden }).eq("id", foto.id);
        if (error) throw error;
        resumen.reordenadas += 1;
        foto.orden = orden;
      }
      continue;
    }

    if (foto.tipo === "nueva") {
      setStatus("formStatus", `Subiendo foto ${resumen.subidas + 1}...`);
      await subirFotoNueva(piezaId, foto.file, orden);
      resumen.subidas += 1;
    }
  }

  fotosEliminadas = [];
  sincronizarArchivosSeleccionados();
  return resumen;
}

async function subirFotoNueva(piezaId, file, orden) {
  const nombreBase = (file?.name || "autoparte").replace(/\.[^.]+$/, "") || "autoparte";
  const sello = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const basePath = `${sello}-${orden + 1}-${slug(nombreBase)}`;

  const archivoCompleto = await crearVersionImagen(file, {
    maxLado: 1400,
    calidadInicial: 0.76,
    tamanoObjetivoKb: 550,
    sufijo: "web"
  });
  const miniatura = await crearVersionImagen(file, {
    maxLado: 560,
    calidadInicial: 0.68,
    tamanoObjetivoKb: 120,
    sufijo: "mini"
  });

  const extensionCompleta = extensionArchivo(archivoCompleto);
  const extensionMiniatura = extensionArchivo(miniatura);
  const pathCompleto = `${piezaId}/full/${basePath}.${extensionCompleta}`;
  const pathMiniatura = `${piezaId}/thumbs/${basePath}.${extensionMiniatura}`;

  try {
    await subirArchivoStorage(pathCompleto, archivoCompleto, false);
    await subirArchivoStorage(pathMiniatura, miniatura, false);

    const { data: publicData } = avDB.storage.from(bucket).getPublicUrl(pathMiniatura);
    const urlMiniatura = publicData.publicUrl;

    const { error: insertFotoError } = await avDB.from("fotos").insert({
      pieza_id: piezaId,
      url: urlMiniatura,
      storage_path: pathCompleto,
      orden
    });

    if (insertFotoError) throw insertFotoError;
  } catch (error) {
    await avDB.storage.from(bucket).remove([pathCompleto, pathMiniatura]).catch(() => {});
    throw error;
  }
}

async function subirArchivoStorage(path, file, upsert = false) {
  const { error } = await avDB.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "31536000",
      upsert,
      contentType: file.type || "image/webp"
    });
  if (error) throw error;
}

function extensionArchivo(file) {
  const tipo = String(file?.type || "").toLowerCase();
  if (tipo.includes("webp")) return "webp";
  if (tipo.includes("png")) return "png";
  if (tipo.includes("jpeg") || tipo.includes("jpg")) return "jpg";
  const nombre = String(file?.name || "").split("?")[0];
  const ext = nombre.includes(".") ? nombre.split(".").pop().toLowerCase() : "";
  return ["webp", "png", "jpg", "jpeg"].includes(ext) ? (ext === "jpeg" ? "jpg" : ext) : "webp";
}

async function crearVersionImagen(file, opciones = {}) {
  if (!file) throw new Error("No se recibió la fotografía.");

  const maxLado = Number(opciones.maxLado || 1400);
  const calidadInicial = Number(opciones.calidadInicial || 0.76);
  const objetivoBytes = Number(opciones.tamanoObjetivoKb || 550) * 1024;
  const sufijo = opciones.sufijo || "web";
  let bitmap;

  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (error) {
    const tipo = String(file.type || "").toLowerCase();
    if (tipo.includes("heic") || tipo.includes("heif")) {
      throw new Error("La foto está en formato HEIC. En el iPhone usa Cámara > Formatos > Más compatible y vuelve a seleccionarla.");
    }
    throw new Error(`No se pudo leer la imagen ${file.name || "seleccionada"}.`);
  }

  try {
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("El navegador no pudo preparar la fotografía.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let tipoSalida = "image/webp";
    let calidad = calidadInicial;
    let blob = await canvasABlob(canvas, tipoSalida, calidad);

    if (!blob || !["image/webp", "image/jpeg"].includes(blob.type)) {
      tipoSalida = "image/jpeg";
      blob = await canvasABlob(canvas, tipoSalida, calidad);
    }
    if (!blob) throw new Error("No se pudo comprimir la fotografía.");
    tipoSalida = blob.type || tipoSalida;

    while (blob.size > objetivoBytes && calidad > 0.46) {
      calidad = Math.max(0.46, calidad - 0.07);
      const siguiente = await canvasABlob(canvas, tipoSalida, calidad);
      if (!siguiente || siguiente.size >= blob.size) break;
      blob = siguiente;
    }

    const base = String(file.name || "autoparte").replace(/\.[^.]+$/, "") || "autoparte";
    const extension = tipoSalida === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${base}-${sufijo}.${extension}`, {
      type: tipoSalida,
      lastModified: Date.now()
    });
  } finally {
    bitmap.close?.();
  }
}

function canvasABlob(canvas, tipo, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

function storagePathDesdeUrl(url) {
  const texto = String(url || "").trim();
  if (!texto) return "";
  try {
    const pathname = new URL(texto).pathname;
    const marcador = `/storage/v1/object/public/${bucket}/`;
    const indice = pathname.indexOf(marcador);
    if (indice < 0) return "";
    return pathname.slice(indice + marcador.length).split("/").map(decodeURIComponent).join("/");
  } catch (_) {
    return "";
  }
}

function pathsFotoStorage(foto) {
  const paths = [];
  if (foto?.storage_path) paths.push(foto.storage_path);
  const pathUrl = storagePathDesdeUrl(foto?.url);
  if (pathUrl && !paths.includes(pathUrl)) paths.push(pathUrl);
  return paths;
}

function pathMiniaturaDesdeOriginal(storagePath, extension = "webp") {
  const limpio = String(storagePath || "").replace(/^\/+/, "");
  if (!limpio) return "";
  const partes = limpio.split("/");
  const archivo = partes.pop() || "foto";
  if (partes.at(-1) === "full") partes.pop();
  const base = archivo.replace(/\.[^.]+$/, "") || "foto";
  const ext = ["webp", "jpg", "png"].includes(extension) ? extension : "webp";
  return [...partes, "thumbs", `${base}.${ext}`].join("/");
}

function fotoYaTieneMiniatura(foto) {
  return storagePathDesdeUrl(foto?.url).split("/").includes("thumbs");
}

async function optimizarFotosExistentes() {
  if (!esAdminActual()) {
    setStatus("tableStatus", "Solo un administrador puede optimizar las fotos existentes.", "err");
    return;
  }

  const pendientes = piezas
    .flatMap((pieza) => (pieza.fotos || []).map((foto) => ({ ...foto, pieza_id: pieza.id })))
    .filter((foto) => foto.id && foto.storage_path && !fotoYaTieneMiniatura(foto));

  if (!pendientes.length) {
    setStatus("tableStatus", "Todas las fotos de Supabase ya tienen miniatura ligera.", "ok");
    return;
  }

  const confirmar = confirm(`Se crearán miniaturas ligeras para ${pendientes.length} foto(s). Las fotos grandes se conservarán para el detalle y las descargas. ¿Continuar?`);
  if (!confirmar) return;

  const boton = $("optimizeExistingPhotos");
  if (boton) boton.disabled = true;
  let correctas = 0;
  let fallidas = 0;

  for (let index = 0; index < pendientes.length; index++) {
    const foto = pendientes[index];
    setStatus("tableStatus", `Optimizando foto ${index + 1} de ${pendientes.length}...`);

    try {
      const { data: blob, error: downloadError } = await avDB.storage.from(bucket).download(foto.storage_path);
      if (downloadError) throw downloadError;

      const nombre = foto.storage_path.split("/").pop() || `foto-${index + 1}.jpg`;
      const archivo = new File([blob], nombre, { type: blob.type || "image/jpeg" });
      const miniatura = await crearVersionImagen(archivo, {
        maxLado: 560,
        calidadInicial: 0.68,
        tamanoObjetivoKb: 120,
        sufijo: "mini"
      });
      const pathMiniatura = pathMiniaturaDesdeOriginal(foto.storage_path, extensionArchivo(miniatura));
      await subirArchivoStorage(pathMiniatura, miniatura, true);
      const { data: publicData } = avDB.storage.from(bucket).getPublicUrl(pathMiniatura);

      const { error: updateError } = await avDB
        .from("fotos")
        .update({ url: publicData.publicUrl })
        .eq("id", foto.id);
      if (updateError) throw updateError;
      correctas += 1;
    } catch (error) {
      fallidas += 1;
      console.warn(`No se pudo optimizar la foto ${foto.id}:`, error);
    }
  }

  if (boton) boton.disabled = false;
  await cargarPiezas();
  const tipo = fallidas ? "" : "ok";
  setStatus("tableStatus", `Optimización terminada: ${correctas} miniatura(s) creadas${fallidas ? ` y ${fallidas} pendiente(s)` : ""}.`, tipo);
}

function resetFotosTrabajo() {
  fotosTrabajo.forEach((foto) => {
    if (foto.tipo === "nueva" && foto.url?.startsWith("blob:")) {
      URL.revokeObjectURL(foto.url);
    }
  });
  fotosTrabajo = [];
  fotosEliminadas = [];
  archivosSeleccionados = [];
  const input = $("fotosInput");
  if (input) input.value = "";
}

function sincronizarArchivosSeleccionados() {
  archivosSeleccionados = fotosTrabajo
    .filter((foto) => foto.tipo === "nueva")
    .map((foto) => foto.file);
}

function prepararFotoNueva(file) {
  contadorFotoTemporal += 1;
  return {
    tipo: "nueva",
    clave: `nueva-${Date.now()}-${contadorFotoTemporal}`,
    nombre: file.name,
    file,
    url: URL.createObjectURL(file)
  };
}

function seleccionarFotos(files) {
  const nuevos = [...files].filter((file) => file.type.startsWith("image/"));
  if (!nuevos.length) return;

  fotosTrabajo = [...fotosTrabajo, ...nuevos.map(prepararFotoNueva)];
  sincronizarArchivosSeleccionados();
  pintarPreview();

  const input = $("fotosInput");
  if (input) input.value = "";
}

function quitarFoto(index) {
  const foto = fotosTrabajo[index];
  if (!foto) return;

  const confirmar = foto.tipo === "guardada"
    ? confirm("¿Quitar esta foto de la publicación? Se borrará al guardar.")
    : true;

  if (!confirmar) return;

  if (foto.tipo === "guardada") {
    fotosEliminadas.push(foto);
  } else if (foto.url?.startsWith("blob:")) {
    URL.revokeObjectURL(foto.url);
  }

  fotosTrabajo.splice(index, 1);
  sincronizarArchivosSeleccionados();
  pintarPreview();
}

function moverFoto(index, direccion) {
  const nuevoIndex = index + direccion;
  if (nuevoIndex < 0 || nuevoIndex >= fotosTrabajo.length) return;

  const copia = [...fotosTrabajo];
  [copia[index], copia[nuevoIndex]] = [copia[nuevoIndex], copia[index]];
  fotosTrabajo = copia;
  sincronizarArchivosSeleccionados();
  pintarPreview();
}

function hacerPortada(index) {
  if (index <= 0 || index >= fotosTrabajo.length) return;

  const copia = [...fotosTrabajo];
  const [foto] = copia.splice(index, 1);
  copia.unshift(foto);
  fotosTrabajo = copia;
  sincronizarArchivosSeleccionados();
  pintarPreview();
}

function manejarAccionPreview(event) {
  const boton = event.target.closest("[data-photo-action]");
  if (!boton) return;

  const index = Number(boton.dataset.index);
  const accion = boton.dataset.photoAction;

  if (accion === "delete") quitarFoto(index);
  if (accion === "up") moverFoto(index, -1);
  if (accion === "down") moverFoto(index, 1);
  if (accion === "cover") hacerPortada(index);
}

function pintarPreview() {
  const preview = $("preview");
  preview.innerHTML = "";

  if (!fotosTrabajo.length) {
    preview.innerHTML = `<p class="preview-note">Todavía no hay fotos. La primera foto que agregues será la portada.</p>`;
    return;
  }

  fotosTrabajo.forEach((foto, index) => {
    const card = document.createElement("article");
    card.className = `preview-card ${index === 0 ? "cover" : ""}`.trim();

    const etiqueta = foto.tipo === "guardada" ? "Guardada" : "Nueva";
    const nombre = foto.nombre || foto.file?.name || `Foto ${index + 1}`;

    card.innerHTML = `
      <div class="preview-photo-wrap">
        <img src="${escapeHtml(foto.url)}" alt="${escapeHtml(nombre)}">
        <span class="preview-badge">${index === 0 ? "Portada" : etiqueta}</span>
      </div>
      <div class="preview-actions">
        <button type="button" class="photo-btn" data-photo-action="cover" data-index="${index}" ${index === 0 ? "disabled" : ""}>Portada</button>
        <button type="button" class="photo-btn" data-photo-action="up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="photo-btn" data-photo-action="down" data-index="${index}" ${index === fotosTrabajo.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="photo-btn danger" data-photo-action="delete" data-index="${index}">Eliminar</button>
      </div>
    `;

    preview.appendChild(card);
  });
}

function configurarDropzone() {
  const dropzone = $("dropzone");
  const input = $("fotosInput");

  dropzone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => seleccionarFotos(input.files));

  ["dragenter", "dragover"].forEach((evento) => {
    dropzone.addEventListener(evento, (e) => {
      e.preventDefault();
      dropzone.classList.add("drag");
    });
  });

  ["dragleave", "drop"].forEach((evento) => {
    dropzone.addEventListener(evento, (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag");
    });
  });

  dropzone.addEventListener("drop", (e) => seleccionarFotos(e.dataTransfer.files));
}

function mapearFilaExcel(row) {
  const n = {};
  Object.entries(row).forEach(([key, value]) => {
    n[normalizar(key).replace(/[^a-z0-9]/g, "")] = value;
  });

  const disponibleTexto = String(n.disponible ?? n.estado ?? "SI").toLowerCase();
  const disponible = !(disponibleTexto.includes("no") || disponibleTexto.includes("vend"));

  return {
    folio: limpiar(n.id ?? n.folio ?? n.codigo),
    pieza: limpiar(n.pieza ?? n.nombre ?? n.producto ?? n.autoparte),
    marca: limpiar(n.marca),
    modelo: limpiar(n.modelo),
    anio: limpiar(n.anio ?? n.ano ?? n.año),
    color: limpiar(n.color),
    lado: limpiar(n.lado),
    estado: limpiar(n.estado) || ESTADO_DEFAULT_CAPTURA,
    precio: numero(n.precio),
    numero_parte: limpiar(n.numeroparte ?? n.numerodeparte ?? n.noparte ?? n.nparte),
    descripcion: limpiar(n.descripcion ?? n.observaciones ?? n.detalles),
    disponible
  };
}

function limpiar(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto || null;
}

function numero(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const parsed = Number(String(valor).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function importarExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  setStatus("tableStatus", "Leyendo Excel...");

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const payload = rows.map(mapearFilaExcel).filter((row) => row.pieza);

    if (!payload.length) {
      setStatus("tableStatus", "No encontré filas válidas. Revisa que exista columna de pieza/nombre.", "err");
      return;
    }

    let creadas = 0;
    let actualizadas = 0;

    for (const item of payload) {
      if (item.folio) {
        const { data: existente, error: buscarError } = await supabase
          .from("piezas")
          .select("id")
          .eq("folio", item.folio)
          .maybeSingle();

        if (buscarError) throw buscarError;

        if (existente) {
          const { error } = await avDB.from("piezas").update(auditarPayload(item, "actualizar")).eq("id", existente.id);
          if (error) throw error;
          actualizadas++;
        } else {
          const { error } = await avDB.from("piezas").insert(auditarPayload(item, "crear"));
          if (error) throw error;
          creadas++;
        }
      } else {
        const { error } = await avDB.from("piezas").insert(auditarPayload(item, "crear"));
        if (error) throw error;
        creadas++;
      }
    }

    await registrarMovimiento("importar_excel", null, { creadas, actualizadas, archivo: file.name });
    await cargarPiezas();
    setStatus("tableStatus", `Excel importado: ${creadas} creadas, ${actualizadas} actualizadas.`, "ok");
  } catch (error) {
    setStatus("tableStatus", "Error importando Excel: " + error.message, "err");
  } finally {
    event.target.value = "";
  }
}


function nombreMesCorte() {
  const fecha = new Date();
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(fecha);
}

function claveMesCorte() {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function filasVentasMes() {
  return ventasMes.map((venta) => ({
    ID: venta.folio || "",
    Pieza: venta.pieza || "",
    Marca: venta.marca || "",
    Modelo: venta.modelo || "",
    Año: venta.anio || "",
    "Precio lista": venta.precio_lista || "",
    "Precio venta": venta.precio_venta || "",
    "Método de pago": venta.metodo_pago || "",
    Vendedor: venta.vendedor_nombre || nombrePerfil(venta.vendedor_id, nombreDesdeEmail(venta.vendedor_email)) || "Sin registrar",
    "Correo vendedor": venta.vendedor_email || "",
    Fecha: venta.vendido_en ? fechaCorta(venta.vendido_en) : "",
    Nota: venta.nota || ""
  }));
}

function exportarCorteMensual() {
  if (!esAdminActual()) {
    setStatus("tableStatus", "Solo el administrador puede generar cortes mensuales.", "err");
    return;
  }

  if (!ventasMes.length) {
    setStatus("tableStatus", "No hay ventas de este mes para generar corte.", "err");
    return;
  }

  const totalMes = ventasMes.reduce((suma, venta) => suma + Number(venta.precio_venta || 0), 0);
  const resumen = resumenVendedores().map((vendedor) => ({
    Vendedor: vendedor.nombre,
    "Piezas vendidas": vendedor.piezas,
    "Total vendido": vendedor.total
  }));

  const cabecera = [
    { Dato: "Negocio", Valor: "AUTOPARTES VENCES" },
    { Dato: "Corte", Valor: nombreMesCorte() },
    { Dato: "Ventas registradas", Valor: ventasMes.length },
    { Dato: "Total vendido", Valor: totalMes },
    { Dato: "Generado por", Valor: usuarioNombre() },
    { Dato: "Fecha de descarga", Valor: fechaCorta(new Date().toISOString()) }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cabecera), "Corte");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resumen), "Resumen vendedores");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filasVentasMes()), "Ventas detalle");
  XLSX.writeFile(workbook, `autopartes-vences-corte-${claveMesCorte()}.xlsx`);

  setStatus("tableStatus", `Corte mensual descargado: ${ventasMes.length} venta(s), ${dinero(totalMes)}.`, "ok");
}

async function limpiarVentasCapacitacion() {
  if (!esAdminActual()) {
    setStatus("tableStatus", "Solo el administrador puede limpiar ventas de capacitación.", "err");
    return;
  }

  if (!ventasMes.length) {
    setStatus("tableStatus", "No hay ventas de este mes para limpiar.", "err");
    return;
  }

  const totalMes = ventasMes.reduce((suma, venta) => suma + Number(venta.precio_venta || 0), 0);
  const ventasLimpieza = ventasMes.length;
  const piezaIds = [...new Set(ventasMes.map((venta) => venta.pieza_id).filter(Boolean))];
  const piezasRepublicadas = piezaIds.length;
  const ventaIds = ventasMes.map((venta) => venta.id).filter(Boolean);

  const confirmar = confirm(
    `Esto limpiará ${ventasLimpieza} venta(s) de este mes (${dinero(totalMes)}) y volverá a publicar ${piezasRepublicadas} pieza(s).\n\n` +
    "Úsalo solo para ventas de prueba/capacitación. No lo uses con ventas reales.\n\n¿Continuar?"
  );
  if (!confirmar) return;

  const clave = prompt('Para confirmar, escribe exactamente: LIMPIAR');
  if (clave !== "LIMPIAR") {
    setStatus("tableStatus", "Limpieza cancelada. No se modificó nada.", "err");
    return;
  }

  setStatus("tableStatus", "Limpiando ventas de capacitación...");

  try {
    // Camino fuerte: ejecuta una función segura en Supabase.
    // Esta función evita que las políticas RLS bloqueen la limpieza del admin.
    const { data, error } = await avDB.rpc("limpiar_ventas_capacitacion_mes");

    if (error) throw error;

    await registrarMovimiento("limpiar_ventas_capacitacion", null, {
      ventas_limpiadas: data?.ventas_limpiadas ?? ventasLimpieza,
      piezas_republicadas: data?.piezas_republicadas ?? piezasRepublicadas,
      total_limpiado: totalMes,
      mes: data?.mes || claveMesCorte()
    });

    await cargarPiezas();

    const ventasOk = Number(data?.ventas_limpiadas ?? ventasLimpieza);
    const piezasOk = Number(data?.piezas_republicadas ?? piezasRepublicadas);
    setStatus("tableStatus", `Ventas de capacitación limpiadas: ${ventasOk} venta(s) y ${piezasOk} pieza(s) republicadas.`, "ok");
  } catch (error) {
    console.error("Error limpiando ventas de capacitación:", error);

    const mensaje = String(error?.message || "");
    if (mensaje.includes("Could not find the function") || mensaje.includes("limpiar_ventas_capacitacion_mes") || mensaje.includes("PGRST202")) {
      setStatus("tableStatus", "Falta ejecutar el SQL de limpieza en Supabase. Revisa el archivo supabase-limpiar-ventas.sql del ZIP.", "err");
      return;
    }

    setStatus("tableStatus", "Error limpiando ventas: " + mensaje, "err");
  }
}

function exportarExcel() {
  const rows = piezas.map((p) => ({
    ID: p.folio || "",
    Pieza: p.pieza || "",
    Marca: p.marca || "",
    Modelo: p.modelo || "",
    Año: p.anio || "",
    Color: p.color || "",
    Lado: p.lado || "",
    Estado: p.estado || "",
    Precio: p.precio || "",
    Disponible: p.disponible ? "SI" : "NO",
    "Vendido por": p.vendido_por ? nombrePerfil(p.vendido_por, "") : "",
    "Fecha de venta": p.vendido_en ? fechaCorta(p.vendido_en) : "",
    "Precio venta": p.precio_venta || "",
    "Método de pago": p.metodo_pago || "",
    "Número de parte": p.numero_parte || "",
    Observaciones: p.descripcion || "",
    Fotos: p.fotos?.length || 0
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
  XLSX.writeFile(workbook, `autopartes-vences-inventario-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function registrarEventos() {
  configurarCapturaRapida();
  $("loginForm").addEventListener("submit", iniciarSesion);
  $("logoutBtn").addEventListener("click", cerrarSesion);
  $("piezaForm").addEventListener("submit", guardarPieza);
  $("resetBtn").addEventListener("click", () => limpiarFormulario({ preservarVehiculo: false, preservarFamilia: false }));
  $("excelInput").addEventListener("change", importarExcel);
  $("exportExcel").addEventListener("click", exportarExcel);
  $("optimizeExistingPhotos")?.addEventListener("click", optimizarFotosExistentes);
  $("exportMonthlyCut")?.addEventListener("click", exportarCorteMensual);
  $("clearTrainingSales")?.addEventListener("click", limpiarVentasCapacitacion);
  $("preview").addEventListener("click", manejarAccionPreview);
  $("searchAdmin").addEventListener("input", (event) => {
    filtroTabla = event.target.value;
    paginaTabla = 1;
    clearTimeout(temporizadorBusquedaAdmin);
    temporizadorBusquedaAdmin = setTimeout(pintarTabla, 120);
  });
  $("familiaAdmin")?.addEventListener("change", (event) => {
    filtroFamilia = event.target.value;
    paginaTabla = 1;
    pintarTabla();
  });
  $("limpiarFiltrosAdmin")?.addEventListener("click", () => {
    filtroTabla = "";
    filtroFamilia = "";
    paginaTabla = 1;
    if ($("searchAdmin")) $("searchAdmin").value = "";
    if ($("familiaAdmin")) $("familiaAdmin").value = "";
    pintarTabla();
  });
  $("paginaAnterior")?.addEventListener("click", () => {
    if (paginaTabla <= 1) return;
    paginaTabla -= 1;
    pintarTabla();
    $("searchAdmin")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("paginaSiguiente")?.addEventListener("click", () => {
    const totalPaginas = Math.max(1, Math.ceil(piezasFiltradas().length / FILAS_POR_PAGINA));
    if (paginaTabla >= totalPaginas) return;
    paginaTabla += 1;
    pintarTabla();
    $("searchAdmin")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  configurarDropzone();
}

document.addEventListener("DOMContentLoaded", async () => {
  registrarEventos();
  await verificarSesion();
});


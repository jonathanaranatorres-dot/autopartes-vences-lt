/* AUTOPARTES VENCES - Admin privado
   Requiere supabase-config.js y admin.html */

const avDB = window.autopartesSupabase;
const bucket = window.AV_CONFIG?.STORAGE_BUCKET || "fotos-piezas";

let piezas = [];
let archivosSeleccionados = [];
let filtroTabla = "";

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

function limpiarFormulario() {
  $("piezaId").value = "";
  $("folio").value = "";
  $("pieza").value = "";
  $("marca").value = "";
  $("modelo").value = "";
  $("anio").value = "";
  $("lado").value = "";
  $("color").value = "";
  $("estado").value = "";
  $("precio").value = "";
  $("numeroParte").value = "";
  $("descripcion").value = "";
  $("disponible").checked = true;
  archivosSeleccionados = [];
  pintarPreview();
  $("formTitle").textContent = "Nueva pieza";
  setStatus("formStatus", "");
}

function datosFormulario() {
  return {
    folio: $("folio").value.trim() || null,
    pieza: $("pieza").value.trim(),
    marca: $("marca").value.trim() || null,
    modelo: $("modelo").value.trim() || null,
    anio: $("anio").value.trim() || null,
    color: $("color").value.trim() || null,
    lado: $("lado").value.trim() || null,
    estado: $("estado").value.trim() || ($("disponible").checked ? "Disponible" : "Vendido"),
    precio: $("precio").value ? Number($("precio").value) : null,
    numero_parte: $("numeroParte").value.trim() || null,
    descripcion: $("descripcion").value.trim() || null,
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
  await cargarPiezas();
}

async function cerrarSesion() {
  await avDB.auth.signOut();
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

  piezas = (data || []).map((pieza) => ({
    ...pieza,
    fotos: [...(pieza.fotos || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0))
  }));

  pintarTabla();
  pintarStats();
  setStatus("tableStatus", `${piezas.length} piezas cargadas.`, "ok");
}

function pintarStats() {
  $("statTotal").textContent = piezas.length;
  $("statDisponibles").textContent = piezas.filter((p) => p.disponible).length;
  $("statFotos").textContent = piezas.filter((p) => p.fotos?.length).length;
}

function piezasFiltradas() {
  const q = normalizar(filtroTabla);
  if (!q) return piezas;

  return piezas.filter((p) => normalizar([
    p.folio,
    p.pieza,
    p.marca,
    p.modelo,
    p.anio,
    p.color,
    p.lado,
    p.estado,
    p.numero_parte,
    p.descripcion
  ].join(" ")).includes(q));
}

function pintarTabla() {
  const tbody = $("tablaPiezas");
  const filtradas = piezasFiltradas();
  tbody.innerHTML = "";

  if (!filtradas.length) {
    tbody.innerHTML = `<tr><td colspan="7">No hay piezas con ese filtro.</td></tr>`;
    return;
  }

  filtradas.forEach((p) => {
    const primeraFoto = p.fotos?.[0]?.url || "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="thumbs">
          ${primeraFoto ? `<img src="${escapeHtml(primeraFoto)}" alt="Foto">` : ""}
          <span>${p.fotos?.length || 0}</span>
        </div>
      </td>
      <td>${escapeHtml(p.folio || p.id.slice(0, 8))}</td>
      <td><strong>${escapeHtml(p.pieza || "")}</strong><br><span style="color:var(--muted)">${escapeHtml(p.color || "")} ${escapeHtml(p.lado || "")}</span></td>
      <td>${escapeHtml(p.marca || "")} ${escapeHtml(p.modelo || "")}<br><span style="color:var(--muted)">${escapeHtml(p.anio || "")}</span></td>
      <td>${dinero(p.precio)}</td>
      <td><span class="pill ${p.disponible ? "" : "off"}">${p.disponible ? "Disponible" : "Vendido / oculto"}</span></td>
      <td>
        <div class="row-actions">
          <button class="btn mini" data-action="edit" data-id="${p.id}">Editar</button>
          <button class="btn mini" data-action="toggle" data-id="${p.id}">${p.disponible ? "Marcar vendido" : "Publicar"}</button>
          <button class="btn mini danger" data-action="delete" data-id="${p.id}">Eliminar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => manejarAccionTabla(btn.dataset.action, btn.dataset.id));
  });
}

async function manejarAccionTabla(action, id) {
  const pieza = piezas.find((p) => p.id === id);
  if (!pieza) return;

  if (action === "edit") return editarPieza(pieza);
  if (action === "toggle") return toggleDisponibilidad(pieza);
  if (action === "delete") return eliminarPieza(pieza);
}

function editarPieza(p) {
  $("piezaId").value = p.id;
  $("folio").value = p.folio || "";
  $("pieza").value = p.pieza || "";
  $("marca").value = p.marca || "";
  $("modelo").value = p.modelo || "";
  $("anio").value = p.anio || "";
  $("lado").value = p.lado || "";
  $("color").value = p.color || "";
  $("estado").value = p.estado || "";
  $("precio").value = p.precio || "";
  $("numeroParte").value = p.numero_parte || "";
  $("descripcion").value = p.descripcion || "";
  $("disponible").checked = Boolean(p.disponible);
  archivosSeleccionados = [];
  pintarPreview(p.fotos || []);
  $("formTitle").textContent = `Editando ${p.folio || p.pieza || "pieza"}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function toggleDisponibilidad(p) {
  setStatus("tableStatus", "Actualizando disponibilidad...");
  const { error } = await supabase
    .from("piezas")
    .update({ disponible: !p.disponible, estado: !p.disponible ? "Disponible" : "Vendido" })
    .eq("id", p.id);

  if (error) {
    setStatus("tableStatus", "Error: " + error.message, "err");
    return;
  }

  await cargarPiezas();
}

async function eliminarPieza(p) {
  const confirmar = confirm(`¿Eliminar la pieza ${p.folio || p.pieza}? También se intentarán borrar sus fotos.`);
  if (!confirmar) return;

  setStatus("tableStatus", "Eliminando pieza...");

  const paths = (p.fotos || []).map((f) => f.storage_path).filter(Boolean);
  if (paths.length) {
    await avDB.storage.from(bucket).remove(paths);
  }

  const { error } = await avDB.from("piezas").delete().eq("id", p.id);

  if (error) {
    setStatus("tableStatus", "Error eliminando: " + error.message, "err");
    return;
  }

  limpiarFormulario();
  await cargarPiezas();
}

async function guardarPieza(event) {
  event.preventDefault();

  const payload = datosFormulario();
  if (!payload.pieza) {
    setStatus("formStatus", "La pieza es obligatoria.", "err");
    return;
  }

  const idActual = $("piezaId").value;
  $("saveBtn").disabled = true;
  setStatus("formStatus", "Guardando publicación...");

  let piezaGuardada;

  try {
    if (idActual) {
      const { data, error } = await supabase
        .from("piezas")
        .update(payload)
        .eq("id", idActual)
        .select()
        .single();
      if (error) throw error;
      piezaGuardada = data;
    } else {
      const { data, error } = await supabase
        .from("piezas")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      piezaGuardada = data;
    }

    if (archivosSeleccionados.length) {
      await subirFotos(piezaGuardada.id, archivosSeleccionados);
    }

    setStatus("formStatus", "Publicación guardada. Ya puede aparecer en el catálogo.", "ok");
    limpiarFormulario();
    await cargarPiezas();
  } catch (error) {
    setStatus("formStatus", "Error guardando: " + error.message, "err");
  } finally {
    $("saveBtn").disabled = false;
  }
}

async function subirFotos(piezaId, archivos) {
  setStatus("formStatus", `Subiendo ${archivos.length} foto(s)...`);

  const { data: fotosExistentes } = await supabase
    .from("fotos")
    .select("orden")
    .eq("pieza_id", piezaId)
    .order("orden", { ascending: false })
    .limit(1);

  let ordenBase = fotosExistentes?.[0]?.orden ?? -1;

  for (let i = 0; i < archivos.length; i++) {
    const file = archivos[i];
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
    const path = `${piezaId}/${Date.now()}-${i + 1}-${slug(file.name)}.${extension}`;

    const { error: uploadError } = await avDB.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg"
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = avDB.storage.from(bucket).getPublicUrl(path);
    const url = publicData.publicUrl;

    const { error: insertFotoError } = await avDB.from("fotos").insert({
      pieza_id: piezaId,
      url,
      storage_path: path,
      orden: ordenBase + i + 1
    });

    if (insertFotoError) throw insertFotoError;
  }
}

function seleccionarFotos(files) {
  const nuevos = [...files].filter((file) => file.type.startsWith("image/"));
  archivosSeleccionados = [...archivosSeleccionados, ...nuevos];
  pintarPreview();
}

function pintarPreview(fotosGuardadas = []) {
  const preview = $("preview");
  preview.innerHTML = "";

  fotosGuardadas.forEach((foto) => {
    const img = document.createElement("img");
    img.src = foto.url;
    img.alt = "Foto guardada";
    preview.appendChild(img);
  });

  archivosSeleccionados.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    preview.appendChild(img);
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
    estado: limpiar(n.estado) || (disponible ? "Disponible" : "Vendido"),
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
          const { error } = await avDB.from("piezas").update(item).eq("id", existente.id);
          if (error) throw error;
          actualizadas++;
        } else {
          const { error } = await avDB.from("piezas").insert(item);
          if (error) throw error;
          creadas++;
        }
      } else {
        const { error } = await avDB.from("piezas").insert(item);
        if (error) throw error;
        creadas++;
      }
    }

    await cargarPiezas();
    setStatus("tableStatus", `Excel importado: ${creadas} creadas, ${actualizadas} actualizadas.`, "ok");
  } catch (error) {
    setStatus("tableStatus", "Error importando Excel: " + error.message, "err");
  } finally {
    event.target.value = "";
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
  $("loginForm").addEventListener("submit", iniciarSesion);
  $("logoutBtn").addEventListener("click", cerrarSesion);
  $("piezaForm").addEventListener("submit", guardarPieza);
  $("resetBtn").addEventListener("click", limpiarFormulario);
  $("excelInput").addEventListener("change", importarExcel);
  $("exportExcel").addEventListener("click", exportarExcel);
  $("searchAdmin").addEventListener("input", (event) => {
    filtroTabla = event.target.value;
    pintarTabla();
  });
  configurarDropzone();
}

document.addEventListener("DOMContentLoaded", async () => {
  registrarEventos();
  await verificarSesion();
});


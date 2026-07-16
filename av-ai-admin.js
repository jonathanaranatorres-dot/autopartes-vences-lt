/* AUTOPARTES VENCES | Copiloto de captura, revisión de fotos, publicaciones y centro de ventas.
   Capa opcional: nunca guarda una pieza ni cambia precios sin una acción explícita del usuario. */
(() => {
  "use strict";

  const config = window.AV_AI_CONFIG || {};
  if (config.enabled === false) return;

  const LEADS_KEY = "avProspectosLocalV2";
  const ALLOWED_FAMILIES = new Set(["CARROCERIA", "ILUMINACION", "ELECTRICO", "MOTOR", "TRANSMISION", "SUSPENSION", "FRENOS", "RINES_LLANTAS", "ENFRIAMIENTO", "INTERIOR", "CRISTALES", "ACCESORIOS"]);
  const ALLOWED_STATES = new Set(["USADO ORIGINAL", "USADO NACIONAL", "NUEVO GENERICO", "REPARADO", "CON DETALLE", "PARA REPARAR", "DISPONIBLE"]);
  const ALLOWED_SIDES = new Set(["", "DERECHO", "IZQUIERDO", "DELANTERO", "TRASERO", "DELANTERO DERECHO", "DELANTERO IZQUIERDO", "TRASERO DERECHO", "TRASERO IZQUIERDO", "SUPERIOR", "INFERIOR"]);
  const $ = (id) => document.getElementById(id);
  const upper = (value) => String(value || "").toLocaleUpperCase("es-MX").trim();
  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s./$-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const BRANDS = [
    "ALFA ROMEO", "AUDI", "BMW", "BUICK", "CADILLAC", "CHEVROLET", "CHRYSLER", "DODGE",
    "FIAT", "FORD", "GMC", "HONDA", "HYUNDAI", "INFINITI", "JEEP", "KIA", "LAND ROVER",
    "LEXUS", "MAZDA", "MERCEDES BENZ", "MERCEDES-BENZ", "MINI", "MITSUBISHI", "NISSAN",
    "PEUGEOT", "PONTIAC", "RENAULT", "SEAT", "SUBARU", "SUZUKI", "TOYOTA", "VOLKSWAGEN", "VW"
  ];
  const COLORS = [
    "BLANCO", "NEGRO", "GRIS", "PLATA", "ROJO", "AZUL", "VERDE", "AMARILLO", "NARANJA",
    "CAFE", "CAFÉ", "BEIGE", "DORADO", "VINO", "MORADO", "ROSA", "CROMADO", "TRANSPARENTE"
  ];
  const STATES = ["USADO ORIGINAL", "USADO NACIONAL", "NUEVO GENERICO", "NUEVO GENÉRICO", "REPARADO", "CON DETALLE", "PARA REPARAR"];
  const SIDES = [
    "DELANTERO DERECHO", "DELANTERO IZQUIERDO", "TRASERO DERECHO", "TRASERO IZQUIERDO",
    "DERECHO", "IZQUIERDO", "DELANTERO", "TRASERO", "SUPERIOR", "INFERIOR"
  ];
  const PARTS = [
    "PUERTA DELANTERA DERECHA", "PUERTA DELANTERA IZQUIERDA", "PUERTA TRASERA DERECHA", "PUERTA TRASERA IZQUIERDA",
    "CALAVERA DERECHA", "CALAVERA IZQUIERDA", "FARO DERECHO", "FARO IZQUIERDO", "SALPICADERA DERECHA", "SALPICADERA IZQUIERDA",
    "ESPEJO DERECHO", "ESPEJO IZQUIERDO", "SWITCH DE VENTANA ELECTRICA", "SWITCH DE VENTANA ELÉCTRICA",
    "ELEVADOR DE CRISTAL", "COMPRESOR DE A/C", "BOLSA DE AIRE", "TAPA DE CAJUELA", "TAPA TRASERA",
    "DEFENSA DELANTERA", "DEFENSA TRASERA", "FASCIA DELANTERA", "FASCIA TRASERA", "PARABRISAS", "MEDALLON", "MEDALLÓN",
    "CONDENSADOR", "RADIADOR", "VENTILADOR", "ALTERNADOR", "MARCHA", "COMPUTADORA", "MODULO", "MÓDULO",
    "TRANSMISION", "TRANSMISIÓN", "MOTOR", "COFRE", "CAJUELA", "PARRILLA", "MOLDURA", "TABLERO", "VOLANTE", "ASIENTO", "RIN", "LLANTA"
  ];

  const FAMILY_RULES = [
    ["ILUMINACION", ["faro", "calavera", "luz trasera", "luz delantera", "stop", "niebla"]],
    ["CARROCERIA", ["puerta", "defensa", "fascia", "facia", "cofre", "cajuela", "salpicadera", "parrilla", "espejo", "moldura exterior", "tapa trasera"]],
    ["ELECTRICO", ["switch", "botonera", "botón", "modulo", "módulo", "computadora", "ecu", "bcm", "arnes", "arnés", "elevador", "estereo", "estéreo", "pantalla"]],
    ["MOTOR", ["motor", "alternador", "marcha", "compresor", "multiple", "múltiple", "inyector", "bomba de aceite", "tapa punterias"]],
    ["TRANSMISION", ["transmision", "transmisión", "caja de velocidades", "convertidor", "diferencial"]],
    ["SUSPENSION", ["amortiguador", "horquilla", "mango", "masa", "resorte", "barra estabilizadora", "muñon", "muñón"]],
    ["FRENOS", ["caliper", "cáliper", "disco", "tambor", "booster", "boster", "bomba de freno", "abs"]],
    ["RINES_LLANTAS", ["rin", "llanta", "neumatico", "neumático", "tapon de rin", "tapón de rin"]],
    ["ENFRIAMIENTO", ["radiador", "condensador", "ventilador", "deposito anticongelante", "depósito anticongelante", "intercooler"]],
    ["INTERIOR", ["asiento", "tablero", "volante", "consola", "guantera", "bolsa de aire", "airbag", "cinturon", "cinturón", "moldura interior"]],
    ["CRISTALES", ["cristal", "vidrio", "parabrisas", "medallon", "medallón", "quemacocos"]],
    ["ACCESORIOS", ["tapon", "tapón", "emblema", "birlo", "gato", "herramienta"]]
  ];

  let currentSuggestion = null;
  let latestPhotoReview = [];
  let leadsMode = "local";
  let leads = [];
  let recognizing = false;
  let recognition = null;
  let demandRequestVersion = 0;

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("av:inventory-updated", refreshIntelligence);
  document.addEventListener("av:session-ready", () => {
    loadLeads();
    refreshIntelligence();
  });

  function init() {
    if (!$('aiCopilot')) return;
    bindEvents();
    configureSpeechRecognition();
    renderServiceMode();
    loadLeads();
    refreshIntelligence();
  }

  function bindEvents() {
    $("aiVoiceBtn")?.addEventListener("click", toggleVoice);
    $("aiAnalyzeBtn")?.addEventListener("click", analyzeCapture);
    $("aiApplyBtn")?.addEventListener("click", applySuggestion);
    $("aiPhotoReviewBtn")?.addEventListener("click", reviewPhotos);
    $("aiGeneratePostsBtn")?.addEventListener("click", generatePublications);
    $("aiCopyPostsBtn")?.addEventListener("click", copyPublications);
    $("aiClearBtn")?.addEventListener("click", clearCopilot);
    $("aiRefreshInsights")?.addEventListener("click", refreshIntelligence);
    $("aiLeadForm")?.addEventListener("submit", saveLead);
    $("aiLeadList")?.addEventListener("click", handleLeadAction);
    $("fotosInput")?.addEventListener("change", () => {
      latestPhotoReview = [];
      if ($("aiPhotoReport")) $("aiPhotoReport").hidden = true;
    });
  }

  function bridge() {
    return window.AV_ADMIN_BRIDGE || null;
  }

  function setStatus(message, type = "") {
    const el = $("aiStatus");
    if (!el) return;
    el.textContent = message || "";
    el.className = `ai-status ${type}`.trim();
  }

  function renderServiceMode() {
    const el = $("aiServiceMode");
    if (!el) return;
    el.textContent = config.remoteEnabled
      ? "IA remota con respaldo local"
      : "Modo local seguro";
    el.title = config.remoteEnabled
      ? "Usa la Edge Function y vuelve al analizador local si la red falla."
      : "No usa claves ni servicios externos. Puedes activar la Edge Function después.";
  }

  function configureSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const button = $("aiVoiceBtn");
    if (!SpeechRecognition) {
      if (button) {
        button.disabled = true;
        button.title = "Este navegador no ofrece dictado. Escribe el texto en el cuadro.";
      }
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += `${text} `;
        else interim += text;
      }
      const area = $("aiDictation");
      if (!area) return;
      if (finalText) area.value = `${area.value} ${finalText}`.replace(/\s+/g, " ").trim();
      setStatus(interim ? `Escuchando: ${interim}` : "Dictado capturado. Puedes analizarlo.", interim ? "" : "ok");
    };
    recognition.onerror = (event) => {
      recognizing = false;
      updateVoiceButton();
      setStatus(`No se pudo continuar el dictado: ${event.error || "error del micrófono"}.`, "err");
    };
    recognition.onend = () => {
      recognizing = false;
      updateVoiceButton();
    };
  }

  function toggleVoice() {
    if (!recognition) return;
    if (recognizing) {
      recognition.stop();
      recognizing = false;
      updateVoiceButton();
      return;
    }
    try {
      recognition.start();
      recognizing = true;
      updateVoiceButton();
      setStatus("Escuchando. Describe la pieza, vehículo, año, estado, detalle y precio.");
    } catch (error) {
      setStatus(`No se pudo iniciar el micrófono: ${error.message}`, "err");
    }
  }

  function updateVoiceButton() {
    const button = $("aiVoiceBtn");
    if (!button) return;
    button.textContent = recognizing ? "Detener dictado" : "Dictar pieza";
    button.setAttribute("aria-pressed", String(recognizing));
  }

  async function analyzeCapture() {
    const text = $("aiDictation")?.value.trim() || "";
    const files = selectedFiles();
    if (!text && !files.length) {
      setStatus("Escribe o dicta datos, o selecciona fotografías antes de analizar.", "err");
      return;
    }

    const button = $("aiAnalyzeBtn");
    if (button) button.disabled = true;
    setStatus("Analizando sin guardar cambios...");

    try {
      const local = parseCaptureLocally(text);
      let suggestion = local;

      if (config.remoteEnabled) {
        try {
          const remote = await callRemote("capture", {
            text,
            current_form: readCurrentForm(),
            inventory_examples: inventoryExamples(),
            images: await imagesForRequest(files)
          });
          suggestion = mergeSuggestions(local, remote?.suggestion || remote);
          suggestion.source = "remote";
        } catch (error) {
          console.warn("Copiloto remoto no disponible, se usará respaldo local:", error);
          suggestion.warnings = unique([...(suggestion.warnings || []), "La IA remota no respondió. Se usó el analizador local seguro."]);
        }
      }

      currentSuggestion = sanitizeSuggestion(suggestion);
      renderSuggestion(currentSuggestion);
      setStatus("Propuesta lista. Revísala y presiona Aplicar al formulario. Nada se ha guardado.", "ok");
    } catch (error) {
      setStatus(`No se pudo analizar: ${error.message}`, "err");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function parseCaptureLocally(text) {
    const normalized = normalize(text);
    const inventory = bridge()?.getInventory?.() || [];
    const foundPart = findLongest(PARTS, normalized);
    const part = normalizePart(foundPart || inferGenericPart(normalized));
    const brand = findLongest(BRANDS, normalized);
    const side = findLongest(SIDES, normalized);
    const state = findLongest(STATES, normalized) || "USADO ORIGINAL";
    const color = findLongest(COLORS, normalized);
    const year = extractYearRange(text);
    const price = extractPrice(text);
    const model = inferModel(normalized, brand, year, part, inventory);
    const family = inferFamily(part || normalized);
    const priceReference = estimatePriceReference({ part, brand, model }, inventory, bridge()?.getMonthlySales?.() || []);
    const warnings = [];

    if (!part) warnings.push("No pude identificar con seguridad el nombre de la pieza.");
    if (!brand) warnings.push("No detecté la marca del vehículo.");
    if (!model) warnings.push("No detecté el modelo. Conviene revisarlo manualmente.");
    if (!year) warnings.push("No detecté un año o rango de años.");
    if (!price) {
      warnings.push("No detecté el precio. La IA no inventará uno.");
      if (priceReference) warnings.push(`Referencia histórica: ${priceReference.label}. Es orientación interna y no se aplicará automáticamente.`);
    }
    if (part && side && !normalize(part).includes(normalize(side))) {
      warnings.push("El lado se detectó por separado. Revisa que coincida con el nombre de la pieza.");
    }

    const description = buildDescription(text, { part, brand, model, year, state, color, side });
    const title = buildTitle({ part, brand, model, year, state });
    const filled = [part, brand, model, year, family].filter(Boolean).length;

    return {
      source: "local",
      confidence: Math.min(96, Math.max(42, 38 + filled * 10 + (price ? 5 : 0))),
      fields: {
        familia: family,
        pieza: part,
        marca: brand,
        modelo: model,
        anio: year,
        lado: side,
        color,
        estado: state,
        precio: price,
        numeroParte: extractPartNumber(text),
        descripcion: description
      },
      title,
      description,
      priceReference,
      warnings
    };
  }

  function estimatePriceReference(fields, inventory, sales) {
    const part = normalize(fields.part);
    const brand = normalize(fields.brand);
    const model = normalize(fields.model);
    if (!part) return null;

    const inventoryValues = (inventory || []).filter((item) => {
      const candidate = normalize([item?.pieza, item?.lado].filter(Boolean).join(" "));
      if (!Number(item?.precio) || !similarPartName(candidate, part)) return false;
      if (brand && normalize(item.marca) !== brand) return false;
      if (model && normalize(item.modelo) !== model) return false;
      return true;
    }).map((item) => Number(item.precio));

    const saleValues = (sales || []).filter((item) => {
      const candidate = normalize([item?.pieza, item?.lado].filter(Boolean).join(" "));
      if (!Number(item?.precio_venta) || !similarPartName(candidate, part)) return false;
      if (brand && item.marca && normalize(item.marca) !== brand) return false;
      if (model && item.modelo && normalize(item.modelo) !== model) return false;
      return true;
    }).map((item) => Number(item.precio_venta));

    const values = [...inventoryValues, ...saleValues].filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (!values.length) return null;
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
    return {
      median,
      min: values[0],
      max: values[values.length - 1],
      samples: values.length,
      label: values.length === 1
        ? `${formatMoney(median)} basado en 1 registro similar`
        : `${formatMoney(median)} de mediana (${formatMoney(values[0])} a ${formatMoney(values[values.length - 1])}, ${values.length} registros)`
    };
  }

  function similarPartName(candidate, target) {
    const a = normalize(candidate);
    const b = normalize(target);
    if (!a || !b) return false;
    if (a === b || a.includes(b) || b.includes(a)) {
      return a.split(" ")[0] === b.split(" ")[0];
    }
    return false;
  }

  function findLongest(list, normalizedText) {
    return list
      .filter((item) => normalizedText.includes(normalize(item)))
      .sort((a, b) => b.length - a.length)[0] || "";
  }

  function inferGenericPart(text) {
    const synonyms = [
      ["botonera de vidrios", "SWITCH DE VENTANA ELECTRICA"], ["botonera", "SWITCH DE VENTANA ELECTRICA"],
      ["luz de atras", "CALAVERA"], ["luz trasera", "CALAVERA"], ["stop", "CALAVERA"],
      ["luz de adelante", "FARO"], ["optica", "FARO"], ["facia", "DEFENSA"], ["fascia", "DEFENSA"],
      ["parachoques", "DEFENSA"], ["capo", "COFRE"], ["capot", "COFRE"], ["retrovisor", "ESPEJO"],
      ["vidrio", "CRISTAL"], ["mica", "CALAVERA"]
    ];
    const match = synonyms.find(([key]) => text.includes(key));
    return match?.[1] || "";
  }

  function normalizePart(part) {
    if (!part) return "";
    return upper(part)
      .replace("FASCIA", "DEFENSA")
      .replace("MÓDULO", "MODULO")
      .replace("TRANSMISIÓN", "TRANSMISION")
      .replace("ELÉCTRICA", "ELECTRICA")
      .replace("MEDALLÓN", "MEDALLON");
  }

  function inferFamily(value) {
    const text = normalize(value);
    return FAMILY_RULES.find(([, keys]) => keys.some((key) => text.includes(normalize(key))))?.[0] || "";
  }

  function extractYearRange(text) {
    const years = [...String(text || "").matchAll(/\b((?:19|20)\d{2}|\d{2})\b/g)]
      .map((match) => normalizeYear(match[1]))
      .filter((year) => year >= 1980 && year <= new Date().getFullYear() + 2);
    const uniqueYears = unique(years);
    if (!uniqueYears.length) return "";
    if (uniqueYears.length === 1) return String(uniqueYears[0]);
    return `${Math.min(...uniqueYears)}-${Math.max(...uniqueYears)}`;
  }

  function normalizeYear(value) {
    const n = Number(value);
    if (String(value).length === 2) return n <= 40 ? 2000 + n : 1900 + n;
    return n;
  }

  function extractPrice(text) {
    const raw = String(text || "");
    const candidates = [
      ...raw.matchAll(/\$\s*([\d,.]+)/g),
      ...raw.matchAll(/(?:precio|vale|cuesta|en)\s*(?:de\s*)?([\d,.]+)\s*(?:pesos|mxn)?/gi),
      ...raw.matchAll(/([\d,.]+)\s*(?:pesos|mxn)/gi)
    ];
    for (const match of candidates) {
      const value = Number(String(match[1] || "").replace(/,/g, ""));
      if (Number.isFinite(value) && value >= 50 && value <= 500000) return value;
    }
    return null;
  }

  function extractPartNumber(text) {
    const match = String(text || "").match(/(?:numero|número|no\.?|parte|codigo|código)\s*(?:de\s*parte)?\s*[:#-]?\s*([A-Z0-9-]{5,})/i);
    return upper(match?.[1] || "");
  }

  function inferModel(normalizedText, brand, year, part, inventory) {
    const brandNorm = normalize(brand);
    const candidates = unique([
      ...Array.from(document.getElementById("listaModelos")?.options || []).map((option) => option.value),
      ...inventory.map((item) => item.modelo)
    ].filter(Boolean)).sort((a, b) => String(b).length - String(a).length);

    const exact = candidates.find((candidate) => normalize(candidate).length >= 2 && normalizedText.includes(normalize(candidate)));
    if (exact) return upper(exact);

    // Sin marca explícita, las palabras restantes suelen ser detalles o daños.
    // Es más seguro dejar el modelo vacío que inventarlo.
    if (!brandNorm) return "";
    const brandIndex = normalizedText.indexOf(brandNorm);
    if (brandIndex < 0) return "";

    let remainder = normalizedText.slice(brandIndex + brandNorm.length);
    const hardStops = [
      normalize(part), normalize(year),
      ...SIDES.map(normalize),
      ...STATES.map(normalize),
      ...COLORS.map(normalize),
      ...FAMILY_RULES.flatMap(([, keys]) => keys.map(normalize)),
      "precio", "pesos", "mxn", "detalle", "detalles", "dano", "daño", "golpe", "golpeado", "golpeada",
      "pestana", "pestaña", "rota", "roto", "quebrada", "quebrado", "rayada", "rayado", "presenta", "tiene",
      "incluye", "falta", "sin ", "con ", "numero", "número", "parte", "codigo", "código", "color"
    ].filter(Boolean).sort((a, b) => b.length - a.length);

    let stopAt = remainder.length;
    hardStops.forEach((token) => {
      const index = remainder.indexOf(token);
      if (index >= 0) stopAt = Math.min(stopAt, index);
    });

    remainder = remainder.slice(0, stopAt)
      .replace(/\b(para|del|de|la|el|lado|original|usado|usada|pieza|autoparte|con|sin)\b/g, " ")
      .replace(/\b(?:19|20)\d{2}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = remainder.split(" ")
      .filter((word) => /^[a-z0-9-]{2,}$/.test(word))
      .slice(0, 3);
    return upper(words.join(" "));
  }

  function buildTitle(fields) {
    return upper([fields.part, fields.brand, fields.model, fields.year, fields.state === "USADO ORIGINAL" ? "ORIGINAL" : ""].filter(Boolean).join(" "));
  }

  function buildDescription(text, fields) {
    const clean = String(text || "").trim();
    const base = [
      fields.part,
      fields.brand && fields.model ? `PARA ${fields.brand} ${fields.model}` : "",
      fields.year ? `AÑOS ${fields.year}` : "",
      fields.state,
      fields.color ? `COLOR ${fields.color}` : "",
      fields.side ? `LADO ${fields.side}` : ""
    ].filter(Boolean).join(". ");
    return upper(clean ? `${base}. OBSERVACIONES DICTADAS: ${clean}` : base);
  }

  function sanitizeSuggestion(value) {
    const input = value || {};
    const fields = input.fields || input;
    const warnings = unique((input.warnings || []).map(String).filter(Boolean));
    let family = upper(fields.familia || fields.family || "");
    let state = upper(fields.estado || fields.condition || "USADO ORIGINAL");
    let side = upper(fields.lado || fields.side || "");

    if (family && !ALLOWED_FAMILIES.has(family)) {
      warnings.push(`La familia sugerida (${family}) no existe en el formulario y no se aplicará.`);
      family = "";
    }
    if (state && !ALLOWED_STATES.has(state)) {
      warnings.push(`El estado sugerido (${state}) no existe en el formulario. Se usará USADO ORIGINAL.`);
      state = "USADO ORIGINAL";
    }
    if (side && !ALLOWED_SIDES.has(side)) {
      warnings.push(`El lado sugerido (${side}) no coincide con las opciones permitidas y no se aplicará.`);
      side = "";
    }

    return {
      source: input.source || "local",
      confidence: Math.max(0, Math.min(100, Number(input.confidence || 70))),
      fields: {
        familia: family,
        pieza: upper(fields.pieza || fields.part || ""),
        marca: upper(fields.marca || fields.brand || ""),
        modelo: upper(fields.modelo || fields.model || ""),
        anio: upper(fields.anio || fields.year || ""),
        lado: side,
        color: upper(fields.color || ""),
        estado: state,
        precio: finiteOrNull(fields.precio ?? fields.price),
        numeroParte: upper(fields.numeroParte || fields.part_number || ""),
        descripcion: upper(fields.descripcion || input.description || "")
      },
      title: upper(input.title || buildTitle({
        part: fields.pieza || fields.part,
        brand: fields.marca || fields.brand,
        model: fields.modelo || fields.model,
        year: fields.anio || fields.year,
        state: fields.estado || fields.condition
      })),
      description: upper(input.description || fields.descripcion || ""),
      priceReference: input.priceReference && Number(input.priceReference.median) ? {
        median: Number(input.priceReference.median),
        min: Number(input.priceReference.min || input.priceReference.median),
        max: Number(input.priceReference.max || input.priceReference.median),
        samples: Number(input.priceReference.samples || 1),
        label: String(input.priceReference.label || formatMoney(input.priceReference.median))
      } : null,
      warnings: unique(warnings)
    };
  }

  function mergeSuggestions(local, remote) {
    if (!remote || typeof remote !== "object") return local;
    const remoteSanitized = sanitizeSuggestion(remote);
    return {
      ...local,
      ...remoteSanitized,
      fields: { ...local.fields, ...Object.fromEntries(Object.entries(remoteSanitized.fields).filter(([, value]) => value !== "" && value !== null)) },
      priceReference: remoteSanitized.priceReference || local.priceReference || null,
      warnings: unique([...(local.warnings || []), ...(remoteSanitized.warnings || [])])
    };
  }

  function renderSuggestion(suggestion) {
    const container = $("aiResult");
    const fieldsContainer = $("aiFields");
    if (!container || !fieldsContainer) return;
    const labels = {
      familia: "Familia", pieza: "Pieza", marca: "Marca", modelo: "Modelo", anio: "Año",
      lado: "Lado", color: "Color", estado: "Estado", precio: "Precio", numeroParte: "Número de parte"
    };
    fieldsContainer.innerHTML = Object.entries(labels).map(([key, label]) => {
      const value = suggestion.fields[key];
      const display = key === "precio" && value ? formatMoney(value) : value || "No detectado";
      return `<div class="ai-field-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(display)}</strong></div>`;
    }).join("") + (suggestion.priceReference
      ? `<div class="ai-field-card ai-price-reference"><span>Referencia de precio</span><strong>${escapeHtml(suggestion.priceReference.label)}</strong><small>No se aplica automáticamente</small></div>`
      : "");
    $("aiConfidence").textContent = `${Math.round(suggestion.confidence)}% de confianza`;
    $("aiWarnings").innerHTML = suggestion.warnings.length
      ? suggestion.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")
      : "";
    $("aiWarnings").hidden = !suggestion.warnings.length;
    $("aiApplyBtn").disabled = false;
    container.hidden = false;
  }

  function applySuggestion() {
    if (!currentSuggestion) {
      setStatus("Primero analiza una descripción.", "err");
      return;
    }
    const fields = currentSuggestion.fields;
    const mapping = {
      familia: "familiaCaptura", pieza: "pieza", marca: "marca", modelo: "modelo", anio: "anio",
      lado: "lado", color: "color", estado: "estado", precio: "precio", numeroParte: "numeroParte", descripcion: "descripcion"
    };
    Object.entries(mapping).forEach(([key, id]) => {
      const element = $(id);
      const value = fields[key];
      if (!element || value === "" || value === null || value === undefined) return;
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
    setStatus("Datos aplicados al formulario. Revísalos y guarda manualmente cuando estés conforme.", "ok");
    $("pieza")?.focus();
  }

  async function reviewPhotos() {
    const files = selectedFiles();
    if (!files.length) {
      setStatus("Selecciona fotos nuevas antes de revisarlas. Las fotos ya guardadas no se descargan para evitar lentitud.", "err");
      return;
    }
    const button = $("aiPhotoReviewBtn");
    if (button) button.disabled = true;
    setStatus(`Revisando ${files.length} foto(s) localmente...`);
    try {
      latestPhotoReview = await analyzeImagesLocally(files);
      if (config.remoteEnabled) {
        try {
          const remote = await callRemote("photo_review", {
            text: $("aiDictation")?.value.trim() || "",
            current_form: readCurrentForm(),
            images: await imagesForRequest(files)
          });
          latestPhotoReview = mergeRemotePhotoReview(latestPhotoReview, remote?.photos || []);
        } catch (error) {
          console.warn("Revisión visual remota no disponible; se conserva el análisis técnico local:", error);
        }
      }
      renderPhotoReview(latestPhotoReview);
      setStatus("Revisión terminada. Es una ayuda visual, no sustituye comprobar lado, número de parte y daños.", "ok");
    } catch (error) {
      setStatus(`No se pudieron revisar las fotos: ${error.message}`, "err");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function selectedFiles() {
    const managed = bridge()?.getSelectedFiles?.() || [];
    const direct = Array.from($("fotosInput")?.files || []);
    return uniqueFiles([...managed, ...direct]).filter((file) => file?.type?.startsWith("image/"));
  }

  function uniqueFiles(files) {
    const seen = new Set();
    return files.filter((file) => {
      if (!file) return false;
      const key = `${file.name || ""}|${file.size || 0}|${file.lastModified || 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function analyzeImagesLocally(files) {
    const results = [];
    const hashes = new Map();
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const metrics = await imageMetrics(file);
      const issues = [];
      if (metrics.width < 700 || metrics.height < 700) issues.push("resolución baja");
      if (metrics.brightness < 42) issues.push("muy oscura");
      if (metrics.brightness > 230) issues.push("sobreexpuesta");
      if (metrics.sharpness < 105) issues.push("posible desenfoque");
      if (file.size > 12 * 1024 * 1024) issues.push("archivo muy pesado");
      if (hashes.has(metrics.hash)) issues.push(`posible duplicada de la foto ${hashes.get(metrics.hash) + 1}`);
      else hashes.set(metrics.hash, index);

      const score = Math.max(0, Math.min(100,
        40 + Math.min(25, metrics.sharpness / 9) + Math.min(20, (metrics.width * metrics.height) / 180000) - issues.length * 13
      ));
      results.push({ file, index, metrics, issues, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  async function imageMetrics(file) {
    const bitmap = await loadBitmap(file);
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const max = 160;
    const scale = Math.min(1, max / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(8, Math.round(sourceWidth * scale));
    const height = Math.max(8, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (bitmap.close) bitmap.close();
    const data = ctx.getImageData(0, 0, width, height).data;
    const gray = new Float32Array(width * height);
    let total = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const value = data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114;
      gray[p] = value;
      total += value;
    }
    const brightness = total / gray.length;
    let lapTotal = 0;
    let lapSqTotal = 0;
    let lapCount = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const p = y * width + x;
        const lap = 4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - width] - gray[p + width];
        lapTotal += lap;
        lapSqTotal += lap * lap;
        lapCount += 1;
      }
    }
    const meanLap = lapCount ? lapTotal / lapCount : 0;
    const sharpness = lapCount ? lapSqTotal / lapCount - meanLap * meanLap : 0;
    return {
      width: sourceWidth || width,
      height: sourceHeight || height,
      brightness,
      sharpness,
      hash: averageHash(ctx, width, height)
    };
  }

  async function loadBitmap(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (_) {
        return createImageBitmap(file);
      }
    }
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo leer ${file.name}`)); };
      image.src = url;
    });
  }

  function averageHash(ctx, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const small = canvas.getContext("2d", { willReadFrequently: true });
    small.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, 8, 8);
    const data = small.getImageData(0, 0, 8, 8).data;
    const values = [];
    for (let i = 0; i < data.length; i += 4) values.push(data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.map((value) => value >= average ? "1" : "0").join("");
  }

  function renderPhotoReview(results) {
    const container = $("aiPhotoReport");
    const grid = $("aiPhotoGrid");
    if (!container || !grid) return;
    grid.innerHTML = results.map((result, order) => {
      const level = result.issues.length >= 2 ? "bad" : result.issues.length ? "warn" : "good";
      const semantic = result.semanticNotes?.length ? ` · ${result.semanticNotes.join(" · ")}` : "";
      const note = `${result.issues.length ? result.issues.join(", ") : "Buena base técnica para catálogo"}${semantic}`;
      return `<article class="ai-photo-card ${level}">
        <strong>${order === 0 ? "⭐ Portada sugerida: " : ""}${escapeHtml(result.file.name)}</strong>
        <span>${result.metrics.width}×${result.metrics.height} · calidad ${Math.round(result.score)}/100</span>
        <span>${escapeHtml(note)}</span>
      </article>`;
    }).join("");
    container.hidden = false;
  }

  function mergeRemotePhotoReview(localResults, remotePhotos) {
    if (!Array.isArray(remotePhotos) || !remotePhotos.length) return localResults;
    return localResults.map((result, sortedIndex) => {
      const byOriginalIndex = remotePhotos.find((photo) => Number(photo?.index) === Number(result.index));
      const remote = byOriginalIndex || remotePhotos[sortedIndex];
      if (!remote) return result;
      const notes = [
        ...(Array.isArray(remote.notes) ? remote.notes : []),
        remote.possible_part_mismatch ? "La pieza visible podría no coincidir con la descripción. Revisar manualmente." : "",
        remote.visible_damage ? `Daño visible posible: ${remote.visible_damage}` : "",
        remote.missing_view ? `Vista recomendada faltante: ${remote.missing_view}` : ""
      ].map(String).filter(Boolean);
      return { ...result, semanticNotes: unique(notes) };
    });
  }

  async function generatePublications() {
    const draft = currentSuggestion || sanitizeSuggestion({ fields: readCurrentForm() });
    const current = readCurrentForm();
    const fields = {
      ...draft.fields,
      ...Object.fromEntries(Object.entries(current).filter(([, value]) => value !== "" && value !== null && value !== undefined))
    };
    const title = buildTitle({ part: fields.pieza, brand: fields.marca, model: fields.modelo, year: fields.anio, state: fields.estado });
    const price = fields.precio ? formatMoney(fields.precio) : "PRECIO POR CONFIRMAR";
    const details = fields.descripcion || `${fields.estado || "USADO ORIGINAL"}. FOTOS REALES DE LA PIEZA.`;
    let output = [
      "MARKETPLACE",
      title,
      `${details}\n${price}. DISPONIBLE EN ECATEPEC, ESTADO DE MÉXICO. ENVÍO A DOMICILIO CON CARGO AL CLIENTE. CONFIRMA COMPATIBILIDAD CON TU MUESTRA O NÚMERO DE PARTE.`,
      "",
      "ESTADO DE WHATSAPP",
      `🔩 ${title}\n${price}\nFOTOS REALES. PREGUNTA DISPONIBILIDAD POR WHATSAPP.`,
      "",
      "MENSAJE PARA TALLER",
      `Hola. Tenemos disponible ${title}. ${price}. La pieza es ${fields.estado || "USADO ORIGINAL"} y contamos con fotos reales. ¿Te comparto detalles y medidas para revisar compatibilidad?`,
      "",
      "DESCRIPCIÓN PARA LA PÁGINA",
      `${title}. ${details} Ubicación: Ecatepec, Estado de México. Envíos con cargo al cliente.`
    ].join("\n");

    if (config.remoteEnabled) {
      try {
        const remote = await callRemote("publications", { fields, title, local_draft: output });
        if (remote?.text) output = remote.text;
      } catch (error) {
        console.warn("Generador remoto no disponible:", error);
      }
    }

    const area = $("aiPublications");
    if (area) area.value = output;
    $("aiPublicationResult").hidden = false;
    setStatus("Publicaciones preparadas. Revisa compatibilidad y daños antes de publicarlas.", "ok");
  }

  async function copyPublications() {
    const text = $("aiPublications")?.value || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Textos copiados.", "ok");
    } catch (_) {
      $("aiPublications")?.select();
      document.execCommand("copy");
      setStatus("Textos seleccionados y copiados.", "ok");
    }
  }

  function clearCopilot() {
    if ($("aiDictation")) $("aiDictation").value = "";
    if ($("aiResult")) $("aiResult").hidden = true;
    if ($("aiPhotoReport")) $("aiPhotoReport").hidden = true;
    if ($("aiPublicationResult")) $("aiPublicationResult").hidden = true;
    if ($("aiApplyBtn")) $("aiApplyBtn").disabled = true;
    currentSuggestion = null;
    latestPhotoReview = [];
    setStatus("");
  }

  function readCurrentForm() {
    return {
      familia: upper($("familiaCaptura")?.value),
      pieza: upper($("pieza")?.value),
      marca: upper($("marca")?.value),
      modelo: upper($("modelo")?.value),
      anio: upper($("anio")?.value),
      lado: upper($("lado")?.value),
      color: upper($("color")?.value),
      estado: upper($("estado")?.value),
      precio: finiteOrNull($("precio")?.value),
      numeroParte: upper($("numeroParte")?.value),
      descripcion: upper($("descripcion")?.value)
    };
  }

  function inventoryExamples() {
    return (bridge()?.getInventory?.() || []).slice(0, 40).map((item) => ({
      pieza: item.pieza, marca: item.marca, modelo: item.modelo, anio: item.anio, folio: item.folio
    }));
  }

  async function imagesForRequest(files) {
    const limit = Number(config.maxImagesPerRequest || 4);
    const output = [];
    for (const file of files.slice(0, limit)) output.push(await imageToDataUrl(file, 900, .72));
    return output;
  }

  async function imageToDataUrl(file, maxSide, quality) {
    const bitmap = await loadBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    return canvas.toDataURL("image/jpeg", quality);
  }

  async function callRemote(mode, payload) {
    const db = window.avDB || window.autopartesSupabase;
    if (!db?.functions?.invoke) throw new Error("Supabase Functions no está disponible.");
    const timeout = Number(config.requestTimeoutMs || 18000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const { data, error } = await db.functions.invoke(config.edgeFunctionName || "ai-copilot", {
        body: { mode, ...payload },
        signal: controller.signal
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  function refreshIntelligence() {
    const inventory = bridge()?.getInventory?.() || [];
    const sales = bridge()?.getMonthlySales?.() || [];
    if (!inventory.length && !$("statTotal")?.textContent) return;
    const now = Date.now();
    const staleDays = Number(config.staleDays || 60);
    const stale = inventory.filter((item) => item.disponible && ageDays(item.created_at || item.actualizado_en, now) >= staleDays);
    const noPhotos = inventory.filter((item) => !item.fotos?.length);
    const noPrice = inventory.filter((item) => !Number(item.precio));
    const unavailable = inventory.filter((item) => !item.disponible);

    setText("aiKpiStale", stale.length);
    setText("aiKpiPhotos", noPhotos.length);
    setText("aiKpiPrice", noPrice.length);
    setText("aiKpiHidden", unavailable.length);

    const insights = [];
    if (stale.length) insights.push(`<strong>${stale.length} pieza(s) llevan ${staleDays}+ días disponibles.</strong> Conviene renovar portada, revisar precio y volver a publicarlas.`);
    if (noPhotos.length) insights.push(`<strong>${noPhotos.length} pieza(s) no tienen fotos.</strong> Son inventario invisible para el cliente.`);
    if (noPrice.length) insights.push(`<strong>${noPrice.length} pieza(s) no tienen precio.</strong> Prioriza las que reciben consultas para reducir fricción.`);

    const salesByPart = groupByNormalized(sales, "pieza");
    const topSale = [...salesByPart.values()].sort((a, b) => b.count - a.count || b.total - a.total)[0];
    if (topSale) {
      const sameAvailable = inventory.filter((item) => item.disponible && normalize(item.pieza) === topSale.key);
      const avg = topSale.count ? topSale.total / topSale.count : 0;
      insights.push(`<strong>${escapeHtml(topSale.label)} lidera ventas del mes.</strong> Hay ${sameAvailable.length} disponible(s) y el precio vendido promedio es ${formatMoney(avg)}.`);
    }

    const oldExample = stale.sort((a, b) => ageDays(b.created_at || b.actualizado_en, now) - ageDays(a.created_at || a.actualizado_en, now))[0];
    if (oldExample) {
      insights.push(`<strong>Prioridad de rescate:</strong> ${escapeHtml(oldExample.folio || "S/F")} · ${escapeHtml(oldExample.pieza || "PIEZA")} lleva aproximadamente ${ageDays(oldExample.created_at || oldExample.actualizado_en, now)} días publicada.`);
    }

    const list = $("aiInsightsList");
    if (list) list.innerHTML = insights.length
      ? insights.map((text) => `<div class="ai-insight">${text}</div>`).join("")
      : `<div class="ai-insight">Todavía no hay suficientes datos para generar alertas. El tablero se alimentará conforme captures y vendas.</div>`;
    refreshDemandInsights();
  }

  async function refreshDemandInsights() {
    const container = $("aiDemandList");
    if (!container) return;
    const db = window.avDB || window.autopartesSupabase;
    const user = bridge()?.getCurrentUser?.();
    const version = ++demandRequestVersion;
    if (!db || !user) {
      container.innerHTML = `<p class="empty-state">La demanda se mostrará aquí cuando se active la tabla opcional y exista una sesión de administrador.</p>`;
      return;
    }
    container.innerHTML = `<p class="empty-state">Analizando consultas sin resultado...</p>`;
    try {
      const { data, error } = await db
        .from("demanda_sin_resultado")
        .select("consulta_normalizada,busquedas,ultima_busqueda")
        .limit(6);
      if (version !== demandRequestVersion) return;
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) {
        container.innerHTML = `<p class="empty-state">Todavía no hay búsquedas sin resultado. Es una buena señal o aún falta historial.</p>`;
        return;
      }
      container.innerHTML = rows.map((row) => `<article class="ai-demand-item">
        <strong>${escapeHtml(upper(row.consulta_normalizada || "CONSULTA"))}</strong>
        <span>${Number(row.busquedas || 0)} búsqueda(s) · última: ${escapeHtml(formatDate(row.ultima_busqueda))}</span>
      </article>`).join("");
    } catch (_) {
      if (version !== demandRequestVersion) return;
      container.innerHTML = `<p class="empty-state">Módulo de demanda aún no activado en Supabase. Las demás funciones siguen operando normalmente.</p>`;
    }
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "sin fecha";
    return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function groupByNormalized(items, field) {
    const map = new Map();
    items.forEach((item) => {
      const key = normalize(item[field]);
      if (!key) return;
      const current = map.get(key) || { key, label: upper(item[field]), count: 0, total: 0 };
      current.count += 1;
      current.total += Number(item.precio_venta || item.precio || 0);
      map.set(key, current);
    });
    return map;
  }

  function ageDays(date, now = Date.now()) {
    const time = date ? new Date(date).getTime() : NaN;
    if (!Number.isFinite(time)) return 0;
    return Math.max(0, Math.floor((now - time) / 86400000));
  }

  async function loadLeads() {
    if (config.crmEnabled === false || !$("aiLeadList")) return;
    const db = window.avDB || window.autopartesSupabase;
    const user = bridge()?.getCurrentUser?.();
    if (db && user) {
      try {
        const { data, error } = await db.from("prospectos").select("*").order("created_at", { ascending: false }).limit(200);
        if (!error) {
          leadsMode = "supabase";
          leads = data || [];
          renderLeads();
          return;
        }
      } catch (_) {}
    }
    leadsMode = "local";
    leads = readLocalLeads();
    renderLeads();
  }

  async function saveLead(event) {
    event.preventDefault();
    const lead = {
      nombre: $("aiLeadName")?.value.trim() || "CLIENTE",
      telefono: String($("aiLeadPhone")?.value || "").replace(/\D/g, ""),
      pieza_buscada: upper($("aiLeadPart")?.value),
      vehiculo: upper($("aiLeadVehicle")?.value),
      presupuesto: finiteOrNull($("aiLeadBudget")?.value),
      estado: "PENDIENTE",
      notas: upper($("aiLeadNotes")?.value),
      seguimiento_en: $("aiLeadFollowup")?.value || null,
      created_at: new Date().toISOString()
    };
    if (!lead.pieza_buscada) {
      setStatus("Escribe la pieza que busca el cliente.", "err");
      return;
    }

    const db = window.avDB || window.autopartesSupabase;
    if (leadsMode === "supabase" && db) {
      const { data, error } = await db.from("prospectos").insert(lead).select().single();
      if (!error) leads.unshift(data);
      else {
        console.warn("No se pudo guardar prospecto en Supabase, se guardará localmente:", error.message);
        leadsMode = "local";
        lead.id = crypto.randomUUID?.() || `local-${Date.now()}`;
        leads.unshift(lead);
        writeLocalLeads(leads);
      }
    } else {
      lead.id = crypto.randomUUID?.() || `local-${Date.now()}`;
      leads.unshift(lead);
      writeLocalLeads(leads);
    }

    event.target.reset();
    renderLeads();
    setStatus(`Prospecto guardado en modo ${leadsMode === "supabase" ? "Supabase" : "local"}.`, "ok");
  }

  function renderLeads() {
    const list = $("aiLeadList");
    const mode = $("aiLeadsMode");
    if (!list) return;
    if (mode) mode.textContent = leadsMode === "supabase" ? "Sincronizado con Supabase" : "Guardado local en este dispositivo";
    if (!leads.length) {
      list.innerHTML = `<p class="empty-state">Aún no hay prospectos. Registra a quien pregunte por una pieza para no perder el seguimiento.</p>`;
      return;
    }
    list.innerHTML = leads.map((lead) => {
      const phone = String(lead.telefono || "").replace(/\D/g, "");
      const wa = phone ? `https://wa.me/${phone.startsWith("52") ? phone : `52${phone}`}?text=${encodeURIComponent(buildLeadMessage(lead))}` : "";
      return `<article class="ai-lead-card" data-lead-id="${escapeAttr(lead.id)}">
        <div class="ai-lead-head">
          <strong>${escapeHtml(lead.nombre || "CLIENTE")}</strong>
          <span class="ai-pill">${escapeHtml(lead.estado || "PENDIENTE")}</span>
        </div>
        <p><b>${escapeHtml(lead.pieza_buscada || "PIEZA")}</b>${lead.vehiculo ? ` · ${escapeHtml(lead.vehiculo)}` : ""}</p>
        <p>${lead.presupuesto ? `Presupuesto: ${formatMoney(lead.presupuesto)} · ` : ""}${lead.seguimiento_en ? `Seguimiento: ${escapeHtml(lead.seguimiento_en)}` : "Sin fecha de seguimiento"}</p>
        ${lead.notas ? `<p>${escapeHtml(lead.notas)}</p>` : ""}
        <div class="ai-lead-actions">
          ${wa ? `<a class="btn mini" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          <button class="btn mini" type="button" data-lead-action="done">Marcar atendido</button>
          <button class="btn mini danger" type="button" data-lead-action="delete">Eliminar</button>
        </div>
      </article>`;
    }).join("");
  }

  async function handleLeadAction(event) {
    const button = event.target.closest("[data-lead-action]");
    const card = event.target.closest("[data-lead-id]");
    if (!button || !card) return;
    const id = card.dataset.leadId;
    const action = button.dataset.leadAction;
    const db = window.avDB || window.autopartesSupabase;

    if (action === "done") {
      const lead = leads.find((item) => String(item.id) === String(id));
      if (!lead) return;
      lead.estado = "ATENDIDO";
      if (leadsMode === "supabase" && db) await db.from("prospectos").update({ estado: "ATENDIDO" }).eq("id", id);
      else writeLocalLeads(leads);
    }
    if (action === "delete") {
      if (leadsMode === "supabase" && db) await db.from("prospectos").delete().eq("id", id);
      leads = leads.filter((item) => String(item.id) !== String(id));
      if (leadsMode === "local") writeLocalLeads(leads);
    }
    renderLeads();
  }

  function buildLeadMessage(lead) {
    return `Hola ${lead.nombre || ""}. Te contactamos de AUTOPARTES VENCES por la ${lead.pieza_buscada || "pieza"}${lead.vehiculo ? ` para ${lead.vehiculo}` : ""}. ¿Todavía la necesitas? Puedo confirmarte disponibilidad y enviarte fotos reales.`;
  }

  function readLocalLeads() {
    try {
      const value = JSON.parse(localStorage.getItem(LEADS_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function writeLocalLeads(value) {
    try {
      localStorage.setItem(LEADS_KEY, JSON.stringify(value.slice(0, 500)));
      return true;
    } catch (_) {
      // Algunos navegadores bloquean almacenamiento local. La lista sigue viva en memoria durante la sesión.
      return false;
    }
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  function finiteOrNull(value) {
    const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function unique(values) {
    return [...new Set(values.filter((value) => value !== "" && value !== null && value !== undefined))];
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value ?? "");
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
})();

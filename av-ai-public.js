/* AUTOPARTES VENCES | Asistente público de búsqueda.
   Busca exclusivamente dentro del inventario cargado y nunca promete compatibilidad. */
(() => {
  "use strict";
  const config = window.AV_AI_CONFIG || {};
  if (config.enabled === false || config.publicAssistant === false) return;

  const $ = (id) => document.getElementById(id);
  const normalize = (value) => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const RELATED = [
    [["puerta"], ["cristal", "elevador", "switch", "cerradura", "manija", "moldura", "espejo"]],
    [["faro"], ["defensa", "parrilla", "salpicadera", "cofre"]],
    [["calavera"], ["cajuela", "defensa trasera", "moldura"]],
    [["defensa", "fascia", "facia"], ["parrilla", "faro", "absorbedor", "alma"]],
    [["motor"], ["alternador", "marcha", "compresor", "radiador", "ventilador"]],
    [["radiador", "condensador"], ["ventilador", "deposito", "manguera"]]
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const launcher = $("avAssistantLauncher");
    const panel = $("avAssistantPanel");
    const close = $("avAssistantClose");
    const form = $("avAssistantForm");
    if (!launcher || !panel || !form) return;

    launcher.addEventListener("click", () => togglePanel(true));
    close?.addEventListener("click", () => togglePanel(false));
    form.addEventListener("submit", handleSearch);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel.classList.contains("open")) togglePanel(false);
    });
  }

  function togglePanel(open) {
    const panel = $("avAssistantPanel");
    const launcher = $("avAssistantLauncher");
    if (!panel || !launcher) return;
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", String(!open));
    launcher.setAttribute("aria-expanded", String(open));
    launcher.classList.toggle("is-hidden", open);
    if (open) setTimeout(() => $("avAssistantInput")?.focus(), 30);
  }

  async function handleSearch(event) {
    event.preventDefault();
    const input = $("avAssistantInput");
    const query = input?.value.trim() || "";
    if (!query) return;
    addMessage(query, "user");
    input.value = "";

    const bridge = window.AV_CATALOG_BRIDGE;
    if (!bridge?.search) {
      addMessage("El catálogo todavía está cargando. Intenta de nuevo en unos segundos.", "bot");
      return;
    }

    let normalizedQuery = query;
    if (config.publicRemoteEnabled === true) {
      try {
        normalizedQuery = await normalizeRemotely(query) || query;
      } catch (error) {
        console.warn("Normalizador remoto no disponible:", error);
      }
    }

    let results = [];
    try {
      const found = bridge.search(normalizedQuery);
      results = (Array.isArray(found) ? found : []).filter((item) => item?.disponible !== false).slice(0, 5);
    } catch (error) {
      console.warn("La búsqueda inteligente no pudo completarse:", error);
      addMessage("No pude consultar el catálogo en este momento. Puedes intentar de nuevo o pedir revisión por WhatsApp.", "bot");
      return;
    }
    recordDemand(query, results.length);

    if (!results.length) {
      const whatsapp = bridge.getWhatsAppNumber?.() || "525632753982";
      const message = `Hola, busco esta autoparte y no la encontré en el catálogo: ${query}. ¿Me pueden ayudar a revisar disponibilidad?`;
      addMessage(
        `No encontré una coincidencia disponible. Puedo dejarte un enlace para pedir revisión manual.`,
        "bot",
        `<a class="av-assistant-result" href="https://wa.me/${encodeURIComponent(whatsapp)}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener"><strong>Pedir revisión por WhatsApp</strong><span>${escapeHtml(query)}</span></a>`
      );
      return;
    }

    const html = results.map((item) => {
      const url = safeProductUrl(bridge, item);
      const price = safeFormatPrice(bridge, item.precio);
      return `<a class="av-assistant-result" href="${escapeAttr(url)}"><strong>${escapeHtml(title(item))}</strong><span>ID ${escapeHtml(item.id || "N/A")} · ${escapeHtml(price)}</span></a>`;
    }).join("");

    const related = findRelated(results[0], bridge.getProducts?.() || []);
    const relatedText = related.length
      ? `<div class="av-assistant-results"><span style="color:#9aa8bd;font-size:.74rem">También podrías necesitar:</span>${related.slice(0, 3).map((item) => `<a class="av-assistant-result" href="${escapeAttr(safeProductUrl(bridge, item))}"><strong>${escapeHtml(title(item))}</strong><span>${escapeHtml(safeFormatPrice(bridge, item.precio))}</span></a>`).join("")}</div>`
      : "";

    addMessage(
      `Encontré ${results.length} opción${results.length === 1 ? "" : "es"}. Confirma número de parte, lado y compatibilidad antes de comprar.`,
      "bot",
      `<div class="av-assistant-results">${html}</div>${relatedText}`
    );
  }

  function safeProductUrl(bridge, item) {
    try {
      return bridge?.createProductUrl?.(item) || "#catalogo";
    } catch (_) {
      return "#catalogo";
    }
  }

  function safeFormatPrice(bridge, value) {
    try {
      return bridge?.formatPrice?.(value) || "Precio por confirmar";
    } catch (_) {
      return "Precio por confirmar";
    }
  }

  function findRelated(base, inventory) {
    const part = normalize(base?.pieza);
    const keys = RELATED.find(([triggers]) => triggers.some((trigger) => part.includes(normalize(trigger))))?.[1] || [];
    if (!keys.length) return [];
    return inventory.filter((item) => {
      if (!item?.disponible || item.id === base.id) return false;
      const sameVehicle = normalize(item.marca) === normalize(base.marca) && normalize(item.modelo) === normalize(base.modelo);
      const relatedPart = keys.some((key) => normalize(item.pieza).includes(normalize(key)));
      return sameVehicle && relatedPart;
    });
  }

  function addMessage(text, type, extraHtml = "") {
    const container = $("avAssistantMessages");
    if (!container) return;
    const message = document.createElement("div");
    message.className = `av-msg ${type}`;
    message.innerHTML = `<div>${escapeHtml(text)}</div>${extraHtml}`;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  async function normalizeRemotely(query) {
    const db = window.autopartesSupabase || window.avDB;
    if (!db?.functions?.invoke) return query;
    const { data, error } = await db.functions.invoke(config.edgeFunctionName || "ai-copilot", {
      body: { mode: "normalize_search", query }
    });
    if (error) throw error;
    return data?.normalized_query || query;
  }

  async function recordDemand(query, resultCount) {
    if (config.demandTrackingEnabled === false || !shouldRecordDemand(query)) return;
    const payload = {
      consulta: String(query).slice(0, 300),
      resultados: Number(resultCount || 0),
      pagina: window.location.pathname,
      user_agent: String(navigator.userAgent || "").slice(0, 500)
    };
    try {
      const db = window.autopartesSupabase || window.avDB;
      if (db?.from) {
        await db.from("busquedas_clientes").insert(payload);
        return;
      }
      const publicConfig = window.AV_CONFIG || {};
      const baseUrl = String(publicConfig.SUPABASE_URL || "").replace(/\/$/, "");
      const anonKey = String(publicConfig.SUPABASE_ANON_KEY || "");
      if (!baseUrl || !anonKey) return;
      await fetch(`${baseUrl}/rest/v1/busquedas_clientes`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (_) {
      // Esta tabla es opcional. El buscador no depende de ella.
    }
  }

  function shouldRecordDemand(query) {
    const normalized = normalize(query).slice(0, 300);
    if (!normalized) return false;
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    const oneDay = 24 * 60 * 60 * 1000;
    const key = "avDemandThrottleV1";
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      const recent = (Array.isArray(stored) ? stored : [])
        .filter((item) => item && Number(item.at) > now - oneDay)
        .slice(-30);
      if (recent.length >= 30) return false;
      if (recent.some((item) => item.query === normalized && Number(item.at) > now - tenMinutes)) return false;
      recent.push({ query: normalized, at: now });
      localStorage.setItem(key, JSON.stringify(recent));
      return true;
    } catch (_) {
      // Con almacenamiento bloqueado se permite el registro; una falla local nunca bloquea la búsqueda.
      return true;
    }
  }

  function title(item) {
    return [item.pieza, item.lado, item.marca, item.modelo, item.anio].filter(Boolean).join(" ") || "Autoparte disponible";
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

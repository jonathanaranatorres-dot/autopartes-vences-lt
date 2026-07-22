(() => {
  "use strict";

  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CHUNK_LIMIT = 5000;
  const incomingTransfers = new Map();

  let peer = null;
  let connection = null;
  let sessionCode = "";
  let sessionActive = false;
  let librariesPromise = null;

  const $ = (id) => document.getElementById(id);

  function randomCode(length = 6) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return [...bytes].map((value) => ALPHABET[value % ALPHABET.length]).join("");
  }

  function peerIdFromCode(code) {
    return `av-vences-pc-${String(code).toLowerCase()}`;
  }

  function cameraUrlForCode(code) {
    const url = new URL("camara-celular.html", window.location.href);
    url.searchParams.set("sesion", code);
    return url.toString();
  }

  function currentPhotoCount() {
    return document.querySelectorAll("#preview .preview-card").length;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((script) => script.src === src);
      if (existing?.dataset.loaded === "true") {
        resolve();
        return;
      }
      const script = existing || document.createElement("script");
      script.src = src;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
      if (!existing) document.head.appendChild(script);
    });
  }

  function ensureLibraries() {
    if (!librariesPromise) {
      librariesPromise = Promise.all([
        typeof window.Peer === "function"
          ? Promise.resolve()
          : loadScript("https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js"),
        typeof window.QRCode === "function"
          ? Promise.resolve()
          : loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js")
      ]).catch((error) => {
        librariesPromise = null;
        throw error;
      });
    }
    return librariesPromise;
  }

  function setBadge(text, type = "wait") {
    const badge = $("remoteCameraBadge");
    if (!badge) return;
    badge.textContent = text;
    badge.className = `remote-camera-badge ${type}`;
  }

  function setStatus(text, type = "") {
    const status = $("remoteCameraStatus");
    if (!status) return;
    status.textContent = text;
    status.className = `remote-camera-status ${type}`.trim();
  }

  function setButtons(active) {
    const start = $("remoteCameraStart");
    const newCode = $("remoteCameraNewCode");
    const copyLink = $("remoteCameraCopyLink");
    if (start) start.textContent = active ? "Reiniciar sesión" : "Activar cámara";
    if (newCode) newCode.disabled = !active;
    if (copyLink) copyLink.disabled = !active;
  }

  function renderAccess() {
    const code = $("remoteSessionCode");
    const qr = $("remoteCameraQr");
    if (code) code.textContent = sessionCode || "------";
    if (!qr) return;
    qr.innerHTML = "";
    if (!sessionCode) {
      qr.innerHTML = "<span>Activa la cámara para generar el QR.</span>";
      return;
    }
    const url = cameraUrlForCode(sessionCode);
    if (typeof window.QRCode === "function") {
      new window.QRCode(qr, {
        text: url,
        width: 184,
        height: 184,
        correctLevel: window.QRCode.CorrectLevel.M
      });
    } else {
      qr.innerHTML = "<span>No se pudo generar el QR. Usa el botón Copiar liga.</span>";
    }
  }

  function closeConnection() {
    if (connection) {
      try { connection.close(); } catch (_) {}
    }
    connection = null;
  }

  function destroyPeer() {
    closeConnection();
    if (peer) {
      try { peer.destroy(); } catch (_) {}
    }
    peer = null;
    incomingTransfers.clear();
  }

  async function createSession() {
    const shell = $("remoteCameraShell");
    if (shell) shell.open = true;
    destroyPeer();
    sessionCode = randomCode();
    sessionActive = true;
    renderAccess();
    setButtons(true);
    setBadge("Abriendo sesión", "wait");
    setStatus("Preparando el enlace seguro con el celular…");

    try {
      await ensureLibraries();
    } catch (error) {
      setBadge("Sin conexión", "err");
      setStatus("No se pudieron cargar los componentes de cámara. Revisa internet y vuelve a intentarlo.", "err");
      return;
    }

    renderAccess();
    peer = new window.Peer(peerIdFromCode(sessionCode), { debug: 1 });

    peer.on("open", () => {
      setBadge("Esperando celular", "wait");
      setStatus("Sesión lista. Escanea el QR con el celular.", "ok");
    });

    peer.on("connection", acceptConnection);

    peer.on("disconnected", () => {
      if (!peer?.destroyed) {
        setBadge("Reconectando", "wait");
        setStatus("Se perdió momentáneamente el enlace. Intentando reconectar…");
        setTimeout(() => {
          try { peer.reconnect(); } catch (_) {}
        }, 900);
      }
    });

    peer.on("error", (error) => {
      console.error("Cámara remota PeerJS:", error);
      if (error?.type === "unavailable-id") {
        setStatus("El código coincidió con otra sesión. Generando uno nuevo…");
        setTimeout(createSession, 350);
        return;
      }
      setBadge("Error", "err");
      setStatus(`No se pudo abrir la sesión: ${error?.message || "error desconocido"}`, "err");
    });
  }

  function acceptConnection(candidate) {
    closeConnection();
    connection = candidate;
    setBadge("Celular enlazando", "wait");

    candidate.on("open", () => {
      setBadge("Celular conectado", "ok");
      setStatus("Conexión lista. Las fotos aparecerán directamente en la bandeja de esta pieza.", "ok");
      candidate.send({ type: "ready", count: currentPhotoCount() });
    });

    candidate.on("data", handleIncomingData);

    candidate.on("close", () => {
      if (connection === candidate) connection = null;
      setBadge("Esperando celular", "wait");
      setStatus("El celular se desconectó. Puede volver a entrar con el mismo QR.");
    });

    candidate.on("error", (error) => {
      console.error("Enlace de cámara remota:", error);
      setBadge("Enlace con error", "err");
      setStatus(`Falló el enlace con el celular: ${error?.message || "error desconocido"}`, "err");
    });
  }

  function handleIncomingData(message) {
    if (!message || typeof message !== "object") return;

    if (message.type === "hello") {
      connection?.send({ type: "ready", count: currentPhotoCount() });
      return;
    }

    if (message.type === "photo-start") {
      const totalChunks = Math.max(1, Math.min(CHUNK_LIMIT, Number(message.totalChunks || 1)));
      incomingTransfers.set(message.id, {
        id: message.id,
        name: String(message.name || `autoparte-${Date.now()}.jpg`),
        mime: String(message.mime || "image/jpeg"),
        totalChunks,
        chunks: new Array(totalChunks),
        received: 0
      });
      setStatus(`Recibiendo ${message.name || "fotografía"}: 0%`);
      return;
    }

    if (message.type === "photo-chunk") {
      const transfer = incomingTransfers.get(message.id);
      if (!transfer) return;
      const index = Number(message.index);
      if (!Number.isInteger(index) || index < 0 || index >= transfer.totalChunks) return;
      if (!transfer.chunks[index]) {
        transfer.chunks[index] = message.buffer;
        transfer.received += 1;
      }
      const percent = Math.round((transfer.received / transfer.totalChunks) * 100);
      setStatus(`Recibiendo ${transfer.name}: ${percent}%`);
      return;
    }

    if (message.type === "photo-end") finishTransfer(message.id);
  }

  function addFileToAdmin(file) {
    const input = $("fotosInput");
    if (!input) throw new Error("No se encontró la bandeja de fotos del admin.");

    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    } catch (error) {
      if (typeof window.seleccionarFotos === "function") {
        window.seleccionarFotos([file]);
        return;
      }
      throw error;
    }
  }

  function finishTransfer(id) {
    const transfer = incomingTransfers.get(id);
    if (!transfer) return;

    if (transfer.received !== transfer.totalChunks || transfer.chunks.some((chunk) => !chunk)) {
      incomingTransfers.delete(id);
      setStatus(`La foto ${transfer.name} llegó incompleta. Tómala nuevamente.`, "err");
      connection?.send({ type: "photo-error", id, message: "La fotografía llegó incompleta." });
      return;
    }

    try {
      const blob = new Blob(transfer.chunks, { type: transfer.mime });
      const file = new File([blob], transfer.name, {
        type: transfer.mime,
        lastModified: Date.now()
      });
      addFileToAdmin(file);
      incomingTransfers.delete(id);
      const count = currentPhotoCount();
      setStatus(`${transfer.name} llegó correctamente. Ya puedes tomar la siguiente.`, "ok");
      connection?.send({ type: "photo-ack", id, count });
    } catch (error) {
      console.error("No se pudo agregar la foto al admin:", error);
      incomingTransfers.delete(id);
      setStatus("La foto llegó, pero no pudo agregarse al formulario. Actualiza la página y vuelve a intentar.", "err");
      connection?.send({ type: "photo-error", id, message: "No se pudo agregar la fotografía al formulario." });
    }
  }

  async function copyLink() {
    if (!sessionCode) return;
    try {
      await navigator.clipboard.writeText(cameraUrlForCode(sessionCode));
      setStatus("Liga copiada. Puedes enviarla o abrirla en el celular.", "ok");
    } catch (_) {
      setStatus("El navegador no permitió copiar la liga. Usa el QR.", "err");
    }
  }

  function observePhotoCount() {
    const preview = $("preview");
    if (!preview) return;
    const observer = new MutationObserver(() => {
      if (connection?.open) connection.send({ type: "count", count: currentPhotoCount() });
    });
    observer.observe(preview, { childList: true, subtree: true });
  }

  function maybeAutoStart() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("captura") !== "remota") return;
    const shell = $("remoteCameraShell");
    if (shell) {
      shell.open = true;
      setTimeout(() => shell.scrollIntoView({ behavior: "smooth", block: "center" }), 700);
    }
    setTimeout(() => {
      if (!sessionActive) createSession();
    }, 500);
  }

  function bindEvents() {
    $("remoteCameraStart")?.addEventListener("click", createSession);
    $("remoteCameraNewCode")?.addEventListener("click", createSession);
    $("remoteCameraCopyLink")?.addEventListener("click", copyLink);
    observePhotoCount();
    maybeAutoStart();

    window.addEventListener("beforeunload", destroyPeer);
  }

  document.addEventListener("DOMContentLoaded", bindEvents);
})();

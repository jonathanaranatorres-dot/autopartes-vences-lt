(() => {
  "use strict";

  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CHUNK_LIMIT = 5000;
  const incomingTransfers = new Map();
  const photos = [];

  let peer = null;
  let connection = null;
  let sessionCode = "";

  const $ = (id) => document.getElementById(id);

  function randomCode(length = 6) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return [...bytes].map((value) => ALPHABET[value % ALPHABET.length]).join("");
  }

  function peerIdFromCode(code) {
    return `av-vences-pc-${String(code).toLowerCase()}`;
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(0)} KB`;
    return `${(value / 1024 ** 2).toFixed(1)} MB`;
  }

  function setConnectionState(text, type = "wait") {
    const badge = $("connectionBadge");
    badge.textContent = text;
    badge.className = `badge ${type}`;
  }

  function setSessionStatus(text, type = "") {
    const element = $("sessionStatus");
    element.textContent = text;
    element.className = `status-line ${type}`.trim();
  }

  function setTransferStatus(text, type = "") {
    const element = $("transferStatus");
    element.textContent = text;
    element.className = `status-line ${type}`.trim();
  }

  function cameraUrlForCode(code) {
    const url = new URL("camara-celular.html", window.location.href);
    url.searchParams.set("sesion", code);
    return url.toString();
  }

  function renderSessionAccess() {
    const url = cameraUrlForCode(sessionCode);
    $("sessionCode").textContent = sessionCode;
    $("cameraUrl").value = url;

    const qrContainer = $("qrCode");
    qrContainer.innerHTML = "";
    if (typeof window.QRCode === "function") {
      new window.QRCode(qrContainer, {
        text: url,
        width: 160,
        height: 160,
        correctLevel: window.QRCode.CorrectLevel.M
      });
    } else {
      qrContainer.textContent = "QR no disponible. Usa la liga.";
      qrContainer.style.color = "#111";
      qrContainer.style.textAlign = "center";
    }
  }

  async function copyText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      setSessionStatus(successMessage, "ok");
    } catch (error) {
      setSessionStatus("No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.", "err");
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
  }

  function createSession() {
    destroyPeer();
    incomingTransfers.clear();
    sessionCode = randomCode();
    renderSessionAccess();
    setConnectionState("Abriendo sesión", "wait");
    setSessionStatus("Registrando el código temporal…");

    if (typeof window.Peer !== "function") {
      setConnectionState("Falta conexión", "err");
      setSessionStatus("No cargó el componente de conexión. Revisa internet y vuelve a abrir la página.", "err");
      return;
    }

    peer = new window.Peer(peerIdFromCode(sessionCode), { debug: 1 });

    peer.on("open", () => {
      setConnectionState("Esperando celular", "wait");
      setSessionStatus("Sesión lista. Escanea el QR o abre la liga en el celular.", "ok");
    });

    peer.on("connection", acceptConnection);

    peer.on("disconnected", () => {
      if (!peer?.destroyed) {
        setConnectionState("Reconectando", "wait");
        setSessionStatus("Se perdió el enlace de señalización. Intentando reconectar…");
        setTimeout(() => {
          try { peer.reconnect(); } catch (_) {}
        }, 900);
      }
    });

    peer.on("error", (error) => {
      console.error("PeerJS:", error);
      if (error?.type === "unavailable-id") {
        setSessionStatus("El código coincidió con otra sesión. Generando uno nuevo…");
        setTimeout(createSession, 400);
        return;
      }
      setConnectionState("Error de conexión", "err");
      setSessionStatus(`No se pudo abrir la sesión: ${error?.message || "error desconocido"}`, "err");
    });
  }

  function acceptConnection(candidate) {
    closeConnection();
    connection = candidate;
    setConnectionState("Celular enlazando", "wait");

    candidate.on("open", () => {
      setConnectionState("Celular conectado", "ok");
      setSessionStatus("Conexión directa lista. Ya puedes tomar fotografías desde el celular.", "ok");
      candidate.send({ type: "ready", count: photos.length });
    });

    candidate.on("data", handleIncomingData);

    candidate.on("close", () => {
      if (connection === candidate) connection = null;
      setConnectionState("Esperando celular", "wait");
      setSessionStatus("El celular se desconectó. Puedes volver a conectarlo con el mismo código.");
    });

    candidate.on("error", (error) => {
      console.error("Conexión:", error);
      setConnectionState("Enlace con error", "err");
      setSessionStatus(`Falló el enlace con el celular: ${error?.message || "error desconocido"}`, "err");
    });
  }

  function handleIncomingData(message) {
    if (!message || typeof message !== "object") return;

    if (message.type === "hello") {
      connection?.send({ type: "ready", count: photos.length });
      return;
    }

    if (message.type === "photo-start") {
      const totalChunks = Math.max(1, Math.min(CHUNK_LIMIT, Number(message.totalChunks || 1)));
      incomingTransfers.set(message.id, {
        id: message.id,
        name: String(message.name || `foto-${Date.now()}.jpg`),
        mime: String(message.mime || "image/jpeg"),
        width: Number(message.width || 0),
        height: Number(message.height || 0),
        originalBytes: Number(message.originalBytes || 0),
        totalBytes: Number(message.totalBytes || 0),
        totalChunks,
        chunks: new Array(totalChunks),
        received: 0
      });
      setTransferStatus(`Recibiendo ${message.name || "foto"}: 0%`);
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
      setTransferStatus(`Recibiendo ${transfer.name}: ${percent}%`);
      return;
    }

    if (message.type === "photo-end") {
      finishTransfer(message.id);
    }
  }

  function finishTransfer(id) {
    const transfer = incomingTransfers.get(id);
    if (!transfer) return;

    if (transfer.received !== transfer.totalChunks || transfer.chunks.some((chunk) => !chunk)) {
      setTransferStatus(`La foto ${transfer.name} llegó incompleta. Tómala nuevamente.`, "err");
      incomingTransfers.delete(id);
      connection?.send({ type: "photo-error", id, message: "La fotografía llegó incompleta." });
      return;
    }

    const blob = new Blob(transfer.chunks, { type: transfer.mime });
    const photo = {
      id: transfer.id,
      name: transfer.name,
      blob,
      url: URL.createObjectURL(blob),
      width: transfer.width,
      height: transfer.height,
      originalBytes: transfer.originalBytes,
      receivedAt: new Date()
    };

    photos.push(photo);
    incomingTransfers.delete(id);
    renderGallery();
    setTransferStatus(`Foto recibida correctamente: ${photo.name} (${formatBytes(blob.size)}).`, "ok");
    connection?.send({ type: "photo-ack", id, count: photos.length });
  }

  function downloadPhoto(photo, index) {
    const anchor = document.createElement("a");
    anchor.href = photo.url;
    anchor.download = `${String(index + 1).padStart(2, "0")}-${photo.name}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function downloadAll() {
    for (let index = 0; index < photos.length; index += 1) {
      downloadPhoto(photos[index], index);
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    setTransferStatus(`${photos.length} fotografía(s) enviadas a descargas.`, "ok");
  }

  function movePhoto(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    [photos[index], photos[nextIndex]] = [photos[nextIndex], photos[index]];
    renderGallery();
  }

  function makeCover(index) {
    if (index <= 0 || index >= photos.length) return;
    const [photo] = photos.splice(index, 1);
    photos.unshift(photo);
    renderGallery();
  }

  function removePhoto(index) {
    const [photo] = photos.splice(index, 1);
    if (photo?.url) URL.revokeObjectURL(photo.url);
    renderGallery();
  }

  function clearPhotos() {
    if (!photos.length) return;
    const confirmed = window.confirm("¿Vaciar las fotos de esta prueba? No afecta el inventario.");
    if (!confirmed) return;
    photos.splice(0).forEach((photo) => URL.revokeObjectURL(photo.url));
    renderGallery();
    setTransferStatus("Bandeja temporal vacía.");
    connection?.send({ type: "count", count: 0 });
  }

  function renderGallery() {
    const gallery = $("gallery");
    $("galleryTitle").textContent = `Fotos recibidas: ${photos.length}`;
    $("downloadAllBtn").disabled = !photos.length;
    $("clearBtn").disabled = !photos.length;

    if (!photos.length) {
      gallery.innerHTML = '<div class="empty">Cuando el celular envíe una foto, aparecerá aquí casi de inmediato.</div>';
      return;
    }

    gallery.innerHTML = "";
    photos.forEach((photo, index) => {
      const card = document.createElement("article");
      card.className = `photo-card ${index === 0 ? "cover" : ""}`.trim();
      card.innerHTML = `
        ${index === 0 ? '<span class="cover-label">Portada</span>' : ""}
        <img src="${photo.url}" alt="Foto ${index + 1}">
        <div class="photo-meta">
          <strong>${escapeHtml(photo.name)}</strong>
          <span>${photo.width && photo.height ? `${photo.width} × ${photo.height} · ` : ""}${formatBytes(photo.blob.size)}</span>
          <div class="photo-tools">
            <button class="btn" data-action="cover" data-index="${index}" ${index === 0 ? "disabled" : ""}>Portada</button>
            <button class="btn" data-action="up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
            <button class="btn" data-action="down" data-index="${index}" ${index === photos.length - 1 ? "disabled" : ""}>↓</button>
            <button class="btn danger" data-action="delete" data-index="${index}">Quitar</button>
          </div>
          <button class="btn" data-action="download" data-index="${index}" style="width:100%;margin-top:7px">Descargar esta foto</button>
        </div>
      `;
      gallery.appendChild(card);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function bindEvents() {
    $("newSessionBtn").addEventListener("click", createSession);
    $("copyCodeBtn").addEventListener("click", () => copyText(sessionCode, "Código copiado."));
    $("copyUrlBtn").addEventListener("click", () => copyText($("cameraUrl").value, "Liga copiada."));
    $("downloadAllBtn").addEventListener("click", downloadAll);
    $("clearBtn").addEventListener("click", clearPhotos);
    $("resetFormBtn").addEventListener("click", () => {
      $("testCaptureForm").reset();
      $("testCondition").value = "USADO ORIGINAL";
      ["testId", "testPart", "testBrand", "testModel", "testYear"].forEach((id) => {
        $(id).value = String($(id).value || "").toLocaleUpperCase("es-MX");
      });
    });
    ["testId", "testPart", "testBrand", "testModel", "testYear", "testCondition"].forEach((id) => {
      $(id).addEventListener("input", (event) => {
        const start = event.target.selectionStart;
        const end = event.target.selectionEnd;
        event.target.value = event.target.value.toLocaleUpperCase("es-MX");
        if (typeof event.target.setSelectionRange === "function") event.target.setSelectionRange(start, end);
      });
    });

    $("gallery").addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const index = Number(button.dataset.index);
      const action = button.dataset.action;
      if (action === "cover") makeCover(index);
      if (action === "up") movePhoto(index, -1);
      if (action === "down") movePhoto(index, 1);
      if (action === "delete") removePhoto(index);
      if (action === "download") downloadPhoto(photos[index], index);
    });

    window.addEventListener("beforeunload", () => {
      destroyPeer();
      photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    createSession();
  });
})();

(() => {
  "use strict";

  const CHUNK_SIZE = 64 * 1024;
  const MAX_BUFFERED_MESSAGES = 18;

  let peer = null;
  let connection = null;
  let sending = false;
  let confirmedCount = 0;
  let lastPreviewUrl = "";

  const $ = (id) => document.getElementById(id);

  function normalizeCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  function peerIdFromCode(code) {
    return `av-vences-pc-${String(code).toLowerCase()}`;
  }

  function setConnectionState(text, type = "wait") {
    const badge = $("connectionBadge");
    badge.textContent = text;
    badge.className = `badge ${type}`;
  }

  function setConnectionStatus(text, type = "") {
    const element = $("connectionStatus");
    element.textContent = text;
    element.className = `status-line ${type}`.trim();
  }

  function setCameraStatus(text, type = "") {
    const element = $("cameraStatus");
    element.textContent = text;
    element.className = `status-line ${type}`.trim();
  }

  function setProgress(percent) {
    $("progressBar").style.width = `${Math.max(0, Math.min(100, Number(percent || 0)))}%`;
  }

  function setCounter(value) {
    confirmedCount = Math.max(0, Number(value || 0));
    $("photoCounter").textContent = String(confirmedCount);
  }

  function destroyConnection() {
    if (connection) {
      try { connection.close(); } catch (_) {}
    }
    connection = null;
    if (peer) {
      try { peer.destroy(); } catch (_) {}
    }
    peer = null;
    sending = false;
    $("cameraPanel").classList.add("hidden");
    $("connectBtn").disabled = false;
    setConnectionState("Sin conectar", "wait");
  }

  function connectToComputer() {
    const code = normalizeCode($("sessionInput").value);
    $("sessionInput").value = code;

    if (code.length !== 6) {
      setConnectionStatus("Escribe los 6 caracteres que aparecen en la computadora.", "err");
      return;
    }

    if (typeof window.Peer !== "function") {
      setConnectionStatus("No cargó el componente de conexión. Revisa internet y vuelve a abrir la página.", "err");
      return;
    }

    destroyConnection();
    $("connectBtn").disabled = true;
    setConnectionState("Conectando", "wait");
    setConnectionStatus("Buscando la computadora…");

    peer = new window.Peer(undefined, { debug: 1 });

    peer.on("open", () => {
      connection = peer.connect(peerIdFromCode(code), {
        reliable: true,
        serialization: "binary",
        metadata: { device: "camera-phone", version: 1 }
      });
      bindConnection(connection);
    });

    peer.on("error", (error) => {
      console.error("PeerJS:", error);
      $("connectBtn").disabled = false;
      setConnectionState("No conectado", "err");
      const friendly = error?.type === "peer-unavailable"
        ? "No encontré esa computadora. Verifica el código y que su pestaña siga abierta."
        : `No se pudo conectar: ${error?.message || "error desconocido"}`;
      setConnectionStatus(friendly, "err");
    });
  }

  function bindConnection(candidate) {
    candidate.on("open", () => {
      setConnectionState("Conectado", "ok");
      setConnectionStatus("Computadora encontrada. Ya puedes usar la cámara.", "ok");
      $("cameraPanel").classList.remove("hidden");
      $("connectBtn").disabled = false;
      candidate.send({ type: "hello", device: "camera-phone" });
    });

    candidate.on("data", (message) => {
      if (!message || typeof message !== "object") return;
      if (message.type === "ready" || message.type === "count") {
        setCounter(message.count);
      }
      if (message.type === "photo-ack") {
        setCounter(message.count);
        setProgress(100);
        setCameraStatus("Foto recibida por la computadora. Lista para la siguiente.", "ok");
        setTimeout(() => setProgress(0), 600);
      }
      if (message.type === "photo-error") {
        setProgress(0);
        setCameraStatus(message.message || "La computadora no pudo completar la fotografía.", "err");
      }
    });

    candidate.on("close", () => {
      connection = null;
      $("cameraPanel").classList.add("hidden");
      setConnectionState("Desconectado", "wait");
      setConnectionStatus("La computadora cerró la conexión. Puedes intentar conectarte otra vez.");
    });

    candidate.on("error", (error) => {
      console.error("Conexión:", error);
      setConnectionState("Enlace con error", "err");
      setConnectionStatus(`Falló la conexión: ${error?.message || "error desconocido"}`, "err");
    });
  }

  async function waitForBuffer() {
    while (connection && connection.open && connection.bufferSize > MAX_BUFFERED_MESSAGES) {
      await new Promise((resolve) => setTimeout(resolve, 35));
    }
  }

  async function sendPhoto(file) {
    if (sending) return;
    if (!connection?.open) {
      setCameraStatus("La computadora ya no está conectada.", "err");
      return;
    }

    sending = true;
    $("takePhotoBtn").disabled = true;
    $("choosePhotoBtn").disabled = true;
    setProgress(3);
    setCameraStatus("Preparando y comprimiendo la fotografía…");

    try {
      const prepared = await prepareImage(file);
      showPreview(prepared.blob);

      const id = `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`;
      const totalChunks = Math.ceil(prepared.blob.size / CHUNK_SIZE);
      connection.send({
        type: "photo-start",
        id,
        name: prepared.name,
        mime: prepared.blob.type || "image/jpeg",
        totalBytes: prepared.blob.size,
        totalChunks,
        width: prepared.width,
        height: prepared.height,
        originalBytes: file.size
      });

      for (let index = 0; index < totalChunks; index += 1) {
        await waitForBuffer();
        if (!connection?.open) throw new Error("La computadora se desconectó durante el envío.");
        const chunk = prepared.blob.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
        connection.send({ type: "photo-chunk", id, index, buffer: await chunk.arrayBuffer() });
        setProgress(10 + Math.round(((index + 1) / totalChunks) * 82));
        setCameraStatus(`Enviando fotografía: ${index + 1} de ${totalChunks} paquetes…`);
      }

      await waitForBuffer();
      connection.send({ type: "photo-end", id });
      setProgress(96);
      setCameraStatus("Fotografía enviada. Esperando confirmación de la computadora…");
    } catch (error) {
      console.error(error);
      setProgress(0);
      setCameraStatus(error?.message || "No se pudo enviar la fotografía.", "err");
    } finally {
      sending = false;
      $("takePhotoBtn").disabled = false;
      $("choosePhotoBtn").disabled = false;
      $("cameraInput").value = "";
      $("galleryInput").value = "";
    }
  }

  async function prepareImage(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      throw new Error("Selecciona una fotografía válida.");
    }

    let source;
    let cleanupSource = () => {};
    try {
      if (typeof createImageBitmap === "function") {
        source = await createImageBitmap(file, { imageOrientation: "from-image" });
        cleanupSource = () => source.close?.();
      } else {
        throw new Error("createImageBitmap no disponible");
      }
    } catch (_) {
      try {
        const objectUrl = URL.createObjectURL(file);
        source = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Formato no compatible"));
          image.src = objectUrl;
        });
        cleanupSource = () => URL.revokeObjectURL(objectUrl);
      } catch (error) {
        throw new Error("El celular entregó un formato que el navegador no pudo leer. Prueba usando JPG o activa el modo Más compatible de la cámara.");
      }
    }

    try {
      const sourceWidth = source.width || source.naturalWidth;
      const sourceHeight = source.height || source.naturalHeight;
      const maxSide = 1500;
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("No se pudo preparar la imagen.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(source, 0, 0, width, height);

      let type = "image/webp";
      let quality = 0.8;
      let blob = await canvasToBlob(canvas, type, quality);
      if (!blob || blob.type !== "image/webp") {
        type = "image/jpeg";
        blob = await canvasToBlob(canvas, type, quality);
      }
      if (!blob) throw new Error("No se pudo comprimir la fotografía.");

      const target = 560 * 1024;
      while (blob.size > target && quality > 0.48) {
        quality = Math.max(0.48, quality - 0.07);
        const next = await canvasToBlob(canvas, type, quality);
        if (!next || next.size >= blob.size) break;
        blob = next;
      }

      const extension = blob.type === "image/webp" ? "webp" : "jpg";
      return {
        blob,
        width,
        height,
        name: `autoparte-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`
      };
    } finally {
      cleanupSource();
    }
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  function showPreview(blob) {
    if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = URL.createObjectURL(blob);
    $("preview").innerHTML = `<img src="${lastPreviewUrl}" alt="Última fotografía">`;
  }

  function bindEvents() {
    const queryCode = normalizeCode(new URLSearchParams(window.location.search).get("sesion"));
    if (queryCode) $("sessionInput").value = queryCode;

    $("sessionInput").addEventListener("input", (event) => {
      event.target.value = normalizeCode(event.target.value);
    });
    $("sessionInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") connectToComputer();
    });
    $("connectBtn").addEventListener("click", connectToComputer);
    $("disconnectBtn").addEventListener("click", () => {
      destroyConnection();
      setConnectionStatus("Desconectado manualmente.");
    });
    $("takePhotoBtn").addEventListener("click", () => $("cameraInput").click());
    $("choosePhotoBtn").addEventListener("click", () => $("galleryInput").click());
    $("cameraInput").addEventListener("change", () => {
      const [file] = $("cameraInput").files || [];
      if (file) sendPhoto(file);
    });
    $("galleryInput").addEventListener("change", () => {
      const [file] = $("galleryInput").files || [];
      if (file) sendPhoto(file);
    });

    window.addEventListener("beforeunload", () => {
      destroyConnection();
      if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    if (normalizeCode($("sessionInput").value).length === 6) {
      setConnectionStatus("Código detectado desde el QR. Presiona Conectar con computadora.");
    }
  });
})();

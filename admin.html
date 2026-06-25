<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin | AUTOPARTES VENCES</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://cdn.jsdelivr.net">
  <style>
    :root {
      --bg: #090b10;
      --panel: #111722;
      --panel-2: #151e2d;
      --text: #f6f7fb;
      --muted: #a8b3c7;
      --line: rgba(255,255,255,.12);
      --accent: #e53b2c;
      --accent-2: #ffb000;
      --ok: #2ecc71;
      --danger: #ff4d4d;
      --shadow: 0 24px 70px rgba(0,0,0,.35);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at top left, rgba(229,59,44,.22), transparent 36%), var(--bg); color: var(--text); }
    a { color: inherit; }
    button, input, select, textarea { font: inherit; }
    .wrap { width: min(1240px, calc(100% - 32px)); margin: 0 auto; }
    .topbar { position: sticky; top: 0; z-index: 5; backdrop-filter: blur(14px); background: rgba(9,11,16,.82); border-bottom: 1px solid var(--line); }
    .topbar-inner { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
    .brand { display: flex; flex-direction: column; gap: 4px; }
    .brand strong { letter-spacing: .08em; }
    .brand span { color: var(--muted); font-size: .92rem; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { border: 0; border-radius: 14px; padding: 11px 16px; cursor: pointer; color: var(--text); background: var(--panel-2); border: 1px solid var(--line); transition: transform .15s ease, opacity .15s ease; }
    .btn:hover { transform: translateY(-1px); }
    .btn.primary { background: linear-gradient(135deg, var(--accent), #9e1c14); border-color: rgba(255,255,255,.18); }
    .btn.gold { background: linear-gradient(135deg, var(--accent-2), #c26b00); color: #16110a; font-weight: 800; }
    .btn.danger { background: rgba(255,77,77,.12); border-color: rgba(255,77,77,.42); color: #ffd6d6; }
    .btn:disabled { opacity: .55; cursor: not-allowed; transform: none; }

    .login { min-height: 100vh; display: grid; place-items: center; padding: 28px; }
    .login-card { width: min(440px, 100%); background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03)); border: 1px solid var(--line); border-radius: 28px; padding: 28px; box-shadow: var(--shadow); }
    .login-card h1 { margin: 0 0 8px; font-size: clamp(1.8rem, 5vw, 2.5rem); }
    .login-card p { margin: 0 0 22px; color: var(--muted); line-height: 1.5; }

    .grid { display: grid; grid-template-columns: minmax(340px, 440px) 1fr; gap: 22px; padding: 28px 0 60px; }
    .panel { background: rgba(17,23,34,.92); border: 1px solid var(--line); border-radius: 24px; padding: 20px; box-shadow: var(--shadow); }
    .panel h2 { margin: 0 0 14px; }
    .panel .hint { margin: -4px 0 18px; color: var(--muted); line-height: 1.45; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 7px; }
    .field.full { grid-column: 1 / -1; }
    label { color: var(--muted); font-size: .88rem; }
    input, select, textarea { width: 100%; color: var(--text); background: #0d121b; border: 1px solid var(--line); border-radius: 14px; padding: 12px 13px; outline: none; }
    input:focus, select:focus, textarea:focus { border-color: rgba(255,176,0,.65); box-shadow: 0 0 0 4px rgba(255,176,0,.08); }
    textarea { min-height: 92px; resize: vertical; }
    .checkrow { flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: #0d121b; }
    .checkrow input { width: auto; transform: scale(1.2); }
    .dropzone { grid-column: 1 / -1; min-height: 145px; border: 1.5px dashed rgba(255,255,255,.25); border-radius: 18px; background: rgba(255,255,255,.035); display: grid; place-items: center; text-align: center; padding: 18px; cursor: pointer; }
    .dropzone.drag { border-color: var(--accent-2); background: rgba(255,176,0,.08); }
    .dropzone strong { display: block; margin-bottom: 6px; }
    .dropzone span { color: var(--muted); }
    .preview { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 10px; grid-column: 1 / -1; }
    .preview img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 14px; border: 1px solid var(--line); }
    .form-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 10px; }

    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 16px; }
    .toolbar input { flex: 1; min-width: 220px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .stat { background: #0d121b; border: 1px solid var(--line); border-radius: 18px; padding: 14px; }
    .stat strong { display: block; font-size: 1.5rem; }
    .stat span { color: var(--muted); font-size: .86rem; }

    .table-wrap { overflow: auto; border: 1px solid var(--line); border-radius: 18px; }
    table { width: 100%; border-collapse: collapse; min-width: 840px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
    th { color: var(--muted); font-size: .82rem; text-transform: uppercase; letter-spacing: .06em; background: rgba(255,255,255,.03); }
    td { color: #e9edf7; }
    tr:hover td { background: rgba(255,255,255,.025); }
    .thumbs { display: flex; align-items: center; gap: 6px; }
    .thumbs img { width: 48px; height: 48px; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); }
    .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 9px; font-size: .82rem; background: rgba(46,204,113,.14); color: #c7ffdd; border: 1px solid rgba(46,204,113,.35); }
    .pill.off { background: rgba(255,77,77,.13); color: #ffd5d5; border-color: rgba(255,77,77,.35); }
    .row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .mini { padding: 8px 10px; border-radius: 10px; font-size: .86rem; }
    .status { margin: 12px 0 0; color: var(--muted); min-height: 24px; }
    .status.ok { color: #c7ffdd; }
    .status.err { color: #ffd5d5; }

    .hidden { display: none !important; }

    @media (max-width: 920px) {
      .grid { grid-template-columns: 1fr; }
      .topbar-inner { align-items: flex-start; flex-direction: column; padding: 14px 0; }
      .stats { grid-template-columns: 1fr; }
    }

    @media (max-width: 560px) {
      .form-grid { grid-template-columns: 1fr; }
      .wrap { width: min(100% - 20px, 1240px); }
      .panel { padding: 16px; border-radius: 20px; }
    }
  </style>
</head>
<body>
  <section id="loginView" class="login">
    <div class="login-card">
      <h1>Admin VENCES</h1>
      <p>Entra para publicar piezas, subir fotos y actualizar disponibilidad sin tocar código.</p>
      <form id="loginForm" class="form-grid">
        <div class="field full">
          <label for="loginEmail">Correo</label>
          <input id="loginEmail" type="email" autocomplete="email" required>
        </div>
        <div class="field full">
          <label for="loginPassword">Contraseña</label>
          <input id="loginPassword" type="password" autocomplete="current-password" required>
        </div>
        <div class="form-actions">
          <button class="btn primary" type="submit">Entrar</button>
          <a class="btn" href="index.html">Ver catálogo</a>
        </div>
      </form>
      <p id="loginStatus" class="status"></p>
    </div>
  </section>

  <main id="adminView" class="hidden">
    <header class="topbar">
      <div class="wrap topbar-inner">
        <div class="brand">
          <strong>AUTOPARTES VENCES</strong>
          <span>Motor de publicaciones e inventario</span>
        </div>
        <div class="actions">
          <a class="btn" href="index.html" target="_blank" rel="noopener">Abrir catálogo</a>
          <button id="exportExcel" class="btn gold" type="button">Exportar Excel</button>
          <button id="logoutBtn" class="btn danger" type="button">Salir</button>
        </div>
      </div>
    </header>

    <div class="wrap grid">
      <section class="panel">
        <h2 id="formTitle">Nueva pieza</h2>
        <p class="hint">Llena datos, arrastra fotos y guarda. El sistema sube las imágenes y publica la pieza automáticamente.</p>

        <form id="piezaForm" class="form-grid">
          <input type="hidden" id="piezaId">

          <div class="field">
            <label for="folio">ID / Folio</label>
            <input id="folio" placeholder="Ej. 041">
          </div>

          <div class="field">
            <label for="precio">Precio</label>
            <input id="precio" type="number" min="0" step="1" placeholder="1300">
          </div>

          <div class="field full">
            <label for="pieza">Pieza *</label>
            <input id="pieza" required placeholder="Puerta delantera">
          </div>

          <div class="field">
            <label for="marca">Marca</label>
            <input id="marca" placeholder="Chevrolet">
          </div>

          <div class="field">
            <label for="modelo">Modelo</label>
            <input id="modelo" placeholder="Beat">
          </div>

          <div class="field">
            <label for="anio">Año</label>
            <input id="anio" placeholder="2014-2021">
          </div>

          <div class="field">
            <label for="lado">Lado</label>
            <select id="lado">
              <option value="">N/C</option>
              <option>Izquierdo</option>
              <option>Derecho</option>
              <option>Delantero</option>
              <option>Trasero</option>
              <option>Superior</option>
              <option>Inferior</option>
            </select>
          </div>

          <div class="field">
            <label for="color">Color</label>
            <input id="color" placeholder="Blanco">
          </div>

          <div class="field">
            <label for="estado">Estado</label>
            <input id="estado" placeholder="Usado original">
          </div>

          <div class="field full">
            <label for="numeroParte">Número de parte</label>
            <input id="numeroParte" placeholder="Si tiene etiqueta o código">
          </div>

          <div class="field full">
            <label for="descripcion">Observaciones</label>
            <textarea id="descripcion" placeholder="Detalles, daños, incluye conectores, compatibilidad pendiente, etc."></textarea>
          </div>

          <label class="field full checkrow">
            <span>Publicar como disponible</span>
            <input id="disponible" type="checkbox" checked>
          </label>

          <div id="dropzone" class="dropzone">
            <div>
              <strong>Arrastra fotos aquí</strong>
              <span>O da clic para seleccionar varias fotos. No necesitas renombrarlas.</span>
            </div>
            <input id="fotosInput" type="file" accept="image/*" multiple hidden>
          </div>

          <div id="preview" class="preview"></div>

          <div class="form-actions">
            <button class="btn primary" id="saveBtn" type="submit">Guardar publicación</button>
            <button class="btn" id="resetBtn" type="button">Limpiar</button>
          </div>
        </form>
        <p id="formStatus" class="status"></p>
      </section>

      <section class="panel">
        <h2>Inventario</h2>
        <p class="hint">Busca, edita, marca vendido, elimina o carga filas desde tu Excel.</p>

        <div class="stats">
          <div class="stat"><strong id="statTotal">0</strong><span>Total de piezas</span></div>
          <div class="stat"><strong id="statDisponibles">0</strong><span>Disponibles</span></div>
          <div class="stat"><strong id="statFotos">0</strong><span>Con fotos</span></div>
        </div>

        <div class="toolbar">
          <input id="searchAdmin" placeholder="Buscar por ID, pieza, marca, modelo, año...">
          <label class="btn" for="excelInput">Importar Excel</label>
          <input id="excelInput" type="file" accept=".xlsx,.xls,.csv" hidden>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fotos</th>
                <th>ID</th>
                <th>Pieza</th>
                <th>Auto</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="tablaPiezas"></tbody>
          </table>
        </div>
        <p id="tableStatus" class="status"></p>
      </section>
    </div>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <script src="supabase-config.js"></script>
  <script src="admin.js"></script>
</body>
</html>

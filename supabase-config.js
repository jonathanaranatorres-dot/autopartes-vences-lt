// AUTOPARTES VENCES - Configuración de Supabase
// Cambia estos valores por los de tu proyecto en Supabase.
// Supabase > Project Settings > Data API

window.AV_CONFIG = {
  SUPABASE_URL: "PEGA_AQUI_TU_SUPABASE_URL",
  SUPABASE_ANON_KEY: "PEGA_AQUI_TU_SUPABASE_ANON_KEY",
  STORAGE_BUCKET: "fotos-piezas",
  WHATSAPP_NUMBER: "525632753982"
};

window.autopartesSupabase = null;

(function iniciarSupabase() {
  const cfg = window.AV_CONFIG;
  const incompleto =
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes("PEGA_AQUI") ||
    cfg.SUPABASE_ANON_KEY.includes("PEGA_AQUI");

  if (incompleto) {
    console.warn("Supabase todavía no está configurado. El catálogo usará datos.json como respaldo.");
    return;
  }

  if (!window.supabase) {
    console.error("No se cargó la librería de Supabase.");
    return;
  }

  window.autopartesSupabase = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );
})();

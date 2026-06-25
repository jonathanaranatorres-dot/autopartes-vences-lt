// AUTOPARTES VENCES - Configuración de Supabase

window.AV_CONFIG = {
  SUPABASE_URL: "https://dptfusbqvnjdutoptklb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_c0U810G6cNuEKk5to1Tjaw_sA7pPWlH",
  STORAGE_BUCKET: "fotos-piezas",
  WHATSAPP_NUMBER: "525632753982"
};

window.autopartesSupabase = null;

(function iniciarSupabase() {
  const cfg = window.AV_CONFIG;

  const incompleto =
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes("AQUI") ||
    cfg.SUPABASE_ANON_KEY.includes("AQUI");

  if (incompleto) {
    console.warn("Supabase todavía no está configurado.");
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

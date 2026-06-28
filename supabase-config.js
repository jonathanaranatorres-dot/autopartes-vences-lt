// AUTOPARTES VENCES - Configuración de Supabase

window.AV_CONFIG = {
  SUPABASE_URL: "https://dptfusbqvnjdutoptklb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_c0U810G6cNuEKk5to1Tjaw_sA7pPWlH",
  STORAGE_BUCKET: "fotos-piezas",
  WHATSAPP_NUMBER: "525632753982"
};

window.autopartesSupabase = null;
window.avDB = null;

(function iniciarSupabase() {
  const cfg = window.AV_CONFIG || {};

  const incompleto =
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes("AQUI") ||
    cfg.SUPABASE_ANON_KEY.includes("AQUI");

  if (incompleto) {
    console.warn("Supabase todavía no está configurado.");
    return;
  }

  const fabricaSupabase = window.supabase;

  if (!fabricaSupabase || typeof fabricaSupabase.createClient !== "function") {
    console.warn("La librería Supabase JS no está cargada. El catálogo público usará REST si está disponible.");
    return;
  }

  const cliente = fabricaSupabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY
  );

  window.autopartesSupabase = cliente;
  window.avDB = cliente;

  // Mantiene compatibilidad con código anterior del admin que usa window.supabase como cliente.
  window.supabase = cliente;
})();

// AUTOPARTES VENCES | Configuración pública segura de funciones inteligentes.
// No colocar aquí claves privadas. Las claves viven como Secrets en Supabase Edge Functions.
window.AV_AI_CONFIG = Object.freeze({
  enabled: true,
  localFallback: true,
  publicAssistant: true,
  crmEnabled: true,
  demandTrackingEnabled: true,
  remoteEnabled: true,
  publicRemoteEnabled: false,
  edgeFunctionName: "ai-copilot",
  requestTimeoutMs: 18000,
  maxImagesPerRequest: 4,
  staleDays: 60
});

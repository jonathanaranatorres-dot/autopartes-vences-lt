// AUTOPARTES VENCES - Puente seguro Supabase -> catalogo actual
// Mantiene script-pro-v7.js intacto. Cuando el catalogo pide datos.json,
// este archivo intenta entregar primero las piezas guardadas en Supabase.
// Si algo falla, deja que datos.json funcione como respaldo.

(() => {
  const fetchOriginal = window.fetch.bind(window);

  function esDatosJson(input) {
    const url = typeof input === "string" ? input : input?.url || "";
    return url.includes("datos.json");
  }

  function ordenarFotos(fotos) {
    return [...(fotos || [])]
      .filter((foto) => foto && foto.url)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((foto) => foto.url);
  }

  function seoSlug(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function mapearPieza(row) {
    const fotos = ordenarFotos(row.fotos);
    const id = String(row.folio || row.id || "");
    const pieza = row.pieza || "";
    const marca = row.marca || "";
    const modelo = row.modelo || "";
    const anio = row.anio || "";
    const lado = row.lado || "";
    const estado = row.estado || (row.disponible ? "USADO" : "VENDIDO");
    const precio = row.precio ?? "";

    const tituloBase = [pieza, lado, marca, modelo, anio, estado]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      id,
      marca,
      modelo,
      anio,
      pieza,
      lado,
      color: row.color || "N/C",
      estado,
      precio,
      fotoPrincipal: fotos[0] || "",
      foto2: fotos[1] || "",
      foto3: fotos[2] || "",
      foto4: fotos[3] || "",
      foto5: fotos[4] || "",
      foto6: fotos[5] || "",
      link: fotos[0] || "",
      numero_parte: row.numero_parte || "N/C",
      notas: row.descripcion || "",
      tituloSeo: `${tituloBase} | Autopartes Vences`,
      descripcionSeo: `${tituloBase} en venta en Autopartes Vences. Consulta disponibilidad y compatibilidad por WhatsApp.`,
      slug: `${seoSlug(tituloBase)}-id-${seoSlug(id)}`,
      urlProducto: `producto.html?id=${encodeURIComponent(id)}`
    };
  }

  async function cargarDesdeSupabase() {
    const db = window.autopartesSupabase || window.avDB;
    if (!db) throw new Error("Supabase no esta disponible");

    const { data, error } = await db
      .from("piezas")
      .select("*, fotos(url, orden)")
      .eq("disponible", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapearPieza);
  }

  window.fetch = async function(input, init) {
    if (!esDatosJson(input)) return fetchOriginal(input, init);

    try {
      const productos = await cargarDesdeSupabase();
      return new Response(JSON.stringify(productos), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.warn("No se pudo cargar Supabase. Usando datos.json como respaldo.", error);
      return fetchOriginal(input, init);
    }
  };
})();

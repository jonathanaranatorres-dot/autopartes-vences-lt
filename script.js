// AUTOPARTES VENCES
// 1) Cambia este número por el WhatsApp real en formato internacional.
// Ejemplo México: 52 + 55 + número = 525512345678
const WHATSAPP_NUMBER = "525500000000";

// 2) Agrega tus piezas aquí. Copia y pega un bloque por cada pieza.
// Tip: usa fotos en una carpeta llamada /img y pon algo como image: "img/faro-cruze-2014.jpg"
const parts = [
  {
    id: "cruze-faro-izquierdo-2013-2015",
    piece: "Faro izquierdo",
    brand: "Chevrolet",
    model: "Cruze",
    years: [2013, 2014, 2015],
    condition: "Original · Buen estado",
    status: "Disponible",
    price: "Cotizar",
    image: "https://images.unsplash.com/photo-1625047509168-a7026f36de04?auto=format&fit=crop&w=900&q=80",
    description: "Faro izquierdo original para Chevrolet Cruze 2013, 2014 y 2015. Se recomienda confirmar versión antes de comprar.",
    tags: ["faro", "izquierdo", "chevrolet", "cruze", "2013", "2014", "2015", "original"]
  },
  {
    id: "equinox-calavera-izquierda-2010-2015",
    piece: "Calavera izquierda",
    brand: "Chevrolet",
    model: "Equinox",
    years: [2010, 2011, 2012, 2013, 2014, 2015],
    condition: "Original · Revisada",
    status: "Disponible",
    price: "Cotizar",
    image: "https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?auto=format&fit=crop&w=900&q=80",
    description: "Calavera izquierda original para Chevrolet Equinox 2010 a 2015. Ideal para reemplazo por golpe o mica dañada.",
    tags: ["calavera", "izquierda", "chevrolet", "equinox", "2010", "2011", "2012", "2013", "2014", "2015"]
  },
  {
    id: "nissan-versa-cofre-2012-2019",
    piece: "Cofre",
    brand: "Nissan",
    model: "Versa",
    years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019],
    condition: "Usado · Buen estado",
    status: "Disponible",
    price: "Cotizar",
    image: "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=900&q=80",
    description: "Cofre usado para Nissan Versa. Confirmar color, año y versión antes de concretar.",
    tags: ["cofre", "nissan", "versa", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019"]
  },
  {
    id: "vw-jetta-defensa-delantera-2011-2018",
    piece: "Defensa delantera",
    brand: "Volkswagen",
    model: "Jetta",
    years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018],
    condition: "Usada · Detalles leves",
    status: "Disponible",
    price: "Cotizar",
    image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80",
    description: "Defensa delantera para Volkswagen Jetta. Pregunta por fotos reales y puntos de sujeción.",
    tags: ["defensa", "delantera", "volkswagen", "vw", "jetta", "2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018"]
  },
  {
    id: "ford-focus-espejo-derecho-2012-2018",
    piece: "Espejo derecho",
    brand: "Ford",
    model: "Focus",
    years: [2012, 2013, 2014, 2015, 2016, 2017, 2018],
    condition: "Original · Funcionando",
    status: "Disponible",
    price: "Cotizar",
    image: "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=900&q=80",
    description: "Espejo lateral derecho para Ford Focus. Confirmar si es eléctrico, manual, con direccional o sin direccional.",
    tags: ["espejo", "derecho", "ford", "focus", "electrico", "2012", "2013", "2014", "2015", "2016", "2017", "2018"]
  },
  {
    id: "toyota-corolla-fascia-trasera-2014-2019",
    piece: "Fascia trasera",
    brand: "Toyota",
    model: "Corolla",
    years: [2014, 2015, 2016, 2017, 2018, 2019],
    condition: "Usada · Revisada",
    status: "Disponible",
    price: "Cotizar",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80",
    description: "Fascia trasera para Toyota Corolla 2014 a 2019. Confirmar color y detalles de pintura.",
    tags: ["fascia", "defensa", "trasera", "toyota", "corolla", "2014", "2015", "2016", "2017", "2018", "2019"]
  }
];

const $ = (selector) => document.querySelector(selector);

const catalogGrid = $("#catalogGrid");
const resultCount = $("#resultCount");
const emptyState = $("#emptyState");

const searchInput = $("#searchInput");
const brandFilter = $("#brandFilter");
const modelFilter = $("#modelFilter");
const yearFilter = $("#yearFilter");
const sortFilter = $("#sortFilter");
const clearFilters = $("#clearFilters");

const menuToggle = $("#menuToggle");
const navLinks = $("#navLinks");

menuToggle?.addEventListener("click", () => {
  navLinks.classList.toggle("open");
});

navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => navLinks.classList.remove("open"));
});

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), "es"));
}

function fillSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function setupFilters() {
  fillSelect(brandFilter, uniqueSorted(parts.map((part) => part.brand)), "Todas");

  const allModels = uniqueSorted(parts.map((part) => part.model));
  fillSelect(modelFilter, allModels, "Todos");

  const allYears = uniqueSorted(parts.flatMap((part) => part.years)).sort((a, b) => b - a);
  fillSelect(yearFilter, allYears, "Todos");
}

function updateDependentFilters() {
  const selectedBrand = brandFilter.value;

  const models = selectedBrand
    ? parts.filter((part) => part.brand === selectedBrand).map((part) => part.model)
    : parts.map((part) => part.model);

  fillSelect(modelFilter, uniqueSorted(models), "Todos");
}

function getSearchText(part) {
  return normalize([
    part.piece,
    part.brand,
    part.model,
    part.condition,
    part.status,
    part.description,
    ...(part.years || []),
    ...(part.tags || [])
  ].join(" "));
}

function getFilteredParts() {
  const query = normalize(searchInput.value);
  const selectedBrand = brandFilter.value;
  const selectedModel = modelFilter.value;
  const selectedYear = yearFilter.value;

  let filtered = parts.filter((part) => {
    const matchesQuery = !query || getSearchText(part).includes(query);
    const matchesBrand = !selectedBrand || part.brand === selectedBrand;
    const matchesModel = !selectedModel || part.model === selectedModel;
    const matchesYear = !selectedYear || part.years.includes(Number(selectedYear));

    return matchesQuery && matchesBrand && matchesModel && matchesYear;
  });

  if (sortFilter.value === "brand") {
    filtered = filtered.sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, "es"));
  }

  if (sortFilter.value === "piece") {
    filtered = filtered.sort((a, b) => a.piece.localeCompare(b.piece, "es"));
  }

  if (sortFilter.value === "recent") {
    filtered = filtered.sort((a, b) => parts.indexOf(a) - parts.indexOf(b));
  }

  return filtered;
}

function createWhatsappLink(part) {
  const years = `${Math.min(...part.years)}-${Math.max(...part.years)}`;
  const message = `Hola Autopartes Vences, quiero cotizar: ${part.piece} ${part.brand} ${part.model} ${years}. ¿Sigue disponible?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function renderParts() {
  const filtered = getFilteredParts();

  catalogGrid.innerHTML = "";
  resultCount.textContent = `${filtered.length} pieza${filtered.length === 1 ? "" : "s"} encontrada${filtered.length === 1 ? "" : "s"}`;

  emptyState.hidden = filtered.length !== 0;

  filtered.forEach((part) => {
    const years = `${Math.min(...part.years)}-${Math.max(...part.years)}`;

    const article = document.createElement("article");
    article.className = "part-card";

    article.innerHTML = `
      <div class="part-image">
        <img src="${part.image}" alt="${part.piece} ${part.brand} ${part.model}" loading="lazy" />
        <span class="badge">${part.status}</span>
      </div>

      <div class="part-body">
        <h3>${part.piece} ${part.brand} ${part.model}</h3>

        <ul class="part-meta">
          <li>${part.brand}</li>
          <li>${part.model}</li>
          <li>${years}</li>
          <li>${part.condition}</li>
        </ul>

        <p class="part-description">${part.description}</p>

        <div class="part-footer">
          <div class="price-row">
            <span>Precio</span>
            <strong>${part.price}</strong>
          </div>

          <div class="part-actions">
            <a class="btn btn-primary" href="${createWhatsappLink(part)}" target="_blank" rel="noopener">
              Cotizar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    `;

    catalogGrid.appendChild(article);
  });
}

brandFilter.addEventListener("change", () => {
  updateDependentFilters();
  renderParts();
});

[searchInput, modelFilter, yearFilter, sortFilter].forEach((element) => {
  element.addEventListener("input", renderParts);
  element.addEventListener("change", renderParts);
});

clearFilters.addEventListener("click", () => {
  searchInput.value = "";
  brandFilter.value = "";
  modelFilter.value = "";
  yearFilter.value = "";
  sortFilter.value = "recent";
  setupFilters();
  renderParts();
});

setupFilters();
renderParts();

}

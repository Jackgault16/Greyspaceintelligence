let briefingData = [];

async function loadBriefings() {
  const { data, error } = await supabase
    .from("briefing_room")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("Failed to load briefings:", error);
    return;
  }

  briefingData = data;
  applyFilters();
}

let activeCategory = "all";
let activeRegion = "all";
let activeSearch = "";
let activeSort = "latest";

function normalizeRegion(region) {
  if (!region) return "global";
  const r = region.toLowerCase();
  if (r.includes("middle") || r.includes("mena")) return "mena";
  if (r.includes("africa")) return "africa";
  if (r.includes("europe")) return "europe";
  if (r.includes("asia")) return "asia";
  if (r.includes("america")) return "americas";
  if (r.includes("oceania") || r.includes("australia")) return "oceania";
  return "global";
}

function renderBriefings(data) {
  const grid = document.getElementById("brf-grid");
  grid.innerHTML = "";

  data.forEach((brief) => {
    const ts = brief.timestamp ? new Date(brief.timestamp).toUTCString() : "";

    const riskClass = brief.risk ? `brf-risk--${brief.risk.toLowerCase()}` : "";
    const priorityClass = brief.priority ? `brf-priority--${brief.priority.toLowerCase()}` : "";

    const card = document.createElement("div");
    card.className = "brf-card";

    card.innerHTML = `
      <div class="brf-card__risk ${riskClass}"></div>

      <div class="brf-card__priority ${priorityClass}">
        ${brief.priority ? brief.priority.toUpperCase() : ""}
      </div>

      <div class="brf-card__meta">
        ${brief.category?.toUpperCase() || "UNCATEGORISED"} • 
        ${brief.region?.toUpperCase() || "GLOBAL"} • 
        ${ts}
      </div>

      <h3 class="brf-card__title">${brief.title}</h3>

      <p class="brf-card__summary">${brief.summary || ""}</p>

      <ul class="brf-card__points">
        ${(brief.points || []).map((p) => `<li>${p}</li>`).join("")}
      </ul>
    `;

    card.addEventListener("click", () => openBriefingModal(brief));
    grid.appendChild(card);
  });
}

function applyFilters() {
  let filtered = [...briefingData];

  if (activeCategory !== "all") {
    filtered = filtered.filter((b) => b.category === activeCategory);
  }

  if (activeRegion !== "all") {
    filtered = filtered.filter((b) => normalizeRegion(b.region) === activeRegion);
  }

  if (activeSearch.trim() !== "") {
    const s = activeSearch.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.title.toLowerCase().includes(s) ||
        b.summary.toLowerCase().includes(s)
    );
  }

  if (activeSort === "latest") {
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  if (activeSort === "risk") {
    const order = { high: 3, med: 2, medium: 2, low: 1 };
    filtered.sort((a, b) => (order[b.risk] || 0) - (order[a.risk] || 0));
  }

  if (activeSort === "relevance") {
    filtered.sort(
      (a, b) => (b.points?.length || 0) - (a.points?.length || 0)
    );
  }

  renderBriefings(filtered);
}

function initBriefMap(brief) {
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const coords = Array.isArray(brief.coords) ? brief.coords : [0, 0];

  const map = new mapboxgl.Map({
    container: "brf-map",
    style: "mapbox://styles/mapbox/dark-v11",
    center: coords,
    zoom: brief.zoom || 5
  });

  new mapboxgl.Marker({ color: "#ff3b3b" })
    .setLngLat(coords)
    .addTo(map);

  setTimeout(() => map.resize(), 300);
}

function openBriefingModal(brief) {
  const modal = document.getElementById("brf-modal");
  const content = document.getElementById("brf-modal-content");

  const ts = brief.timestamp ? new Date(brief.timestamp).toUTCString() : "";
  const priorityClass = brief.priority ? `brf-priority--${brief.priority.toLowerCase()}` : "";

  content.innerHTML = `
    <div class="brf-article-layout">
      <div class="brf-article-left">
        <div id="brf-map" class="brf-article-map"></div>
      </div>

      <div class="brf-article-right">
        <h2>${brief.title}</h2>

        <div class="brf-article-meta">
          <span>${brief.category?.toUpperCase() || ""}</span>
          <span>${brief.region?.toUpperCase() || ""}</span>
          <span>${ts}</span>
          <span class="${priorityClass}">
            ${brief.priority?.toUpperCase() || ""}
          </span>
        </div>

        <p class="brf-article-summary">${brief.summary || ""}</p>

        <h3>Key Points</h3>
        <ul class="brf-article-points">
          ${(brief.points || []).map((p) => `<li>${p}</li>`).join("")}
        </ul>

        <h3>Analysis</h3>
        <p class="brf-article-analysis">
          ${brief.analysis || "No analysis provided."}
        </p>
      </div>
    </div>
  `;

  modal.classList.add("brf-modal--open");

  setTimeout(() => initBriefMap(brief), 250);
}

document.querySelectorAll("[data-modal-close]").forEach((el) => {
  el.addEventListener("click", () => {
    document.getElementById("brf-modal").classList.remove("brf-modal--open");
  });
});

document.querySelectorAll(".brf-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".brf-tab").forEach((t) => t.classList.remove("brf-tab--active"));
    tab.classList.add("brf-tab--active");
    activeCategory = tab.dataset.category;
    applyFilters();
  });
});

document.getElementById("brf-region-filter").addEventListener("change", (e) => {
  activeRegion = e.target.value;
  applyFilters();
});

document.getElementById("brf-search-input").addEventListener("input", (e) => {
  activeSearch = e.target.value;
  applyFilters();
});

document.getElementById("brf-sort").addEventListener("change", (e) => {
  activeSort = e.target.value;
  applyFilters();
});

document.addEventListener("DOMContentLoaded", () => {
  loadBriefings();
});

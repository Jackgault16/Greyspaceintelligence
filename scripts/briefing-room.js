// ===============================
// SAMPLE DATA
// ===============================
const fallbackBriefings = [
  {
    id: 1,
    title: "Russian Force Posture Shift",
    category: "military",
    region: "Europe",
    timestamp: "2026-02-27T13:46:33Z",
    risk: "high",
    priority: "high",
    coords: [24.7536, 59.4370],
    zoom: 5,
    summary: "Russian units near the Baltic region have repositioned closer to forward operating zones.",
    points: [
      "Increased armored presence detected",
      "Logistics convoys moving north",
      "Electronic warfare activity elevated"
    ]
  },
  {
    id: 2,
    title: "Sudan Ceasefire Collapse",
    category: "political",
    region: "Africa",
    timestamp: "2026-02-27T12:20:00Z",
    risk: "med",
    priority: "medium",
    coords: [32.5599, 15.5007],
    zoom: 5,
    summary: "Negotiations between rival factions have broken down, triggering renewed clashes.",
    points: [
      "UN observers report artillery exchanges",
      "Civilians fleeing Khartoum districts",
      "Regional mediation attempts stalled"
    ]
  },
  {
    id: 3,
    title: "Oil Market Volatility",
    category: "economic",
    region: "Middle East",
    timestamp: "2026-02-27T10:05:00Z",
    risk: "low",
    priority: "low",
    coords: [46.6753, 24.7136],
    zoom: 5,
    summary: "OPEC signals production adjustments amid fluctuating global demand.",
    points: [
      "Saudi output expected to tighten",
      "Brent futures up 1.8%",
      "Analysts expect short-term instability"
    ]
  }
];

let briefingsData = [...fallbackBriefings];

// ===============================
// STATE
// ===============================
let activeCategory = "all";
let activeRegion = "";
let activeSearch = "";
let activeSort = "latest";

const riskOrder = { high: 3, med: 2, low: 1 };

function sortBriefings(data, sortType) {
  if (sortType === "latest") {
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return;
  }

  if (sortType === "risk") {
    data.sort((a, b) => riskOrder[b.risk] - riskOrder[a.risk]);
    return;
  }

  if (sortType === "relevance") {
    data.sort((a, b) => b.points.length - a.points.length);
  }
}

function normalizeCategory(raw) {
  return (raw || "").toLowerCase().replace(/\s+/g, "");
}

function derivePoints(details) {
  if (!details) return [];

  const linePoints = details
    .split(/\r?\n/)
    .map(p => p.trim())
    .filter(Boolean);

  if (linePoints.length >= 2) return linePoints.slice(0, 4);

  const sentencePoints = details
    .split(/(?<=[.!?])\s+/)
    .map(p => p.trim())
    .filter(Boolean);

  return sentencePoints.slice(0, 4);
}

function toBriefingItem(item) {
  const normalizedCategory = normalizeCategory(item.category);
  const points = derivePoints(item.details);

  return {
    id: item.id,
    title: item.title || "Untitled",
    category: normalizedCategory || "greyspace",
    region: item.region || "Global / Multi-Region",
    timestamp: item.timestamp,
    risk: "med",
    priority: "medium",
    coords:
      item.lat != null && item.lng != null
        ? [Number(item.lng), Number(item.lat)]
        : [0, 20],
    zoom: 5,
    summary: item.summary || "",
    points: points.length ? points : ["No key points available."]
  };
}

async function loadBriefingsData() {
  try {
    const rows = await fetchBriefingIntel({ limit: 300, days: 3650 });
    if (rows.length) {
      briefingsData = rows.map(toBriefingItem);
      return;
    }
  } catch (err) {
    console.error("Failed to load briefing data:", err);
  }

  briefingsData = [...fallbackBriefings];
}

// ===============================
// RENDER CARDS
// ===============================
function renderBriefings(data) {
  const grid = document.getElementById("brf-grid");
  grid.innerHTML = "";

  data.forEach(brief => {
    const card = document.createElement("div");
    card.className = "brf-card";

    card.innerHTML = `
      <div class="brf-card__risk brf-risk--${brief.risk}"></div>
      <div class="brf-card__priority brf-priority--${brief.priority}">
        ${brief.priority.toUpperCase()}
      </div>
      <div class="brf-card__meta">
        ${brief.category.toUpperCase()} • ${brief.region.toUpperCase()} • 
        ${new Date(brief.timestamp).toUTCString()}
      </div>
      <h3 class="brf-card__title">${brief.title}</h3>
      <p class="brf-card__summary">${brief.summary}</p>
      <ul class="brf-card__points">
        ${brief.points.map(p => `<li>${p}</li>`).join("")}
      </ul>
    `;

    card.addEventListener("click", () => openBriefingModal(brief));
    grid.appendChild(card);
  });
}

// ===============================
// FILTER LOGIC
// ===============================
function applyFilters() {
  let filtered = [...briefingsData];

  // Category filter
  if (activeCategory !== "all") {
    filtered = filtered.filter(b => normalizeCategory(b.category) === activeCategory);
  }

  // Region filter
  if (activeRegion.trim() !== "") {
    const selectedRegion = activeRegion.toLowerCase();
    filtered = filtered.filter(b => (b.region || "").toLowerCase() === selectedRegion);
  }

  // Search filter
  if (activeSearch.trim() !== "") {
    const s = activeSearch.toLowerCase();
    filtered = filtered.filter(b =>
      b.title.toLowerCase().includes(s) ||
      b.summary.toLowerCase().includes(s)
    );
  }

  // Sort filter
  sortBriefings(filtered, activeSort);

  renderBriefings(filtered);
}

// ===============================
// MAP INITIALIZATION
// ===============================
function initBriefMap(brief) {
  if (!brief.coords || brief.coords.length !== 2) return;
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: "brf-map",
    style: "mapbox://styles/mapbox/dark-v11",
    center: brief.coords,
    zoom: brief.zoom || 5
  });

  new mapboxgl.Marker({ color: "#ff3b3b" })
    .setLngLat(brief.coords)
    .addTo(map);

  setTimeout(() => map.resize(), 300);
}

// ===============================
// MODAL
// ===============================
function openBriefingModal(brief) {
  const modal = document.getElementById("brf-modal");
  const content = document.getElementById("brf-modal-content");

  content.innerHTML = `
    <div class="brf-article-layout">
      <div class="brf-article-left">
        <div id="brf-map" class="brf-article-map"></div>
      </div>

      <div class="brf-article-right">
        <h2>${brief.title}</h2>

        <div class="brf-article-meta">
          <span>${brief.category.toUpperCase()}</span>
          <span>${brief.region.toUpperCase()}</span>
          <span>${new Date(brief.timestamp).toUTCString()}</span>
          <span class="brf-article-priority brf-priority--${brief.priority}">
            ${brief.priority.toUpperCase()}
          </span>
        </div>

        <p class="brf-article-summary">${brief.summary}</p>

        <h3>Key Points</h3>
        <ul class="brf-article-points">
          ${brief.points.map(p => `<li>${p}</li>`).join("")}
        </ul>

        <h3>Analysis</h3>
        <p class="brf-article-analysis">
          This section provides deeper context, risk evaluation, and potential implications.
          It can include escalation likelihood, regional impact, actor motivations, 
          and intelligence confidence levels.
        </p>
      </div>
    </div>
  `;

  modal.classList.add("brf-modal--open");

  setTimeout(() => initBriefMap(brief), 250);
}

function setupModalClose() {
  document.querySelectorAll("[data-modal-close]").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("brf-modal").classList.remove("brf-modal--open");
    });
  });
}

// ===============================
// FILTER EVENT LISTENERS
// ===============================
function setupFilters() {
  // Category tabs
  document.querySelectorAll(".brf-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".brf-tab").forEach(t => t.classList.remove("brf-tab--active"));
      tab.classList.add("brf-tab--active");

      activeCategory = tab.dataset.category;
      applyFilters();
    });
  });

  // Region dropdown
  document.getElementById("brf-region-filter").addEventListener("change", e => {
    activeRegion = e.target.value;
    applyFilters();
  });

  // Search
  document.getElementById("brf-search-input").addEventListener("input", e => {
    activeSearch = e.target.value;
    applyFilters();
  });

  // Sort
  document.getElementById("brf-sort").addEventListener("change", e => {
    activeSort = e.target.value;
    applyFilters();
  });
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  loadBriefingsData().then(() => {
    applyFilters();
  });
  setupFilters();
  setupModalClose();
});

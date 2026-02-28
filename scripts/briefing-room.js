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
let briefingModalMap = null;

const riskOrder = { high: 3, medium: 2, med: 2, low: 1 };
const priorityOrder = { high: 3, medium: 2, low: 1 };
const triadIcons = {
  impact: "🧭",
  risk: "⚠️",
  priority: "⭐"
};
function sortBriefings(data, sortType) {
  if (sortType === "latest") {
    data.sort((a, b) => {
      const priorityDiff = (priorityOrder[b.priorityLevel] || 0) - (priorityOrder[a.priorityLevel] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    return;
  }

  if (sortType === "risk") {
    data.sort((a, b) => riskOrder[b.riskLevel] - riskOrder[a.riskLevel]);
    return;
  }

  if (sortType === "relevance") {
    data.sort((a, b) => b.points.length - a.points.length);
  }
}

function normalizeCategory(raw) {
  return (raw || "").toLowerCase().replace(/\s+/g, "");
}

function normalizeImpactLevel(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "strategic") return "strategic";
  if (v === "operational") return "operational";
  if (v === "tactical") return "tactical";
  return "noise";
}

function normalizeStatus(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "breaking") return "Breaking";
  if (v === "developing") return "Developing";
  return "Ongoing";
}

function normalizeConfidence(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "high") return "High";
  if (v === "low") return "Low";
  return "Medium";
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

function normalizeRiskLevel(rawRisk) {
  const value = String(rawRisk || "").toLowerCase();
  if (value === "high" || value === "medium" || value === "low") return value;
  if (value === "med") return "medium";
  return "low";
}

function normalizePriorityLevel(rawPriority) {
  const value = String(rawPriority || "").toLowerCase();
  if (value === "high" || value === "medium" || value === "low") return value;
  if (value === "med") return "medium";
  return "medium";
}

function parsePointsField(item, detailsText) {
  if (Array.isArray(item.points)) return item.points;
  if (Array.isArray(item.key_points)) return item.key_points;
  if (typeof item.points === "string") {
    return item.points.split(/\r?\n|;/).map(p => p.trim()).filter(Boolean);
  }
  return derivePoints(detailsText);
}

function parseIndicators(item, detailsText) {
  const raw = item.indicators || item.indicators_to_watch || item.watch_indicators;
  if (Array.isArray(raw)) {
    return raw.map(v => String(v).trim()).filter(Boolean).slice(0, 4);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsedJson = JSON.parse(trimmed);
        if (Array.isArray(parsedJson)) {
          return parsedJson.map(v => String(v).trim()).filter(Boolean).slice(0, 4);
        }
      } catch (_) {
        // Continue into string split fallback.
      }
    }

    // Postgres text[] style: {"a","b"}
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map(v => v.trim().replace(/^"(.*)"$/, "$1"))
        .filter(Boolean)
        .slice(0, 4);
    }

    const parsed = raw
      .split(/\r?\n|;/)
      .map(v => v.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (parsed.length) return parsed;
  }
  return derivePoints(detailsText).slice(0, 4);
}

function parseSources(item) {
  const raw = item.sources || item.source || item.source_links;
  if (Array.isArray(raw)) {
    return raw
      .map(s => {
        if (typeof s === "string") return { name: s, url: s };
        return { name: s?.name || s?.title || s?.url || "Source", url: s?.url || "#" };
      })
      .filter(s => s.name)
      .slice(0, 6);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => ({ name: s, url: s }))
      .slice(0, 6);
  }
  return [];
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString();
}

function formatUpdated(ts) {
  return new Date(ts).toLocaleString();
}

function parseTimestampMs(ts) {
  if (!ts) return null;
  const value = new Date(ts).getTime();
  return Number.isFinite(value) ? value : null;
}

function shouldShowUpdated(publishedAt, updatedAt) {
  const updatedMs = parseTimestampMs(updatedAt);
  if (!updatedMs) return false;

  const publishedMs = parseTimestampMs(publishedAt);
  if (!publishedMs) return true;

  return Math.abs(updatedMs - publishedMs) > 5 * 60 * 1000;
}

function impactClassName(impact) {
  return `badge-impact-${impact}`;
}

function impactDisplayLabel(impact) {
  return String(impact || "noise").toUpperCase();
}

function riskDisplayLabel(risk) {
  return String(risk || "low").toUpperCase();
}

function priorityDisplayLabel(priority) {
  return String(priority || "medium").toUpperCase();
}

function renderIndicatorsList(indicators) {
  if (Array.isArray(indicators)) {
    const cleaned = indicators.map(v => String(v).trim()).filter(Boolean);
    if (!cleaned.length) return "<li>No indicators listed.</li>";
    return cleaned.slice(0, 4).map(p => `<li>${p}</li>`).join("");
  }
  if (typeof indicators === "string" && indicators.trim()) {
    return `<li>${indicators.trim()}</li>`;
  }
  return "<li>No indicators listed.</li>";
}

function toBriefingItem(item) {
  const normalizedCategory = normalizeCategory(item.category || item.type);
  const detailsText = item.details || item.analysis || "";
  const points = parsePointsField(item, detailsText);
  const coords = Array.isArray(item.coords) && item.coords.length === 2
    ? [Number(item.coords[0]), Number(item.coords[1])]
    : null;
  const lng = item.lng != null ? Number(item.lng) : (item.long != null ? Number(item.long) : (coords ? coords[0] : null));
  const lat = item.lat != null ? Number(item.lat) : (coords ? coords[1] : null);

  return {
    id: item.id,
    title: item.title || "Untitled",
    category: normalizedCategory || "greyspace",
    region: item.region || item.theater || "Global / Multi-Region",
    timestamp: item.timestamp || item.published_at || item.created_at || new Date().toISOString(),
    publishedAt: item.published_at || item.timestamp || item.created_at || null,
    updatedAt: item.updated_at || item.updatedAt || null,
    riskLevel: normalizeRiskLevel(item.risk_level || item.risk),
    priorityLevel: normalizePriorityLevel(item.priority_level || item.priority),
    status: normalizeStatus(item.status),
    impactLevel: normalizeImpactLevel(item.impact_level || item.impact || item.impact_level_primary),
    confidence: normalizeConfidence(item.confidence),
    coords:
      lat != null && lng != null
        ? [lng, lat]
        : [0, 20],
    zoom: Number(item.map_zoom || item.zoom || 5),
    summary: item.summary || item.executive_summary || "",
    whyItMatters: item.why_it_matters || item.whyItMatters || item.why || item.summary || item.executive_summary || "",
    analysis: item.assessment || item.analysis || detailsText,
    points: points.length ? points : ["No key points available."],
    indicators: parseIndicators(item, detailsText),
    sources: parseSources(item)
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
    card.className = "briefing-card";

    const indicatorsLis = renderIndicatorsList(brief.indicators);

    const sourcesLis = (brief.sources || [])
      .map(s => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.name}</a></li>`)
      .join("");
    const updatedPill = shouldShowUpdated(brief.publishedAt, brief.updatedAt)
      ? `<span class="pill">Updated: ${formatUpdated(brief.updatedAt)}</span>`
      : "";

    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="headline">${brief.title}</div>
          <div class="meta-row">
            <span class="pill">${brief.region}</span>
            <span class="pill">${brief.status}</span>
            <span class="pill">${formatTimestamp(brief.publishedAt || brief.timestamp)}</span>
          </div>
          <div class="intel-row">
            <span class="badge badge--muted badge-risk-${brief.riskLevel}">${triadIcons.risk} RISK: ${riskDisplayLabel(brief.riskLevel)}</span>
            <span class="badge badge--muted badge-priority-${brief.priorityLevel}">${triadIcons.priority} PRIORITY: ${priorityDisplayLabel(brief.priorityLevel)}</span>
          </div>
        </div>
        <div class="badge impact-badge ${impactClassName(brief.impactLevel)}">
          ${triadIcons.impact} ${impactDisplayLabel(brief.impactLevel)}
        </div>
      </div>

      <div class="section">
        <div class="section-title">SITUATION SUMMARY</div>
        <div class="section-body">${brief.summary}</div>
      </div>

      <div class="section">
        <div class="section-title">WHY IT MATTERS</div>
        <div class="section-body">${brief.whyItMatters || brief.summary}</div>
      </div>

      <div class="section">
        <div class="section-title">ASSESSMENT</div>
        <div class="section-body">${brief.analysis || "No assessment available."}</div>
      </div>

      <div class="section">
        <div class="section-title">CONFIDENCE</div>
        <div class="section-body">${brief.confidence} <span class="confidence-hint">(source reliability + corroboration)</span></div>
      </div>

      <div class="section">
        <div class="section-title">INDICATORS TO WATCH</div>
        <div class="section-body">
          <ul>${indicatorsLis}</ul>
        </div>
      </div>

      <div class="section">
        <div class="section-title">SOURCES</div>
        <div class="section-body">
          <ul>${sourcesLis || "<li>No sources listed.</li>"}</ul>
        </div>
      </div>

      <div class="card-footer">
        <span class="pill">${brief.category.toUpperCase()}</span>
        ${updatedPill}
      </div>
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

  if (briefingModalMap) {
    briefingModalMap.remove();
    briefingModalMap = null;
  }

  briefingModalMap = new mapboxgl.Map({
    container: "brf-map",
    style: "mapbox://styles/mapbox/dark-v11",
    center: brief.coords,
    zoom: brief.zoom || 5
  });

  new mapboxgl.Marker({ color: "#ff3b3b" })
    .setLngLat(brief.coords)
    .addTo(briefingModalMap);

  setTimeout(() => briefingModalMap?.resize(), 50);
  setTimeout(() => briefingModalMap?.resize(), 300);
}

// ===============================
// MODAL
// ===============================
function openBriefingModal(brief) {
  const modal = document.getElementById("brf-modal");
  const content = document.getElementById("brf-modal-content");

  const indicatorsLis = renderIndicatorsList(brief.indicators);
  const sourcesLis = (brief.sources || [])
    .map(s => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.name}</a></li>`)
    .join("");
  const updatedPill = shouldShowUpdated(brief.publishedAt, brief.updatedAt)
    ? `<span class="pill">Updated: ${formatUpdated(brief.updatedAt)}</span>`
    : "";

  content.innerHTML = `
    <div class="brf-article-layout briefing-modal-body">
      <div class="brf-article-left briefing-map-panel">
        <div id="brf-map" class="brf-article-map briefing-map"></div>
      </div>

      <div class="brf-article-right briefing-content-panel">
        <div class="card-header card-header--modal">
          <div>
            <div class="headline">${brief.title}</div>
            <div class="meta-row">
              <span class="pill">${brief.region}</span>
              <span class="pill">${brief.status}</span>
              <span class="pill">${formatTimestamp(brief.publishedAt || brief.timestamp)}</span>
            </div>
            <div class="intel-triad">
              <span class="badge ${impactClassName(brief.impactLevel)}">${triadIcons.impact} IMPACT: ${impactDisplayLabel(brief.impactLevel)}</span>
              <span class="badge badge-risk-${brief.riskLevel}">${triadIcons.risk} RISK: ${riskDisplayLabel(brief.riskLevel)}</span>
              <span class="badge badge-priority-${brief.priorityLevel}">${triadIcons.priority} PRIORITY: ${priorityDisplayLabel(brief.priorityLevel)}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">SITUATION SUMMARY</div>
          <div class="section-body">${brief.summary}</div>
        </div>

        <div class="section">
          <div class="section-title">WHY IT MATTERS</div>
          <div class="section-body">${brief.whyItMatters || brief.summary}</div>
        </div>

        <div class="section">
          <div class="section-title">ASSESSMENT</div>
          <div class="section-body">${brief.analysis || "No assessment available."}</div>
        </div>

        <div class="section">
          <div class="section-title">CONFIDENCE</div>
          <div class="section-body">${brief.confidence} <span class="confidence-hint">(source reliability + corroboration)</span></div>
        </div>

        <div class="section">
          <div class="section-title">INDICATORS TO WATCH</div>
          <div class="section-body">
            <ul>${indicatorsLis}</ul>
          </div>
        </div>

        <div class="section">
          <div class="section-title">SOURCES</div>
          <div class="section-body">
            <ul>${sourcesLis || "<li>No sources listed.</li>"}</ul>
          </div>
        </div>

        <div class="card-footer">
          <span class="pill">${brief.category.toUpperCase()}</span>
          ${updatedPill}
        </div>
      </div>
    </div>
  `;

  modal.classList.add("brf-modal--open");

  setTimeout(() => initBriefMap(brief), 250);
  setTimeout(() => briefingModalMap?.resize(), 450);
}

function setupModalClose() {
  document.querySelectorAll("[data-modal-close]").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("brf-modal").classList.remove("brf-modal--open");
      if (briefingModalMap) {
        briefingModalMap.remove();
        briefingModalMap = null;
      }
    });
  });
}

window.addEventListener("resize", () => {
  const modal = document.getElementById("brf-modal");
  if (modal?.classList.contains("brf-modal--open")) {
    setTimeout(() => briefingModalMap?.resize(), 50);
  }
});

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


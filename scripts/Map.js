const mapEl = document.getElementById("countryMap");
const panelEl = document.getElementById("dossierPanel");
const panelCloseBtn = document.getElementById("dossierClose");
const tabsWrap = document.getElementById("dossierTabs");
const metricsGrid = document.getElementById("metricsGrid");
const narrativeEl = document.getElementById("profileNarrative");
const sourcesEl = document.getElementById("profileSources");
const overlayLegendEl = document.getElementById("overlayLegend");
const poiTypeLegendEl = document.getElementById("poiTypeLegend");
const relatedLiveEl = document.getElementById("relatedLive");
const relatedBriefsEl = document.getElementById("relatedBriefs");
const countryNameEl = document.getElementById("dossierCountryName");
const countryMetaEl = document.getElementById("dossierCountryMeta");
const countryFlagEl = document.getElementById("dossierFlag");

let map = null;
let panelOpen = false;
let selectedIso2 = null;
let selectedCountryName = null;
let activeCategory = "political";
let selectedCountryRow = null;
let selectedIso3 = null;
let hoveredIso3 = null;
let adminBorderLayerIds = [];

const cache = {
  countriesByIso2: new Map(),
  countriesByIso3: new Map(),
  profiles: new Map(),
  pois: new Map(),
  live: new Map(),
  briefs: new Map()
};

const CATEGORY_KEYS = ["political", "military", "economic", "social", "greyspace"];
const LOCAL_ISO3_TO_ISO2 = {
  USA: "US", GBR: "GB", FRA: "FR", DEU: "DE", ESP: "ES", ITA: "IT", RUS: "RU", CHN: "CN", IND: "IN", JPN: "JP"
};

normalizeMapHamburgerMenu();
if (mapEl && typeof mapboxgl !== "undefined" && MAPBOX_TOKEN) initCountryMap();

function normalizeMapHamburgerMenu() {
  const sideMenu = document.getElementById("sideMenu");
  const list = sideMenu ? sideMenu.querySelector("ul") : null;
  if (!list) return;
  list.innerHTML = `
    <li onclick="window.location.href='index.html'">Home</li>
    <li onclick="window.location.href='About.html'">About</li>
    <li onclick="window.location.href='Admin.html'">Admin</li>
  `;
}

function setPanelOpen(next) {
  panelOpen = Boolean(next);
  panelEl.classList.toggle("open", panelOpen);
}

function setCountrySelection({ iso2 = null, iso3 = null, name = null, row = null }) {
  selectedIso2 = iso2 || null;
  selectedIso3 = iso3 || row?.iso3 || null;
  selectedCountryName = name || row?.name || iso2 || "Selected Country";
  selectedCountryRow = row || null;
}

function initCountryMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  map = new mapboxgl.Map({
    container: "countryMap",
    style: "mapbox://styles/mapbox/dark-v11",
    center: [0, 20],
    zoom: 1.35,
    projection: "mercator",
    attributionControl: false
  });

  map.on("load", async () => {
    addCountryLayers();
    addPoiLayers();
    wireCountryInteractions();
    discoverAdminBorderLayers();
    updateAdminBordersVisibility();

    const iso2FromUrl = new URLSearchParams(window.location.search).get("iso2");
    if (iso2FromUrl) {
      await openCountryByIso2(iso2FromUrl.toUpperCase());
    }
  });

  map.on("zoom", updateAdminBordersVisibility);

  panelCloseBtn?.addEventListener("click", () => setPanelOpen(false));

  tabsWrap?.addEventListener("click", e => {
    const btn = e.target.closest("button[data-category]");
    if (!btn) return;
    activeCategory = btn.getAttribute("data-category");
    tabsWrap.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
    hydratePanel();
  });
}

function addCountryLayers() {
  map.addSource("country-boundaries", { type: "vector", url: "mapbox://mapbox.country-boundaries-v1" });
  map.addLayer({
    id: "gs-country-fill",
    type: "fill",
    source: "country-boundaries",
    "source-layer": "country_boundaries",
    paint: { "fill-color": "#5a6f93", "fill-opacity": 0.02 }
  });
  map.addLayer({
    id: "gs-country-hover",
    type: "fill",
    source: "country-boundaries",
    "source-layer": "country_boundaries",
    filter: ["==", ["get", "iso_3166_1_alpha_3"], ""],
    paint: { "fill-color": "#839ecd", "fill-opacity": 0.14 }
  });
  map.addLayer({
    id: "gs-country-selected-fill",
    type: "fill",
    source: "country-boundaries",
    "source-layer": "country_boundaries",
    filter: ["==", ["get", "iso_3166_1_alpha_3"], ""],
    paint: { "fill-color": "#6a8ed3", "fill-opacity": 0.19 }
  });
  map.addLayer({
    id: "gs-country-selected-line",
    type: "line",
    source: "country-boundaries",
    "source-layer": "country_boundaries",
    filter: ["==", ["get", "iso_3166_1_alpha_3"], ""],
    paint: { "line-color": "#c9ddff", "line-width": 1.7 }
  });
}

function addPoiLayers() {
  map.addSource("country-pois", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterRadius: 45
  });
  map.addLayer({
    id: "country-poi-clusters",
    type: "circle",
    source: "country-pois",
    filter: ["has", "point_count"],
    paint: { "circle-color": "#678ed0", "circle-radius": ["step", ["get", "point_count"], 15, 12, 18, 30, 24], "circle-opacity": 0.85 }
  });
  map.addLayer({
    id: "country-poi-count",
    type: "symbol",
    source: "country-pois",
    filter: ["has", "point_count"],
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
    paint: { "text-color": "#ffffff" }
  });
  map.addLayer({
    id: "country-poi-unclustered",
    type: "circle",
    source: "country-pois",
    filter: ["!", ["has", "point_count"]],
    paint: { "circle-color": "#f97316", "circle-radius": 5, "circle-stroke-width": 1, "circle-stroke-color": "#fff" }
  });

  map.on("click", "country-poi-clusters", e => {
    const cluster = map.queryRenderedFeatures(e.point, { layers: ["country-poi-clusters"] })[0];
    if (!cluster) return;
    map.getSource("country-pois").getClusterExpansionZoom(cluster.properties.cluster_id, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: cluster.geometry.coordinates, zoom });
    });
  });

  map.on("click", "country-poi-unclustered", e => {
    const f = e.features?.[0];
    if (!f) return;
    const p = f.properties || {};
    const src = parseCsvOrArray(p.sources).slice(0, 4).join(", ");
    new mapboxgl.Popup({ offset: 12 })
      .setLngLat(f.geometry.coordinates)
      .setHTML(`
        <div style="font-size:12px;max-width:240px;">
          <strong>${escapeHtml(p.name || "POI")}</strong><br/>
          <span>${escapeHtml(p.poi_type || "unknown")} • ${escapeHtml(p.confidence || "medium")}</span><br/>
          ${p.notes ? `<div style="margin-top:6px;opacity:.86;">${escapeHtml(String(p.notes).slice(0, 220))}</div>` : ""}
          ${src ? `<div style="margin-top:6px;opacity:.72;">${escapeHtml(src)}</div>` : ""}
        </div>
      `)
      .addTo(map);
  });
}

function wireCountryInteractions() {
  map.on("mousemove", "gs-country-fill", e => {
    const feature = e.features?.[0];
    hoveredIso3 = feature?.properties?.iso_3166_1_alpha_3 || feature?.properties?.ISO_A3 || null;
    map.setFilter("gs-country-hover", ["==", ["get", "iso_3166_1_alpha_3"], hoveredIso3 || ""]);
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "gs-country-fill", () => {
    hoveredIso3 = null;
    map.setFilter("gs-country-hover", ["==", ["get", "iso_3166_1_alpha_3"], ""]);
    map.getCanvas().style.cursor = "";
  });

  map.on("click", "gs-country-fill", async e => {
    const feature = e.features?.[0];
    if (!feature) return;
    const resolved = await resolveCountryFromFeature(feature);

    setPanelOpen(true);
    setCountrySelection(resolved);
    applySelectedCountryFilter();
    updateAdminBordersVisibility();
    updateHeader();
    fitToCountry(resolved.row, feature);
    hydratePanel();
  });
}

function discoverAdminBorderLayers() {
  const layers = map.getStyle()?.layers || [];
  adminBorderLayerIds = layers.filter(l => l.type === "line" && /admin-1|admin1|state|province/.test(l.id)).map(l => l.id);
}

function updateAdminBordersVisibility() {
  if (!map) return;
  const show = Boolean(selectedIso3) && map.getZoom() >= 3.5;
  adminBorderLayerIds.forEach(id => {
    if (!map.getLayer(id)) return;
    map.setLayoutProperty(id, "visibility", show ? "visible" : "none");
    if (show && selectedIso3) {
      try {
        map.setFilter(id, ["==", ["get", "iso_3166_1_alpha_3"], selectedIso3]);
      } catch (_) {}
    }
  });
}

function applySelectedCountryFilter() {
  map.setFilter("gs-country-selected-fill", ["==", ["get", "iso_3166_1_alpha_3"], selectedIso3 || ""]);
  map.setFilter("gs-country-selected-line", ["==", ["get", "iso_3166_1_alpha_3"], selectedIso3 || ""]);
}

function fitToCountry(countryRow, feature) {
  const bbox = parseBbox(countryRow?.bbox);
  if (bbox) {
    map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 500 });
    return;
  }
  const fbounds = geometryBounds(feature?.geometry);
  if (fbounds) {
    map.fitBounds([[fbounds[0], fbounds[1]], [fbounds[2], fbounds[3]]], { padding: 60, duration: 500 });
  }
}

async function hydratePanel() {
  if (!panelOpen) return;
  if (!selectedIso2) {
    renderNoIsoState();
    return;
  }
  const [profile, pois, liveItems, briefItems] = await Promise.all([
    getCountryProfile(selectedIso2, activeCategory),
    getCountryPois(selectedIso2, activeCategory),
    getRelatedLive(selectedIso2, selectedCountryRow?.bbox),
    getRelatedBriefs(selectedIso2, selectedCountryRow?.bbox)
  ]);
  renderProfile(profile);
  renderPois(pois);
  renderRelated(relatedLiveEl, liveItems, "Live.html?id=");
  renderRelated(relatedBriefsEl, briefItems, "briefing-room.html?brief=");
}

function renderNoIsoState() {
  metricsGrid.innerHTML = `<div class="muted">No ISO code available for this click. Data unavailable.</div>`;
  narrativeEl.textContent = "No data yet for this category.";
  sourcesEl.innerHTML = `<span class="muted">No sources listed.</span>`;
  overlayLegendEl.textContent = `${prettyCategory(activeCategory)} - 0 POIs`;
  poiTypeLegendEl.innerHTML = `<span class="muted">No POI types available.</span>`;
  relatedLiveEl.innerHTML = `<div class="muted">No related items.</div>`;
  relatedBriefsEl.innerHTML = `<div class="muted">No related items.</div>`;
  const source = map.getSource("country-pois");
  if (source) source.setData({ type: "FeatureCollection", features: [] });
}

function renderProfile(profile) {
  const metrics = profile?.metrics && typeof profile.metrics === "object" ? profile.metrics : {};
  const entries = Object.entries(metrics);
  metricsGrid.innerHTML = entries.length
    ? entries.map(([k, v]) => `<div class="metric-cell"><div class="metric-k">${escapeHtml(k)}</div><div class="metric-v">${escapeHtml(String(v ?? "").trim() || "—")}</div></div>`).join("")
    : `<div class="muted">No data yet for this category.</div>`;
  narrativeEl.textContent = profile?.narrative || "No narrative available.";
  const sources = parseCsvOrArray(profile?.sources);
  sourcesEl.innerHTML = sources.length
    ? sources.map(s => `<span class="chip">${escapeHtml(s)}</span>`).join("")
    : `<span class="muted">No sources listed.</span>`;
}

function renderPois(rows) {
  const features = (rows || []).map(r => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [Number(r.longitude), Number(r.latitude)] },
    properties: {
      id: r.id, name: r.name || "POI", poi_type: r.poi_type || "", confidence: r.confidence || "medium",
      notes: r.notes || "", sources: Array.isArray(r.sources) ? r.sources.join(", ") : (r.sources || "")
    }
  })).filter(f => Number.isFinite(f.geometry.coordinates[0]) && Number.isFinite(f.geometry.coordinates[1]));
  const source = map.getSource("country-pois");
  if (source) source.setData({ type: "FeatureCollection", features });
  overlayLegendEl.textContent = `${prettyCategory(activeCategory)} - ${features.length} POIs`;
  const types = [...new Set((rows || []).map(r => r.poi_type).filter(Boolean))];
  poiTypeLegendEl.innerHTML = types.length
    ? types.map(t => `<span class="chip">${escapeHtml(t)}</span>`).join("")
    : `<span class="muted">No POI types available.</span>`;
}

function renderRelated(container, rows, baseHref) {
  container.innerHTML = "";
  if (!rows?.length) {
    container.innerHTML = `<div class="muted">No related items.</div>`;
    return;
  }
  rows.slice(0, 8).forEach(row => {
    const risk = row.risk_level || row.risk || "";
    const priority = row.priority_level || row.priority || "";
    const ts = row.timestamp || row.updated_at || row.created_at;
    const div = document.createElement("div");
    div.className = "compact-item";
    div.innerHTML = `
      <div class="compact-item-title">${escapeHtml(row.title || "Untitled")}</div>
      <div class="compact-item-meta">${ts ? new Date(ts).toLocaleString() : "--"}${risk ? ` • risk:${escapeHtml(risk)}` : ""}${priority ? ` • pri:${escapeHtml(priority)}` : ""}</div>
    `;
    div.addEventListener("click", () => { window.location.href = `${baseHref}${encodeURIComponent(row.id)}`; });
    container.appendChild(div);
  });
}

function updateHeader() {
  countryNameEl.textContent = selectedCountryName || selectedIso2 || "Country";
  countryMetaEl.textContent = selectedIso2
    ? [selectedCountryRow?.region, selectedCountryRow?.capital, selectedIso2].filter(Boolean).join(" • ")
    : "No ISO code available";
  if (selectedIso2) {
    countryFlagEl.src = `https://flagcdn.com/w40/${selectedIso2.toLowerCase()}.png`;
    countryFlagEl.style.visibility = "visible";
  } else {
    countryFlagEl.style.visibility = "hidden";
  }
}

async function openCountryByIso2(iso2) {
  const row = await getCountryByIso(iso2);
  if (!row) return;
  setPanelOpen(true);
  setCountrySelection({ iso2: row.iso2, iso3: row.iso3, name: row.name, row });
  applySelectedCountryFilter();
  updateHeader();
  fitToCountry(row, null);
  hydratePanel();
}

async function resolveCountryFromFeature(feature) {
  const props = feature?.properties || {};
  const name = props.name_en || props.name || props.ADMIN || props.admin || "Selected Country";
  const iso2Candidate =
    normalizeIso2(props.iso2 || props.ISO_A2 || props.iso_3166_1 || props["iso_3166_1_alpha_2"] || "");
  const iso3Candidate =
    normalizeIso3(props.iso3 || props.ISO_A3 || props.iso_3166_1_alpha_3 || "");

  if (iso2Candidate) {
    const row = await getCountryByIso(iso2Candidate);
    return { iso2: iso2Candidate, iso3: row?.iso3 || iso3Candidate, name: row?.name || name, row };
  }
  if (iso3Candidate) {
    const row = await getCountryByIso(iso3Candidate);
    const localIso2 = row?.iso2 || LOCAL_ISO3_TO_ISO2[iso3Candidate] || null;
    return { iso2: localIso2, iso3: iso3Candidate, name: row?.name || name, row };
  }
  return { iso2: null, iso3: null, name, row: null };
}

function normalizeIso2(value) {
  const v = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : "";
}

function normalizeIso3(value) {
  const v = String(value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(v) ? v : "";
}

async function getCountryByIso(isoAny) {
  if (!supabase) return null;
  const key = String(isoAny || "").toUpperCase();
  if (key.length === 2 && cache.countriesByIso2.has(key)) return cache.countriesByIso2.get(key);
  if (key.length === 3 && cache.countriesByIso3.has(key)) return cache.countriesByIso3.get(key);

  const { data } = await supabase.from("countries").select("*").or(`iso2.eq.${key},iso3.eq.${key}`).limit(1).maybeSingle();
  if (!data) return null;
  if (data.iso2) cache.countriesByIso2.set(String(data.iso2).toUpperCase(), data);
  if (data.iso3) cache.countriesByIso3.set(String(data.iso3).toUpperCase(), data);
  return data;
}

async function getCountryProfile(iso2, category) {
  if (!supabase) return null;
  const cacheKey = `${iso2}|${category}`;
  if (cache.profiles.has(cacheKey)) return cache.profiles.get(cacheKey);
  const { data } = await supabase.from("country_profiles").select("*").eq("iso2", iso2).eq("category", category).maybeSingle();
  cache.profiles.set(cacheKey, data || null);
  return data || null;
}

async function getCountryPois(iso2, category) {
  if (!supabase) return [];
  const cacheKey = `${iso2}|${category}`;
  if (cache.pois.has(cacheKey)) return cache.pois.get(cacheKey);
  const { data } = await supabase.from("country_pois").select("*").eq("iso2", iso2).eq("category", category).order("created_at", { ascending: false });
  cache.pois.set(cacheKey, data || []);
  return data || [];
}

async function getRelatedLive(iso2, bboxRaw) {
  if (!supabase) return [];
  const cacheKey = `${iso2}|live`;
  if (cache.live.has(cacheKey)) return cache.live.get(cacheKey);
  const byIso = await supabase.from(LIVE_INTEL_TABLE).select("*").eq("iso2", iso2).order("timestamp", { ascending: false }).limit(16);
  let rows = byIso.error ? [] : (byIso.data || []);
  if (!rows.length) {
    const bbox = parseBbox(bboxRaw);
    if (bbox) {
      const { data } = await supabase.from(LIVE_INTEL_TABLE).select("*")
        .gte("lng", bbox[0]).lte("lng", bbox[2]).gte("lat", bbox[1]).lte("lat", bbox[3])
        .order("timestamp", { ascending: false }).limit(16);
      rows = data || [];
    }
  }
  cache.live.set(cacheKey, rows);
  return rows;
}

async function getRelatedBriefs(iso2, bboxRaw) {
  if (!supabase) return [];
  const cacheKey = `${iso2}|briefs`;
  if (cache.briefs.has(cacheKey)) return cache.briefs.get(cacheKey);
  const byIso = await supabase.from(BRIEF_DOCUMENTS_TABLE).select("*").eq("iso2", iso2).order("updated_at", { ascending: false }).limit(16);
  let rows = byIso.error ? [] : (byIso.data || []);
  if (!rows.length) {
    const bbox = parseBbox(bboxRaw);
    if (bbox) {
      const { data } = await supabase.from(BRIEF_DOCUMENTS_TABLE).select("*")
        .gte("longitude", bbox[0]).lte("longitude", bbox[2]).gte("latitude", bbox[1]).lte("latitude", bbox[3])
        .order("updated_at", { ascending: false }).limit(16);
      rows = data || [];
    }
  }
  cache.briefs.set(cacheKey, rows);
  return rows;
}

function parseBbox(raw) {
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length >= 4) return raw.map(Number);
  const text = String(raw).trim();
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length >= 4) return parsed.map(Number);
      if (parsed && Array.isArray(parsed.bbox) && parsed.bbox.length >= 4) return parsed.bbox.map(Number);
    } catch (_) {}
  }
  const nums = text.split(/[, ]+/).map(Number).filter(Number.isFinite);
  return nums.length >= 4 ? nums.slice(0, 4) : null;
}

function geometryBounds(geom) {
  if (!geom) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = coords => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      minX = Math.min(minX, coords[0]); minY = Math.min(minY, coords[1]);
      maxX = Math.max(maxX, coords[0]); maxY = Math.max(maxY, coords[1]);
      return;
    }
    coords.forEach(walk);
  };
  walk(geom.coordinates);
  if (!Number.isFinite(minX)) return null;
  return [minX, minY, maxX, maxY];
}

function prettyCategory(v) {
  if (v === "greyspace") return "Grey Space";
  return String(v || "").charAt(0).toUpperCase() + String(v || "").slice(1);
}

function parseCsvOrArray(raw) {
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
  return String(raw || "").split(",").map(v => v.trim()).filter(Boolean);
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

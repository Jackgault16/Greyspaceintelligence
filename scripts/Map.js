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
let selectedCountry = null;
let hoveredIso3 = null;
let activeCategory = "political";
let adminBorderLayerIds = [];
const cache = {
    countriesByIso2: new Map(),
    profiles: new Map(),
    pois: new Map(),
    live: new Map(),
    briefs: new Map()
};

const CATEGORY_KEYS = ["political", "military", "economic", "social", "greyspace"];

if (mapEl && typeof mapboxgl !== "undefined" && MAPBOX_TOKEN) {
    initCountryMap();
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

    map.on("load", () => {
        addCountryLayers();
        addPoiLayers();
        wireCountryInteractions();
        discoverAdminBorderLayers();
        updateAdminBordersVisibility();
    });

    map.on("zoom", updateAdminBordersVisibility);

    panelCloseBtn?.addEventListener("click", () => {
        panelEl.classList.remove("open");
    });

    tabsWrap?.addEventListener("click", e => {
        const btn = e.target.closest("button[data-category]");
        if (!btn || !selectedCountry) return;
        activeCategory = btn.getAttribute("data-category");
        tabsWrap.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
        hydrateCountryContent(selectedCountry.iso2);
    });
}

function addCountryLayers() {
    map.addSource("country-boundaries", {
        type: "vector",
        url: "mapbox://mapbox.country-boundaries-v1"
    });

    map.addLayer({
        id: "gs-country-fill",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        paint: {
            "fill-color": "#5a6f93",
            "fill-opacity": 0.02
        }
    });

    map.addLayer({
        id: "gs-country-hover",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        filter: ["==", ["get", "iso_3166_1_alpha_3"], ""],
        paint: {
            "fill-color": "#839ecd",
            "fill-opacity": 0.14
        }
    });

    map.addLayer({
        id: "gs-country-selected-fill",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        filter: ["==", ["get", "iso_3166_1_alpha_3"], ""],
        paint: {
            "fill-color": "#6a8ed3",
            "fill-opacity": 0.19
        }
    });

    map.addLayer({
        id: "gs-country-selected-line",
        type: "line",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        filter: ["==", ["get", "iso_3166_1_alpha_3"], ""],
        paint: {
            "line-color": "#c9ddff",
            "line-width": 1.7
        }
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
        paint: {
            "circle-color": "#678ed0",
            "circle-radius": ["step", ["get", "point_count"], 15, 12, 18, 30, 24],
            "circle-opacity": 0.85
        }
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
        paint: {
            "circle-color": "#f97316",
            "circle-radius": 5,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff"
        }
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
        const sources = parseCsvOrArray(p.sources).slice(0, 4).join(", ");
        new mapboxgl.Popup({ offset: 12 })
            .setLngLat(f.geometry.coordinates)
            .setHTML(`
                <div style="font-size:12px;max-width:240px;">
                    <strong>${escapeHtml(p.name || "POI")}</strong><br/>
                    <span>${escapeHtml(p.poi_type || "unknown")} • ${escapeHtml(p.confidence || "medium")}</span><br/>
                    ${p.notes ? `<div style="margin-top:6px;opacity:.86;">${escapeHtml(String(p.notes).slice(0, 220))}</div>` : ""}
                    ${sources ? `<div style="margin-top:6px;opacity:.72;">${escapeHtml(sources)}</div>` : ""}
                </div>
            `)
            .addTo(map);
    });
}

function wireCountryInteractions() {
    map.on("mousemove", "gs-country-fill", e => {
        const feature = e.features?.[0];
        hoveredIso3 = feature?.properties?.iso_3166_1_alpha_3 || null;
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
        const iso3 = feature.properties?.iso_3166_1_alpha_3;
        if (!iso3) return;

        const country = await getCountryByIso(iso3);
        if (!country) return;

        selectedCountry = country;
        map.setFilter("gs-country-selected-fill", ["==", ["get", "iso_3166_1_alpha_3"], country.iso3 || iso3]);
        map.setFilter("gs-country-selected-line", ["==", ["get", "iso_3166_1_alpha_3"], country.iso3 || iso3]);
        updateAdminBordersVisibility();
        panelEl.classList.add("open");
        updateCountryHeader(country);
        fitToCountry(country, feature);
        hydrateCountryContent(country.iso2);
    });
}

function discoverAdminBorderLayers() {
    const layers = map.getStyle()?.layers || [];
    adminBorderLayerIds = layers
        .filter(l => l.type === "line" && /admin-1|admin1|state|province/.test(l.id))
        .map(l => l.id);
}

function updateAdminBordersVisibility() {
    if (!map) return;
    const show = Boolean(selectedCountry) && map.getZoom() >= 3.5;
    adminBorderLayerIds.forEach(id => {
        if (!map.getLayer(id)) return;
        map.setLayoutProperty(id, "visibility", show ? "visible" : "none");
        if (show && selectedCountry?.iso3) {
            try {
                map.setFilter(id, ["==", ["get", "iso_3166_1_alpha_3"], selectedCountry.iso3]);
            } catch (_) {
                // ignore if layer/property mismatch
            }
        }
    });
}

function fitToCountry(country, feature) {
    const bbox = parseBbox(country.bbox);
    if (bbox) {
        map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: 500 });
        return;
    }
    const fbounds = geometryBounds(feature?.geometry);
    if (fbounds) {
        map.fitBounds([[fbounds[0], fbounds[1]], [fbounds[2], fbounds[3]]], { padding: 60, duration: 500 });
    }
}

function updateCountryHeader(country) {
    countryNameEl.textContent = country.name || country.iso2;
    countryMetaEl.textContent = [country.region, country.capital].filter(Boolean).join(" • ");
    countryFlagEl.src = country.iso2 ? `https://flagcdn.com/w40/${country.iso2.toLowerCase()}.png` : "";
    countryFlagEl.style.visibility = country.iso2 ? "visible" : "hidden";
}

async function hydrateCountryContent(iso2) {
    if (!iso2) return;
    const [profile, pois, liveItems, briefItems] = await Promise.all([
        getCountryProfile(iso2, activeCategory),
        getCountryPois(iso2, activeCategory),
        getRelatedLive(iso2, selectedCountry?.bbox),
        getRelatedBriefs(iso2, selectedCountry?.bbox)
    ]);

    renderProfile(profile);
    renderPois(pois);
    renderRelated(relatedLiveEl, liveItems, "Live.html?id=");
    renderRelated(relatedBriefsEl, briefItems, "briefing-room.html?brief=");
}

function renderProfile(profile) {
    const metrics = profile?.metrics && typeof profile.metrics === "object" ? profile.metrics : {};
    const entries = Object.entries(metrics);
    metricsGrid.innerHTML = entries.length
        ? entries.map(([k, v]) => `<div class="metric-cell"><div class="metric-k">${escapeHtml(k)}</div><div class="metric-v">${escapeHtml(String(v))}</div></div>`).join("")
        : `<div class="muted">No data yet.</div>`;
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
            id: r.id,
            name: r.name || "POI",
            poi_type: r.poi_type || "",
            confidence: r.confidence || "medium",
            notes: r.notes || "",
            sources: Array.isArray(r.sources) ? r.sources.join(", ") : (r.sources || "")
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
        const div = document.createElement("div");
        div.className = "compact-item";
        const risk = row.risk_level || row.risk || "";
        const priority = row.priority_level || row.priority || "";
        const ts = row.timestamp || row.updated_at || row.created_at;
        div.innerHTML = `
            <div class="compact-item-title">${escapeHtml(row.title || "Untitled")}</div>
            <div class="compact-item-meta">${ts ? new Date(ts).toLocaleString() : "--"}${risk ? ` • risk:${escapeHtml(risk)}` : ""}${priority ? ` • pri:${escapeHtml(priority)}` : ""}</div>
        `;
        div.addEventListener("click", () => {
            window.location.href = `${baseHref}${encodeURIComponent(row.id)}`;
        });
        container.appendChild(div);
    });
}

async function getCountryByIso(isoAny) {
    if (!supabase) return null;
    const key = String(isoAny || "").toUpperCase();
    for (const row of cache.countriesByIso2.values()) {
        if ((row.iso2 || "").toUpperCase() === key || (row.iso3 || "").toUpperCase() === key) return row;
    }

    const q = supabase
        .from("countries")
        .select("*")
        .or(`iso2.eq.${key},iso3.eq.${key}`)
        .limit(1)
        .maybeSingle();
    const { data } = await q;
    if (!data) return null;
    cache.countriesByIso2.set(String(data.iso2 || "").toUpperCase(), data);
    return data;
}

async function getCountryProfile(iso2, category) {
    if (!supabase) return null;
    const cacheKey = `${iso2}|${category}`;
    if (cache.profiles.has(cacheKey)) return cache.profiles.get(cacheKey);
    const { data } = await supabase
        .from("country_profiles")
        .select("*")
        .eq("iso2", iso2)
        .eq("category", category)
        .maybeSingle();
    cache.profiles.set(cacheKey, data || null);
    return data || null;
}

async function getCountryPois(iso2, category) {
    if (!supabase) return [];
    const cacheKey = `${iso2}|${category}`;
    if (cache.pois.has(cacheKey)) return cache.pois.get(cacheKey);
    const { data } = await supabase
        .from("country_pois")
        .select("*")
        .eq("iso2", iso2)
        .eq("category", category)
        .order("created_at", { ascending: false });
    cache.pois.set(cacheKey, data || []);
    return data || [];
}

async function getRelatedLive(iso2, bboxRaw) {
    if (!supabase) return [];
    const cacheKey = `${iso2}|live`;
    if (cache.live.has(cacheKey)) return cache.live.get(cacheKey);

    let rows = [];
    const byIso = await supabase.from(LIVE_INTEL_TABLE).select("*").eq("iso2", iso2).order("timestamp", { ascending: false }).limit(16);
    if (!byIso.error) {
        rows = byIso.data || [];
    } else {
        const bbox = parseBbox(bboxRaw);
        if (bbox) {
            const { data } = await supabase
                .from(LIVE_INTEL_TABLE)
                .select("*")
                .gte("lng", bbox[0]).lte("lng", bbox[2])
                .gte("lat", bbox[1]).lte("lat", bbox[3])
                .order("timestamp", { ascending: false })
                .limit(16);
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

    let rows = [];
    const byIso = await supabase.from(BRIEF_DOCUMENTS_TABLE).select("*").eq("iso2", iso2).order("updated_at", { ascending: false }).limit(16);
    if (!byIso.error) {
        rows = byIso.data || [];
    } else {
        const bbox = parseBbox(bboxRaw);
        if (bbox) {
            const { data } = await supabase
                .from(BRIEF_DOCUMENTS_TABLE)
                .select("*")
                .gte("longitude", bbox[0]).lte("longitude", bbox[2])
                .gte("latitude", bbox[1]).lte("latitude", bbox[3])
                .order("updated_at", { ascending: false })
                .limit(16);
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
            minX = Math.min(minX, coords[0]);
            minY = Math.min(minY, coords[1]);
            maxX = Math.max(maxX, coords[0]);
            maxY = Math.max(maxY, coords[1]);
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

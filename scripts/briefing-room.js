const REGION_OPTIONS = window.BRIEF_REGION_OPTIONS || [];
const IMPACT_ORDER = { noise: 1, tactical: 2, operational: 3, strategic: 4 };
const RISK_ORDER = { low: 1, medium: 2, high: 3 };
const PRIORITY_ORDER = { low: 1, medium: 2, high: 3 };
const TIME_WINDOW_HOURS = { "24h": 24, "72h": 72, "7d": 24 * 7, "30d": 24 * 30 };

const filterState = {
  search: "",
  region: "",
  topic: "all",
  timeWindow: "24h",
  sort: "latest",
  docType: "scheduled"
};

let briefDocumentsData = [];
let eventBriefsData = [];
let briefingModalMap = null;
let previousBodyOverflow = "";
let activeDocPinFeatures = [];

const briefDocGrid = document.getElementById("briefDocGrid");
const eventBriefGrid = document.getElementById("eventBriefGrid");
const modal = document.getElementById("brf-modal");
const modalContent = document.getElementById("brf-modal-content");

function normalizeCategory(raw) {
  return String(raw || "").toLowerCase().replace(/\s+/g, "_");
}

function normalizeRegionToKey(raw) {
  return window.normalizeRegionKey ? window.normalizeRegionKey(raw) : String(raw || "").toLowerCase().replace(/\s+/g, "_");
}

function regionLabelByKey(key) {
  if (window.regionDisplayNameFromKey) return window.regionDisplayNameFromKey(key);
  const found = REGION_OPTIONS.find(r => r.key === String(key || "").toLowerCase());
  return found ? found.label : String(key || "");
}

function normalizeStatus(raw) {
  const v = String(raw || "").toLowerCase();
  return v === "ongoing" || v === "developing" || v === "resolved" ? v : "ongoing";
}

function normalizeConfidence(raw) {
  const v = String(raw || "").toLowerCase();
  return v === "low" || v === "medium" || v === "high" ? v : "medium";
}

function normalizeImpact(raw) {
  const v = String(raw || "").toLowerCase();
  return v === "strategic" || v === "operational" || v === "tactical" || v === "noise" ? v : "noise";
}

function normalizeRisk(raw) {
  const v = String(raw || "").toLowerCase();
  return v === "low" || v === "medium" || v === "high" ? v : "medium";
}

function normalizePriority(raw) {
  const v = String(raw || "").toLowerCase();
  return v === "low" || v === "medium" || v === "high" ? v : "medium";
}

function parseListField(raw, limit = 12) {
  if (Array.isArray(raw)) {
    return raw.map(v => String(v).trim()).filter(Boolean).slice(0, limit);
  }
  if (typeof raw === "string") {
    return raw.split(/\r?\n|,|;/).map(v => v.trim()).filter(Boolean).slice(0, limit);
  }
  return [];
}

function parseSources(raw) {
  return parseListField(raw, 24);
}

function sourceDomain(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  try {
    const url = value.startsWith("http://") || value.startsWith("https://") ? new URL(value) : null;
    return url ? url.hostname.replace(/^www\./, "") : value;
  } catch (_) {
    return value.replace(/^www\./, "");
  }
}

function formatTimestamp(ts) {
  if (!ts) return "--";
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "--";
}

function elapsedLabel(ts) {
  if (!ts) return "--";
  const date = new Date(ts);
  const ms = Date.now() - date.getTime();
  if (!Number.isFinite(ms) || ms < 0) return formatTimestamp(ts);
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function truncateChars(text, max = 90) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}...`;
}

function badge(label, className = "") {
  return `<span class="badge ${className}">${label}</span>`;
}

function topSourceLabel(sources) {
  const first = parseSources(sources)[0];
  return first ? sourceDomain(first) : "source n/a";
}

function parsePublishedAt(item) {
  return item.updated_at || item.published_at || item.timestamp || item.created_at || null;
}

function toBriefDocument(item) {
  const regionKey = normalizeRegionToKey(item.region || item.brief_subtype);
  return {
    id: item.id,
    title: item.title || "Untitled",
    briefType: String(item.brief_type || "").toLowerCase(),
    briefSubtype: String(item.brief_subtype || "").toLowerCase(),
    status: normalizeStatus(item.status),
    confidence: normalizeConfidence(item.confidence),
    impact: normalizeImpact(item.impact_level),
    risk: normalizeRisk(item.risk_level),
    priority: normalizePriority(item.priority_level),
    regionKey,
    regionLabel: regionLabelByKey(regionKey),
    category: normalizeCategory(item.category),
    tags: parseListField(item.tags, 12),
    summary: item.summary || "",
    whyItMatters: item.why_it_matters || "",
    details: item.details || item.body || "",
    keyPoints: parseListField(item.key_points || item.points, 20),
    indicators: parseListField(item.indicators, 20),
    sources: parseSources(item.sources),
    updatedAt: parsePublishedAt(item),
    raw: item
  };
}

function toEventBrief(item) {
  const coords = Array.isArray(item.coords) && item.coords.length === 2 ? [Number(item.coords[0]), Number(item.coords[1])] : null;
  const lng = item.lng != null ? Number(item.lng) : (item.long != null ? Number(item.long) : (coords ? coords[0] : null));
  const lat = item.lat != null ? Number(item.lat) : (coords ? coords[1] : null);
  const sources = parseSources(item.sources || item.source || item.source_links);
  return {
    id: item.id,
    title: item.title || "Untitled",
    canonicalUrl: item.canonical_url || "",
    timestamp: item.published_at || item.timestamp || item.created_at,
    regionKey: normalizeRegionToKey(item.region),
    regionLabel: item.region || regionLabelByKey(normalizeRegionToKey(item.region)),
    category: normalizeCategory(item.category || item.type),
    summary: item.summary || "",
    whyItMatters: item.why_it_matters || item.whyItMatters || item.why || item.summary || "",
    assessment: item.assessment || item.analysis || item.details || "",
    details: item.details || item.analysis || "",
    impact: normalizeImpact(item.impact_level || item.impact),
    risk: normalizeRisk(item.risk_level || item.risk),
    priority: normalizePriority(item.priority_level || item.priority),
    status: normalizeStatus(item.status),
    confidence: normalizeConfidence(item.confidence),
    points: parseListField(item.key_points || item.points, 12),
    indicators: parseListField(item.indicators || item.indicators_to_watch || item.watch_indicators, 12),
    sources,
    topSource: topSourceLabel(sources),
    lat,
    lng,
    tags: parseListField(item.tags, 12),
    raw: item
  };
}

function eventCanonicalKey(event) {
  if (event.canonicalUrl) return `url:${String(event.canonicalUrl).trim().toLowerCase()}`;
  const dayBucket = event.timestamp ? new Date(event.timestamp).toISOString().slice(0, 10) : "unknown-day";
  const title = String(event.title || "").trim().toLowerCase().replace(/\s+/g, " ");
  const domain = sourceDomain(event.topSource || event.sources[0] || "unknown");
  return `sig:${title}|${domain}|${dayBucket}`;
}

function dedupeEventBriefs(rows) {
  const map = new Map();
  rows.forEach(item => {
    const event = toEventBrief(item);
    const key = eventCanonicalKey(event);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, event);
      return;
    }

    const mergedSources = [...existing.sources, ...event.sources]
      .map(v => String(v).trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);

    map.set(key, {
      ...existing,
      timestamp: new Date(event.timestamp || 0).getTime() > new Date(existing.timestamp || 0).getTime() ? event.timestamp : existing.timestamp,
      summary: existing.summary.length >= event.summary.length ? existing.summary : event.summary,
      whyItMatters: existing.whyItMatters.length >= event.whyItMatters.length ? existing.whyItMatters : event.whyItMatters,
      assessment: existing.assessment.length >= event.assessment.length ? existing.assessment : event.assessment,
      points: [...existing.points, ...event.points].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 12),
      indicators: [...existing.indicators, ...event.indicators].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 12),
      sources: mergedSources,
      topSource: topSourceLabel(mergedSources),
      priority: PRIORITY_ORDER[event.priority] > PRIORITY_ORDER[existing.priority] ? event.priority : existing.priority,
      impact: IMPACT_ORDER[event.impact] > IMPACT_ORDER[existing.impact] ? event.impact : existing.impact,
      risk: RISK_ORDER[event.risk] > RISK_ORDER[existing.risk] ? event.risk : existing.risk
    });
  });
  return [...map.values()];
}

async function fetchBriefDocumentPins(briefId) {
  if (!supabase || !briefId) return [];
  const { data, error } = await supabase
    .from("brief_document_pins")
    .select("*")
    .eq("brief_id", briefId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch brief pins:", error);
    return [];
  }

  return data || [];
}

async function loadData() {
  try {
    const [docRows, eventRows] = await Promise.all([
      fetchBriefDocuments({ limit: 500, days: 3650 }),
      fetchBriefingIntel({ limit: 800, days: 3650 })
    ]);

    briefDocumentsData = docRows
      .map(toBriefDocument)
      .filter(item => {
        const publishTo = parseListField(item.raw.publish_to, 8).map(v => v.toLowerCase());
        return publishTo.includes("briefing_room");
      });

    eventBriefsData = dedupeEventBriefs(eventRows);
  } catch (err) {
    console.error("Failed to load briefing room data:", err);
    briefDocumentsData = [];
    eventBriefsData = [];
  }
}

function withinTimeWindow(timestamp, windowKey) {
  const hours = TIME_WINDOW_HOURS[windowKey] || 24;
  const value = new Date(timestamp || 0).getTime();
  if (!Number.isFinite(value)) return false;
  return Date.now() - value <= hours * 3600 * 1000;
}

function matchesTopic(category, topic) {
  if (topic === "all") return true;
  if (topic === "grey_space") return category === "grey_space" || category === "greyspace";
  return category === topic;
}

function matchesSearchDocument(doc, search) {
  if (!search) return true;
  const haystack = [doc.title, doc.summary, doc.whyItMatters, doc.details, doc.regionLabel, doc.category, ...doc.tags, ...doc.keyPoints, ...doc.indicators].join(" ").toLowerCase();
  return haystack.includes(search);
}

function matchesSearchEvent(event, search) {
  if (!search) return true;
  const haystack = [event.title, event.summary, event.whyItMatters, event.assessment, event.regionLabel, event.category, event.topSource, ...event.tags, ...event.points, ...event.indicators].join(" ").toLowerCase();
  return haystack.includes(search);
}

function sortItems(items, sort, type) {
  if (sort === "impact") {
    items.sort((a, b) => IMPACT_ORDER[b.impact] - IMPACT_ORDER[a.impact]);
    return;
  }
  if (sort === "priority") {
    items.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
    return;
  }
  items.sort((a, b) => {
    const aTs = new Date((type === "doc" ? a.updatedAt : a.timestamp) || 0).getTime();
    const bTs = new Date((type === "doc" ? b.updatedAt : b.timestamp) || 0).getTime();
    return bTs - aTs;
  });
}

function filterDocs() {
  const search = filterState.search.toLowerCase();
  const filtered = briefDocumentsData.filter(doc => {
    if (doc.briefType !== filterState.docType) return false;
    if (filterState.region && normalizeRegionToKey(doc.regionKey) !== normalizeRegionToKey(filterState.region)) return false;
    if (!matchesTopic(doc.category, filterState.topic)) return false;
    if (!withinTimeWindow(doc.updatedAt, filterState.timeWindow)) return false;
    if (!matchesSearchDocument(doc, search)) return false;
    return true;
  });
  sortItems(filtered, filterState.sort, "doc");
  return filtered;
}

function filterEvents() {
  const search = filterState.search.toLowerCase();
  const filtered = eventBriefsData.filter(item => {
    if (filterState.region && normalizeRegionToKey(item.regionKey) !== normalizeRegionToKey(filterState.region)) return false;
    if (!matchesTopic(item.category, filterState.topic)) return false;
    if (!withinTimeWindow(item.timestamp, filterState.timeWindow)) return false;
    if (!matchesSearchEvent(item, search)) return false;
    return true;
  });
  sortItems(filtered, filterState.sort, "event");
  return filtered;
}

function renderDocumentGrid() {
  const docs = filterDocs();
  briefDocGrid.innerHTML = "";
  if (!docs.length) {
    briefDocGrid.innerHTML = `<div class="empty-state">No brief documents match current filters.</div>`;
    return;
  }

  docs.forEach(doc => {
    const card = document.createElement("article");
    card.className = "brief-doc-card";
    const bullets = doc.keyPoints.slice(0, 3).map(p => `<li class="line-clamp-1">${truncateChars(p, 90)}</li>`).join("");
    const tags = doc.tags.slice(0, 3).map(t => `<span class="tag-chip">${t}</span>`).join("");
    card.innerHTML = `
      <h3 class="card-title line-clamp-2">${doc.title}</h3>
      <div class="card-meta">
        <span>${elapsedLabel(doc.updatedAt)}</span>
        ${badge(`risk ${doc.risk}`, `badge-risk-${doc.risk}`)}
        ${badge(`confidence ${doc.confidence}`)}
      </div>
      <ul class="card-list">${bullets || "<li class='line-clamp-1'>No key points.</li>"}</ul>
      <div class="tag-row">${tags}</div>
    `;
    card.addEventListener("click", () => openDocumentModal(doc));
    briefDocGrid.appendChild(card);
  });
}

function renderEventFeed() {
  const events = filterEvents();
  eventBriefGrid.innerHTML = "";
  if (!events.length) {
    eventBriefGrid.innerHTML = `<div class="empty-state">No event briefs match current filters.</div>`;
    return;
  }

  events.forEach(item => {
    const card = document.createElement("article");
    card.className = "event-brief-card";
    const tags = [...item.tags, item.regionLabel, item.category].filter(Boolean).slice(0, 3).map(t => `<span class="tag-chip">${t}</span>`).join("");
    card.innerHTML = `
      <h3 class="card-title line-clamp-2">${item.title}</h3>
      <div class="card-meta line-clamp-1">${formatTimestamp(item.timestamp)} • ${item.regionLabel || "--"} • ${item.category || "--"} • ${item.topSource}</div>
      <p class="why-line line-clamp-1">${item.whyItMatters || item.summary || "No why-it-matters provided."}</p>
      <div class="tag-row">${tags}</div>
      <div class="badge-row">
        ${badge(`impact ${item.impact}`, `badge-impact-${item.impact}`)}
        ${badge(`risk ${item.risk}`, `badge-risk-${item.risk}`)}
        ${badge(`priority ${item.priority}`, `badge-priority-${item.priority}`)}
      </div>
    `;
    card.addEventListener("click", () => openEventModal(item));
    eventBriefGrid.appendChild(card);
  });
}

function dedupeDisplaySources(sources) {
  const unique = [];
  parseSources(sources).forEach(source => {
    const label = sourceDomain(source);
    if (!label) return;
    if (unique.some(v => v.toLowerCase() === label.toLowerCase())) return;
    unique.push(label);
  });
  return unique;
}

function coverageLabelForDoc(doc) {
  if (doc.briefType === "scheduled") {
    if (doc.briefSubtype === "morning" || doc.briefSubtype === "evening") return "last 12h";
    if (doc.briefSubtype === "daily") return "last 24h";
    if (doc.briefSubtype === "weekly") return "last 7d";
    if (doc.briefSubtype === "monthly") return "last 30d";
  }
  if (doc.briefType === "regional") return "last 72h";
  return "mixed window";
}

function titleBlockForDoc(doc) {
  const subtypeLabel = doc.briefSubtype.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  if (doc.briefType === "scheduled") {
    return { headline: `${subtypeLabel} Brief`, typeChip: "SCHEDULED", secondary: doc.title };
  }
  if (doc.briefType === "regional") {
    return { headline: `${regionLabelByKey(doc.briefSubtype)} Briefing`, typeChip: "REGIONAL", secondary: doc.title };
  }
  return { headline: doc.title, typeChip: "SPECIAL", secondary: "" };
}

function pinFeatureFromRow(pin) {
  const lng = Number(pin.longitude);
  const lat = Number(pin.latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id: pin.id,
      label: pin.label || "Hotspot",
      region: pin.region || "",
      category: pin.category || "",
      risk_level: normalizeRisk(pin.risk_level || "medium"),
      event_id: pin.event_id || "",
      created_at: pin.created_at || ""
    }
  };
}

function popupHtmlForPin(properties) {
  const risk = normalizeRisk(properties.risk_level || "medium");
  const eventBtn = properties.event_id ? `<button class="pin-open-event" data-event-id="${properties.event_id}">Open event</button>` : "";
  return `
    <div class="pin-popup">
      <div class="pin-popup__title">${properties.label || "Hotspot"}</div>
      <div class="pin-popup__meta">${properties.region || "--"} • ${properties.category || "--"}</div>
      <div class="pin-popup__badges"><span class="badge badge-risk-${risk}">risk ${risk}</span></div>
      ${eventBtn}
    </div>
  `;
}

function applyInitialDocMapView(map, doc, features, didInitView) {
  if (didInitView.value) return;
  didInitView.value = true;

  if (doc.briefType === "regional") {
    const key = normalizeRegionToKey(doc.briefSubtype);
    const frame = (window.REGION_FRAMES && window.REGION_FRAMES[key]) || window.REGION_FRAMES.global;
    if (frame?.bounds) {
      map.fitBounds(frame.bounds, { padding: 40, duration: 0 });
    } else if (frame) {
      map.setCenter(frame.center);
      map.setZoom(frame.zoom);
    }
    return;
  }

  if (features.length) {
    const bounds = new mapboxgl.LngLatBounds();
    features.forEach(f => bounds.extend(f.geometry.coordinates));
    map.fitBounds(bounds, { padding: 50, duration: 0 });
    return;
  }

  const globalFrame = window.REGION_FRAMES?.global || { center: [0, 20], zoom: 1.2 };
  map.setCenter(globalFrame.center);
  map.setZoom(globalFrame.zoom);
}

function renderHotspotsList(features) {
  const container = document.getElementById("doc-hotspots");
  if (!container) return;

  const sorted = [...features]
    .sort((a, b) => {
      const riskDiff = RISK_ORDER[normalizeRisk(b.properties.risk_level)] - RISK_ORDER[normalizeRisk(a.properties.risk_level)];
      if (riskDiff !== 0) return riskDiff;
      return new Date(b.properties.created_at || 0).getTime() - new Date(a.properties.created_at || 0).getTime();
    })
    .slice(0, 5);

  if (!sorted.length) {
    container.innerHTML = `<div class="empty-state">No hotspots pinned for this brief.</div>`;
    return;
  }

  container.innerHTML = sorted.map((f, idx) => `
    <button class="hotspot-item" data-pin-id="${f.properties.id}">
      <span class="hotspot-item__idx">${idx + 1}</span>
      <span class="hotspot-item__body">
        <span class="hotspot-item__label">${f.properties.label || "Hotspot"}</span>
        <span class="hotspot-item__meta">${f.properties.region || "--"} • ${f.properties.category || "--"}</span>
      </span>
      <span class="badge badge-risk-${normalizeRisk(f.properties.risk_level)}">${normalizeRisk(f.properties.risk_level)}</span>
    </button>
  `).join("");
}

function bindModalDynamicActions(map) {
  modalContent.querySelectorAll(".pin-open-event").forEach(btn => {
    btn.addEventListener("click", e => {
      const eventId = e.currentTarget.getAttribute("data-event-id");
      if (!eventId) return;
      window.location.href = `Live.html?event=${eventId}`;
    });
  });

  modalContent.querySelectorAll(".hotspot-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pin-id");
      const feature = activeDocPinFeatures.find(f => String(f.properties.id) === String(id));
      if (!feature || !map) return;
      const [lng, lat] = feature.geometry.coordinates;
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 4.8), duration: 400 });
      new mapboxgl.Popup({ offset: 12 })
        .setLngLat([lng, lat])
        .setHTML(popupHtmlForPin(feature.properties))
        .addTo(map);
    });
  });
}

function mountDocMap(doc, pins) {
  const mapEl = document.getElementById("doc-brief-map");
  if (!mapEl || typeof mapboxgl === "undefined" || !MAPBOX_TOKEN) return;

  mapboxgl.accessToken = MAPBOX_TOKEN;
  if (briefingModalMap) {
    briefingModalMap.remove();
    briefingModalMap = null;
  }

  const didInitView = { value: false };
  const features = pins.map(pinFeatureFromRow).filter(Boolean);
  activeDocPinFeatures = features;

  briefingModalMap = new mapboxgl.Map({
    container: "doc-brief-map",
    style: "mapbox://styles/mapbox/dark-v11",
    center: [0, 20],
    zoom: 1.2
  });

  briefingModalMap.on("load", () => {
    briefingModalMap.addSource("doc-pins", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
      cluster: true,
      clusterMaxZoom: 8,
      clusterRadius: 45
    });

    briefingModalMap.addLayer({
      id: "doc-pin-clusters",
      type: "circle",
      source: "doc-pins",
      filter: ["has", "point_count"],
      paint: { "circle-color": "#3b82f6", "circle-radius": ["step", ["get", "point_count"], 16, 10, 19, 30, 24], "circle-opacity": 0.84 }
    });

    briefingModalMap.addLayer({
      id: "doc-pin-cluster-count",
      type: "symbol",
      source: "doc-pins",
      filter: ["has", "point_count"],
      layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
      paint: { "text-color": "#ffffff" }
    });

    briefingModalMap.addLayer({
      id: "doc-pin-unclustered",
      type: "circle",
      source: "doc-pins",
      filter: ["!", ["has", "point_count"]],
      paint: { "circle-color": "#f97316", "circle-radius": 7, "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" }
    });

    briefingModalMap.on("click", "doc-pin-clusters", e => {
      const cluster = briefingModalMap.queryRenderedFeatures(e.point, { layers: ["doc-pin-clusters"] })[0];
      if (!cluster) return;
      const clusterId = cluster.properties.cluster_id;
      briefingModalMap.getSource("doc-pins").getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        briefingModalMap.easeTo({ center: cluster.geometry.coordinates, zoom });
      });
    });

    briefingModalMap.on("click", "doc-pin-unclustered", e => {
      const feature = e.features && e.features[0];
      if (!feature) return;
      new mapboxgl.Popup({ offset: 12 })
        .setLngLat(feature.geometry.coordinates)
        .setHTML(popupHtmlForPin(feature.properties))
        .addTo(briefingModalMap);
      bindModalDynamicActions(briefingModalMap);
    });

    briefingModalMap.on("mouseenter", "doc-pin-clusters", () => {
      briefingModalMap.getCanvas().style.cursor = "pointer";
    });
    briefingModalMap.on("mouseleave", "doc-pin-clusters", () => {
      briefingModalMap.getCanvas().style.cursor = "";
    });
    briefingModalMap.on("mouseenter", "doc-pin-unclustered", () => {
      briefingModalMap.getCanvas().style.cursor = "pointer";
    });
    briefingModalMap.on("mouseleave", "doc-pin-unclustered", () => {
      briefingModalMap.getCanvas().style.cursor = "";
    });

    applyInitialDocMapView(briefingModalMap, doc, features, didInitView);
  });
}

async function openDocumentModal(doc) {
  const titleBlock = titleBlockForDoc(doc);

  modalContent.innerHTML = `
    <div class="detail-header">
      <div class="detail-type-chip">${titleBlock.typeChip}</div>
      <h2 class="detail-headline">${titleBlock.headline}</h2>
      ${titleBlock.secondary ? `<div class="detail-secondary line-clamp-2">${titleBlock.secondary}</div>` : ""}
      <div class="detail-subheader" id="doc-subheader">${formatTimestamp(doc.updatedAt)} • Coverage: ${coverageLabelForDoc(doc)} • Pins: ...</div>
      <div class="detail-badges">
        ${badge(`risk ${doc.risk}`, `badge-risk-${doc.risk}`)}
        ${badge(`impact ${doc.impact}`, `badge-impact-${doc.impact}`)}
        ${badge(`priority ${doc.priority}`, `badge-priority-${doc.priority}`)}
        ${badge(`confidence ${doc.confidence}`)}
        ${badge(`status ${doc.status}`)}
      </div>
    </div>

    <section class="detail-section detail-map-grid">
      <div class="detail-map-panel">
        <div id="doc-brief-map" class="detail-map"></div>
      </div>
      <div class="detail-hotspots-panel">
        <h4>Hotspots</h4>
        <div id="doc-hotspots"></div>
      </div>
    </section>

    <section class="detail-section">
      <h4>Executive Summary</h4>
      <p class="line-clamp-5">${doc.summary || "No summary provided."}</p>
    </section>
    <section class="detail-section">
      <h4>Top Signals</h4>
      <ul>${doc.keyPoints.map(p => `<li>${p}</li>`).join("") || "<li>No key points listed.</li>"}</ul>
    </section>
    <section class="detail-section">
      <h4>Indicators to Watch</h4>
      <ul>${doc.indicators.map(p => `<li>${p}</li>`).join("") || "<li>No indicators listed.</li>"}</ul>
    </section>
    <section class="detail-section">
      <h4>Full Body</h4>
      <p>${(doc.details || "No detailed body provided.").replace(/\n/g, "<br>")}</p>
    </section>
    <section class="detail-section">
      <h4>Sources</h4>
      <div class="tag-row">${dedupeDisplaySources(doc.sources).map(s => `<span class="tag-chip">${s}</span>`).join("") || "<span>No sources listed.</span>"}</div>
    </section>
    <section class="detail-section">
      <h4>Metadata</h4>
      <p>Region: ${doc.regionLabel || "--"} | Category: ${doc.category || "--"} | Type: ${titleBlock.typeChip}${doc.briefSubtype ? ` (${doc.briefSubtype})` : ""}</p>
    </section>
  `;

  openModal();

  const pins = await fetchBriefDocumentPins(doc.id);
  document.getElementById("doc-subheader").textContent =
    `${formatTimestamp(doc.updatedAt)} • Coverage: ${coverageLabelForDoc(doc)} • Pins: ${pins.length}`;

  const features = pins.map(pinFeatureFromRow).filter(Boolean);
  renderHotspotsList(features);
  mountDocMap(doc, pins);
  bindModalDynamicActions(briefingModalMap);
}

function openEventModal(event) {
  const sourceItems = dedupeDisplaySources(event.sources).map(s => `<li>${s}</li>`).join("");
  const hasMap = Number.isFinite(event.lat) && Number.isFinite(event.lng);
  const mapBlock = hasMap ? `<section class="detail-section"><h4>Map</h4><div id="event-detail-map" class="detail-map"></div></section>` : "";

  modalContent.innerHTML = `
    <div class="detail-header">
      <h3>${event.title}</h3>
      <div class="detail-meta">
        <span>${formatTimestamp(event.timestamp)}</span>
        <span>${event.regionLabel || "--"}</span>
        <span>${event.category || "--"}</span>
        <span>${event.topSource}</span>
      </div>
      <div class="detail-badges">
        ${badge(`impact ${event.impact}`, `badge-impact-${event.impact}`)}
        ${badge(`risk ${event.risk}`, `badge-risk-${event.risk}`)}
        ${badge(`priority ${event.priority}`, `badge-priority-${event.priority}`)}
        ${badge(`confidence ${event.confidence}`)}
        ${badge(`status ${event.status}`)}
      </div>
    </div>
    <section class="detail-section"><h4>Why It Matters</h4><p>${(event.whyItMatters || "No why-it-matters provided.").replace(/\n/g, "<br>")}</p></section>
    <section class="detail-section"><h4>Assessment</h4><p>${(event.assessment || "No assessment provided.").replace(/\n/g, "<br>")}</p></section>
    <section class="detail-section"><h4>Key Points</h4><ul>${event.points.map(p => `<li>${p}</li>`).join("") || "<li>No key points listed.</li>"}</ul></section>
    <section class="detail-section"><h4>Indicators to Watch</h4><ul>${event.indicators.map(p => `<li>${p}</li>`).join("") || "<li>No indicators listed.</li>"}</ul></section>
    <section class="detail-section"><h4>Sources</h4><ul>${sourceItems || "<li>No sources listed.</li>"}</ul></section>
    ${mapBlock}
  `;

  openModal();

  if (hasMap && typeof mapboxgl !== "undefined" && MAPBOX_TOKEN) {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    if (briefingModalMap) briefingModalMap.remove();
    setTimeout(() => {
      briefingModalMap = new mapboxgl.Map({
        container: "event-detail-map",
        style: "mapbox://styles/mapbox/dark-v11",
        center: [event.lng, event.lat],
        zoom: Number(event.raw?.map_zoom || event.raw?.zoom || 5)
      });
      new mapboxgl.Marker({ color: "#ff3b3b" }).setLngLat([event.lng, event.lat]).addTo(briefingModalMap);
      setTimeout(() => briefingModalMap?.resize(), 80);
    }, 120);
  }
}

function closeModal() {
  modal.classList.remove("brf-modal--open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = previousBodyOverflow;
  if (briefingModalMap) {
    briefingModalMap.remove();
    briefingModalMap = null;
  }
}

function openModal() {
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  modal.classList.add("brf-modal--open");
  modal.setAttribute("aria-hidden", "false");
}

function renderAll() {
  renderDocumentGrid();
  renderEventFeed();
}

function setActiveChip(container, valueAttr, value) {
  container.querySelectorAll("button").forEach(btn => {
    btn.classList.toggle("brf-chip--active", btn.dataset[valueAttr] === value);
  });
}

function setupFilters() {
  document.getElementById("brf-search-input").addEventListener("input", e => {
    filterState.search = e.target.value.trim();
    renderAll();
  });
  document.getElementById("brf-region-filter").addEventListener("change", e => {
    filterState.region = e.target.value;
    renderAll();
  });
  document.getElementById("brf-sort").addEventListener("change", e => {
    filterState.sort = e.target.value;
    renderAll();
  });

  const topicChips = document.getElementById("topicChips");
  topicChips.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      filterState.topic = btn.dataset.topic;
      setActiveChip(topicChips, "topic", filterState.topic);
      renderAll();
    });
  });

  const timeWindowChips = document.getElementById("timeWindowChips");
  timeWindowChips.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      filterState.timeWindow = btn.dataset.window;
      setActiveChip(timeWindowChips, "window", filterState.timeWindow);
      renderAll();
    });
  });

  const docTabs = document.getElementById("docTypeTabs");
  docTabs.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      filterState.docType = btn.dataset.docType;
      docTabs.querySelectorAll("button").forEach(node => node.classList.toggle("segmented-control__btn--active", node === btn));
      renderDocumentGrid();
    });
  });
}

function setupModalClose() {
  document.querySelectorAll("[data-modal-close]").forEach(el => {
    el.addEventListener("click", closeModal);
    el.addEventListener("touchend", closeModal, { passive: true });
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("brf-modal--open")) closeModal();
  });
}

window.addEventListener("resize", () => {
  if (modal?.classList.contains("brf-modal--open")) {
    setTimeout(() => briefingModalMap?.resize(), 60);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  setupFilters();
  setupModalClose();
  await loadData();
  renderAll();
});

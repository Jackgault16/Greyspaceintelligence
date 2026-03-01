// ===============================
// TYPE NOTES (runtime JS, TS-style unions documented)
// BriefType: 'scheduled' | 'regional' | 'special'
// BriefSubtype: scheduled keys or region keys or free text
// Status: 'ongoing' | 'developing' | 'resolved'
// Confidence: 'low' | 'medium' | 'high'
// ImpactLevel: 'strategic' | 'operational' | 'tactical' | 'noise'
// RiskLevel: 'low' | 'medium' | 'high'
// PriorityLevel: 'low' | 'medium' | 'high'
// ===============================

const REGION_OPTIONS = window.BRIEF_REGION_OPTIONS || [
    { key: "global", label: "Global" },
    { key: "europe", label: "Europe" }
];

const SCHEDULED_SUBTYPES = [
    { key: "morning", label: "Morning" },
    { key: "evening", label: "Evening" },
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" }
];

const PRIORITY_ORDER = { low: 1, medium: 2, high: 3 };

// ===============================
// GLOBAL ELEMENTS
// ===============================
const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");

const adminEmailDisplay = document.getElementById("adminUserEmail");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");
const logoutLink = document.getElementById("logoutLink");

const liveIntelList = document.getElementById("liveIntelList");
const briefingIntelList = document.getElementById("briefingIntelList");
const briefDocumentsList = document.getElementById("briefDocumentsList");
const editorStatus = document.getElementById("editorStatus");
const editorModeTitle = document.getElementById("editorModeTitle");

const intelTitle = document.getElementById("intelTitle");
const intelSummary = document.getElementById("intelSummary");
const intelDetails = document.getElementById("intelDetails");
const intelRegion = document.getElementById("intelRegion");
const intelCategory = document.getElementById("intelCategory");
const intelScope = document.getElementById("intelScope");
const intelTimestamp = document.getElementById("intelTimestamp");
const intelSources = document.getElementById("intelSources");
const intelLat = document.getElementById("intelLat");
const intelLng = document.getElementById("intelLng");
const briefingFields = document.getElementById("briefingFields");
const briefingRisk = document.getElementById("briefingRisk");
const briefingPriority = document.getElementById("briefingPriority");
const briefingZoom = document.getElementById("briefingZoom");
const briefingPoints = document.getElementById("briefingPoints");
const briefingStatus = document.getElementById("briefingStatus");
const briefingImpactLevel = document.getElementById("briefingImpactLevel");
const briefingConfidence = document.getElementById("briefingConfidence");
const briefingIndicators = document.getElementById("briefingIndicators");
const briefingWhyMatters = document.getElementById("briefingWhyMatters");
const briefingAssessment = document.getElementById("briefingAssessment");
const briefingEntryKind = document.getElementById("briefingEntryKind");
const briefDocType = document.getElementById("briefDocType");
const briefDocSubtypeSelect = document.getElementById("briefDocSubtypeSelect");
const briefDocSubtypeSpecialWrap = document.getElementById("briefDocSubtypeSpecialWrap");
const briefDocSubtypeSpecial = document.getElementById("briefDocSubtypeSpecial");
const briefDocumentTypeFields = document.getElementById("briefDocumentTypeFields");
const briefingTags = document.getElementById("briefingTags");
const briefPinsSection = document.getElementById("briefPinsSection");
const briefPinsList = document.getElementById("briefPinsList");

const publishButton = document.getElementById("publishButton");
const resetFormButton = document.getElementById("resetFormButton");
const deleteButton = document.getElementById("deleteButton");

const citySearch = document.getElementById("citySearch");
const adminEmailInput = document.getElementById("adminEmail");
const adminPasswordInput = document.getElementById("adminPassword");

let editingIntelId = null;
let editingTable = null;
let adminMarker = null;
let briefPinsMap = null;
let briefPins = [];
let briefPinMarkers = [];
let briefPinsBaselineHash = "[]";

function generateUuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function normalizedPinsForHash(pins) {
    return pins.map(pin => ({
        id: String(pin.id || ""),
        label: String(pin.label || "").trim(),
        latitude: Number(pin.latitude),
        longitude: Number(pin.longitude),
        region: String(pin.region || "").trim(),
        category: String(pin.category || "").trim(),
        risk_level: normalizeRiskLevel(pin.risk_level || "medium"),
        event_id: isUuid(pin.event_id) ? String(pin.event_id).trim() : ""
    }));
}

function pinsHash(pins) {
    try {
        return JSON.stringify(normalizedPinsForHash(pins));
    } catch (_) {
        return "[]";
    }
}

function normalizeRiskLevel(value) {
    const v = String(value || "").toLowerCase();
    return v === "high" || v === "medium" || v === "low" ? v : "low";
}

function normalizePriorityLevel(value) {
    const v = String(value || "").toLowerCase();
    return v === "high" || v === "medium" || v === "low" ? v : "medium";
}

function normalizeImpactLevel(value) {
    const v = String(value || "").toLowerCase();
    return v === "strategic" || v === "operational" || v === "tactical" || v === "noise" ? v : "noise";
}

function normalizeStatus(value) {
    const v = String(value || "").toLowerCase();
    return v === "ongoing" || v === "developing" || v === "resolved" ? v : "ongoing";
}

function normalizeConfidence(value) {
    const v = String(value || "").toLowerCase();
    return v === "low" || v === "medium" || v === "high" ? v : "medium";
}

function normalizeBriefType(value) {
    const v = String(value || "").toLowerCase();
    return v === "scheduled" || v === "regional" || v === "special" ? v : "scheduled";
}

function splitMultiline(value, limit = 12) {
    return String(value || "")
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(Boolean)
        .slice(0, limit);
}

function joinMultiline(value) {
    if (Array.isArray(value)) return value.join("\n");
    if (typeof value === "string") return value.split(/\r?\n|;/).map(v => v.trim()).filter(Boolean).join("\n");
    return "";
}

function splitCommaList(value, limit = 12) {
    return String(value || "")
        .split(",")
        .map(v => v.trim())
        .filter(Boolean)
        .slice(0, limit);
}

function sourceArrayFromInput(value) {
    return splitCommaList(value, 24);
}

function sourceInputFromStored(value) {
    if (Array.isArray(value)) return value.join(", ");
    return String(value || "");
}

function regionKeyByLabel(label) {
    const hit = REGION_OPTIONS.find(r => r.label.toLowerCase() === String(label || "").toLowerCase().trim());
    if (hit) return hit.key;
    return window.normalizeRegionKey ? window.normalizeRegionKey(label) : "";
}

function regionLabelByKey(key) {
    if (window.regionDisplayNameFromKey) return window.regionDisplayNameFromKey(key);
    const hit = REGION_OPTIONS.find(r => r.key === String(key || "").toLowerCase().trim());
    return hit ? hit.label : key;
}

function getScopeMode() {
    return intelScope.value === "BRIEFING" ? "BRIEFING" : "LIVE";
}

function getBriefingEntryKind() {
    return briefingEntryKind.value === "document" ? "document" : "event";
}

function getSelectedTable() {
    if (getScopeMode() === "LIVE") return LIVE_INTEL_TABLE;
    return getBriefingEntryKind() === "document" ? BRIEF_DOCUMENTS_TABLE : BRIEFING_INTEL_TABLE;
}

function tableLabel(table) {
    if (table === BRIEF_DOCUMENTS_TABLE) return "BRIEF DOCUMENT";
    if (table === BRIEFING_INTEL_TABLE) return "EVENT BRIEF";
    return "LIVE";
}

async function fetchTableRows(table) {
    const orderColumn = table === BRIEF_DOCUMENTS_TABLE ? "updated_at" : "timestamp";
    const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderColumn, { ascending: false });

    if (error) {
        console.error(`Failed to load intel from ${table}:`, error);
        return [];
    }

    return data.map(item => ({ ...item, __table: table }));
}

function setAutoTimestamp() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    intelTimestamp.value = local;
}

function setEditorStatus(message) {
    editorStatus.textContent = message;
}

function setCoordinates(lng, lat) {
    intelLat.value = lat.toFixed(6);
    intelLng.value = lng.toFixed(6);
}

function fillSubtypeOptions() {
    const briefType = normalizeBriefType(briefDocType.value);
    const current = briefDocSubtypeSelect.value;
    let options = SCHEDULED_SUBTYPES;

    if (briefType === "regional") {
        options = REGION_OPTIONS;
    } else if (briefType === "special") {
        options = [];
    }

    briefDocSubtypeSelect.innerHTML = "";

    if (options.length) {
        options.forEach(opt => {
            const node = document.createElement("option");
            node.value = opt.key;
            node.textContent = opt.label;
            briefDocSubtypeSelect.appendChild(node);
        });
        briefDocSubtypeSelect.value = options.find(o => o.key === current)?.key || options[0].key;
    }

    const isSpecial = briefType === "special";
    briefDocSubtypeSelect.style.display = isSpecial ? "none" : "block";
    briefDocSubtypeSpecialWrap.style.display = isSpecial ? "block" : "none";
}

function syncEditorModeUI() {
    const isBriefing = getScopeMode() === "BRIEFING";
    briefingFields.style.display = isBriefing ? "block" : "none";

    if (editorModeTitle) {
        editorModeTitle.textContent = isBriefing ? "BRIEFING ROOM EDITOR" : "LIVE EDITOR";
    }

    intelSummary.placeholder = isBriefing
        ? "Executive summary (supports multi-paragraph)"
        : "One or two lines of context";
    intelDetails.placeholder = isBriefing
        ? "Detailed body (supports multi-paragraph)"
        : "Deeper context, implications, sources, etc.";

    const isDocument = isBriefing && getBriefingEntryKind() === "document";
    briefDocumentTypeFields.style.display = isDocument ? "block" : "none";
    if (briefPinsSection) briefPinsSection.style.display = isDocument ? "block" : "none";
    if (isDocument) {
        initBriefPinsMap();
        if (briefPinsMap) {
            setTimeout(() => briefPinsMap.resize(), 80);
        }
    }
    fillSubtypeOptions();
}

function extractMissingColumnName(error) {
    const message = String(error?.message || "");
    const patterns = [
        /column \"([a-zA-Z0-9_]+)\"/i,
        /could not find the '([a-zA-Z0-9_]+)' column/i,
        /'([a-zA-Z0-9_]+)' column/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) return match[1];
    }

    return null;
}

function getErrorText(error) {
    const parts = [error?.message, error?.details, error?.hint]
        .filter(Boolean)
        .map(v => String(v).trim());
    return parts.join(" | ");
}

async function saveWithColumnFallback(table, payload, editingId) {
    let workingPayload = { ...payload };

    for (let i = 0; i < 12; i++) {
        const result = editingId
            ? await supabase.from(table).update(workingPayload).eq("id", editingId)
            : await supabase.from(table).insert(workingPayload);

        if (!result.error) return result;

        if (Array.isArray(workingPayload.points) && table === BRIEFING_INTEL_TABLE) {
            workingPayload.points = workingPayload.points.join("\n");
            continue;
        }

        if (Array.isArray(workingPayload.coords) && table === BRIEFING_INTEL_TABLE) {
            const [lng, lat] = workingPayload.coords;
            workingPayload.coords = `${lng},${lat}`;
            continue;
        }

        const missingColumn = extractMissingColumnName(result.error);
        if (!missingColumn || !(missingColumn in workingPayload)) {
            return result;
        }

        delete workingPayload[missingColumn];
    }

    return { error: { message: "Save failed after fallback attempts." } };
}

function regionFromCountryCode(rawCode) {
    if (!rawCode) return "";
    const code = rawCode.toUpperCase();

    const northAmerica = new Set(["US", "CA", "MX", "GL", "BM"]);
    const southAmerica = new Set(["AR", "BO", "BR", "CL", "CO", "EC", "GY", "PE", "PY", "SR", "UY", "VE", "GF", "FK"]);
    const europe = new Set([
        "AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS",
        "IE", "IT", "XK", "LV", "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL", "PT", "RO", "RU",
        "SM", "RS", "SK", "SI", "ES", "SE", "CH", "UA", "GB", "VA"
    ]);
    const middleEast = new Set(["AE", "BH", "EG", "IQ", "IR", "IL", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "TR", "YE"]);
    const africa = new Set([
        "DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CD", "CG", "CI", "DJ", "GQ", "ER", "SZ",
        "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA",
        "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW"
    ]);
    const centralAsia = new Set(["KZ", "KG", "TJ", "TM", "UZ", "AF"]);
    const eastAsia = new Set(["CN", "HK", "JP", "KP", "KR", "MN", "MO", "TW"]);
    const southAsia = new Set(["BD", "BT", "IN", "LK", "MV", "NP", "PK"]);
    const southeastAsia = new Set(["BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "TL", "VN"]);
    const oceania = new Set(["AU", "FJ", "KI", "MH", "FM", "NR", "NZ", "PW", "PG", "WS", "SB", "TO", "TV", "VU"]);

    if (northAmerica.has(code)) return "North America";
    if (southAmerica.has(code)) return "South America";
    if (europe.has(code)) return "Europe";
    if (middleEast.has(code)) return "Middle East";
    if (africa.has(code)) return "Africa";
    if (centralAsia.has(code)) return "Central Asia";
    if (eastAsia.has(code)) return "East Asia";
    if (southAsia.has(code)) return "South Asia";
    if (southeastAsia.has(code)) return "Southeast Asia";
    if (oceania.has(code)) return "Oceania";
    return "";
}

function extractCountryCodeFromFeature(feature) {
    const context = feature?.context || [];
    const country = context.find(entry => (entry.id || "").startsWith("country."));
    if (country?.short_code) return country.short_code.toUpperCase();
    if (feature?.place_type?.includes("country") && feature.properties?.short_code) {
        return String(feature.properties.short_code).toUpperCase();
    }
    return "";
}

function maybeApplyRegionFromFeature(feature) {
    const code = extractCountryCodeFromFeature(feature);
    const region = regionFromCountryCode(code);
    if (region) intelRegion.value = region;
}

// ===============================
// MAPBOX SETUP
// ===============================
mapboxgl.accessToken = MAPBOX_TOKEN;

const adminMap = new mapboxgl.Map({
    container: "adminMap",
    style: "mapbox://styles/mapbox/dark-v11",
    center: [0, 20],
    zoom: 1.6
});

function placeAdminMarker(lng, lat) {
    if (adminMarker) adminMarker.remove();
    adminMarker = new mapboxgl.Marker({ color: "#f97316" })
        .setLngLat([lng, lat])
        .addTo(adminMap);
}

function initBriefPinsMap() {
    if (briefPinsMap || !document.getElementById("briefPinsMap")) return;

    const frame = (window.REGION_FRAMES && window.REGION_FRAMES.global) || { center: [0, 20], zoom: 1.2 };
    briefPinsMap = new mapboxgl.Map({
        container: "briefPinsMap",
        style: "mapbox://styles/mapbox/dark-v11",
        center: frame.center,
        zoom: frame.zoom
    });

    briefPinsMap.on("click", e => {
        briefPins.push({
            id: generateUuid(),
            label: `Hotspot ${briefPins.length + 1}`,
            latitude: Number(e.lngLat.lat.toFixed(6)),
            longitude: Number(e.lngLat.lng.toFixed(6)),
            region: intelRegion.value || "",
            category: intelCategory.value || "",
            risk_level: "medium",
            event_id: "",
            created_at: new Date().toISOString()
        });
        renderBriefPins();
    });
}

function updatePinMarkers() {
    briefPinMarkers.forEach(m => m.remove());
    briefPinMarkers = [];
    if (!briefPinsMap) return;

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    briefPins.forEach(pin => {
        if (!Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude)) return;
        const marker = new mapboxgl.Marker({ color: "#22c55e" })
            .setLngLat([pin.longitude, pin.latitude])
            .addTo(briefPinsMap);
        briefPinMarkers.push(marker);
        bounds.extend([pin.longitude, pin.latitude]);
        hasBounds = true;
    });

    if (hasBounds && briefPins.length > 1) {
        briefPinsMap.fitBounds(bounds, { padding: 40, duration: 0 });
    }
}

function renderBriefPins() {
    if (!briefPinsList) return;
    if (!briefPins.length) {
        briefPinsList.innerHTML = '<div class="field-help">No pins added yet. Click the map to add one.</div>';
        updatePinMarkers();
        return;
    }

    briefPinsList.innerHTML = briefPins.map((pin, idx) => `
        <div class="pin-row">
            <div class="pin-row__header">
                <span>Pin ${idx + 1}</span>
                <button type="button" class="btn-danger pin-delete-btn" data-pin-id="${pin.id}">Delete</button>
            </div>
            <label>Label</label>
            <input type="text" class="pin-input" data-field="label" data-pin-id="${pin.id}" value="${String(pin.label || "").replace(/"/g, "&quot;")}">

            <div class="admin-row">
                <div>
                    <label>Latitude</label>
                    <input type="text" value="${pin.latitude}" readonly>
                </div>
                <div>
                    <label>Longitude</label>
                    <input type="text" value="${pin.longitude}" readonly>
                </div>
            </div>

            <div class="admin-row">
                <div>
                    <label>Region (optional)</label>
                    <input type="text" class="pin-input" data-field="region" data-pin-id="${pin.id}" value="${String(pin.region || "").replace(/"/g, "&quot;")}">
                </div>
                <div>
                    <label>Category (optional)</label>
                    <input type="text" class="pin-input" data-field="category" data-pin-id="${pin.id}" value="${String(pin.category || "").replace(/"/g, "&quot;")}">
                </div>
            </div>

            <div class="admin-row">
                <div>
                    <label>Risk Level</label>
                    <select class="pin-input" data-field="risk_level" data-pin-id="${pin.id}">
                        <option value="low" ${pin.risk_level === "low" ? "selected" : ""}>low</option>
                        <option value="medium" ${pin.risk_level === "medium" ? "selected" : ""}>medium</option>
                        <option value="high" ${pin.risk_level === "high" ? "selected" : ""}>high</option>
                    </select>
                </div>
                <div>
                    <label>Event ID (optional UUID)</label>
                    <input type="text" class="pin-input" data-field="event_id" data-pin-id="${pin.id}" value="${String(pin.event_id || "").replace(/"/g, "&quot;")}">
                </div>
            </div>
        </div>
    `).join("");

    briefPinsList.querySelectorAll(".pin-input").forEach(el => {
        const onPinChange = e => {
            const pinId = e.target.getAttribute("data-pin-id");
            const field = e.target.getAttribute("data-field");
            const pin = briefPins.find(p => p.id === pinId);
            if (!pin || !field) return;
            pin[field] = e.target.value;
        };
        el.addEventListener("input", onPinChange);
        el.addEventListener("change", onPinChange);
    });

    briefPinsList.querySelectorAll(".pin-delete-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            const id = e.currentTarget.getAttribute("data-pin-id");
            briefPins = briefPins.filter(p => p.id !== id);
            renderBriefPins();
        });
    });

    updatePinMarkers();
}

async function loadBriefPins(briefId) {
    if (!briefId) {
        briefPins = [];
        briefPinsBaselineHash = "[]";
        renderBriefPins();
        return;
    }

    const { data, error } = await supabase
        .from("brief_document_pins")
        .select("*")
        .eq("brief_id", briefId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Failed loading brief pins:", error);
        briefPins = [];
        briefPinsBaselineHash = "[]";
        renderBriefPins();
        return;
    }

    briefPins = (data || []).map(pin => ({
        id: pin.id,
        label: pin.label || "",
        latitude: Number(pin.latitude),
        longitude: Number(pin.longitude),
        region: pin.region || "",
        category: pin.category || "",
        risk_level: normalizeRiskLevel(pin.risk_level || "medium"),
        event_id: pin.event_id || "",
        created_at: pin.created_at || new Date().toISOString()
    }));

    briefPinsBaselineHash = pinsHash(briefPins);
    renderBriefPins();
}

async function syncBriefPins(briefId) {
    if (!briefId) return { error: null };

    const { data: existingRows, error: existingError } = await supabase
        .from("brief_document_pins")
        .select("id")
        .eq("brief_id", briefId);

    if (existingError) return { error: existingError };

    const currentIds = briefPins.map(p => p.id);
    const existingIds = (existingRows || []).map(r => r.id);
    const deleteIds = existingIds.filter(id => !currentIds.includes(id));

    if (deleteIds.length) {
        const { error } = await supabase.from("brief_document_pins").delete().in("id", deleteIds);
        if (error) return { error };
    }

    if (!briefPins.length) return { error: null };

    const upsertRows = briefPins
        .map(pin => ({
            id: pin.id || generateUuid(),
            brief_id: briefId,
            label: String(pin.label || "").trim() || null,
            latitude: Number(pin.latitude),
            longitude: Number(pin.longitude),
            region: String(pin.region || "").trim() || null,
            category: String(pin.category || "").trim() || null,
            risk_level: normalizeRiskLevel(pin.risk_level || "medium"),
            event_id: isUuid(pin.event_id) ? String(pin.event_id).trim() : null
        }))
        .filter(row => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));

    if (!upsertRows.length) return { error: null };

    const { error } = await supabase.from("brief_document_pins").upsert(upsertRows, { onConflict: "id" });
    return { error };
}

adminMap.on("click", async e => {
    const { lng, lat } = e.lngLat;
    setCoordinates(lng, lat);
    placeAdminMarker(lng, lat);

    try {
        const reverseUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country,region,place&limit=1&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(reverseUrl);
        const json = await res.json();
        if (json.features && json.features[0]) {
            maybeApplyRegionFromFeature(json.features[0]);
        }
    } catch (err) {
        console.error("Reverse geocode failed:", err);
    }
});

async function geocodeCity(query) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    return res.json();
}

citySearch.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;

    const query = citySearch.value.trim();
    if (!query) return;

    try {
        const json = await geocodeCity(query);
        if (!json.features || json.features.length === 0) return;

        const place = json.features[0];
        const [lng, lat] = place.center;
        setCoordinates(lng, lat);
        maybeApplyRegionFromFeature(place);
        placeAdminMarker(lng, lat);
        adminMap.flyTo({ center: [lng, lat], zoom: 5 });
    } catch (err) {
        console.error("City search failed:", err);
    }
});

function clearForm() {
    editingIntelId = null;
    editingTable = null;

    intelTitle.value = "";
    intelSummary.value = "";
    intelDetails.value = "";
    intelRegion.value = "";
    intelCategory.value = "";
    intelSources.value = "";
    intelLat.value = "";
    intelLng.value = "";
    briefingRisk.value = "medium";
    briefingPriority.value = "medium";
    briefingZoom.value = "5";
    briefingPoints.value = "";
    briefingStatus.value = "ongoing";
    briefingImpactLevel.value = "noise";
    briefingConfidence.value = "medium";
    briefingIndicators.value = "";
    briefingWhyMatters.value = "";
    briefingAssessment.value = "";
    briefingEntryKind.value = "event";
    briefDocType.value = "scheduled";
    briefingTags.value = "";
    briefDocSubtypeSpecial.value = "";
    briefPins = [];
    briefPinsBaselineHash = "[]";
    renderBriefPins();

    fillSubtypeOptions();
    setAutoTimestamp();
    deleteButton.style.display = "none";
    setEditorStatus("");
    syncEditorModeUI();
}

function createIntelListItem(item, table) {
    const timestamp = item.updated_at || item.published_at || item.timestamp || item.created_at;
    const div = document.createElement("div");
    div.className = "intel-item";

    div.innerHTML = `
        <div class="intel-item-main">
            <div class="intel-item-title">${item.title || "Untitled"}</div>
            <div class="intel-item-meta">${timestamp ? new Date(timestamp).toLocaleString() : "--"} • ${tableLabel(table)}</div>
        </div>
        <div class="intel-item-actions">
            <button class="btn-secondary" data-id="${item.id}">EDIT</button>
        </div>
    `;

    div.querySelector("button").addEventListener("click", async () => loadIntelIntoEditor(item, table));
    return div;
}

async function loadIntelList() {
    const [liveRows, briefingRows, briefDocsRows] = await Promise.all([
        fetchTableRows(LIVE_INTEL_TABLE),
        fetchTableRows(BRIEFING_INTEL_TABLE),
        fetchTableRows(BRIEF_DOCUMENTS_TABLE)
    ]);

    liveIntelList.innerHTML = "";
    briefingIntelList.innerHTML = "";
    briefDocumentsList.innerHTML = "";

    liveRows.forEach(item => liveIntelList.appendChild(createIntelListItem(item, LIVE_INTEL_TABLE)));
    briefingRows.forEach(item => briefingIntelList.appendChild(createIntelListItem(item, BRIEFING_INTEL_TABLE)));
    briefDocsRows.forEach(item => briefDocumentsList.appendChild(createIntelListItem(item, BRIEF_DOCUMENTS_TABLE)));
}

function getDocumentSubtypeFromUI() {
    if (normalizeBriefType(briefDocType.value) === "special") {
        return briefDocSubtypeSpecial.value.trim();
    }
    return briefDocSubtypeSelect.value;
}

async function loadIntelIntoEditor(item, table) {
    editingIntelId = item.id;
    editingTable = table;

    intelTitle.value = item.title || "";
    intelSummary.value = item.summary || item.executive_summary || "";
    intelDetails.value = item.details || item.analysis || "";
    intelRegion.value = item.region || item.theater || "";
    intelCategory.value = item.category || item.type || "";
    const ts = (item.published_at || item.timestamp || item.updated_at) ? String(item.published_at || item.timestamp || item.updated_at).slice(0, 16) : "";
    intelTimestamp.value = ts;
    intelSources.value = sourceInputFromStored(item.sources || item.source_links || "");

    const coords = Array.isArray(item.coords) ? item.coords : null;
    const lat = item.lat != null ? item.lat : (coords ? coords[1] : "");
    const lng = item.lng != null ? item.lng : (item.long != null ? item.long : (coords ? coords[0] : ""));
    intelLat.value = lat;
    intelLng.value = lng;

    if (table === LIVE_INTEL_TABLE) {
        intelScope.value = "LIVE";
        briefingEntryKind.value = "event";
    } else if (table === BRIEF_DOCUMENTS_TABLE) {
        intelScope.value = "BRIEFING";
        briefingEntryKind.value = "document";
    } else {
        intelScope.value = "BRIEFING";
        briefingEntryKind.value = "event";
    }

    const points = item.key_points || item.points || item.keyPoints;
    const indicators = item.indicators || item.indicators_to_watch || item.watch_indicators;

    briefingRisk.value = normalizeRiskLevel(item.risk_level || item.risk || "medium");
    briefingPriority.value = normalizePriorityLevel(item.priority_level || item.priority || "medium");
    briefingZoom.value = item.map_zoom || item.zoom || 5;
    briefingPoints.value = joinMultiline(points);
    briefingStatus.value = normalizeStatus(item.status || "ongoing");
    briefingImpactLevel.value = normalizeImpactLevel(item.impact_level || item.impact || "noise");
    briefingConfidence.value = normalizeConfidence(item.confidence || "medium");
    briefingIndicators.value = joinMultiline(indicators);
    briefingWhyMatters.value = item.why_it_matters || item.whyItMatters || item.why || item.summary || "";
    briefingAssessment.value = item.assessment || item.analysis || item.details || "";
    briefingTags.value = sourceInputFromStored(item.tags);

    if (table === BRIEF_DOCUMENTS_TABLE) {
        briefDocType.value = normalizeBriefType(item.brief_type);
        fillSubtypeOptions();
        if (briefDocType.value === "special") {
            briefDocSubtypeSpecial.value = item.brief_subtype || "";
        } else {
            briefDocSubtypeSelect.value = item.brief_subtype || briefDocSubtypeSelect.value;
        }
        await loadBriefPins(item.id);
    } else {
        briefDocType.value = "scheduled";
        briefDocSubtypeSpecial.value = "";
        briefPins = [];
        briefPinsBaselineHash = "[]";
        renderBriefPins();
        fillSubtypeOptions();
    }

    if (lng !== "" && lat !== "") {
        placeAdminMarker(Number(lng), Number(lat));
    }

    deleteButton.style.display = "inline-block";
    syncEditorModeUI();
}

function buildLivePayload() {
    return {
        title: intelTitle.value.trim(),
        summary: intelSummary.value.trim(),
        details: intelDetails.value.trim(),
        region: intelRegion.value.trim(),
        category: intelCategory.value,
        timestamp: new Date(intelTimestamp.value).toISOString(),
        sources: intelSources.value.trim(),
        lat: parseFloat(intelLat.value),
        lng: parseFloat(intelLng.value)
    };
}

function buildEventBriefPayload(isUpdate) {
    const lat = parseFloat(intelLat.value);
    const lng = parseFloat(intelLng.value);
    const points = splitMultiline(briefingPoints.value, 12);
    const indicators = splitMultiline(briefingIndicators.value, 12);
    const detailsText = intelDetails.value.trim();
    const whyItMatters = briefingWhyMatters.value.trim();
    const assessment = briefingAssessment.value.trim();
    const publishedAt = new Date(intelTimestamp.value).toISOString();
    const updatedAt = isUpdate ? new Date().toISOString() : publishedAt;
    const impactLevel = normalizeImpactLevel(briefingImpactLevel.value);
    const riskLevel = normalizeRiskLevel(briefingRisk.value);
    const priorityLevel = normalizePriorityLevel(briefingPriority.value);
    const sources = sourceArrayFromInput(intelSources.value);

    return {
        title: intelTitle.value.trim(),
        summary: intelSummary.value.trim(),
        details: detailsText,
        why_it_matters: whyItMatters,
        assessment,
        analysis: assessment || detailsText,
        region: intelRegion.value.trim(),
        category: intelCategory.value,
        timestamp: publishedAt,
        published_at: publishedAt,
        updated_at: updatedAt,
        status: normalizeStatus(briefingStatus.value),
        impact_level: impactLevel,
        confidence: normalizeConfidence(briefingConfidence.value),
        risk_level: riskLevel,
        priority_level: priorityLevel,
        risk: riskLevel,
        priority: priorityLevel,
        points,
        key_points: points,
        indicators,
        sources,
        source_links: sources,
        lat,
        lng,
        coords: Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null,
        map_zoom: Math.round(parseFloat(briefingZoom.value) || 5),
        zoom: Math.round(parseFloat(briefingZoom.value) || 5)
    };
}

function buildBriefDocumentPayload(isUpdate) {
    const nowIso = new Date().toISOString();
    const publishIso = intelTimestamp.value ? new Date(intelTimestamp.value).toISOString() : nowIso;
    const briefType = normalizeBriefType(briefDocType.value);
    const subtype = getDocumentSubtypeFromUI();
    const points = splitMultiline(briefingPoints.value, 12);
    const indicators = splitMultiline(briefingIndicators.value, 12);
    const sources = sourceArrayFromInput(intelSources.value);
    const tags = splitCommaList(briefingTags.value, 12);
    const regionLabel = intelRegion.value.trim();
    const regionKey = regionKeyByLabel(regionLabel);

    const id = isUpdate ? editingIntelId : generateUuid();

    return {
        id,
        title: intelTitle.value.trim(),
        brief_type: briefType,
        brief_subtype: briefType === "regional" && regionKey ? regionKey : subtype,
        status: normalizeStatus(briefingStatus.value),
        confidence: normalizeConfidence(briefingConfidence.value),
        impact_level: normalizeImpactLevel(briefingImpactLevel.value),
        risk_level: normalizeRiskLevel(briefingRisk.value),
        priority_level: normalizePriorityLevel(briefingPriority.value),
        region: regionLabel,
        category: intelCategory.value || "",
        tags,
        summary: intelSummary.value.trim(),
        why_it_matters: briefingWhyMatters.value.trim(),
        details: intelDetails.value.trim(),
        key_points: points,
        indicators,
        sources,
        publish_to: ["briefing_room"],
        updated_at: isUpdate ? nowIso : publishIso,
        created_at: isUpdate ? undefined : publishIso
    };
}

function validatePayload(table, payload) {
    if (!payload.title || !payload.summary) return "Missing required fields.";

    if (table === LIVE_INTEL_TABLE && !payload.details) return "Missing required fields.";

    if (table === BRIEFING_INTEL_TABLE) {
        const latValid = Number.isFinite(payload.lat);
        const lngValid = Number.isFinite(payload.lng);
        if (!payload.details || !latValid || !lngValid) {
            return "Event brief requires details + latitude + longitude.";
        }
    }

    if (table === BRIEF_DOCUMENTS_TABLE) {
        if (!payload.brief_subtype) return "Brief document subtype is required.";
        if (!payload.details) return "Brief document full body is required.";
    }

    return "";
}

publishButton.addEventListener("click", async () => {
    const table = editingTable || getSelectedTable();
    const isUpdate = Boolean(editingIntelId);
    let payload = null;

    if (table === LIVE_INTEL_TABLE) {
        payload = buildLivePayload();
    } else if (table === BRIEF_DOCUMENTS_TABLE) {
        payload = buildBriefDocumentPayload(isUpdate);
    } else {
        payload = buildEventBriefPayload(isUpdate);
    }

    const validationError = validatePayload(table, payload);
    if (validationError) {
        setEditorStatus(validationError);
        return;
    }

    const result = await saveWithColumnFallback(table, payload, editingIntelId);

    if (result.error) {
        setEditorStatus(`Error saving intel: ${getErrorText(result.error) || "Unknown error"}`);
        console.error(result.error);
        return;
    }

    if (table === BRIEF_DOCUMENTS_TABLE) {
        const briefId = payload.id || editingIntelId;
        const pinChanged = pinsHash(briefPins) !== briefPinsBaselineHash;

        if (pinChanged) {
            const pinSync = await syncBriefPins(briefId);
            if (pinSync.error) {
                setEditorStatus(`Brief saved, but pins could not sync: ${getErrorText(pinSync.error) || "Unknown error"}`);
                console.error(pinSync.error);
            } else {
                briefPinsBaselineHash = pinsHash(briefPins);
            }
        }
    }

    setEditorStatus("Saved.");
    clearForm();
    await loadIntelList();
});

deleteButton.addEventListener("click", async () => {
    if (!editingIntelId) return;
    const table = editingTable || getSelectedTable();

    const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", editingIntelId);

    if (error) {
        setEditorStatus("Delete failed.");
        return;
    }

    setEditorStatus("Deleted.");
    clearForm();
    await loadIntelList();
});

resetFormButton.addEventListener("click", clearForm);
intelScope.addEventListener("change", () => {
    clearForm();
    syncEditorModeUI();
});
briefingEntryKind.addEventListener("change", syncEditorModeUI);
briefDocType.addEventListener("change", fillSubtypeOptions);

// ===============================
// AUTH
// ===============================
loginButton.addEventListener("click", async () => {
    loginError.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "SIGNING IN...";

    const email = adminEmailInput.value.trim();
    const password = adminPasswordInput.value.trim();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    loginButton.disabled = false;
    loginButton.textContent = "SIGN IN";

    if (error) {
        loginError.textContent = "Invalid email or password.";
        return;
    }

    showAdminView(data.user);
});

async function checkSessionOnLoad() {
    const { data } = await supabase.auth.getSession();
    if (data.session) showAdminView(data.session.user);
}

async function showAdminView(user) {
    loginView.style.display = "none";
    adminView.style.display = "block";
    adminEmailDisplay.textContent = user.email;
    if (intelRegion) {
        const current = intelRegion.value;
        intelRegion.innerHTML = '<option value="">Select...</option>';
        REGION_OPTIONS.forEach(opt => {
            const node = document.createElement("option");
            node.value = opt.label;
            node.textContent = opt.label;
            intelRegion.appendChild(node);
        });
        intelRegion.value = current;
    }
    setAutoTimestamp();
    fillSubtypeOptions();
    syncEditorModeUI();
    renderBriefPins();
    await loadIntelList();
}

logoutLink.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
});

checkSessionOnLoad();

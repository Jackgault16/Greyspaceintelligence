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
const scheduledBriefDocsList = document.getElementById("scheduledBriefDocsList");
const regionalBriefDocsList = document.getElementById("regionalBriefDocsList");
const specialBriefDocsList = document.getElementById("specialBriefDocsList");
const briefingEventBriefsList = document.getElementById("briefingEventBriefsList");
const queueTitle = document.getElementById("queueTitle");
const queueSubtitle = document.getElementById("queueSubtitle");
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
const briefingEntryKindRow = briefingEntryKind ? briefingEntryKind.closest(".admin-row") : null;
const entryKindHelper = document.getElementById("entryKindHelper");
const intelScopeLabel = document.querySelector('label[for="intelScope"]');
const intelScopeRow = intelScope ? intelScope.closest(".admin-row") : null;
const briefDocType = document.getElementById("briefDocType");
const briefDocSubtypeSelect = document.getElementById("briefDocSubtypeSelect");
const briefDocSubtypeSpecialWrap = document.getElementById("briefDocSubtypeSpecialWrap");
const briefDocSubtypeSpecial = document.getElementById("briefDocSubtypeSpecial");
const briefDocumentTypeFields = document.getElementById("briefDocumentTypeFields");
const briefingTags = document.getElementById("briefingTags");
const briefPinsSection = document.getElementById("briefPinsSection");
const briefPinsList = document.getElementById("briefPinsList");
const adminModeTabs = document.getElementById("adminModeTabs");
const eventsLibraryWrap = document.getElementById("eventsLibraryWrap");
const documentsLibraryWrap = document.getElementById("documentsLibraryWrap");
const adminListSearch = document.getElementById("adminListSearch");
const adminListRegionFilter = document.getElementById("adminListRegionFilter");
const adminListCategoryFilter = document.getElementById("adminListCategoryFilter");

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
let adminMode = "events";
let listFilterState = { search: "", region: "", category: "" };
let liveRowsCache = [];
let eventRowsCache = [];
let docsRowsCache = [];
let currentBriefFrameKey = "global";
let didInitBriefPinsView = false;
let entryKindState = "brief_document"; // 'brief_document' | 'event_brief'

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
        event_id: isUuid(pin.event_id) ? String(pin.event_id).trim() : "",
        hotspot_summary: String(pin.hotspot_summary || "").trim(),
        hotspot_why_it_matters: String(pin.hotspot_why_it_matters || "").trim(),
        hotspot_indicators: splitMultiline(pin.hotspot_indicators || "", 12),
        hotspot_sources: splitCommaList(pin.hotspot_sources || "", 24)
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
    return entryKindState === "brief_document" ? "document" : "event";
}

function entryKindStateFromUiValue(value) {
    return value === "event" ? "event_brief" : "brief_document";
}

function entryKindUiValueFromState(value) {
    return value === "event_brief" ? "event" : "document";
}

function isEditingExistingBriefingItem() {
    if (adminMode !== "documents") return false;
    if (!editingIntelId) return false;
    return editingTable === BRIEF_DOCUMENTS_TABLE || editingTable === BRIEFING_INTEL_TABLE;
}

function applyEntryKindTemplate(kindState) {
    if (kindState === "event_brief") {
        briefDocType.value = "scheduled";
        fillSubtypeOptions();
        briefDocSubtypeSelect.value = "daily";
        briefDocSubtypeSpecial.value = "";
        briefPins = [];
        briefPinsBaselineHash = "[]";
        renderBriefPins();
        return;
    }

    // brief_document defaults
    briefDocType.value = "scheduled";
    fillSubtypeOptions();
    briefDocSubtypeSelect.value = "daily";
    briefDocSubtypeSpecial.value = "";
    briefingWhyMatters.value = "";
    briefingAssessment.value = "";
}

function setEntryKindState(nextState, { applyTemplate = false } = {}) {
    const normalized = nextState === "event_brief" ? "event_brief" : "brief_document";
    const changed = entryKindState !== normalized;
    entryKindState = normalized;
    if (briefingEntryKind) {
        briefingEntryKind.value = entryKindUiValueFromState(entryKindState);
    }
    if (applyTemplate && changed && !isEditingExistingBriefingItem()) {
        applyEntryKindTemplate(entryKindState);
    }
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
            applyBriefPinsInitialView();
        }
    }
    fillSubtypeOptions();
}

function setSingleSelectOption(selectEl, value, label) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    selectEl.appendChild(opt);
    selectEl.value = value;
}

function enforceAdminModeConstraints() {
    if (adminMode === "documents") {
        setSingleSelectOption(intelScope, "BRIEFING", "Briefing Room");
        intelScope.disabled = true;
        if (intelScope) intelScope.style.display = "none";
        if (intelScopeLabel) intelScopeLabel.style.display = "none";
        if (intelScopeRow && intelScopeRow.contains(intelScope)) intelScopeRow.style.display = "none";

        if (briefingEntryKind && briefingEntryKind.options.length !== 2) {
            briefingEntryKind.innerHTML = "";
            const optionDoc = document.createElement("option");
            optionDoc.value = "document";
            optionDoc.textContent = "Brief Document";
            const optionEvent = document.createElement("option");
            optionEvent.value = "event";
            optionEvent.textContent = "Event Brief";
            briefingEntryKind.appendChild(optionDoc);
            briefingEntryKind.appendChild(optionEvent);
        }

        const isLocked = isEditingExistingBriefingItem();
        briefingEntryKind.disabled = isLocked;
        briefingEntryKind.style.pointerEvents = isLocked ? "none" : "auto";
        briefingEntryKind.style.opacity = isLocked ? "0.65" : "1";
        if (entryKindHelper) entryKindHelper.style.display = isLocked ? "block" : "none";
        if (briefingEntryKindRow) briefingEntryKindRow.style.display = "flex";
        setEntryKindState(entryKindState, { applyTemplate: false });
    } else {
        setSingleSelectOption(intelScope, "LIVE", "Live");
        setSingleSelectOption(briefingEntryKind, "event", "Event Brief");
        intelScope.disabled = true;
        briefingEntryKind.disabled = true;
        briefingEntryKind.style.pointerEvents = "none";
        briefingEntryKind.style.opacity = "0.65";
        if (entryKindHelper) entryKindHelper.style.display = "none";
        if (intelScope) intelScope.style.display = "none";
        if (intelScopeLabel) intelScopeLabel.style.display = "none";
        if (intelScopeRow && intelScopeRow.contains(intelScope)) intelScopeRow.style.display = "none";
        if (briefingEntryKindRow) briefingEntryKindRow.style.display = "none";
        setEntryKindState("event_brief", { applyTemplate: false });
    }
}

function getSelectedFrameKey() {
    if (normalizeBriefType(briefDocType.value) === "regional") {
        const key = getDocumentSubtypeFromUI();
        return (window.normalizeRegionKey ? window.normalizeRegionKey(key) : String(key || "").trim().toLowerCase()) || "global";
    }
    const regionKey = regionKeyByLabel(intelRegion.value);
    return regionKey || "global";
}

function applyBriefPinsInitialView(force = false) {
    if (!briefPinsMap) return;
    if (didInitBriefPinsView && !force) return;
    didInitBriefPinsView = true;

    const frameKey = getSelectedFrameKey();
    const frame = (window.REGION_FRAMES && window.REGION_FRAMES[frameKey]) || (window.REGION_FRAMES && window.REGION_FRAMES.global) || { center: [0, 20], zoom: 1.2 };

    const bounds = new mapboxgl.LngLatBounds();
    let hasPinBounds = false;
    let firstPin = null;
    briefPins.forEach(pin => {
        if (!Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude)) return;
        if (!firstPin) firstPin = pin;
        bounds.extend([pin.longitude, pin.latitude]);
        hasPinBounds = true;
    });

    try {
        if (normalizeBriefType(briefDocType.value) === "regional") {
            if (frame.bounds) {
                briefPinsMap.fitBounds(frame.bounds, { padding: 40, duration: 0 });
            } else {
                briefPinsMap.jumpTo({ center: frame.center, zoom: frame.zoom });
            }
            return;
        }

        if (hasPinBounds) {
            if (briefPins.length === 1 && firstPin) {
                briefPinsMap.jumpTo({ center: [firstPin.longitude, firstPin.latitude], zoom: 4.8 });
            } else {
                briefPinsMap.fitBounds(bounds, { padding: 50, duration: 0 });
            }
            return;
        }

        if (frame.bounds) {
            briefPinsMap.fitBounds(frame.bounds, { padding: 40, duration: 0 });
        } else {
            briefPinsMap.jumpTo({ center: frame.center, zoom: frame.zoom });
        }
    } catch (_) {
        briefPinsMap.jumpTo({ center: [0, 20], zoom: 1.2 });
    }
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

    briefPinsMap.on("load", () => {
        didInitBriefPinsView = false;
        applyBriefPinsInitialView();
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
            hotspot_summary: "",
            hotspot_why_it_matters: "",
            hotspot_indicators: "",
            hotspot_sources: "",
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
        didInitBriefPinsView = false;
        applyBriefPinsInitialView(true);
    }
}

function renderBriefPins() {
    if (!briefPinsList) return;
    if (!briefPins.length) {
        briefPinsList.innerHTML = '<div class="field-help">No hotspots added yet. Click the map to add one.</div>';
        updatePinMarkers();
        return;
    }

    if (!briefPins.some(p => p.__selected)) {
        briefPins[0].__selected = true;
    }

    const selected = briefPins.find(p => p.__selected) || briefPins[0];

    briefPinsList.innerHTML = `
        <div class="field-help">Select a hotspot to edit details.</div>
        ${briefPins.map((pin, idx) => `
            <div class="pin-row ${pin.__selected ? "pin-row--active" : ""}">
                <div class="pin-row__header">
                    <span>${idx + 1}. ${pin.label || "Hotspot"}</span>
                    <div style="display:flex;gap:6px;">
                        <button type="button" class="btn-secondary pin-select-btn" data-pin-id="${pin.id}">Edit</button>
                        <button type="button" class="btn-danger pin-delete-btn" data-pin-id="${pin.id}">Delete</button>
                    </div>
                </div>
                <div class="field-help">${pin.region || "--"} • ${pin.category || "--"} • ${normalizeRiskLevel(pin.risk_level || "medium")}</div>
            </div>
        `).join("")}
        <div class="pin-row">
            <div class="pin-row__header"><span>Selected Hotspot Editor</span></div>
            <label>Label</label>
            <input type="text" class="pin-input" data-field="label" data-pin-id="${selected.id}" value="${String(selected.label || "").replace(/"/g, "&quot;")}">
            <div class="admin-row">
                <div>
                    <label>Latitude</label>
                    <input type="text" value="${selected.latitude}" readonly>
                </div>
                <div>
                    <label>Longitude</label>
                    <input type="text" value="${selected.longitude}" readonly>
                </div>
            </div>
            <div class="admin-row">
                <div>
                    <label>Region (optional)</label>
                    <input type="text" class="pin-input" data-field="region" data-pin-id="${selected.id}" value="${String(selected.region || "").replace(/"/g, "&quot;")}">
                </div>
                <div>
                    <label>Category (optional)</label>
                    <input type="text" class="pin-input" data-field="category" data-pin-id="${selected.id}" value="${String(selected.category || "").replace(/"/g, "&quot;")}">
                </div>
            </div>
            <div class="admin-row">
                <div>
                    <label>Risk Level</label>
                    <select class="pin-input" data-field="risk_level" data-pin-id="${selected.id}">
                        <option value="low" ${selected.risk_level === "low" ? "selected" : ""}>low</option>
                        <option value="medium" ${selected.risk_level === "medium" ? "selected" : ""}>medium</option>
                        <option value="high" ${selected.risk_level === "high" ? "selected" : ""}>high</option>
                    </select>
                </div>
                <div>
                    <label>Event ID (optional UUID)</label>
                    <input type="text" class="pin-input" data-field="event_id" data-pin-id="${selected.id}" value="${String(selected.event_id || "").replace(/"/g, "&quot;")}">
                </div>
            </div>
            <label>Hotspot Summary (What's happening)</label>
            <textarea class="pin-input" data-field="hotspot_summary" data-pin-id="${selected.id}" placeholder="Concise hotspot summary...">${String(selected.hotspot_summary || "")}</textarea>
            <label>Hotspot Why It Matters</label>
            <textarea class="pin-input" data-field="hotspot_why_it_matters" data-pin-id="${selected.id}" placeholder="Why this hotspot matters...">${String(selected.hotspot_why_it_matters || "")}</textarea>
            <label>Hotspot Indicators (one per line)</label>
            <textarea class="pin-input" data-field="hotspot_indicators" data-pin-id="${selected.id}" placeholder="Indicator 1&#10;Indicator 2">${String(selected.hotspot_indicators || "")}</textarea>
            <label>Hotspot Sources (comma-separated)</label>
            <input type="text" class="pin-input" data-field="hotspot_sources" data-pin-id="${selected.id}" value="${String(selected.hotspot_sources || "").replace(/"/g, "&quot;")}" placeholder="bbc.com, reuters.com">
        </div>
    `;

    briefPinsList.querySelectorAll(".pin-select-btn").forEach(btn => {
        btn.addEventListener("click", e => {
            const id = e.currentTarget.getAttribute("data-pin-id");
            briefPins = briefPins.map(p => ({ ...p, __selected: p.id === id }));
            renderBriefPins();
        });
    });

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
            if (briefPins.length) briefPins[0].__selected = true;
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
        hotspot_summary: pin.hotspot_summary || "",
        hotspot_why_it_matters: pin.hotspot_why_it_matters || "",
        hotspot_indicators: Array.isArray(pin.hotspot_indicators) ? pin.hotspot_indicators.join("\n") : "",
        hotspot_sources: Array.isArray(pin.hotspot_sources) ? pin.hotspot_sources.join(", ") : "",
        created_at: pin.created_at || new Date().toISOString()
    }));
    if (briefPins.length) briefPins[0].__selected = true;

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
            event_id: isUuid(pin.event_id) ? String(pin.event_id).trim() : null,
            hotspot_summary: String(pin.hotspot_summary || "").trim() || null,
            hotspot_why_it_matters: String(pin.hotspot_why_it_matters || "").trim() || null,
            hotspot_indicators: splitMultiline(pin.hotspot_indicators || "", 12),
            hotspot_sources: splitCommaList(pin.hotspot_sources || "", 24)
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
    briefDocType.value = "scheduled";
    briefingTags.value = "";
    briefDocSubtypeSpecial.value = "";
    briefPins = [];
    currentBriefFrameKey = "global";
    didInitBriefPinsView = false;
    briefPinsBaselineHash = "[]";
    renderBriefPins();

    fillSubtypeOptions();
    setEntryKindState(adminMode === "documents" ? "brief_document" : "event_brief", { applyTemplate: false });
    enforceAdminModeConstraints();
    setAutoTimestamp();
    deleteButton.style.display = "none";
    setEditorStatus("");
    syncEditorModeUI();
}

function createIntelListItem(item, table) {
    const timestamp = item.updated_at || item.published_at || item.timestamp || item.created_at;
    const div = document.createElement("div");
    div.className = "intel-item";
    const region = item.region || item.theater || "--";
    const category = item.category || item.type || "--";
    const risk = normalizeRiskLevel(item.risk_level || item.risk || "medium");
    const confidence = normalizeConfidence(item.confidence || "medium");
    const subtype = item.brief_subtype ? String(item.brief_subtype) : "";
    const typeChip = table === BRIEF_DOCUMENTS_TABLE
        ? normalizeBriefType(item.brief_type || "special").toUpperCase()
        : (table === BRIEFING_INTEL_TABLE ? "EVENT BRIEF" : "LIVE");
    const subtypeChip = table === BRIEF_DOCUMENTS_TABLE && subtype
        ? `<span class="field-help" style="margin-left:6px;">${subtype}</span>`
        : "";

    div.innerHTML = `
        <div class="intel-item-main">
            <div class="intel-item-title">${item.title || "Untitled"}</div>
            <div class="intel-item-meta">${timestamp ? new Date(timestamp).toLocaleString() : "--"} • ${region} • ${category}</div>
            <div class="intel-item-meta" style="margin-top:2px;">
                <span>${typeChip}</span>${subtypeChip}
                ${table !== LIVE_INTEL_TABLE ? ` • risk:${risk} • conf:${confidence}` : ""}
            </div>
        </div>
        <div class="intel-item-actions">
            <button class="btn-secondary" data-id="${item.id}">EDIT</button>
        </div>
    `;

    div.querySelector("button").addEventListener("click", async () => loadIntelIntoEditor(item, table));
    return div;
}

function rowMatchesLibraryFilters(item) {
    const search = String(listFilterState.search || "").toLowerCase();
    const region = String(listFilterState.region || "").toLowerCase();
    const category = String(listFilterState.category || "").toLowerCase();

    const title = String(item.title || "").toLowerCase();
    const rowRegion = String(regionKeyByLabel(item.region || item.theater || "") || item.region || item.theater || "").toLowerCase();
    const rowCategory = String(item.category || item.type || "").toLowerCase();

    if (search && !title.includes(search)) return false;
    if (region && rowRegion !== region) return false;
    if (category && rowCategory !== category) return false;
    return true;
}

function parsePublishTargets(raw) {
    if (Array.isArray(raw)) return raw.map(v => String(v || "").trim().toLowerCase()).filter(Boolean);
    const text = String(raw || "").trim().toLowerCase();
    if (!text) return [];
    if (text.startsWith("{") && text.endsWith("}")) {
        return text.slice(1, -1).split(",").map(v => v.replace(/"/g, "").trim().toLowerCase()).filter(Boolean);
    }
    return [text];
}

function isLiveItem(item) {
    const targets = parsePublishTargets(item.publish_to);
    if (!targets.length) return true;
    return targets.includes("live");
}

function isBriefingItem(item) {
    const targets = parsePublishTargets(item.publish_to);
    if (!targets.length) return true;
    return targets.includes("briefing_room");
}

function renderIntelListsFromCache() {
    if (!liveIntelList) return;

    const liveRows = liveRowsCache
        .filter(isLiveItem)
        .filter(rowMatchesLibraryFilters);
    const briefingRows = eventRowsCache
        .filter(isBriefingItem)
        .filter(rowMatchesLibraryFilters);
    const briefDocsRows = docsRowsCache
        .filter(isBriefingItem)
        .filter(rowMatchesLibraryFilters);

    const scheduledRows = briefDocsRows.filter(row => normalizeBriefType(row.brief_type) === "scheduled");
    const regionalRows = briefDocsRows.filter(row => normalizeBriefType(row.brief_type) === "regional");
    const specialRows = briefDocsRows.filter(row => normalizeBriefType(row.brief_type) === "special");

    const eventBriefRows = briefingRows;

    liveIntelList.innerHTML = "";
    if (scheduledBriefDocsList) scheduledBriefDocsList.innerHTML = "";
    if (regionalBriefDocsList) regionalBriefDocsList.innerHTML = "";
    if (specialBriefDocsList) specialBriefDocsList.innerHTML = "";
    if (briefingEventBriefsList) briefingEventBriefsList.innerHTML = "";

    if (adminMode === "events") {
        liveRows.forEach(item => liveIntelList.appendChild(createIntelListItem(item, LIVE_INTEL_TABLE)));
        if (!liveRows.length) liveIntelList.innerHTML = '<div class="field-help">No matching live items.</div>';
        return;
    }

    scheduledRows.forEach(item => scheduledBriefDocsList?.appendChild(createIntelListItem(item, BRIEF_DOCUMENTS_TABLE)));
    regionalRows.forEach(item => regionalBriefDocsList?.appendChild(createIntelListItem(item, BRIEF_DOCUMENTS_TABLE)));
    specialRows.forEach(item => specialBriefDocsList?.appendChild(createIntelListItem(item, BRIEF_DOCUMENTS_TABLE)));
    eventBriefRows.forEach(item => briefingEventBriefsList?.appendChild(createIntelListItem(item, BRIEFING_INTEL_TABLE)));

    if (scheduledBriefDocsList && !scheduledRows.length) scheduledBriefDocsList.innerHTML = '<div class="field-help">No scheduled briefs.</div>';
    if (regionalBriefDocsList && !regionalRows.length) regionalBriefDocsList.innerHTML = '<div class="field-help">No regional briefings.</div>';
    if (specialBriefDocsList && !specialRows.length) specialBriefDocsList.innerHTML = '<div class="field-help">No special briefs.</div>';
    if (briefingEventBriefsList && !eventBriefRows.length) briefingEventBriefsList.innerHTML = '<div class="field-help">No event briefs.</div>';
}

async function loadIntelList() {
    if (adminMode === "events") {
        const liveRows = await fetchTableRows(LIVE_INTEL_TABLE);
        liveRowsCache = liveRows;
        eventRowsCache = [];
        docsRowsCache = [];
    } else {
        const [briefingRows, briefDocsRows] = await Promise.all([
            fetchTableRows(BRIEFING_INTEL_TABLE),
            fetchTableRows(BRIEF_DOCUMENTS_TABLE)
        ]);
        liveRowsCache = [];
        eventRowsCache = briefingRows;
        docsRowsCache = briefDocsRows;
    }
    renderIntelListsFromCache();
}

function getDocumentSubtypeFromUI() {
    if (normalizeBriefType(briefDocType.value) === "special") {
        return briefDocSubtypeSpecial.value.trim();
    }
    return briefDocSubtypeSelect.value;
}

async function loadIntelIntoEditor(item, table) {
    if (table === LIVE_INTEL_TABLE) {
        adminMode = "events";
    } else {
        adminMode = "documents";
    }
    setAdminMode(adminMode);

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
        setEntryKindState("event_brief", { applyTemplate: false });
    } else if (table === BRIEF_DOCUMENTS_TABLE) {
        intelScope.value = "BRIEFING";
        setEntryKindState("brief_document", { applyTemplate: false });
    } else {
        intelScope.value = "BRIEFING";
        setEntryKindState("event_brief", { applyTemplate: false });
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
        currentBriefFrameKey = getSelectedFrameKey();
        didInitBriefPinsView = false;
        applyBriefPinsInitialView();
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
    enforceAdminModeConstraints();
    syncEditorModeUI();
}

function populateAdminRegionFilter() {
    if (!adminListRegionFilter) return;
    const current = adminListRegionFilter.value;
    adminListRegionFilter.innerHTML = '<option value="">All Regions</option>';
    REGION_OPTIONS.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.key;
        option.textContent = opt.label;
        adminListRegionFilter.appendChild(option);
    });
    adminListRegionFilter.value = current || "";
}

function setAdminMode(mode) {
    adminMode = mode === "documents" ? "documents" : "events";
    if (eventsLibraryWrap) eventsLibraryWrap.style.display = adminMode === "events" ? "block" : "none";
    if (documentsLibraryWrap) documentsLibraryWrap.style.display = adminMode === "documents" ? "block" : "none";

    adminModeTabs?.querySelectorAll(".admin-tab").forEach(tab => {
        tab.classList.toggle("active", tab.getAttribute("data-mode") === adminMode);
    });

    if (adminMode === "documents") {
        intelScope.value = "BRIEFING";
        if (!isEditingExistingBriefingItem()) {
            setEntryKindState("brief_document", { applyTemplate: false });
        }
        if (queueTitle) queueTitle.textContent = "BRIEFING ROOM QUEUE";
        if (queueSubtitle) queueSubtitle.textContent = "Publishes to Briefing Room only.";
    } else {
        intelScope.value = "LIVE";
        setEntryKindState("event_brief", { applyTemplate: false });
        if (queueTitle) queueTitle.textContent = "LIVE QUEUE";
        if (queueSubtitle) queueSubtitle.textContent = "Publishes to Live page and Latest Intel.";
    }
    enforceAdminModeConstraints();
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
        publish_to: "live",
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
        publish_to: "briefing_room",
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
    enforceAdminModeConstraints();
    syncEditorModeUI();
});
briefingEntryKind.addEventListener("change", () => {
    if (isEditingExistingBriefingItem()) {
        setEntryKindState(editingTable === BRIEF_DOCUMENTS_TABLE ? "brief_document" : "event_brief", { applyTemplate: false });
        enforceAdminModeConstraints();
        syncEditorModeUI();
        return;
    }
    setEntryKindState(entryKindStateFromUiValue(briefingEntryKind.value), { applyTemplate: true });
    enforceAdminModeConstraints();
    syncEditorModeUI();
});
briefDocType.addEventListener("change", fillSubtypeOptions);
briefDocSubtypeSelect.addEventListener("change", () => {
    didInitBriefPinsView = false;
    applyBriefPinsInitialView(true);
});
briefDocSubtypeSpecial.addEventListener("input", () => {
    didInitBriefPinsView = false;
    applyBriefPinsInitialView(true);
});
intelRegion.addEventListener("change", () => {
    didInitBriefPinsView = false;
    applyBriefPinsInitialView(true);
});

adminModeTabs?.addEventListener("click", e => {
    const button = e.target.closest(".admin-tab");
    if (!button) return;
    const mode = button.getAttribute("data-mode") || "events";
    if (mode === adminMode) return;
    setAdminMode(mode);
    clearForm();
    loadIntelList();
});

adminListSearch?.addEventListener("input", e => {
    listFilterState.search = String(e.target.value || "").trim();
    renderIntelListsFromCache();
});

adminListRegionFilter?.addEventListener("change", e => {
    listFilterState.region = String(e.target.value || "").trim().toLowerCase();
    renderIntelListsFromCache();
});

adminListCategoryFilter?.addEventListener("change", e => {
    listFilterState.category = String(e.target.value || "").trim().toLowerCase();
    renderIntelListsFromCache();
});

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
    populateAdminRegionFilter();
    fillSubtypeOptions();
    enforceAdminModeConstraints();
    syncEditorModeUI();
    setAdminMode("events");
    renderBriefPins();
    await loadIntelList();
}

logoutLink.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
});

checkSessionOnLoad();

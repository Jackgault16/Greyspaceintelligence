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

const publishButton = document.getElementById("publishButton");
const resetFormButton = document.getElementById("resetFormButton");
const deleteButton = document.getElementById("deleteButton");

const citySearch = document.getElementById("citySearch");
const adminEmailInput = document.getElementById("adminEmail");
const adminPasswordInput = document.getElementById("adminPassword");

const intelFields = {
    title: intelTitle,
    summary: intelSummary,
    details: intelDetails,
    region: intelRegion,
    category: intelCategory,
    scope: intelScope,
    timestamp: intelTimestamp,
    sources: intelSources,
    lat: intelLat,
    lng: intelLng,
    briefingRisk,
    briefingPriority,
    briefingZoom,
    briefingPoints
};

let editingIntelId = null;
let editingTable = null;

function getSelectedTable() {
    return intelFields.scope.value === "BRIEFING" ? BRIEFING_INTEL_TABLE : LIVE_INTEL_TABLE;
}

function tableLabel(table) {
    return table === BRIEFING_INTEL_TABLE ? "BRIEFING" : "LIVE";
}

async function fetchTableRows(table) {
    const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("timestamp", { ascending: false });

    if (error) {
        console.error(`Failed to load intel from ${table}:`, error);
        return [];
    }

    return data.map(item => ({ ...item, __table: table }));
}

// ===============================
// AUTO TIMESTAMP
// ===============================
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

function getScopeMode() {
    return intelFields.scope.value === "BRIEFING" ? "BRIEFING" : "LIVE";
}

function syncEditorModeUI() {
    const isBriefing = getScopeMode() === "BRIEFING";
    briefingFields.style.display = isBriefing ? "block" : "none";
    if (editorModeTitle) {
        editorModeTitle.textContent = isBriefing ? "BRIEFING ROOM EDITOR" : "LIVE EDITOR";
    }
    intelSummary.placeholder = isBriefing
        ? "Executive summary for briefing readers"
        : "One or two lines of context";
    intelDetails.placeholder = isBriefing
        ? "Detailed analysis body for briefing room"
        : "Deeper context, implications, sources, etc.";
}

function parsePointsFromText(text) {
    return String(text || "")
        .split(/\r?\n/)
        .map(p => p.trim())
        .filter(Boolean);
}

function parsePointsFromItem(item) {
    if (Array.isArray(item.points)) return item.points;
    if (Array.isArray(item.key_points)) return item.key_points;
    if (typeof item.points === "string") {
        return item.points.split(/\r?\n|;/).map(p => p.trim()).filter(Boolean);
    }
    return [];
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

        // Try shape conversions for stricter briefing_room schemas.
        if (Array.isArray(workingPayload.points)) {
            workingPayload.points = workingPayload.points.join("\n");
            continue;
        }
        if (Array.isArray(workingPayload.coords)) {
            const [lng, lat] = workingPayload.coords;
            workingPayload.coords = `${lng},${lat}`;
            continue;
        }

        const missingColumn = extractMissingColumnName(result.error);
        if (!missingColumn || !(missingColumn in workingPayload)) {
            // Final compatibility fallback: keep only safest common fields.
            const minimalPayload = {
                title: workingPayload.title,
                summary: workingPayload.summary,
                timestamp: workingPayload.timestamp,
                category: workingPayload.category,
                region: workingPayload.region,
                sources: workingPayload.sources
            };

            const finalResult = editingId
                ? await supabase.from(table).update(minimalPayload).eq("id", editingId)
                : await supabase.from(table).insert(minimalPayload);

            return finalResult.error ? result : finalResult;
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

    if (country?.short_code) {
        return country.short_code.toUpperCase();
    }

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

let adminMarker = null;

function placeAdminMarker(lng, lat) {
    if (adminMarker) adminMarker.remove();
    adminMarker = new mapboxgl.Marker({ color: "#f97316" })
        .setLngLat([lng, lat])
        .addTo(adminMap);
}

// ===============================
// MAP CLICK HANDLER
// ===============================
adminMap.on("click", async (e) => {
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

// ===============================
// CITY SEARCH
// ===============================
async function geocodeCity(query) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    return res.json();
}

citySearch.addEventListener("keydown", async (e) => {
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

// ===============================
// CLEAR FORM
// ===============================
function clearForm() {
    editingIntelId = null;
    editingTable = null;

    intelFields.title.value = "";
    intelFields.summary.value = "";
    intelFields.details.value = "";
    intelFields.region.value = "";
    intelFields.category.value = "";
    intelFields.sources.value = "";
    intelFields.lat.value = "";
    intelFields.lng.value = "";
    intelFields.briefingRisk.value = "med";
    intelFields.briefingPriority.value = "medium";
    intelFields.briefingZoom.value = "5";
    intelFields.briefingPoints.value = "";

    setAutoTimestamp();
    deleteButton.style.display = "none";
    setEditorStatus("");
    syncEditorModeUI();
}

resetFormButton.addEventListener("click", clearForm);
intelScope.addEventListener("change", () => {
    clearForm();
    syncEditorModeUI();
});

// ===============================
// LOAD EXISTING INTEL
// ===============================
function createIntelListItem(item) {
    const table = item.__table || getSelectedTable();
    const div = document.createElement("div");
    div.className = "intel-item";

    div.innerHTML = `
        <div class="intel-item-main">
            <div class="intel-item-title">${item.title}</div>
            <div class="intel-item-meta">${new Date(item.timestamp).toLocaleString()} • ${tableLabel(table)}</div>
        </div>
        <div class="intel-item-actions">
            <button class="btn-secondary" data-id="${item.id}">EDIT</button>
        </div>
    `;

    div.querySelector("button").addEventListener("click", () => loadIntelIntoEditor(item, table));
    return div;
}

async function loadIntelList() {
    const [liveRows, briefingRows] = await Promise.all([
        fetchTableRows(LIVE_INTEL_TABLE),
        fetchTableRows(BRIEFING_INTEL_TABLE)
    ]);

    liveIntelList.innerHTML = "";
    briefingIntelList.innerHTML = "";

    liveRows.forEach(item => liveIntelList.appendChild(createIntelListItem(item)));
    briefingRows.forEach(item => briefingIntelList.appendChild(createIntelListItem(item)));
}

// ===============================
// LOAD INTEL INTO EDITOR
// ===============================
function loadIntelIntoEditor(item, table) {
    editingIntelId = item.id;
    editingTable = table;

    intelFields.title.value = item.title;
    intelFields.summary.value = item.summary || item.executive_summary || "";
    intelFields.details.value = item.details || item.analysis || "";
    intelFields.region.value = item.region || item.theater || "";
    intelFields.category.value = item.category || item.type || "";
    const ts = item.timestamp ? String(item.timestamp).slice(0, 16) : "";
    intelFields.timestamp.value = ts;
    intelFields.sources.value = item.sources || "";
    const coords = Array.isArray(item.coords) ? item.coords : null;
    const lat = item.lat != null ? item.lat : (coords ? coords[1] : "");
    const lng = item.lng != null ? item.lng : (item.long != null ? item.long : (coords ? coords[0] : ""));
    intelFields.lat.value = lat;
    intelFields.lng.value = lng;
    intelFields.scope.value = table === BRIEFING_INTEL_TABLE ? "BRIEFING" : "LIVE";
    intelFields.briefingRisk.value = item.risk || "med";
    intelFields.briefingPriority.value = item.priority || "medium";
    intelFields.briefingZoom.value = item.zoom || item.map_zoom || 5;
    intelFields.briefingPoints.value = parsePointsFromItem(item).join("\n");

    if (lng !== "" && lat !== "") {
        placeAdminMarker(Number(lng), Number(lat));
    }
    deleteButton.style.display = "inline-block";
    syncEditorModeUI();
}

function buildLivePayload() {
    return {
        title: intelFields.title.value.trim(),
        summary: intelFields.summary.value.trim(),
        details: intelFields.details.value.trim(),
        region: intelFields.region.value.trim(),
        category: intelFields.category.value,
        timestamp: new Date(intelFields.timestamp.value).toISOString(),
        sources: intelFields.sources.value.trim(),
        lat: parseFloat(intelFields.lat.value),
        lng: parseFloat(intelFields.lng.value)
    };
}

function buildBriefingPayload() {
    const lat = parseFloat(intelFields.lat.value);
    const lng = parseFloat(intelFields.lng.value);
    const points = parsePointsFromText(intelFields.briefingPoints.value);
    const detailsText = intelFields.details.value.trim();

    return {
        title: intelFields.title.value.trim(),
        summary: intelFields.summary.value.trim(),
        details: detailsText,
        analysis: detailsText,
        region: intelFields.region.value.trim(),
        category: intelFields.category.value,
        timestamp: new Date(intelFields.timestamp.value).toISOString(),
        risk: intelFields.briefingRisk.value || "med",
        priority: intelFields.briefingPriority.value || "medium",
        points,
        sources: intelFields.sources.value.trim(),
        lat,
        lng,
        coords: Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null,
        zoom: parseFloat(intelFields.briefingZoom.value) || 5
    };
}

// ===============================
// PUBLISH / UPDATE
// ===============================
publishButton.addEventListener("click", async () => {
    const table = editingTable || getSelectedTable();
    const isBriefing = table === BRIEFING_INTEL_TABLE;
    const payload = isBriefing ? buildBriefingPayload() : buildLivePayload();

    if (!payload.title || !payload.summary) {
        setEditorStatus("Missing required fields.");
        return;
    }

    if (!isBriefing && !payload.details) {
        setEditorStatus("Missing required fields.");
        return;
    }

    if (isBriefing) {
        const latValid = Number.isFinite(payload.lat);
        const lngValid = Number.isFinite(payload.lng);
        if (!payload.details || !latValid || !lngValid) {
            setEditorStatus("Briefing requires details + latitude + longitude.");
            return;
        }
    }

    const result = await saveWithColumnFallback(table, payload, editingIntelId);

    if (result.error) {
        setEditorStatus(`Error saving intel: ${getErrorText(result.error) || "Unknown error"}`);
        console.error(result.error);
        return;
    }

    setEditorStatus("Saved.");
    clearForm();
    loadIntelList();
});

// ===============================
// DELETE
// ===============================
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
    loadIntelList();
});

// ===============================
// AUTH: LOGIN
// ===============================
loginButton.addEventListener("click", async () => {
    loginError.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "SIGNING IN…";

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

// ===============================
// AUTH: SESSION CHECK
// ===============================
async function checkSessionOnLoad() {
    const { data } = await supabase.auth.getSession();
    if (data.session) showAdminView(data.session.user);
}

function showAdminView(user) {
    loginView.style.display = "none";
    adminView.style.display = "block";
    adminEmailDisplay.textContent = user.email;
    setAutoTimestamp();
    syncEditorModeUI();
    loadIntelList();
}

// ===============================
// AUTH: LOGOUT
// ===============================
logoutLink.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
});

// ===============================
// INIT
// ===============================
checkSessionOnLoad();

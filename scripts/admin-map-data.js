const loginWrap = document.getElementById("mapAdminLogin");
const appWrap = document.getElementById("mapAdminApp");
const loginBtn = document.getElementById("mapAdminLoginBtn");
const loginStatus = document.getElementById("mapAdminLoginStatus");
const emailInput = document.getElementById("mapAdminEmail");
const pwInput = document.getElementById("mapAdminPassword");
const userLabel = document.getElementById("mapAdminUser");
const logoutBtn = document.getElementById("mapAdminLogout");
const tabs = document.getElementById("mapAdminTabs");
const countriesEditor = document.getElementById("countriesEditor");
const profilesEditor = document.getElementById("profilesEditor");
const statusEl = document.getElementById("mapAdminStatus");

const countrySearch = document.getElementById("countrySearch");
const countryList = document.getElementById("countryList");
const countryIso2 = document.getElementById("countryIso2");
const countryIso3 = document.getElementById("countryIso3");
const countryName = document.getElementById("countryName");
const countryRegion = document.getElementById("countryRegion");
const countryCapital = document.getElementById("countryCapital");
const countryCentroid = document.getElementById("countryCentroid");
const countryBbox = document.getElementById("countryBbox");
const saveCountryBtn = document.getElementById("saveCountryBtn");

const profileIso2 = document.getElementById("profileIso2");
const profileCategory = document.getElementById("profileCategory");
const profileMetrics = document.getElementById("profileMetrics");
const profileNarrativeEdit = document.getElementById("profileNarrativeEdit");
const profileSourcesEdit = document.getElementById("profileSourcesEdit");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const poiMapEl = document.getElementById("poiMap");
const poiListEl = document.getElementById("poiList");
const poiType = document.getElementById("poiType");
const poiName = document.getElementById("poiName");
const poiLat = document.getElementById("poiLat");
const poiLng = document.getElementById("poiLng");
const poiConfidence = document.getElementById("poiConfidence");
const poiNotes = document.getElementById("poiNotes");
const poiSources = document.getElementById("poiSources");
const savePoiBtn = document.getElementById("savePoiBtn");
const newPoiBtn = document.getElementById("newPoiBtn");
const deletePoiBtn = document.getElementById("deletePoiBtn");

let activeTab = "countries";
let countries = [];
let selectedCountryIso2 = "";
let selectedPoiId = "";
let pois = [];
let poiMap = null;
let poiMarker = null;

bootstrap();

async function bootstrap() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
        showApp(data.session.user);
    }
}

loginBtn?.addEventListener("click", async () => {
    loginStatus.textContent = "";
    const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: pwInput.value.trim()
    });
    if (error) {
        loginStatus.textContent = "Login failed.";
        return;
    }
    showApp(data.user);
});

logoutBtn?.addEventListener("click", async e => {
    e.preventDefault();
    await supabase.auth.signOut();
    location.reload();
});

tabs?.addEventListener("click", e => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    activeTab = btn.getAttribute("data-tab");
    tabs.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
    countriesEditor.style.display = activeTab === "countries" ? "block" : "none";
    profilesEditor.style.display = activeTab === "profiles" ? "block" : "none";
    if (activeTab === "profiles") {
        initPoiMap();
        loadProfileAndPois();
    }
});

countrySearch?.addEventListener("input", renderCountryList);
saveCountryBtn?.addEventListener("click", saveCountry);
saveProfileBtn?.addEventListener("click", saveProfile);
savePoiBtn?.addEventListener("click", savePoi);
newPoiBtn?.addEventListener("click", () => {
    selectedPoiId = "";
    poiType.value = "";
    poiName.value = "";
    poiLat.value = "";
    poiLng.value = "";
    poiConfidence.value = "medium";
    poiNotes.value = "";
    poiSources.value = "";
    if (poiMarker) poiMarker.remove();
});
deletePoiBtn?.addEventListener("click", deletePoi);
profileIso2?.addEventListener("change", loadProfileAndPois);
profileCategory?.addEventListener("change", loadProfileAndPois);

async function showApp(user) {
    loginWrap.style.display = "none";
    appWrap.style.display = "block";
    userLabel.textContent = user.email || "";
    await loadCountries();
}

async function loadCountries() {
    const { data, error } = await supabase
        .from("countries")
        .select("*")
        .order("name", { ascending: true });
    if (error) {
        statusEl.textContent = `Error loading countries: ${error.message}`;
        return;
    }
    countries = data || [];
    renderCountryList();
}

function renderCountryList() {
    const q = (countrySearch.value || "").trim().toLowerCase();
    const rows = countries.filter(c => {
        const s = `${c.name || ""} ${c.iso2 || ""} ${c.iso3 || ""}`.toLowerCase();
        return !q || s.includes(q);
    });
    countryList.innerHTML = rows.map(c => `
        <div class="list-item ${selectedCountryIso2 === c.iso2 ? "active" : ""}" data-iso2="${c.iso2}">
            <div>${escapeHtml(c.name || c.iso2)}</div>
            <div class="note">${escapeHtml(c.iso2 || "")} • ${escapeHtml(c.region || "--")}</div>
        </div>
    `).join("");
    countryList.querySelectorAll(".list-item").forEach(node => {
        node.addEventListener("click", () => {
            const iso2 = node.getAttribute("data-iso2");
            selectCountry(iso2);
        });
    });
}

function selectCountry(iso2) {
    const row = countries.find(c => c.iso2 === iso2);
    if (!row) return;
    selectedCountryIso2 = iso2;
    countryIso2.value = row.iso2 || "";
    countryIso3.value = row.iso3 || "";
    countryName.value = row.name || "";
    countryRegion.value = row.region || "";
    countryCapital.value = row.capital || "";
    countryCentroid.value = arrToInput(row.centroid);
    countryBbox.value = arrToInput(row.bbox);
    profileIso2.value = row.iso2 || "";
    renderCountryList();
    if (activeTab === "profiles") loadProfileAndPois();
}

async function saveCountry() {
    const payload = {
        iso2: countryIso2.value.trim().toUpperCase(),
        iso3: countryIso3.value.trim().toUpperCase() || null,
        name: countryName.value.trim() || null,
        region: countryRegion.value.trim() || null,
        capital: countryCapital.value.trim() || null,
        centroid: parseNumberArray(countryCentroid.value, 2),
        bbox: parseNumberArray(countryBbox.value, 4)
    };
    const { error } = await supabase.from("countries").upsert(payload, { onConflict: "iso2" });
    if (error) {
        statusEl.textContent = `Save failed: ${error.message}`;
        return;
    }
    statusEl.textContent = "Country saved.";
    await loadCountries();
    selectCountry(payload.iso2);
}

async function loadProfileAndPois() {
    const iso2 = profileIso2.value.trim().toUpperCase();
    const category = profileCategory.value;
    if (!iso2 || !category) return;

    const [{ data: profile }, { data: poiRows }] = await Promise.all([
        supabase.from("country_profiles").select("*").eq("iso2", iso2).eq("category", category).maybeSingle(),
        supabase.from("country_pois").select("*").eq("iso2", iso2).eq("category", category).order("created_at", { ascending: false })
    ]);

    profileMetrics.value = profile?.metrics ? JSON.stringify(profile.metrics, null, 2) : "{}";
    profileNarrativeEdit.value = profile?.narrative || "";
    profileSourcesEdit.value = Array.isArray(profile?.sources) ? profile.sources.join(", ") : (profile?.sources || "");
    pois = poiRows || [];
    renderPoiList();
    redrawPoiMap();
}

async function saveProfile() {
    const iso2 = profileIso2.value.trim().toUpperCase();
    const category = profileCategory.value;
    if (!iso2 || !category) return;
    let metrics;
    try {
        metrics = JSON.parse(profileMetrics.value || "{}");
    } catch (_) {
        statusEl.textContent = "Metrics must be valid JSON.";
        return;
    }
    const payload = {
        iso2,
        category,
        metrics,
        narrative: profileNarrativeEdit.value.trim() || null,
        sources: csvToArray(profileSourcesEdit.value)
    };
    const { error } = await supabase.from("country_profiles").upsert(payload, { onConflict: "iso2,category" });
    statusEl.textContent = error ? `Save failed: ${error.message}` : "Profile saved.";
}

function initPoiMap() {
    if (poiMap || !poiMapEl) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    poiMap = new mapboxgl.Map({
        container: "poiMap",
        style: "mapbox://styles/mapbox/dark-v11",
        center: [0, 20],
        zoom: 1.6
    });
    poiMap.on("click", e => {
        poiLat.value = e.lngLat.lat.toFixed(6);
        poiLng.value = e.lngLat.lng.toFixed(6);
        if (poiMarker) poiMarker.remove();
        poiMarker = new mapboxgl.Marker({ color: "#f97316" }).setLngLat([e.lngLat.lng, e.lngLat.lat]).addTo(poiMap);
    });
}

function redrawPoiMap() {
    if (!poiMap) return;
    if (poiMap.getSource("admin-pois")) {
        poiMap.getSource("admin-pois").setData({
            type: "FeatureCollection",
            features: pois.map(toPoiFeature)
        });
        return;
    }
    poiMap.addSource("admin-pois", {
        type: "geojson",
        data: { type: "FeatureCollection", features: pois.map(toPoiFeature) }
    });
    poiMap.addLayer({
        id: "admin-pois-layer",
        type: "circle",
        source: "admin-pois",
        paint: { "circle-color": "#62a5ff", "circle-radius": 5 }
    });
}

function renderPoiList() {
    poiListEl.innerHTML = pois.map(p => `
        <div class="list-item ${selectedPoiId === p.id ? "active" : ""}" data-id="${p.id}">
            <div>${escapeHtml(p.name || "POI")}</div>
            <div class="note">${escapeHtml(p.poi_type || "--")} • ${escapeHtml(p.confidence || "medium")}</div>
        </div>
    `).join("");
    poiListEl.querySelectorAll(".list-item").forEach(node => {
        node.addEventListener("click", () => {
            const id = node.getAttribute("data-id");
            const p = pois.find(x => x.id === id);
            if (!p) return;
            selectedPoiId = id;
            poiType.value = p.poi_type || "";
            poiName.value = p.name || "";
            poiLat.value = p.latitude ?? "";
            poiLng.value = p.longitude ?? "";
            poiConfidence.value = p.confidence || "medium";
            poiNotes.value = p.notes || "";
            poiSources.value = Array.isArray(p.sources) ? p.sources.join(", ") : "";
            if (poiMarker) poiMarker.remove();
            if (Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))) {
                poiMarker = new mapboxgl.Marker({ color: "#22c55e" }).setLngLat([Number(p.longitude), Number(p.latitude)]).addTo(poiMap);
                poiMap.easeTo({ center: [Number(p.longitude), Number(p.latitude)], zoom: Math.max(poiMap.getZoom(), 4.3) });
            }
            renderPoiList();
        });
    });
}

async function savePoi() {
    const iso2 = profileIso2.value.trim().toUpperCase();
    const category = profileCategory.value;
    const payload = {
        id: selectedPoiId || (window.crypto?.randomUUID ? window.crypto.randomUUID() : undefined),
        iso2,
        category,
        poi_type: poiType.value.trim() || null,
        name: poiName.value.trim() || null,
        latitude: Number(poiLat.value),
        longitude: Number(poiLng.value),
        confidence: poiConfidence.value,
        notes: poiNotes.value.trim() || null,
        sources: csvToArray(poiSources.value)
    };
    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
        statusEl.textContent = "POI latitude/longitude required.";
        return;
    }
    const { error } = await supabase.from("country_pois").upsert(payload, { onConflict: "id" });
    statusEl.textContent = error ? `Save POI failed: ${error.message}` : "POI saved.";
    if (!error) {
        selectedPoiId = payload.id || selectedPoiId;
        await loadProfileAndPois();
    }
}

async function deletePoi() {
    if (!selectedPoiId) return;
    const { error } = await supabase.from("country_pois").delete().eq("id", selectedPoiId);
    statusEl.textContent = error ? `Delete failed: ${error.message}` : "POI deleted.";
    if (!error) {
        selectedPoiId = "";
        await loadProfileAndPois();
    }
}

function toPoiFeature(row) {
    return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [Number(row.longitude), Number(row.latitude)] },
        properties: { id: row.id, name: row.name || "" }
    };
}

function parseNumberArray(input, minCount) {
    const nums = String(input || "").split(/[, ]+/).map(Number).filter(Number.isFinite);
    return nums.length >= minCount ? nums.slice(0, minCount) : null;
}

function arrToInput(raw) {
    if (Array.isArray(raw)) return raw.join(", ");
    if (typeof raw === "string") return raw;
    return "";
}

function csvToArray(raw) {
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

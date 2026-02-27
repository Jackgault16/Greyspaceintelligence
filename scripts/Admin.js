// ===============================
// GLOBAL ELEMENTS
// ===============================
const loginView = document.getElementById("loginView");
const adminView = document.getElementById("adminView");

const adminEmailDisplay = document.getElementById("adminUserEmail");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");
const logoutLink = document.getElementById("logoutLink");

const intelList = document.getElementById("intelList");
const listTitle = document.getElementById("listTitle");

// LIVE INTEL EDITOR ELEMENTS
const editorStatus = document.getElementById("editorStatus");
const intelTitle = document.getElementById("intelTitle");
const intelSummary = document.getElementById("intelSummary");
const intelDetails = document.getElementById("intelDetails");
const intelRegion = document.getElementById("intelRegion");
const intelCategory = document.getElementById("intelCategory");
const intelTimestamp = document.getElementById("intelTimestamp");
const intelSources = document.getElementById("intelSources");
const intelLat = document.getElementById("intelLat");
const intelLng = document.getElementById("intelLng");
const publishButton = document.getElementById("publishButton");
const resetFormButton = document.getElementById("resetFormButton");
const deleteButton = document.getElementById("deleteButton");
const citySearch = document.getElementById("citySearch");

// BRIEFING EDITOR ELEMENTS
const brTitle = document.getElementById("br-title");
const brCategory = document.getElementById("br-category");
const brRegion = document.getElementById("br-region");
const brRisk = document.getElementById("br-risk");
const brPriority = document.getElementById("br-priority");
const brSummary = document.getElementById("br-summary");
const brPoints = document.getElementById("br-points");
const brAnalysis = document.getElementById("br-analysis");
const brLng = document.getElementById("br-lng");
const brLat = document.getElementById("br-lat");
const brZoom = document.getElementById("br-zoom");
const brPublish = document.getElementById("br-publish");
const brReset = document.getElementById("br-reset");
const brDelete = document.getElementById("br-delete");
const brStatus = document.getElementById("br-status");
const brCitySearch = document.getElementById("br-city-search");

// MODE SWITCH
const modeLive = document.getElementById("modeLive");
const modeBriefings = document.getElementById("modeBriefings");
const liveEditor = document.getElementById("liveEditor");
const briefingEditor = document.getElementById("briefingEditor");

let editingIntelId = null;
let editingBriefingId = null;
let currentMode = "live"; // "live" | "briefings"

// ===============================
// AUTO TIMESTAMP (LIVE INTEL)
// ===============================
function setAutoTimestamp() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  intelTimestamp.value = local;
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

const brMap = new mapboxgl.Map({
  container: "br-map",
  style: "mapbox://styles/mapbox/dark-v11",
  center: [0, 20],
  zoom: 1.6
});

let adminMarker = null;
let brMarker = null;

function placeAdminMarker(lng, lat) {
  if (adminMarker) adminMarker.remove();
  adminMarker = new mapboxgl.Marker({ color: "#f97316" })
    .setLngLat([lng, lat])
    .addTo(adminMap);
}

function placeBrMarker(lng, lat) {
  if (brMarker) brMarker.remove();
  brMarker = new mapboxgl.Marker({ color: "#ff3b3b" })
    .setLngLat([lng, lat])
    .addTo(brMap);
}

// ===============================
// REGION DETECTION FROM COORDS
// ===============================
async function detectRegionFromCoords(lng, lat) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country&access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json.features || json.features.length === 0) return null;

    const country = json.features[0].text;

    const regionMap = {
      // NORTH AMERICA
      "United States": "North America",
      "Canada": "North America",
      "Mexico": "North America",
      "Greenland": "North America",

      // SOUTH AMERICA
      "Brazil": "South America",
      "Argentina": "South America",
      "Chile": "South America",
      "Colombia": "South America",
      "Peru": "South America",
      "Venezuela": "South America",
      "Ecuador": "South America",
      "Bolivia": "South America",
      "Paraguay": "South America",
      "Uruguay": "South America",
      "Guyana": "South America",
      "Suriname": "South America",

      // EUROPE
      "United Kingdom": "Europe",
      "Ireland": "Europe",
      "France": "Europe",
      "Germany": "Europe",
      "Spain": "Europe",
      "Portugal": "Europe",
      "Italy": "Europe",
      "Poland": "Europe",
      "Netherlands": "Europe",
      "Belgium": "Europe",
      "Luxembourg": "Europe",
      "Switzerland": "Europe",
      "Austria": "Europe",
      "Czechia": "Europe",
      "Slovakia": "Europe",
      "Hungary": "Europe",
      "Romania": "Europe",
      "Bulgaria": "Europe",
      "Greece": "Europe",
      "Croatia": "Europe",
      "Slovenia": "Europe",
      "Serbia": "Europe",
      "Bosnia and Herzegovina": "Europe",
      "Montenegro": "Europe",
      "North Macedonia": "Europe",
      "Albania": "Europe",
      "Kosovo": "Europe",
      "Sweden": "Europe",
      "Norway": "Europe",
      "Finland": "Europe",
      "Denmark": "Europe",
      "Estonia": "Europe",
      "Latvia": "Europe",
      "Lithuania": "Europe",
      "Ukraine": "Europe",
      "Belarus": "Europe",
      "Moldova": "Europe",
      "Russia": "Europe",

      // MIDDLE EAST
      "Turkey": "Middle East",
      "Israel": "Middle East",
      "Saudi Arabia": "Middle East",
      "Iraq": "Middle East",
      "Iran": "Middle East",
      "Syria": "Middle East",
      "Jordan": "Middle East",
      "Lebanon": "Middle East",
      "Qatar": "Middle East",
      "United Arab Emirates": "Middle East",
      "Kuwait": "Middle East",
      "Bahrain": "Middle East",
      "Oman": "Middle East",
      "Yemen": "Middle East",

      // AFRICA
      "Egypt": "Africa",
      "Libya": "Africa",
      "Tunisia": "Africa",
      "Algeria": "Africa",
      "Morocco": "Africa",
      "Nigeria": "Africa",
      "Ghana": "Africa",
      "Kenya": "Africa",
      "Ethiopia": "Africa",
      "Somalia": "Africa",
      "South Africa": "Africa",
      "Namibia": "Africa",
      "Botswana": "Africa",
      "Zimbabwe": "Africa",
      "Zambia": "Africa",
      "Uganda": "Africa",
      "Tanzania": "Africa",
      "Sudan": "Africa",
      "South Sudan": "Africa",
      "Chad": "Africa",
      "Niger": "Africa",
      "Mali": "Africa",
      "Senegal": "Africa",
      "Angola": "Africa",
      "Mozambique": "Africa",

      // CENTRAL ASIA
      "Kazakhstan": "Central Asia",
      "Uzbekistan": "Central Asia",
      "Turkmenistan": "Central Asia",
      "Kyrgyzstan": "Central Asia",
      "Tajikistan": "Central Asia",

      // EAST ASIA
      "China": "East Asia",
      "Japan": "East Asia",
      "South Korea": "East Asia",
      "North Korea": "East Asia",
      "Mongolia": "East Asia",

      // SOUTH ASIA
      "India": "South Asia",
      "Pakistan": "South Asia",
      "Bangladesh": "South Asia",
      "Nepal": "South Asia",
      "Bhutan": "South Asia",
      "Sri Lanka": "South Asia",
      "Maldives": "South Asia",

      // SOUTHEAST ASIA
      "Thailand": "Southeast Asia",
      "Vietnam": "Southeast Asia",
      "Indonesia": "Southeast Asia",
      "Malaysia": "Southeast Asia",
      "Singapore": "Southeast Asia",
      "Philippines": "Southeast Asia",
      "Myanmar": "Southeast Asia",
      "Cambodia": "Southeast Asia",
      "Laos": "Southeast Asia",
      "Brunei": "Southeast Asia",
      "Timor-Leste": "Southeast Asia",

      // OCEANIA
      "Australia": "Oceania",
      "New Zealand": "Oceania",
      "Papua New Guinea": "Oceania",
      "Fiji": "Oceania",
      "Samoa": "Oceania",
      "Tonga": "Oceania",
      "Vanuatu": "Oceania",

      // DEFAULT
      "Antarctica": "Global / Multi-Region"
    };

    return regionMap[country] || "Global / Multi-Region";
  } catch (err) {
    console.error("Region detection failed:", err);
    return null;
  }
}

// ===============================
// MAP CLICK HANDLERS
// ===============================
adminMap.on("click", async (e) => {
  const { lng, lat } = e.lngLat;

  intelLat.value = lat.toFixed(6);
  intelLng.value = lng.toFixed(6);

  placeAdminMarker(lng, lat);

  const detected = await detectRegionFromCoords(lng, lat);
  if (detected) intelRegion.value = detected;
});

brMap.on("click", async (e) => {
  const { lng, lat } = e.lngLat;

  brLat.value = lat.toFixed(6);
  brLng.value = lng.toFixed(6);

  placeBrMarker(lng, lat);

  const detected = await detectRegionFromCoords(lng, lat);
  if (detected) brRegion.value = detected;
});

// ===============================
// CITY SEARCH (LIVE)
// ===============================
citySearch.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  const query = citySearch.value.trim();
  if (!query) return;

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json.features || json.features.length === 0) return;

    const place = json.features[0];
    const [lng, lat] = place.center;

    intelLat.value = lat.toFixed(6);
    intelLng.value = lng.toFixed(6);

    placeAdminMarker(lng, lat);
    adminMap.flyTo({ center: [lng, lat], zoom: 5 });

    const detected = await detectRegionFromCoords(lng, lat);
    if (detected) intelRegion.value = detected;
  } catch (err) {
    console.error("City search failed:", err);
  }
});

// ===============================
// CITY SEARCH (BRIEFING)
// ===============================
brCitySearch.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  const query = brCitySearch.value.trim();
  if (!query) return;

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    const json = await res.json();

    if (!json.features || json.features.length === 0) return;

    const place = json.features[0];
    const [lng, lat] = place.center;

    brLat.value = lat.toFixed(6);
    brLng.value = lng.toFixed(6);

    placeBrMarker(lng, lat);
    brMap.flyTo({ center: [lng, lat], zoom: 5 });

    const detected = await detectRegionFromCoords(lng, lat);
    if (detected) brRegion.value = detected;
  } catch (err) {
    console.error("Briefing city search failed:", err);
  }
});

// ===============================
// CLEAR FORMS
// ===============================
function clearLiveForm() {
  editingIntelId = null;

  intelTitle.value = "";
  intelSummary.value = "";
  intelDetails.value = "";
  intelRegion.value = "";
  intelCategory.value = "";
  intelSources.value = "";
  intelLat.value = "";
  intelLng.value = "";

  setAutoTimestamp();

  deleteButton.style.display = "none";
  editorStatus.textContent = "";
}

function clearBriefingForm() {
  editingBriefingId = null;

  brTitle.value = "";
  brCategory.value = "military";
  brRegion.value = "Europe";
  brRisk.value = "high";
  brPriority.value = "high";
  brSummary.value = "";
  brPoints.value = "";
  brAnalysis.value = "";
  brLng.value = "";
  brLat.value = "";
  brZoom.value = "5";

  brDelete.style.display = "none";
  brStatus.textContent = "";
}

resetFormButton.addEventListener("click", clearLiveForm);
brReset.addEventListener("click", clearBriefingForm);

// ===============================
// LOAD EXISTING LIVE INTEL
// ===============================
async function loadIntelList() {
  const { data, error } = await supabase
    .from("live_intel")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("Failed to load intel:", error);
    return;
  }

  intelList.innerHTML = "";

  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "intel-item";

    div.innerHTML = `
      <div class="intel-item-main">
        <div class="intel-item-title">${item.title}</div>
        <div class="intel-item-meta">${new Date(item.timestamp).toLocaleString()}</div>
      </div>
      <div class="intel-item-actions">
        <button class="btn-secondary" data-id="${item.id}">EDIT</button>
      </div>
    `;

    div.querySelector("button").addEventListener("click", () =>
      loadIntelIntoEditor(item)
    );
    intelList.appendChild(div);
  });
}

// ===============================
// LOAD EXISTING BRIEFINGS
// ===============================
async function loadBriefingList() {
  const { data, error } = await supabase
    .from("briefing_room")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("Failed to load briefings:", error);
    return;
  }

  intelList.innerHTML = "";

  data.forEach((item) => {
    const ts = item.timestamp
      ? new Date(item.timestamp).toLocaleString()
      : "";

    const div = document.createElement("div");
    div.className = "intel-item";

    div.innerHTML = `
      <div class="intel-item-main">
        <div class="intel-item-title">${item.title}</div>
        <div class="intel-item-meta">${ts}</div>
      </div>
      <div class="intel-item-actions">
        <button class="btn-secondary" data-id="${item.id}">EDIT</button>
      </div>
    `;

    div.querySelector("button").addEventListener("click", () =>
      loadBriefingIntoEditor(item)
    );
    intelList.appendChild(div);
  });
}

// ===============================
// LOAD LIVE INTEL INTO EDITOR
// ===============================
function loadIntelIntoEditor(item) {
  currentMode = "live";
  setModeUI();

  editingIntelId = item.id;

  intelTitle.value = item.title || "";
  intelSummary.value = item.summary || "";
  intelDetails.value = item.details || "";
  intelRegion.value = item.region || "";
  intelCategory.value = item.category || "";
  intelTimestamp.value = item.timestamp
    ? item.timestamp.slice(0, 16)
    : "";
  intelSources.value = item.sources || "";
  intelLat.value = item.lat ?? "";
  intelLng.value = item.lng ?? "";

  if (item.lng != null && item.lat != null) {
    placeAdminMarker(item.lng, item.lat);
    adminMap.flyTo({ center: [item.lng, item.lat], zoom: 4 });
  }

  deleteButton.style.display = "inline-block";
  editorStatus.textContent = "";
}

// ===============================
// LOAD BRIEFING INTO EDITOR
// ===============================
function loadBriefingIntoEditor(item) {
  currentMode = "briefings";
  setModeUI();

  editingBriefingId = item.id;

  brTitle.value = item.title || "";
  brCategory.value = item.category || "military";
  brRegion.value = item.region || "Europe";
  brRisk.value = item.risk || "high";
  brPriority.value = item.priority || "high";
  brSummary.value = item.summary || "";
  brAnalysis.value = item.analysis || "";

  if (Array.isArray(item.points)) {
    brPoints.value = item.points.join("\n");
  } else {
    brPoints.value = "";
  }

  if (Array.isArray(item.coords) && item.coords.length === 2) {
    const [lng, lat] = item.coords;
    brLng.value = lng;
    brLat.value = lat;
    placeBrMarker(lng, lat);
    brMap.flyTo({ center: [lng, lat], zoom: item.zoom || 5 });
  } else {
    brLng.value = "";
    brLat.value = "";
  }

  brZoom.value = item.zoom || 5;

  brDelete.style.display = "inline-block";
  brStatus.textContent = "";
}

// ===============================
// PUBLISH / UPDATE LIVE INTEL
// ===============================
publishButton.addEventListener("click", async () => {
  const payload = {
    title: intelTitle.value.trim(),
    summary: intelSummary.value.trim(),
    details: intelDetails.value.trim(),
    region: intelRegion.value.trim(),
    category: intelCategory.value,
    timestamp: new Date(intelTimestamp.value).toISOString(),
    sources: intelSources.value.trim(),
    lat: intelLat.value ? parseFloat(intelLat.value) : null,
    lng: intelLng.value ? parseFloat(intelLng.value) : null
  };

  if (!payload.title || !payload.summary || !payload.details) {
    editorStatus.textContent = "Missing required fields.";
    return;
  }

  let result;
  if (editingIntelId) {
    result = await supabase
      .from("live_intel")
      .update(payload)
      .eq("id", editingIntelId);
  } else {
    result = await supabase.from("live_intel").insert(payload);
  }

  if (result.error) {
    editorStatus.textContent = "Error saving intel.";
    console.error(result.error);
    return;
  }

  editorStatus.textContent = "Saved.";
  clearLiveForm();
  loadIntelList();
});

// ===============================
// DELETE LIVE INTEL
// ===============================
deleteButton.addEventListener("click", async () => {
  if (!editingIntelId) return;

  const { error } = await supabase
    .from("live_intel")
    .delete()
    .eq("id", editingIntelId);

  if (error) {
    editorStatus.textContent = "Delete failed.";
    console.error(error);
    return;
  }

  editorStatus.textContent = "Deleted.";
  clearLiveForm();
  loadIntelList();
});

// ===============================
// PUBLISH / UPDATE BRIEFING
// ===============================
brPublish.addEventListener("click", async () => {
  const title = brTitle.value.trim();
  const category = brCategory.value;
  const region = brRegion.value;
  const risk = brRisk.value;
  const priority = brPriority.value;
  const summary = brSummary.value.trim();
  const analysis = brAnalysis.value.trim();

  const points = brPoints.value
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const lng = brLng.value ? parseFloat(brLng.value) : null;
  const lat = brLat.value ? parseFloat(brLat.value) : null;
  const zoom = brZoom.value ? parseInt(brZoom.value, 10) : 5;

  if (!title || !summary) {
    brStatus.textContent = "Title and summary are required.";
    return;
  }

  const payload = {
    title,
    category,
    region,
    risk,
    priority,
    summary,
    analysis,
    points,
    coords: lng != null && lat != null ? [lng, lat] : null,
    zoom,
    timestamp: new Date().toISOString()
  };

  let result;
  if (editingBriefingId) {
    result = await supabase
      .from("briefing_room")
      .update(payload)
      .eq("id", editingBriefingId);
  } else {
    result = await supabase.from("briefing_room").insert(payload);
  }

  if (result.error) {
    brStatus.textContent = "Error saving briefing.";
    console.error(result.error);
    return;
  }

  brStatus.textContent = "Saved.";
  clearBriefingForm();
  loadBriefingList();
});

// ===============================
// DELETE BRIEFING
// ===============================
brDelete.addEventListener("click", async () => {
  if (!editingBriefingId) return;

  const { error } = await supabase
    .from("briefing_room")
    .delete()
    .eq("id", editingBriefingId);

  if (error) {
    brStatus.textContent = "Delete failed.";
    console.error(error);
    return;
  }

  brStatus.textContent = "Deleted.";
  clearBriefingForm();
  loadBriefingList();
});

// ===============================
// MODE SWITCHING
// ===============================
function setModeUI() {
  if (currentMode === "live") {
    modeLive.classList.add("active");
    modeBriefings.classList.remove("active");
    liveEditor.style.display = "block";
    briefingEditor.style.display = "none";
    listTitle.textContent = "EXISTING INTEL";
    loadIntelList();
  } else {
    modeLive.classList.remove("active");
    modeBriefings.classList.add("active");
    liveEditor.style.display = "none";
    briefingEditor.style.display = "block";
    listTitle.textContent = "EXISTING BRIEFINGS";
    loadBriefingList();
  }
}

modeLive.addEventListener("click", () => {
  currentMode = "live";
  setModeUI();
});

modeBriefings.addEventListener("click", () => {
  currentMode = "briefings";
  setModeUI();
});

// ===============================
// AUTH: LOGIN
// ===============================
loginButton.addEventListener("click", async () => {
  loginError.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "SIGNING IN…";

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

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
  currentMode = "live";
  setModeUI();
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
async function checkSessionOnLoad() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    showAdminView(data.session.user);
  } else {
    loginView.style.display = "block";
    adminView.style.display = "none";
  }
}

function showAdminView(user) {
  loginView.style.display = "none";
  adminView.style.display = "block";
  adminEmailDisplay.textContent = user.email;

  setAutoTimestamp();
  currentMode = "live";
  setModeUI();
}

checkSessionOnLoad();

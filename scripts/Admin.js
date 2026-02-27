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

let editingIntelId = null;

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

    intelLat.value = lat.toFixed(6);
    intelLng.value = lng.toFixed(6);

    placeAdminMarker(lng, lat);
});

// ===============================
// CITY SEARCH
// ===============================
citySearch.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;

    const query = citySearch.value.trim();
    if (!query) return;

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}`;

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

    } catch (err) {
        console.error("City search failed:", err);
    }
});

// ===============================
// CLEAR FORM
// ===============================
function clearForm() {
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

resetFormButton.addEventListener("click", clearForm);

// ===============================
// LOAD EXISTING INTEL
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

    data.forEach(item => {
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

        div.querySelector("button").addEventListener("click", () => loadIntelIntoEditor(item));
        intelList.appendChild(div);
    });
}

// ===============================
// LOAD INTEL INTO EDITOR
// ===============================
function loadIntelIntoEditor(item) {
    editingIntelId = item.id;

    intelTitle.value = item.title;
    intelSummary.value = item.summary;
    intelDetails.value = item.details;
    intelRegion.value = item.region;
    intelCategory.value = item.category;
    intelTimestamp.value = item.timestamp.slice(0, 16);
    intelSources.value = item.sources || "";
    intelLat.value = item.lat;
    intelLng.value = item.lng;

    placeAdminMarker(item.lng, item.lat);

    deleteButton.style.display = "inline-block";
}

// ===============================
// PUBLISH / UPDATE
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
        lat: parseFloat(intelLat.value),
        lng: parseFloat(intelLng.value)
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
        result = await supabase
            .from("live_intel")
            .insert(payload);
    }

    if (result.error) {
        editorStatus.textContent = "Error saving intel.";
        console.error(result.error);
        return;
    }

    editorStatus.textContent = "Saved.";
    clearForm();
    loadIntelList();
});

// ===============================
// DELETE
// ===============================
deleteButton.addEventListener("click", async () => {
    if (!editingIntelId) return;

    const { error } = await supabase
        .from("live_intel")
        .delete()
        .eq("id", editingIntelId);

    if (error) {
        editorStatus.textContent = "Delete failed.";
        return;
    }

    editorStatus.textContent = "Deleted.";
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
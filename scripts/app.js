/* ============================================================
   ENVIRONMENT VARIABLES (Cloudflare Pages)
   ============================================================ */
// Add these in Cloudflare Pages → Settings → Environment Variables:
// MAPBOX_TOKEN
// SUPABASE_URL
// SUPABASE_ANON_KEY

const MAPBOX_TOKEN_PUBLIC = MAPBOX_TOKEN;
const SUPABASE_URL_PUBLIC = SUPABASE_URL;
const SUPABASE_ANON_KEY_PUBLIC = SUPABASE_ANON_KEY;

/* ============================================================
   SUPABASE CLIENT
   ============================================================ */
const supabase = window.supabase.createClient(
    SUPABASE_URL_PUBLIC,
    SUPABASE_ANON_KEY_PUBLIC
);

/* ============================================================
   FETCH LIVE INTEL (REST API)
   ============================================================ */
async function fetchLiveIntel({ limit = 50, days = 30 } = {}) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const url =
        `${SUPABASE_URL_PUBLIC}/rest/v1/live_intel` +
        `?select=*` +
        `&timestamp=gte.${encodeURIComponent(since)}` +
        `&order=timestamp.desc` +
        `&limit=${limit}`;

    const res = await fetch(url, {
        headers: {
            apikey: SUPABASE_ANON_KEY_PUBLIC,
            Authorization: `Bearer ${SUPABASE_ANON_KEY_PUBLIC}`
        }
    });

    if (!res.ok) {
        console.error("Failed to fetch live intel", await res.text());
        return [];
    }

    return await res.json();
}

/* ============================================================
   GLOBAL MENU + NAVIGATION
   ============================================================ */

const menuButton = document.getElementById("menuButton");
const sideMenu = document.getElementById("sideMenu");
const closeMenu = document.getElementById("closeMenu");
const menuOverlay = document.getElementById("menuOverlay");

if (menuButton) {
    menuButton.addEventListener("click", () => {
        sideMenu.classList.add("open");
        menuOverlay.classList.add("visible");
    });
}

if (closeMenu) {
    closeMenu.addEventListener("click", () => {
        sideMenu.classList.remove("open");
        menuOverlay.classList.remove("visible");
    });
}

if (menuOverlay) {
    menuOverlay.addEventListener("click", () => {
        sideMenu.classList.remove("open");
        menuOverlay.classList.remove("visible");
    });
}

const menuHome = document.getElementById("menuHome");
const menuAbout = document.getElementById("menuAbout");

if (menuHome) menuHome.onclick = () => (window.location.href = "index.html");
if (menuAbout) menuAbout.onclick = () => (window.location.href = "About.html");

/* ============================================================
   TIMELINE CHECK
   ============================================================ */

const timelineExists =
    document.getElementById("timelineBar") &&
    document.getElementById("timelineSlider") &&
    document.getElementById("timelineTooltip") &&
    document.getElementById("timelineLabels") &&
    document.getElementById("timelineCurrentBox");

/* ============================================================
   LATEST INTELLIGENCE FEED
   ============================================================ */

const feedContainer = document.getElementById("feed");

if (feedContainer) {
    loadHomeFeed();
}

async function loadHomeFeed() {
    try {
        const data = await fetchLiveIntel({ limit: 7, days: 30 });

        const feedData = data.map(item => ({
            time: new Date(item.timestamp).toLocaleString(),
            headline: item.title,
            summary: item.summary,
            why: item.details
        }));

        feedContainer.innerHTML = "";

        feedData.forEach(item => {
            const div = document.createElement("div");
            div.classList.add("feed-item");

            div.innerHTML = `
                <div class="timestamp">${item.time}</div>
                <h3>${item.headline}</h3>
                <p>${item.summary}</p>
                <div class="why"><strong>Why this matters:</strong> ${item.why}</div>
            `;

            feedContainer.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading home feed:", err);
    }
}

/* ============================================================
   MAP / EVENTS: CATEGORY COLORS
   ============================================================ */

const categoryColors = {
    MILITARY: "#ff3b30",
    POLITICAL: "#3b82f6",
    ECONOMIC: "#facc15",
    SOCIAL: "#a855f7",
    "GREY SPACE": "#22d3ee"
};

function isoHoursAgo(hours) {
    return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

let eventsData = [];
let activeMarkers = [];
let selectedCategories = ["ALL"];
let updateMarkerVisibility = () => {};

/* ============================================================
   TIMELINE SYSTEM
   ============================================================ */

if (timelineExists) {
    const totalHours = 168;
    const stepHours = 2;

    const bar = document.getElementById("timelineBar");
    const slider = document.getElementById("timelineSlider");
    const tooltip = document.getElementById("timelineTooltip");
    const labelsContainer = document.getElementById("timelineLabels");
    const currentBox = document.getElementById("timelineCurrentBox");

    function formatTimestampDisplay(dateObj) {
        const d = String(dateObj.getDate()).padStart(2, "0");
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const y = dateObj.getFullYear();
        const h = String(dateObj.getHours()).padStart(2, "0");
        const min = String(dateObj.getMinutes()).padStart(2, "0");
        return `${d}/${m}/${y} ${h}:${min}`;
    }

    function exactTimestamp(hoursAgo) {
        return new Date(Date.now() - hoursAgo * 3600 * 1000);
    }

    let guidePoints = [];
    for (let h = totalHours; h >= 0; h -= 24) guidePoints.push(h);

    labelsContainer.innerHTML = guidePoints
        .map(h =>
            h === 0
                ? `<span data-hours="0">NOW</span>`
                : `<span data-hours="${h}">-${Math.round(h / 24)}d</span>`
        )
        .join("");

    function moveSliderToHours(hoursAgo) {
        const clamped = Math.max(0, Math.min(hoursAgo, totalHours));
        const percent = 1 - clamped / totalHours;
        slider.style.left = `${percent * 100}%`;
        slider.style.transform = "translateX(-50%)";
        slider.dataset.hoursAgo = clamped;
        return percent;
    }

    function updateTimeDisplays(hoursAgo, showTooltip = true) {
        const clamped = Math.max(0, Math.min(hoursAgo, totalHours));
        const percent = 1 - clamped / totalHours;
        const dateObj = exactTimestamp(clamped);

        if (clamped === 0) {
            tooltip.style.opacity = 0;
        } else if (showTooltip) {
            const rect = bar.getBoundingClientRect();
            let px = percent * rect.width;
            px = Math.max(40, Math.min(px, rect.width - 40));
            tooltip.style.left = px + "px";
            tooltip.style.transform = "translateX(-50%)";
            tooltip.textContent = formatTimestampDisplay(dateObj);
            tooltip.style.opacity = 1;
        }

        if (clamped === 0) {
            const now = new Date();
            currentBox.textContent = `NOW • ${now
                .getHours()
                .toString()
                .padStart(2, "0")}:${now
                .getMinutes()
                .toString()
                .padStart(2, "0")}:${now
                .getSeconds()
                .toString()
                .padStart(2, "0")}`;
        } else {
            currentBox.textContent = formatTimestampDisplay(dateObj);
        }

        updateMarkerVisibility(clamped);
    }

    function hideTooltip() {
        tooltip.style.opacity = 0;
    }

    document.querySelectorAll(".timeline-labels span").forEach(label => {
        const hoursAgo = parseInt(label.dataset.hours);
        label.addEventListener("click", () => {
            moveSliderToHours(hoursAgo);
            updateTimeDisplays(hoursAgo, true);
            setTimeout(hideTooltip, 1200);
        });
    });

    let dragging = false;

    slider.addEventListener("mousedown", e => {
        dragging = true;
        e.preventDefault();
    });

    document.addEventListener("mouseup", () => {
        dragging = false;
        hideTooltip();
    });

    document.addEventListener("mousemove", e => {
        if (!dragging) return;
        e.preventDefault();
        const rect = bar.getBoundingClientRect();
        let x = e.clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));
        const percent = x / rect.width;
        const hoursAgoRaw = totalHours * (1 - percent);
        const snapped = Math.round(hoursAgoRaw / stepHours) * stepHours;
        slider.style.left = `${percent * 100}%`;
        slider.style.transform = "translateX(-50%)";
        updateTimeDisplays(snapped, true);
    });

    slider.addEventListener(
        "touchstart",
        e => {
            dragging = true;
            e.preventDefault();
        },
        { passive: false }
    );

    document.addEventListener("touchend", () => {
        dragging = false;
        hideTooltip();
    });

    document.addEventListener(
        "touchmove",
        e => {
            if (!dragging) return;
            e.preventDefault();
            const touch = e.touches[0];
            const rect = bar.getBoundingClientRect();
            let x = touch.clientX - rect.left;
            x = Math.max(0, Math.min(x, rect.width));
            const percent = x / rect.width;
            const hoursAgoRaw = totalHours * (1 - percent);
            const snapped = Math.round(hoursAgoRaw / stepHours) * stepHours;
            slider.style.left = `${percent * 100}%`;
            slider.style.transform = "translateX(-50%)";
            updateTimeDisplays(snapped, true);
        },
        { passive: false }
    );

    setInterval(() => {
        if (currentBox.textContent.startsWith("NOW")) {
            const now = new Date();
            currentBox.textContent = `NOW • ${now
                .getHours()
                .toString()
                .padStart(2, "0")}:${now
                .getMinutes()
                .toString()
                .padStart(2, "0")}:${now
                .getSeconds()
                .toString()
                .padStart(2, "0")}`;
        }
    }, 1000);

    moveSliderToHours(0);
    updateTimeDisplays(0, false);
}

/* ============================================================
   MAPBOX: INIT INTELLIGENCE MAP
   ============================================================ */

const intelMapContainer = document.getElementById("intel-map");
let intelMap = null;

if (intelMapContainer && typeof mapboxgl !== "undefined") {
    mapboxgl.accessToken = MAPBOX_TOKEN_PUBLIC;

    intelMap = new mapboxgl.Map({
        container: "intel-map",
        style: "mapbox://styles/mapbox/dark-v11",
        center: [0, -5],
        zoom: 1.15,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        projection: "equalEarth"
    });

    intelMap.dragRotate.disable();
    intelMap.touchZoomRotate.disableRotation();

    intelMap.on("load", () => {
        loadMapEventsFromSupabase();
    });
}

/* ============================================================
   MAP EVENTS FROM SUPABASE
   ============================================================ */

async function loadMapEventsFromSupabase() {
    try {
        const data = await fetchLiveIntel({ limit: 200, days: 7 });

        eventsData = data
            .filter(item => item.lat != null && item.lng != null)
            .map(item => ({
                id: item.id,
                title: item.title,
                lat: item.lat,
                lng: item.lng,
                category: (item.category || "").toUpperCase(),
                timestamp: item.timestamp,
                url: null
            }));

        activeMarkers.forEach(m => m.marker.remove());
        activeMarkers = eventsData.map(ev => addEventMarker(ev));

        updateMarkerVisibility(0);
    } catch (err) {
        console.error("Error loading map events from Supabase:", err);
    }
}

/* ============================================================
   MAPBOX: MARKER SVG + API
   ============================================================ */

function markerSVG(color) {
    return `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="${color}"/>
      <circle cx="12" cy="12" r="6" fill="#1a1a1a"/>
    </svg>`;
}

function addEventMarker(event) {
    if (!intelMap) return null;

    const color = categoryColors[event.category] || "#ffffff";

    const el = document.createElement("div");
    el.className = "intel-marker";
    el.innerHTML = markerSVG(color);
    el.title = event.title || "";

    el.addEventListener("click", () => {
        if (event.url) window.location.href = event.url;
    });

    const marker = new mapboxgl.Marker(el)
        .setLngLat([event.lng, event.lat])
        .addTo(intelMap);

    return { marker, event };
}

/* ============================================================
   TIME-BASED MARKER VISIBILITY
   ============================================================ */

updateMarkerVisibility = function (hoursAgo) {
    const now = Date.now();
    const windowEnd = now - hoursAgo * 3600 * 1000;
    const windowStart = windowEnd - 24 * 3600 * 1000;

    activeMarkers.forEach(m => {
        const eventTime = new Date(m.event.timestamp).getTime();
        const inTimeWindow = eventTime >= windowStart && eventTime <= windowEnd;

        if (!inTimeWindow) {
            m.marker.getElement().style.display = "none";
            return;
        }

        const categoryMatch =
            selectedCategories.includes("ALL") ||
            selectedCategories.includes(m.event.category);

        m.marker.getElement().style.display = categoryMatch ? "block" : "none";
    });
};

/* ============================================================
   CATEGORY FILTER BUTTONS
   ============================================================ */

const filterButtons = document.querySelectorAll(".filters button");

filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const category = btn.textContent.trim().toUpperCase();

        if (category === "ALL") {
            selectedCategories = ["ALL"];
        } else {
            selectedCategories = [category];
        }

        const slider = document.getElementById("timelineSlider");
        const hoursAgo = parseInt(slider?.dataset.hoursAgo || "0");

        updateMarkerVisibility(hoursAgo);
    });
});

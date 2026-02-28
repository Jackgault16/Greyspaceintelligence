const regionFilter = document.getElementById("regionFilter");
const categoryFilter = document.getElementById("categoryFilter");
const feed = document.getElementById("feed");

function parseScopeMeta(rawSources) {
    const text = String(rawSources || "");
    const match = text.match(/^__scope=(LIVE|BRIEFING|BOTH)__\s*\n?/);
    const scope = match ? match[1] : "BOTH";
    const cleanedSources = match
        ? text.replace(/^__scope=(LIVE|BRIEFING|BOTH)__\s*\n?/, "")
        : text;

    return { scope, cleanedSources };
}

function isLiveVisible(item) {
    const { scope } = parseScopeMeta(item.sources || item.source || "");
    return scope === "BOTH" || scope === "LIVE";
}

function getFilterValues() {
    return {
        region: regionFilter.value.toLowerCase(),
        category: categoryFilter.value.toLowerCase()
    };
}

function buildSourcesHTML(item) {
    const { cleanedSources } = parseScopeMeta(item.sources || item.source || "");
    const sourceText = cleanedSources;
    if (!sourceText) return "";

    const sources = sourceText.split(",").map(s => s.trim());
    return sources
        .map(src => `<a href="${src}" target="_blank">${src}</a>`)
        .join("<br>");
}

function matchesFilters(item, filterValues) {
    const region = item.region?.toLowerCase() || "";
    const category = item.category?.toLowerCase() || "";

    const regionMatch = !filterValues.region || region === filterValues.region;
    const categoryMatch = !filterValues.category || category === filterValues.category;

    return regionMatch && categoryMatch;
}

// Render feed
async function renderIntel() {
    const intel = await fetchLiveIntel({ limit: 200 });
    feed.innerHTML = "";
    const filterValues = getFilterValues();

    intel.forEach(item => {
        if (!isLiveVisible(item)) return;
        if (!matchesFilters(item, filterValues)) return;

        const category = item.category?.toLowerCase() || "";

        const card = document.createElement("div");
        card.className = "feed-item";

        const sourcesHTML = buildSourcesHTML(item);

        card.innerHTML = `
            <h3>
                ${item.title}
                <span class="category-tag category-${category || "none"}">
                    ${item.category || ""}
                </span>
            </h3>

            <div class="timestamp">
                ${(item.region || "").toUpperCase()} • ${(item.category || "").toUpperCase()} • 
                ${new Date(item.timestamp).toLocaleString()}
            </div>

            <div class="why">${item.summary || ""}</div>

            <div class="intel-expanded">
                <div class="details">${item.details || ""}</div>
                ${
                    sourcesHTML
                        ? `<div class="sources"><strong>Sources:</strong><br>${sourcesHTML}</div>`
                        : ""
                }
            </div>
        `;

        card.addEventListener("click", () => {
            card.querySelector(".intel-expanded").classList.toggle("visible");
        });

        feed.appendChild(card);
    });

    updateMapMarkers(intel);
}

// Map markers
let markers = [];

function updateMapMarkers(intel) {
    markers.forEach(m => m.remove());
    markers = [];

    intel.forEach(item => {
        if (!isLiveVisible(item)) return;
        const lng = item.lng != null ? item.lng : item.long;
        if (item.lat == null || lng == null) return;

        const marker = new mapboxgl.Marker({ color: "#f97316" })
            .setLngLat([lng, item.lat])
            .setPopup(new mapboxgl.Popup().setHTML(`
                <strong>${item.title}</strong><br>
                ${item.region} • ${item.category}<br>
                ${new Date(item.timestamp).toLocaleString()}
            `))
            .addTo(map);

        markers.push(marker);
    });
}

regionFilter.addEventListener("change", renderIntel);
categoryFilter.addEventListener("change", renderIntel);

// Init
renderIntel();

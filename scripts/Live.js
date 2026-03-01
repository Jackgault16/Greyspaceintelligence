const regionFilter = document.getElementById("regionFilter");
const categoryFilter = document.getElementById("categoryFilter");
const feed = document.getElementById("feed");

function getFilterValues() {
    return {
        region: regionFilter.value.toLowerCase(),
        category: categoryFilter.value.toLowerCase()
    };
}

function buildSourcesHTML(item) {
    const rawSources = item.sources ?? item.source ?? "";
    const sourceText = Array.isArray(rawSources)
        ? rawSources.join(", ")
        : String(rawSources);

    if (!sourceText) return "";

    const sources = sourceText
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

    return sources
        .map(src => `<a href="${src}" target="_blank">${src}</a>`)
        .join("<br>");
}

function categoryClassName(rawCategory) {
    return String(rawCategory || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
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
    const intel = await fetchLiveIntel({ limit: 200, days: 365 });
    feed.innerHTML = "";
    const filterValues = getFilterValues();

    intel.forEach(item => {
        try {
            if (!matchesFilters(item, filterValues)) return;

            const category = item.category?.toLowerCase() || "";
            const categoryClass = categoryClassName(item.category);
            const card = document.createElement("div");
            card.className = "feed-item";

            const sourcesHTML = buildSourcesHTML(item);

            card.innerHTML = `
                <h3>
                    ${item.title || "Untitled"}
                    <span class="category-tag category-${categoryClass || "none"}">
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
        } catch (err) {
            console.error("Skipping invalid live row:", err, item);
        }
    });

    updateMapMarkers(intel);
}

// Map markers
let markers = [];

function updateMapMarkers(intel) {
    if (typeof map === "undefined" || !map) return;

    markers.forEach(m => m.remove());
    markers = [];

    intel.forEach(item => {
        try {
            const lng = item.lng != null ? item.lng : item.long;
            if (item.lat == null || lng == null) return;

            const marker = new mapboxgl.Marker({ color: "#f97316" })
                .setLngLat([lng, item.lat])
                .setPopup(new mapboxgl.Popup().setHTML(`
                    <strong>${item.title || "Untitled"}</strong><br>
                    ${item.region || ""} • ${item.category || ""}<br>
                    ${new Date(item.timestamp).toLocaleString()}
                `))
                .addTo(map);

            markers.push(marker);
        } catch (err) {
            console.error("Skipping invalid map row:", err, item);
        }
    });
}

regionFilter.addEventListener("change", renderIntel);
categoryFilter.addEventListener("change", renderIntel);

// Init
renderIntel();

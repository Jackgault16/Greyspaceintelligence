const regionFilter = document.getElementById("regionFilter");
const categoryFilter = document.getElementById("categoryFilter");
const feed = document.getElementById("feed");

// Render feed
async function renderIntel() {
    const intel = await fetchLiveIntel({ limit: 200 });

    feed.innerHTML = "";

    intel.forEach(item => {
        const region = item.region?.toLowerCase() || "";
        const category = item.category?.toLowerCase() || "";

        const regionFilterValue = regionFilter.value.toLowerCase();
        const categoryFilterValue = categoryFilter.value.toLowerCase();

        const regionMatch = !regionFilterValue || region === regionFilterValue;
        const categoryMatch = !categoryFilterValue || category === categoryFilterValue;

        if (!regionMatch || !categoryMatch) return;

        const card = document.createElement("div");
        card.className = "feed-item";

        // Single source field
        let sourcesHTML = "";
        if (item.source) {
            // allow comma-separated or single URL
            const sources = item.source.split(",").map(s => s.trim());
            sourcesHTML = sources
                .map(src => `<a href="${src}" target="_blank">${src}</a>`)
                .join("<br>");
        }

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
        if (!item.lat || !item.long) return;

        const marker = new mapboxgl.Marker({ color: "#f97316" })
            .setLngLat([item.long, item.lat])
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
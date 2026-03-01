// Single source of truth for regional map framing in briefing views.
const REGION_FRAMES = {
  global: { center: [0, 20], zoom: 1.2 },

  europe: { center: [12, 52], zoom: 3.4, bounds: [[-25, 34], [45, 72]] },
  middle_east: { center: [45, 27], zoom: 3.4, bounds: [[25, 12], [65, 40]] },
  africa: { center: [20, 2], zoom: 2.6, bounds: [[-20, -35], [55, 37]] },
  north_america: { center: [-98, 39], zoom: 2.6, bounds: [[-170, 7], [-50, 72]] },
  latin_america: { center: [-60, -15], zoom: 2.6, bounds: [[-120, -60], [-30, 32]] },
  asia: { center: [95, 35], zoom: 2.3, bounds: [[40, 0], [150, 60]] },
  indo_pacific: { center: [125, 5], zoom: 2.4, bounds: [[70, -45], [180, 30]] },
  russia_eurasia: { center: [90, 58], zoom: 2.2, bounds: [[20, 40], [180, 80]] },
  oceania: { center: [145, -25], zoom: 2.6, bounds: [[110, -50], [180, 0]] }
};

const BRIEF_REGION_OPTIONS = [
  { key: "global", label: "Global" },
  { key: "europe", label: "Europe" },
  { key: "middle_east", label: "Middle East" },
  { key: "africa", label: "Africa" },
  { key: "north_america", label: "North America" },
  { key: "latin_america", label: "Latin America" },
  { key: "asia", label: "Asia" },
  { key: "indo_pacific", label: "Indo-Pacific" },
  { key: "russia_eurasia", label: "Russia / Eurasia" },
  { key: "oceania", label: "Oceania" }
];

const REGION_KEY_ALIASES = {
  south_america: "latin_america",
  central_asia: "russia_eurasia",
  east_asia: "asia",
  south_asia: "asia",
  southeast_asia: "indo_pacific",
  global_multi_region: "global"
};

function normalizeRegionKey(rawKey) {
  const key = String(rawKey || "").toLowerCase().trim().replace(/\s+/g, "_");
  if (!key) return "global";
  return REGION_KEY_ALIASES[key] || key;
}

function regionDisplayNameFromKey(rawKey) {
  const key = normalizeRegionKey(rawKey);
  const hit = BRIEF_REGION_OPTIONS.find(r => r.key === key);
  if (hit) return hit.label;
  return key
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

window.REGION_FRAMES = REGION_FRAMES;
window.BRIEF_REGION_OPTIONS = BRIEF_REGION_OPTIONS;
window.normalizeRegionKey = normalizeRegionKey;
window.regionDisplayNameFromKey = regionDisplayNameFromKey;

const loginWrap = document.getElementById("mapAdminLogin");
const appWrap = document.getElementById("mapAdminApp");
const loginBtn = document.getElementById("mapAdminLoginBtn");
const loginStatus = document.getElementById("mapAdminLoginStatus");
const emailInput = document.getElementById("mapAdminEmail");
const pwInput = document.getElementById("mapAdminPassword");
const userLabel = document.getElementById("mapAdminUser");
const logoutBtn = document.getElementById("mapAdminLogout");

const countryPickerInput = document.getElementById("countryPickerInput");
const countryOptions = document.getElementById("countryOptions");
const categoryTabs = document.getElementById("categoryTabs");
const activeCategoryLabel = document.getElementById("activeCategoryLabel");
const editorStatusBadge = document.getElementById("editorStatusBadge");
const bootstrapWikidataBtn = document.getElementById("bootstrapWikidataBtn");
const statusEl = document.getElementById("mapAdminStatus");

const overviewCountryName = document.getElementById("overviewCountryName");
const overviewCountryMeta = document.getElementById("overviewCountryMeta");
const categoryCounters = document.getElementById("categoryCounters");
const openOnMapBtn = document.getElementById("openOnMapBtn");

const countryIso2 = document.getElementById("countryIso2");
const countryIso3 = document.getElementById("countryIso3");
const countryName = document.getElementById("countryName");
const countryRegion = document.getElementById("countryRegion");
const countryCapital = document.getElementById("countryCapital");
const countryCentroid = document.getElementById("countryCentroid");
const countryBbox = document.getElementById("countryBbox");
const saveCountryBtn = document.getElementById("saveCountryBtn");

const metricsRowsWrap = document.getElementById("metricsRows");
const addMetricBtn = document.getElementById("addMetricBtn");
const profileNarrative = document.getElementById("profileNarrative");
const profileSources = document.getElementById("profileSources");
const metricsJson = document.getElementById("metricsJson");
const applyJsonBtn = document.getElementById("applyJsonBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const poisTable = document.getElementById("poisTable");
const addPoiBtn = document.getElementById("addPoiBtn");
const savePoisBtn = document.getElementById("savePoisBtn");

const previewCountryName = document.getElementById("previewCountryName");
const previewCategory = document.getElementById("previewCategory");
const previewMetrics = document.getElementById("previewMetrics");
const previewNarrative = document.getElementById("previewNarrative");
const previewSources = document.getElementById("previewSources");
const previewPois = document.getElementById("previewPois");

const poiModal = document.getElementById("poiModal");
const poiModalTitle = document.getElementById("poiModalTitle");
const poiModalClose = document.getElementById("poiModalClose");
const poiModalSave = document.getElementById("poiModalSave");
const poiName = document.getElementById("poiName");
const poiType = document.getElementById("poiType");
const poiLat = document.getElementById("poiLat");
const poiLng = document.getElementById("poiLng");
const poiConfidence = document.getElementById("poiConfidence");
const poiNotes = document.getElementById("poiNotes");
const poiSources = document.getElementById("poiSources");
const poiMapEl = document.getElementById("poiMap");

const switchConfirmModal = document.getElementById("switchConfirmModal");
const confirmSaveSwitch = document.getElementById("confirmSaveSwitch");
const confirmDiscardSwitch = document.getElementById("confirmDiscardSwitch");
const confirmCancelSwitch = document.getElementById("confirmCancelSwitch");

const CATEGORY_KEYS = ["political", "military", "economic", "social", "greyspace"];

let countries = [];
let selectedIso2 = "";
let activeCategory = "political";
let countryRow = null;
let profileRow = null;
let metricRows = [];
let poiRows = [];
let editingPoiId = null;
let pendingSwitch = null;
let dirtyProfile = false;
let dirtyPois = false;
let statusMode = "loaded"; // loaded | unsaved | saved

let poiMap = null;
let poiMarker = null;

bootstrap();

async function bootstrap() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) showApp(data.session.user);
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

countryPickerInput?.addEventListener("change", () => {
  const iso = parseIsoFromPicker(countryPickerInput.value);
  if (!iso) return;
  trySwitch(() => setSelectedCountry(iso));
});

categoryTabs?.addEventListener("click", e => {
  const btn = e.target.closest("button[data-category]");
  if (!btn) return;
  const next = btn.getAttribute("data-category");
  if (next === activeCategory) return;
  trySwitch(() => setActiveCategory(next));
});

saveCountryBtn?.addEventListener("click", saveCountryBase);
addMetricBtn?.addEventListener("click", () => {
  metricRows.push({ key: "", value: "" });
  dirtyProfile = true;
  renderMetricsRows();
  syncStatusBadge();
});
applyJsonBtn?.addEventListener("click", applyAdvancedJson);
saveProfileBtn?.addEventListener("click", saveProfile);
addPoiBtn?.addEventListener("click", () => openPoiModal(null));
savePoisBtn?.addEventListener("click", savePois);
openOnMapBtn?.addEventListener("click", () => {
  if (!selectedIso2) return;
  window.location.href = `../../map.html?iso2=${encodeURIComponent(selectedIso2)}`;
});

profileNarrative?.addEventListener("input", () => { dirtyProfile = true; syncStatusBadge(); renderPreview(); });
profileSources?.addEventListener("input", () => { dirtyProfile = true; syncStatusBadge(); renderPreview(); });

poiModalClose?.addEventListener("click", () => setPoiModal(false));
poiModalSave?.addEventListener("click", commitPoiFromModal);
confirmSaveSwitch?.addEventListener("click", async () => {
  await saveAllDirty();
  switchConfirmModal.classList.remove("open");
  const fn = pendingSwitch; pendingSwitch = null;
  if (fn) await fn();
});
confirmDiscardSwitch?.addEventListener("click", async () => {
  dirtyProfile = false; dirtyPois = false; syncStatusBadge();
  switchConfirmModal.classList.remove("open");
  const fn = pendingSwitch; pendingSwitch = null;
  if (fn) await fn();
});
confirmCancelSwitch?.addEventListener("click", () => {
  pendingSwitch = null;
  switchConfirmModal.classList.remove("open");
});

bootstrapWikidataBtn?.addEventListener("click", runWikidataBootstrap);

async function showApp(user) {
  loginWrap.style.display = "none";
  appWrap.style.display = "block";
  userLabel.textContent = user.email || "";
  await loadCountries();
  if (countries.length) await setSelectedCountry(countries[0].iso2);
}

async function runWikidataBootstrap() {
  if (!supabase) return;
  bootstrapWikidataBtn.disabled = true;
  bootstrapWikidataBtn.textContent = "Importing...";
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch("/api/admin/import-wikidata", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    });
    const json = await res.json();
    if (!res.ok) {
      statusEl.textContent = `Wikidata import failed: ${json?.error || "Unknown error"}`;
      return;
    }
    statusEl.textContent = `Wikidata import complete: ${json.countriesProcessed} countries (${json.countriesInserted} inserted, ${json.countriesUpdated} updated), ${json.profilesCreated} profiles created.`;
    await loadCountries();
    if (selectedIso2) await setSelectedCountry(selectedIso2);
  } catch (err) {
    statusEl.textContent = `Wikidata import failed: ${String(err?.message || err)}`;
  } finally {
    bootstrapWikidataBtn.disabled = false;
    bootstrapWikidataBtn.textContent = "Bootstrap from Wikidata";
  }
}

async function loadCountries() {
  const { data, error } = await supabase.from("countries").select("*").order("name", { ascending: true });
  if (error) {
    statusEl.textContent = `Failed loading countries: ${error.message}`;
    return;
  }
  countries = data || [];
  countryOptions.innerHTML = countries.map(c => `<option value="${escapeHtml(c.name || c.iso2)} (${escapeHtml(c.iso2)})"></option>`).join("");
}

function parseIsoFromPicker(value) {
  const text = String(value || "");
  const match = text.match(/\(([A-Za-z]{2})\)\s*$/);
  if (match) return match[1].toUpperCase();
  const direct = countries.find(c => c.iso2 === text.toUpperCase() || (c.name || "").toLowerCase() === text.toLowerCase());
  return direct?.iso2 || "";
}

async function setSelectedCountry(iso2) {
  selectedIso2 = iso2;
  countryRow = countries.find(c => c.iso2 === iso2) || null;
  countryPickerInput.value = countryRow ? `${countryRow.name} (${countryRow.iso2})` : iso2;
  countryIso2.value = countryRow?.iso2 || iso2;
  countryIso3.value = countryRow?.iso3 || "";
  countryName.value = countryRow?.name || "";
  countryRegion.value = countryRow?.region || "";
  countryCapital.value = countryRow?.capital || "";
  countryCentroid.value = arrToInput(countryRow?.centroid);
  countryBbox.value = arrToInput(countryRow?.bbox);
  renderOverview();
  await loadCategoryData();
}

async function setActiveCategory(category) {
  activeCategory = CATEGORY_KEYS.includes(category) ? category : "political";
  categoryTabs.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.getAttribute("data-category") === activeCategory));
  activeCategoryLabel.textContent = prettyCategory(activeCategory);
  await loadCategoryData();
}

async function loadCategoryData() {
  if (!selectedIso2) return;
  const [{ data: p }, { data: pois }] = await Promise.all([
    supabase.from("country_profiles").select("*").eq("iso2", selectedIso2).eq("category", activeCategory).maybeSingle(),
    supabase.from("country_pois").select("*").eq("iso2", selectedIso2).eq("category", activeCategory).order("created_at", { ascending: false })
  ]);
  profileRow = p || null;
  poiRows = pois || [];
  metricRows = jsonToMetricRows(profileRow?.metrics || {});
  profileNarrative.value = profileRow?.narrative || "";
  profileSources.value = Array.isArray(profileRow?.sources) ? profileRow.sources.join(", ") : "";
  metricsJson.value = JSON.stringify(profileRow?.metrics || {}, null, 2);
  dirtyProfile = false;
  dirtyPois = false;
  statusMode = "loaded";
  syncStatusBadge();
  renderMetricsRows();
  renderPoisTable();
  renderPreview();
  await renderCategoryCounters();
}

function renderOverview() {
  overviewCountryName.textContent = countryRow?.name || selectedIso2 || "No country selected";
  overviewCountryMeta.textContent = [
    countryRow?.iso2 ? `ISO2: ${countryRow.iso2}` : "",
    countryRow?.region || "",
    countryRow?.capital ? `Capital: ${countryRow.capital}` : ""
  ].filter(Boolean).join(" • ") || "Select a country to begin.";
  previewCountryName.textContent = countryRow?.name || selectedIso2 || "Country";
}

async function renderCategoryCounters() {
  if (!selectedIso2) {
    categoryCounters.innerHTML = "";
    return;
  }
  const { data } = await supabase.from("country_pois").select("category").eq("iso2", selectedIso2);
  const counts = new Map();
  CATEGORY_KEYS.forEach(k => counts.set(k, 0));
  (data || []).forEach(row => counts.set(row.category, (counts.get(row.category) || 0) + 1));
  categoryCounters.innerHTML = CATEGORY_KEYS.map(k => `<div class="counter-pill">${prettyCategory(k)}: ${counts.get(k) || 0}</div>`).join("");
}

function renderMetricsRows() {
  metricsRowsWrap.innerHTML = "";
  if (!metricRows.length) {
    metricsRowsWrap.innerHTML = `<div class="note">No data yet for this category.</div>`;
    return;
  }
  metricRows.forEach((row, idx) => {
    const div = document.createElement("div");
    div.className = "metric-row";
    div.innerHTML = `
      <input data-k="${idx}" placeholder="Metric key" value="${escapeAttr(row.key)}">
      <input data-v="${idx}" placeholder="Metric value" value="${escapeAttr(row.value)}">
      <button data-del="${idx}" class="small-btn">Delete</button>
    `;
    div.querySelector(`[data-k="${idx}"]`).addEventListener("input", e => {
      metricRows[idx].key = e.target.value;
      dirtyProfile = true; syncStatusBadge(); renderPreview();
    });
    div.querySelector(`[data-v="${idx}"]`).addEventListener("input", e => {
      metricRows[idx].value = e.target.value;
      dirtyProfile = true; syncStatusBadge(); renderPreview();
    });
    div.querySelector(`[data-del="${idx}"]`).addEventListener("click", () => {
      metricRows.splice(idx, 1);
      dirtyProfile = true; syncStatusBadge();
      renderMetricsRows(); renderPreview();
    });
    metricsRowsWrap.appendChild(div);
  });
}

function applyAdvancedJson() {
  try {
    const parsed = JSON.parse(metricsJson.value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid object");
    metricRows = jsonToMetricRows(parsed);
    dirtyProfile = true;
    syncStatusBadge();
    renderMetricsRows();
    renderPreview();
  } catch (_) {
    statusEl.textContent = "Advanced JSON is invalid.";
  }
}

function renderPoisTable() {
  if (!poiRows.length) {
    poisTable.innerHTML = `<div class="note">No POIs for this category.</div>`;
    return;
  }
  poisTable.innerHTML = poiRows.map(row => `
    <div class="poi-row">
      <div>
        <div>${escapeHtml(row.name || "POI")}</div>
        <div class="note">${escapeHtml(row.poi_type || "--")} • ${escapeHtml(row.confidence || "medium")}</div>
      </div>
      <div class="poi-actions">
        <button class="small-btn" data-edit="${row.id}">Edit</button>
        <button class="small-btn ghost-btn" data-del="${row.id}">Delete</button>
      </div>
    </div>
  `).join("");
  poisTable.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => openPoiModal(btn.getAttribute("data-edit")));
  });
  poisTable.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      poiRows = poiRows.filter(p => p.id !== id);
      dirtyPois = true; syncStatusBadge();
      renderPoisTable(); renderPreview();
    });
  });
}

function renderPreview() {
  previewCategory.textContent = prettyCategory(activeCategory);
  const metrics = metricRowsToJson(metricRows);
  const entries = Object.entries(metrics);
  previewMetrics.innerHTML = entries.length
    ? entries.map(([k, v]) => `<div class="preview-metric"><div class="note">${escapeHtml(k)}</div><div>${escapeHtml(String(v))}</div></div>`).join("")
    : `<div class="note">No data yet for this category.</div>`;
  previewNarrative.textContent = profileNarrative.value.trim() || "No narrative available.";
  const src = csvToArray(profileSources.value);
  previewSources.innerHTML = src.length
    ? src.map(s => `<span class="chip">${escapeHtml(s)}</span>`).join("")
    : `<span class="note">No sources listed.</span>`;
  previewPois.innerHTML = poiRows.length
    ? poiRows.map(p => `<div class="preview-poi">${escapeHtml(p.name || "POI")} • ${escapeHtml(p.poi_type || "--")} • ${escapeHtml(p.confidence || "medium")}</div>`).join("")
    : `<div class="note">No POIs for this category.</div>`;
}

function setPoiModal(open) {
  poiModal.classList.toggle("open", Boolean(open));
  poiModal.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    initPoiMap();
    setTimeout(() => poiMap?.resize(), 50);
  }
}

function openPoiModal(id) {
  editingPoiId = id || null;
  const row = id ? poiRows.find(p => p.id === id) : null;
  poiModalTitle.textContent = row ? "Edit POI" : "Add POI";
  poiName.value = row?.name || "";
  poiType.value = row?.poi_type || "";
  poiLat.value = row?.latitude ?? "";
  poiLng.value = row?.longitude ?? "";
  poiConfidence.value = row?.confidence || "medium";
  poiNotes.value = row?.notes || "";
  poiSources.value = Array.isArray(row?.sources) ? row.sources.join(", ") : "";
  if (poiMarker) poiMarker.remove();
  if (row && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)) && poiMap) {
    poiMarker = new mapboxgl.Marker({ color: "#22c55e" }).setLngLat([Number(row.longitude), Number(row.latitude)]).addTo(poiMap);
    poiMap.jumpTo({ center: [Number(row.longitude), Number(row.latitude)], zoom: 4.8 });
  }
  setPoiModal(true);
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

function commitPoiFromModal() {
  const payload = {
    id: editingPoiId || (window.crypto?.randomUUID ? window.crypto.randomUUID() : `poi_${Date.now()}`),
    iso2: selectedIso2,
    category: activeCategory,
    name: poiName.value.trim() || null,
    poi_type: poiType.value.trim() || null,
    latitude: Number(poiLat.value),
    longitude: Number(poiLng.value),
    confidence: poiConfidence.value || "medium",
    notes: poiNotes.value.trim() || null,
    sources: csvToArray(poiSources.value)
  };
  if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
    statusEl.textContent = "POI latitude/longitude required.";
    return;
  }
  const idx = poiRows.findIndex(p => p.id === payload.id);
  if (idx >= 0) poiRows[idx] = payload;
  else poiRows.unshift(payload);
  dirtyPois = true;
  syncStatusBadge();
  renderPoisTable();
  renderPreview();
  setPoiModal(false);
}

async function saveCountryBase() {
  if (!selectedIso2) return;
  const payload = {
    iso2: selectedIso2,
    iso3: countryIso3.value.trim().toUpperCase() || null,
    name: countryName.value.trim() || null,
    region: countryRegion.value.trim() || null,
    capital: countryCapital.value.trim() || null,
    centroid: parseNumberArray(countryCentroid.value, 2),
    bbox: parseNumberArray(countryBbox.value, 4)
  };
  const { error } = await supabase.from("countries").upsert(payload, { onConflict: "iso2" });
  if (error) {
    statusEl.textContent = `Country save failed: ${error.message}`;
    return;
  }
  statusEl.textContent = "Country saved.";
  markSaved();
  await loadCountries();
  countryRow = countries.find(c => c.iso2 === selectedIso2) || payload;
  renderOverview();
}

async function saveProfile() {
  if (!selectedIso2) return;
  const payload = {
    iso2: selectedIso2,
    category: activeCategory,
    metrics: metricRowsToJson(metricRows),
    narrative: profileNarrative.value.trim() || null,
    sources: csvToArray(profileSources.value)
  };
  const { error } = await supabase.from("country_profiles").upsert(payload, { onConflict: "iso2,category" });
  if (error) {
    statusEl.textContent = `Profile save failed: ${error.message}`;
    return;
  }
  dirtyProfile = false;
  syncStatusBadge();
  statusEl.textContent = "Profile saved.";
  metricsJson.value = JSON.stringify(payload.metrics, null, 2);
  markSaved();
}

async function savePois() {
  if (!selectedIso2) return;
  const validRows = poiRows.filter(r => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)));
  const { data: existing } = await supabase.from("country_pois").select("id").eq("iso2", selectedIso2).eq("category", activeCategory);
  const existingIds = new Set((existing || []).map(r => r.id));
  const keepIds = new Set(validRows.map(r => r.id));
  const deleteIds = [...existingIds].filter(id => !keepIds.has(id));
  if (deleteIds.length) {
    const { error: delErr } = await supabase.from("country_pois").delete().in("id", deleteIds);
    if (delErr) {
      statusEl.textContent = `POI delete failed: ${delErr.message}`;
      return;
    }
  }
  if (validRows.length) {
    const { error } = await supabase.from("country_pois").upsert(validRows, { onConflict: "id" });
    if (error) {
      statusEl.textContent = `POI save failed: ${error.message}`;
      return;
    }
  }
  dirtyPois = false;
  syncStatusBadge();
  statusEl.textContent = "POIs saved.";
  markSaved();
  await loadCategoryData();
}

async function saveAllDirty() {
  if (dirtyProfile) await saveProfile();
  if (dirtyPois) await savePois();
}

function trySwitch(actionFn) {
  if (!dirtyProfile && !dirtyPois) {
    actionFn();
    return;
  }
  pendingSwitch = actionFn;
  switchConfirmModal.classList.add("open");
}

function syncStatusBadge() {
  if (dirtyProfile || dirtyPois) {
    statusMode = "unsaved";
    renderStatusBadge();
    return;
  }
  if (statusMode !== "saved") statusMode = "loaded";
  renderStatusBadge();
}

function markSaved() {
  statusMode = "saved";
  renderStatusBadge();
}

function renderStatusBadge() {
  if (statusMode === "unsaved") {
    editorStatusBadge.textContent = "Unsaved changes";
    editorStatusBadge.style.borderColor = "#7d5f2d";
    return;
  }
  if (statusMode === "saved") {
    editorStatusBadge.textContent = "Saved";
    editorStatusBadge.style.borderColor = "#2d7d50";
    return;
  }
  editorStatusBadge.textContent = "Loaded";
  editorStatusBadge.style.borderColor = "#2a3a56";
}

function jsonToMetricRows(metrics) {
  const obj = metrics && typeof metrics === "object" && !Array.isArray(metrics) ? metrics : {};
  const entries = Object.entries(obj);
  if (!entries.length) return [];
  return entries.map(([key, value]) => ({ key: String(key), value: String(value) }));
}

function metricRowsToJson(rows) {
  const obj = {};
  rows.forEach(row => {
    const k = String(row.key || "").trim();
    const v = String(row.value || "").trim();
    if (!k) return;
    obj[k] = v;
  });
  return obj;
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

function prettyCategory(v) {
  if (v === "greyspace") return "Grey Space";
  return String(v || "").charAt(0).toUpperCase() + String(v || "").slice(1);
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

function escapeAttr(input) {
  return escapeHtml(input).replace(/"/g, "&quot;");
}

const CATEGORIES = ["political", "military", "economic", "social", "greyspace"];
const STARTER_METRICS = {
  political: { Government: "", Stability: "" },
  military: { "Active personnel": "", Reserve: "", "Defense spending": "" },
  economic: { GDP: "", "Key industries": "" },
  social: { Population: "", Urbanization: "", "Life expectancy": "" },
  greyspace: { "Key agencies": "", "Cyber capability": "", "Influence ops": "" }
};

const SPARQL_QUERY = `
SELECT ?country ?iso2 ?countryLabel ?capitalLabel ?continentLabel ?coord WHERE {
  ?country wdt:P297 ?iso2 .
  FILTER(STRLEN(?iso2) = 2)
  FILTER NOT EXISTS { ?country wdt:P576 ?dissolved }
  OPTIONAL { ?country wdt:P36 ?capital . }
  OPTIONAL { ?country wdt:P30 ?continent . }
  OPTIONAL { ?country wdt:P625 ?coord . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?countryLabel
`;

const ENRICH_QUERY = `
SELECT ?iso2
       (SAMPLE(?governmentLabel) AS ?governmentLabel)
       (SAMPLE(?headOfStateLabel) AS ?headOfStateLabel)
       (SAMPLE(?headOfGovernmentLabel) AS ?headOfGovernmentLabel)
       (SAMPLE(?currencyLabel) AS ?currencyLabel)
       (MAX(?population) AS ?population)
       (MAX(?gdp) AS ?gdp)
       (MAX(?gdpPerCapita) AS ?gdpPerCapita)
       (MAX(?lifeExpectancy) AS ?lifeExpectancy)
       (MAX(?hdi) AS ?hdi)
       (MAX(?militaryPersonnel) AS ?militaryPersonnel)
       (MAX(?defenseSpending) AS ?defenseSpending)
WHERE {
  ?country wdt:P297 ?iso2 .
  FILTER(STRLEN(?iso2) = 2)
  FILTER NOT EXISTS { ?country wdt:P576 ?dissolved }
  OPTIONAL { ?country wdt:P122 ?government . }
  OPTIONAL { ?country wdt:P35 ?headOfState . }
  OPTIONAL { ?country wdt:P6 ?headOfGovernment . }
  OPTIONAL { ?country wdt:P38 ?currency . }
  OPTIONAL { ?country wdt:P1082 ?population . }
  OPTIONAL { ?country wdt:P2131 ?gdp . }
  OPTIONAL { ?country wdt:P2132 ?gdpPerCapita . }
  OPTIONAL { ?country wdt:P2250 ?lifeExpectancy . }
  OPTIONAL { ?country wdt:P1081 ?hdi . }
  OPTIONAL { ?country wdt:P1083 ?militaryPersonnel . }
  OPTIONAL { ?country wdt:P2206 ?defenseSpending . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?iso2
`;

export const onRequestPost = async ({ request, env }) => {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return json({ error: "Forbidden" }, 403);
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }, 500);
    }

    const user = await getUserFromAccessToken(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, token);
    if (!user) {
      return json({ error: "Forbidden" }, 403);
    }

    // Optional allowlist: set MAP_DATA_ADMIN_EMAILS="a@x.com,b@y.com"
    const allowedEmailsRaw = String(env.MAP_DATA_ADMIN_EMAILS || "").trim();
    if (allowedEmailsRaw) {
      const allowed = allowedEmailsRaw.split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
      const email = String(user.email || "").toLowerCase();
      if (!allowed.includes(email)) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const supabase = createSupabaseRestClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const rows = await fetchWikidataCountries();
    const enrichMap = await fetchWikidataEnrichment();
    const iso2List = rows.map(r => r.iso2);

    const existingCountriesRes = await supabase.selectAll("countries", "iso2,name,capital,region,centroid_lat,centroid_lng");
    if (existingCountriesRes.error) return json({ error: existingCountriesRes.error }, 500);
    const existingCountries = (existingCountriesRes.data || []).filter(r => iso2List.includes(String(r.iso2 || "").toUpperCase()));

    const existingMap = new Map((existingCountries || []).map(r => [String(r.iso2).toUpperCase(), r]));
    const upsertRows = rows.map(r => {
      const current = existingMap.get(r.iso2);
      return {
        iso2: r.iso2,
        name: r.name || current?.name || null,
        capital: r.capital ?? current?.capital ?? null,
        region: r.region ?? current?.region ?? null,
        centroid_lat: r.centroid_lat ?? current?.centroid_lat ?? null,
        centroid_lng: r.centroid_lng ?? current?.centroid_lng ?? null
      };
    });

    const countriesInserted = upsertRows.filter(r => !existingMap.has(r.iso2)).length;
    const countriesUpdated = upsertRows.length - countriesInserted;

    if (upsertRows.length) {
      const upsertCountriesRes = await supabase.upsert("countries", upsertRows, "iso2");
      if (upsertCountriesRes.error) return json({ error: upsertCountriesRes.error }, 500);
    }

    const existingProfilesRes = await supabase.selectAll("country_profiles", "id,iso2,category,metrics,sources");
    if (existingProfilesRes.error) return json({ error: existingProfilesRes.error }, 500);
    const existingProfiles = (existingProfilesRes.data || []).filter(p => iso2List.includes(String(p.iso2 || "").toUpperCase()));

    const profileSet = new Set((existingProfiles || []).map(p => `${String(p.iso2).toUpperCase()}|${String(p.category).toLowerCase()}`));
    const createProfiles = [];
    for (const iso2 of iso2List) {
      for (const category of CATEGORIES) {
        const key = `${iso2}|${category}`;
        if (profileSet.has(key)) continue;
        createProfiles.push({
          iso2,
          category,
          metrics: STARTER_METRICS[category],
          narrative: null,
          sources: ["Wikidata (CC0)"]
        });
      }
    }

    if (createProfiles.length) {
      const upsertProfilesRes = await supabase.upsert("country_profiles", createProfiles, "iso2,category");
      if (upsertProfilesRes.error) return json({ error: upsertProfilesRes.error }, 500);
    }

    const allProfilesRes = await supabase.selectAll("country_profiles", "id,iso2,category,metrics,sources");
    if (allProfilesRes.error) return json({ error: allProfilesRes.error }, 500);
    const allProfiles = (allProfilesRes.data || []).filter(p => iso2List.includes(String(p.iso2 || "").toUpperCase()));

    const enrichUpdates = [];
    for (const row of allProfiles) {
      const iso2 = String(row.iso2 || "").toUpperCase();
      const category = String(row.category || "").toLowerCase();
      const enrich = enrichMap.get(iso2);
      if (!enrich) continue;

      const nextMetrics = toMetricObject(row.metrics);
      let changed = false;
      if (category === "political") {
        changed ||= fillBlank(nextMetrics, "Government", enrich.governmentLabel);
        changed ||= fillBlank(nextMetrics, "Head of state", enrich.headOfStateLabel);
        changed ||= fillBlank(nextMetrics, "Head of government", enrich.headOfGovernmentLabel);
      }
      if (category === "economic") {
        changed ||= fillBlank(nextMetrics, "GDP", formatMoney(enrich.gdp));
        changed ||= fillBlank(nextMetrics, "GDP per capita", formatMoney(enrich.gdpPerCapita));
        changed ||= fillBlank(nextMetrics, "Currency", enrich.currencyLabel);
      }
      if (category === "social") {
        changed ||= fillBlank(nextMetrics, "Population", formatInt(enrich.population));
        changed ||= fillBlank(nextMetrics, "Life expectancy", formatYears(enrich.lifeExpectancy));
        changed ||= fillBlank(nextMetrics, "Human Development Index", formatDecimal(enrich.hdi, 3));
      }
      if (category === "military") {
        changed ||= fillBlank(nextMetrics, "Active personnel", formatInt(enrich.militaryPersonnel));
        changed ||= fillBlank(nextMetrics, "Defense spending", formatMoney(enrich.defenseSpending));
      }
      if (!changed) continue;

      const nextSources = normalizeSources(row.sources);
      if (!nextSources.includes("Wikidata (CC0)")) nextSources.push("Wikidata (CC0)");
      enrichUpdates.push({
        id: row.id,
        iso2,
        category,
        metrics: nextMetrics,
        sources: nextSources
      });
    }

    if (enrichUpdates.length) {
      const enrichRes = await supabase.upsert("country_profiles", enrichUpdates, "id");
      if (enrichRes.error) return json({ error: enrichRes.error }, 500);
    }

    return json({
      countriesProcessed: upsertRows.length,
      countriesInserted,
      countriesUpdated,
      profilesCreated: createProfiles.length,
      profilesEnriched: enrichUpdates.length
    });
  } catch (err) {
      return json({ error: String(err?.message || err) }, 500);
  }
};

function extractBearerToken(request) {
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return "";
  return m[1];
}

async function getUserFromAccessToken(url, apiKey, token) {
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

async function fetchWikidataCountries() {
  const endpoint = "https://query.wikidata.org/sparql";
  const url = `${endpoint}?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "GreySpaceWikidataImporter/1.0 (admin api)"
    }
  });
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`);
  const json = await res.json();
  const bindings = json?.results?.bindings || [];
  const unique = new Map();
  for (const row of bindings) {
    const iso2 = String(row?.iso2?.value || "").trim().toUpperCase();
    const name = String(row?.countryLabel?.value || "").trim();
    if (!/^[A-Z]{2}$/.test(iso2) || !name) continue;
    const [lng, lat] = parseWktPoint(String(row?.coord?.value || ""));
    const item = {
      iso2,
      name,
      capital: normalizeOptional(row?.capitalLabel?.value),
      region: normalizeOptional(row?.continentLabel?.value),
      centroid_lat: Number.isFinite(lat) ? lat : null,
      centroid_lng: Number.isFinite(lng) ? lng : null
    };
    const existing = unique.get(iso2);
    if (!existing) unique.set(iso2, item);
    else {
      unique.set(iso2, {
        iso2,
        name: existing.name || item.name,
        capital: existing.capital || item.capital,
        region: existing.region || item.region,
        centroid_lat: existing.centroid_lat ?? item.centroid_lat,
        centroid_lng: existing.centroid_lng ?? item.centroid_lng
      });
    }
  }
  return [...unique.values()];
}

async function fetchWikidataEnrichment() {
  const endpoint = "https://query.wikidata.org/sparql";
  const url = `${endpoint}?query=${encodeURIComponent(ENRICH_QUERY)}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "GreySpaceWikidataImporter/1.0 (admin api phase2)"
    }
  });
  if (!res.ok) throw new Error(`Wikidata enrichment query failed: ${res.status}`);
  const jsonData = await res.json();
  const out = new Map();
  for (const row of jsonData?.results?.bindings || []) {
    const iso2 = String(row?.iso2?.value || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso2)) continue;
    out.set(iso2, {
      governmentLabel: normalizeOptional(row?.governmentLabel?.value),
      headOfStateLabel: normalizeOptional(row?.headOfStateLabel?.value),
      headOfGovernmentLabel: normalizeOptional(row?.headOfGovernmentLabel?.value),
      currencyLabel: normalizeOptional(row?.currencyLabel?.value),
      population: toNum(row?.population?.value),
      gdp: toNum(row?.gdp?.value),
      gdpPerCapita: toNum(row?.gdpPerCapita?.value),
      lifeExpectancy: toNum(row?.lifeExpectancy?.value),
      hdi: toNum(row?.hdi?.value),
      militaryPersonnel: toNum(row?.militaryPersonnel?.value),
      defenseSpending: toNum(row?.defenseSpending?.value)
    });
  }
  return out;
}

function parseWktPoint(input) {
  const m = String(input || "").match(/Point\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return [NaN, NaN];
  return [Number(m[1]), Number(m[2])];
}

function normalizeOptional(v) {
  const s = String(v || "").trim();
  return s || null;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatInt(v) {
  if (!Number.isFinite(Number(v))) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(v));
}

function formatMoney(v) {
  if (!Number.isFinite(Number(v))) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

function formatYears(v) {
  if (!Number.isFinite(Number(v))) return "";
  return `${Number(v).toFixed(1)} years`;
}

function formatDecimal(v, digits = 2) {
  if (!Number.isFinite(Number(v))) return "";
  return Number(v).toFixed(digits);
}

function toMetricObject(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  Object.entries(raw).forEach(([k, v]) => { out[String(k)] = String(v ?? ""); });
  return out;
}

function fillBlank(obj, key, value) {
  if (!value) return false;
  const current = String(obj[key] || "").trim();
  if (current) return false;
  obj[key] = value;
  return true;
}

function normalizeSources(raw) {
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map(v => v.trim()).filter(Boolean);
  return [];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function createSupabaseRestClient(url, serviceRoleKey) {
  const base = `${url}/rest/v1`;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };

  async function selectAll(table, select) {
    const res = await fetch(`${base}/${table}?select=${encodeURIComponent(select)}&limit=5000`, { headers });
    if (!res.ok) return { data: null, error: await res.text() };
    return { data: await res.json(), error: null };
  }

  async function upsert(table, rows, onConflict) {
    const res = await fetch(`${base}/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(rows)
    });
    if (!res.ok) return { error: await res.text() };
    return { error: null };
  }

  return { selectAll, upsert };
}

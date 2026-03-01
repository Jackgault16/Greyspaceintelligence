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
  VALUES ?class {
    wd:Q6256
    wd:Q3624078
    wd:Q161243
    wd:Q3336843
    wd:Q82794
    wd:Q46395
  }
  ?country wdt:P31/wdt:P279* ?class .
  OPTIONAL { ?country wdt:P36 ?capital . }
  OPTIONAL { ?country wdt:P30 ?continent . }
  OPTIONAL { ?country wdt:P625 ?coord . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?countryLabel
`;

export const onRequestPost = async ({ request, env }) => {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return json({ error: "Forbidden" }, 403);
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ANON_KEY) {
      return json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY." }, 500);
    }

    const user = await getUserFromAccessToken(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token);
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

    const existingProfilesRes = await supabase.selectAll("country_profiles", "iso2,category");
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

    return json({
      countriesProcessed: upsertRows.length,
      countriesInserted,
      countriesUpdated,
      profilesCreated: createProfiles.length
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

async function getUserFromAccessToken(url, anonKey, token) {
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
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

function parseWktPoint(input) {
  const m = String(input || "").match(/Point\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!m) return [NaN, NaN];
  return [Number(m[1]), Number(m[2])];
}

function normalizeOptional(v) {
  const s = String(v || "").trim();
  return s || null;
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

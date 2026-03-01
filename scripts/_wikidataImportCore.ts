import type { SupabaseClient } from "@supabase/supabase-js";

type Category = "political" | "military" | "economic" | "social" | "greyspace";

type WikidataCountryRow = {
  iso2: string;
  name: string;
  capital: string | null;
  region: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
};

export type WikidataImportSummary = {
  countriesProcessed: number;
  countriesInserted: number;
  countriesUpdated: number;
  profilesCreated: number;
  profilesEnriched: number;
};

const STARTER_METRICS: Record<Category, Record<string, string>> = {
  political: { Government: "", Stability: "" },
  military: { "Active personnel": "", Reserve: "", "Defense spending": "" },
  economic: { GDP: "", "Key industries": "" },
  social: { Population: "", Urbanization: "", "Life expectancy": "" },
  greyspace: { "Key agencies": "", "Cyber capability": "", "Influence ops": "" }
};

const CATEGORIES: Category[] = ["political", "military", "economic", "social", "greyspace"];

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

const ENRICH_QUERY = `
SELECT ?iso2
       (SAMPLE(?governmentLabel) AS ?governmentLabel)
       (MAX(?population) AS ?population)
       (MAX(?gdp) AS ?gdp)
       (MAX(?lifeExpectancy) AS ?lifeExpectancy)
       (MAX(?defenseSpending) AS ?defenseSpending)
WHERE {
  ?country wdt:P297 ?iso2 .
  OPTIONAL { ?country wdt:P122 ?government . }
  OPTIONAL { ?country wdt:P1082 ?population . }
  OPTIONAL { ?country wdt:P2131 ?gdp . }
  OPTIONAL { ?country wdt:P2250 ?lifeExpectancy . }
  OPTIONAL { ?country wdt:P2206 ?defenseSpending . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?iso2
`;

export async function fetchWikidataCountries(): Promise<WikidataCountryRow[]> {
  const endpoint = "https://query.wikidata.org/sparql";
  const url = `${endpoint}?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "GreySpaceWikidataImporter/1.0 (admin automation)"
    }
  });

  if (!res.ok) {
    throw new Error(`Wikidata query failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const rows = (json?.results?.bindings || []) as any[];

  const unique = new Map<string, WikidataCountryRow>();

  for (const row of rows) {
    const iso2 = String(row?.iso2?.value || "").trim().toUpperCase();
    const name = String(row?.countryLabel?.value || "").trim();
    if (!/^[A-Z]{2}$/.test(iso2)) continue;
    if (!name) continue;

    const coordRaw = String(row?.coord?.value || "");
    const [lng, lat] = parseWktPoint(coordRaw);

    const item: WikidataCountryRow = {
      iso2,
      name,
      capital: normalizeOptional(row?.capitalLabel?.value),
      region: normalizeOptional(row?.continentLabel?.value),
      centroid_lat: Number.isFinite(lat) ? lat : null,
      centroid_lng: Number.isFinite(lng) ? lng : null
    };

    const existing = unique.get(iso2);
    if (!existing) {
      unique.set(iso2, item);
      continue;
    }

    // Prefer fuller row when duplicates appear.
    unique.set(iso2, {
      iso2,
      name: existing.name || item.name,
      capital: existing.capital || item.capital,
      region: existing.region || item.region,
      centroid_lat: existing.centroid_lat ?? item.centroid_lat,
      centroid_lng: existing.centroid_lng ?? item.centroid_lng
    });
  }

  return [...unique.values()];
}

export async function importWikidataCountries(supabase: SupabaseClient): Promise<WikidataImportSummary> {
  const rows = await fetchWikidataCountries();
  const enrichMap = await fetchWikidataEnrichment();
  const iso2List = rows.map(r => r.iso2);

  const { data: existingCountries, error: existingCountriesErr } = await supabase
    .from("countries")
    .select("iso2,name,capital,region,centroid_lat,centroid_lng")
    .in("iso2", iso2List);

  if (existingCountriesErr) {
    throw new Error(`Failed loading existing countries: ${existingCountriesErr.message}`);
  }

  const existingMap = new Map<string, any>((existingCountries || []).map(r => [String(r.iso2).toUpperCase(), r]));

  const upsertRows = rows.map(row => {
    const current = existingMap.get(row.iso2);
    const merged = {
      iso2: row.iso2,
      name: row.name || current?.name || null,
      capital: row.capital ?? current?.capital ?? null,
      region: row.region ?? current?.region ?? null,
      centroid_lat: row.centroid_lat ?? current?.centroid_lat ?? null,
      centroid_lng: row.centroid_lng ?? current?.centroid_lng ?? null
    };
    return merged;
  });

  const inserted = upsertRows.filter(r => !existingMap.has(r.iso2)).length;
  const updated = upsertRows.length - inserted;

  if (upsertRows.length) {
    const { error } = await supabase.from("countries").upsert(upsertRows, { onConflict: "iso2" });
    if (error) throw new Error(`Country upsert failed: ${error.message}`);
  }

  const { data: existingProfiles, error: existingProfilesErr } = await supabase
    .from("country_profiles")
    .select("iso2,category,sources")
    .in("iso2", iso2List);

  if (existingProfilesErr) {
    throw new Error(`Failed loading existing profiles: ${existingProfilesErr.message}`);
  }

  const existingProfileSet = new Set<string>();
  for (const p of existingProfiles || []) {
    existingProfileSet.add(`${String(p.iso2).toUpperCase()}|${String(p.category).toLowerCase()}`);
  }

  const createProfiles: any[] = [];
  for (const iso2 of iso2List) {
    for (const category of CATEGORIES) {
      const key = `${iso2}|${category}`;
      if (existingProfileSet.has(key)) continue;
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
    const { error } = await supabase.from("country_profiles").upsert(createProfiles, { onConflict: "iso2,category" });
    if (error) throw new Error(`Profile bootstrap upsert failed: ${error.message}`);
  }

  const { data: fullProfiles, error: fullProfilesErr } = await supabase
    .from("country_profiles")
    .select("id,iso2,category,metrics,sources")
    .in("iso2", iso2List);

  if (fullProfilesErr) {
    throw new Error(`Failed loading profiles for enrichment: ${fullProfilesErr.message}`);
  }

  const enrichUpdates: any[] = [];
  for (const row of fullProfiles || []) {
    const iso2 = String(row.iso2 || "").toUpperCase();
    const category = String(row.category || "").toLowerCase() as Category;
    const enrich = enrichMap.get(iso2);
    if (!enrich) continue;

    const currentMetrics = toMetricObject(row.metrics);
    const nextMetrics = { ...currentMetrics };
    let changed = false;

    if (category === "political") {
      changed ||= fillBlank(nextMetrics, "Government", enrich.governmentLabel);
    }
    if (category === "economic") {
      changed ||= fillBlank(nextMetrics, "GDP", formatMoney(enrich.gdp));
    }
    if (category === "social") {
      changed ||= fillBlank(nextMetrics, "Population", formatInt(enrich.population));
      changed ||= fillBlank(nextMetrics, "Life expectancy", formatYears(enrich.lifeExpectancy));
    }
    if (category === "military") {
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
    const { error } = await supabase.from("country_profiles").upsert(enrichUpdates, { onConflict: "id" });
    if (error) throw new Error(`Profile enrichment upsert failed: ${error.message}`);
  }

  return {
    countriesProcessed: upsertRows.length,
    countriesInserted: inserted,
    countriesUpdated: updated,
    profilesCreated: createProfiles.length,
    profilesEnriched: enrichUpdates.length
  };
}

async function fetchWikidataEnrichment() {
  const endpoint = "https://query.wikidata.org/sparql";
  const url = `${endpoint}?query=${encodeURIComponent(ENRICH_QUERY)}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "GreySpaceWikidataImporter/1.0 (phase2 enrichment)"
    }
  });
  if (!res.ok) {
    throw new Error(`Wikidata enrichment query failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const out = new Map<string, any>();
  for (const row of (json?.results?.bindings || []) as any[]) {
    const iso2 = String(row?.iso2?.value || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso2)) continue;
    out.set(iso2, {
      governmentLabel: normalizeOptional(row?.governmentLabel?.value),
      population: toNum(row?.population?.value),
      gdp: toNum(row?.gdp?.value),
      lifeExpectancy: toNum(row?.lifeExpectancy?.value),
      defenseSpending: toNum(row?.defenseSpending?.value)
    });
  }
  return out;
}

function parseWktPoint(input: string): [number, number] {
  const match = String(input || "").match(/Point\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
  if (!match) return [NaN, NaN];
  return [Number(match[1]), Number(match[2])];
}

function normalizeOptional(v: unknown): string | null {
  const s = String(v || "").trim();
  return s || null;
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatInt(v: number | null): string {
  if (!Number.isFinite(Number(v))) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(v));
}

function formatMoney(v: number | null): string {
  if (!Number.isFinite(Number(v))) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}

function formatYears(v: number | null): string {
  if (!Number.isFinite(Number(v))) return "";
  return `${Number(v).toFixed(1)} years`;
}

function toMetricObject(raw: any): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[String(k)] = String(v ?? "");
  return out;
}

function fillBlank(obj: Record<string, string>, key: string, value: string | null): boolean {
  if (!value) return false;
  const current = String(obj[key] || "").trim();
  if (current) return false;
  obj[key] = value;
  return true;
}

function normalizeSources(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map(v => v.trim()).filter(Boolean);
  return [];
}

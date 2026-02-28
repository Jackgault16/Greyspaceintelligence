function loadPublicConfigSync() {
    if (window.__APP_CONFIG__) return window.__APP_CONFIG__;

    try {
        const req = new XMLHttpRequest();
        req.open("GET", "/api/public-config", false);
        req.send(null);

        if (req.status >= 200 && req.status < 300) {
            return JSON.parse(req.responseText);
        }
    } catch (err) {
        console.error("Failed to load /api/public-config:", err);
    }

    return {
        MAPBOX_TOKEN: "",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        LIVE_INTEL_TABLE: "live_intel",
        BRIEFING_INTEL_TABLE: "briefing_intel"
    };
}

const PUBLIC_CONFIG = loadPublicConfigSync();
const MAPBOX_TOKEN = PUBLIC_CONFIG.MAPBOX_TOKEN || "";
const SUPABASE_URL = PUBLIC_CONFIG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = PUBLIC_CONFIG.SUPABASE_ANON_KEY || "";
const LIVE_INTEL_TABLE = PUBLIC_CONFIG.LIVE_INTEL_TABLE || "live_intel";
const BRIEFING_INTEL_TABLE = PUBLIC_CONFIG.BRIEFING_INTEL_TABLE || "briefing_intel";

if (!MAPBOX_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Missing public config values. Set MAPBOX_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY in Cloudflare.");
}

const supabase =
    window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY
        ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

async function fetchLiveIntel({ limit = 50, days = 30 } = {}) {
    return fetchIntelByTable(LIVE_INTEL_TABLE, { limit, days });
}

async function fetchBriefingIntel({ limit = 50, days = 30 } = {}) {
    return fetchIntelByTable(BRIEFING_INTEL_TABLE, { limit, days });
}

async function fetchIntelByTable(table, { limit = 50, days = 30 } = {}) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return [];
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const url =
        `${SUPABASE_URL}/rest/v1/${table}` +
        `?select=*` +
        `&timestamp=gte.${encodeURIComponent(since)}` +
        `&order=timestamp.desc` +
        `&limit=${limit}`;

    const res = await fetch(url, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    if (!res.ok) {
        console.error("Failed to fetch live intel", await res.text());
        return [];
    }

    return await res.json();
}

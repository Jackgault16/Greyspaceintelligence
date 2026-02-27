// ===============================
// ENVIRONMENT VARIABLES (Cloudflare Pages)
// ===============================
// Add these in Cloudflare Pages → Settings → Environment Variables:
// MAPBOX_TOKEN
// SUPABASE_URL
// SUPABASE_ANON_KEY

const MAPBOX_TOKEN_PUBLIC = MAPBOX_TOKEN;
const SUPABASE_URL_PUBLIC = SUPABASE_URL;
const SUPABASE_ANON_KEY_PUBLIC = SUPABASE_ANON_KEY;

// ===============================
// SUPABASE CLIENT
// ===============================
const supabase = window.supabase.createClient(
    SUPABASE_URL_PUBLIC,
    SUPABASE_ANON_KEY_PUBLIC
);

// ===============================
// FETCH LIVE INTEL (REST API)
// ===============================
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

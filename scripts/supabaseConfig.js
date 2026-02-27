const MAPBOX_TOKEN = "pk.eyJ1IjoiamFja2dhdWx0MTYiLCJhIjoiY21tM3Jsc2lzMDRnYzJxc2E5NXhiejRyaSJ9.Cf2rNQKOAO307w851VIzxw";

const SUPABASE_URL = "https://pdelotrjiapznwpsfshm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_B91oKhmD6VwNQDZfnzWzzQ_82KWfzoy";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchLiveIntel({ limit = 50, days = 30 } = {}) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const url =
        `${SUPABASE_URL}/rest/v1/live_intel` +
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
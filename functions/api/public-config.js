export const onRequestGet = async ({ env }) => {
    const payload = {
        MAPBOX_TOKEN: env.MAPBOX_TOKEN || "",
        SUPABASE_URL: env.SUPABASE_URL || "",
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || ""
    };

    return new Response(JSON.stringify(payload), {
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store"
        }
    });
};

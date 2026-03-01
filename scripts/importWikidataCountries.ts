import { getSupabaseAdminClient } from "./_supabaseAdmin";
import { importWikidataCountries } from "./_wikidataImportCore";

async function main() {
  const supabase = getSupabaseAdminClient();
  const summary = await importWikidataCountries(supabase);

  console.log("Wikidata bootstrap import complete:");
  console.log(`- countries processed: ${summary.countriesProcessed}`);
  console.log(`- countries inserted: ${summary.countriesInserted}`);
  console.log(`- countries updated: ${summary.countriesUpdated}`);
  console.log(`- profiles created: ${summary.profilesCreated}`);
  console.log(`- profiles enriched: ${summary.profilesEnriched}`);
}

main().catch(err => {
  console.error("Import failed:", err?.message || err);
  process.exit(1);
});

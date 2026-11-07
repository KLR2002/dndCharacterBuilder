/**
 * The single entry to the seed importer, awaited on launch before the app state loads. Metro inlines
 * EXPO_PUBLIC_* at bundle time, so in a build without EXPO_PUBLIC_E2E=1 the minifier reduces this
 * function to an immediate return and the importer never runs. The importer module still ships,
 * unreachable. Metro's cache is not keyed on the flag: clear it when the flag changes between builds.
 */
export async function runE2eSeedHook(): Promise<void> {
  if (process.env.EXPO_PUBLIC_E2E !== "1") return;
  const { importE2eSeed } = await import("./e2eSeedImport.ts");
  await importE2eSeed();
}

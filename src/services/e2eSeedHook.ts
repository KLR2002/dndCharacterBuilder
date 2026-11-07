/**
 * The single entry to the seed importer, awaited on launch before the app state loads. Metro inlines
 * EXPO_PUBLIC_* at bundle time, so in every build without EXPO_PUBLIC_E2E=1 this branch is statically
 * dead and the importer is not in the bundle.
 */
export async function runE2eSeedHook(): Promise<void> {
  if (process.env.EXPO_PUBLIC_E2E !== "1") return;
  const { importE2eSeed } = await import("./e2eSeedImport.ts");
  await importE2eSeed();
}

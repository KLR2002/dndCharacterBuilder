# Spec: Load the SRD Baseline lazily

**Status:** wontfix (measured 2026-11-19; the glossary was corrected instead)

Architecture review candidate #9, marked speculative: "measure start time first".

## Measurements

- **On a device:** a release APK on the `Small_Phone` emulator (x86_64 on the dev host). A measurement build timed the SRD JSON `require`s in `src/services/compendium.ts`; that edit was never committed.
  - Evaluating the SRD Baseline's nine JSON files (2 MB): 3.9-5.4 ms per cold start, over 8 runs.
  - `createCompendium` for the SRD Baseline: 0.0-0.1 ms.
  - Cold start: process start to `Running "main"` takes about 330-470 ms, and to the first frame (`am start -W` TotalTime) about 530-730 ms. The evaluation runs about 30 ms after `Running "main"`, on the first render.
- **Desktop Node:** an evaluation plus a Spell Page with the integrated test compendium spends 0.12 ms of 3.7 ms in name lookups (200 lookups per pass).

## Decision

- **Lazy building and lookup indexes are not built.** Evaluating the SRD Baseline is under 1% of a cold start, and lookups are about 3% of an evaluation; a slower phone would scale both alike.
- **The glossary is corrected.** It said Dataset Swapping unloads the SRD Baseline. The code keeps it loaded, and that is needed:
  - as the fallback for a collection the Integrated Catalog lacks (`resolve` in `compendium.ts`)
  - for a held class the catalog lacks (`srdBaselineClasses` in `classData.ts`)
  - as the reference for plain race forms (`srdBaselineRaces` in `AncestrySection`)
- **Not measured:** the JS heap the SRD Baseline holds while an Integrated Catalog is loaded.

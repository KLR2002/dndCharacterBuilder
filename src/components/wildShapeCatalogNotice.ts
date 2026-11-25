export type WildShapeCatalogNotice = "beasts" | "monsterManual" | "none";

// The SRD Baseline carries its own beasts, so only an Integrated Catalog gets a notice. A catalog without beasts offers
// the download in place of the Monster Manual reminder.
export function wildShapeCatalogNotice({ integrated, lacksBeasts, mmActive }: { integrated: boolean; lacksBeasts: boolean; mmActive: boolean }): WildShapeCatalogNotice {
  if (!integrated) return "none";
  if (lacksBeasts) return "beasts";
  if (!mmActive) return "monsterManual";
  return "none";
}

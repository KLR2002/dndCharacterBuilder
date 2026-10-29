import { REQUIRED_CATALOG_FORMAT } from "./compendiumStorage.ts";

export interface CatalogUpdateNoticeInput {
  integrated: boolean;
  stale: boolean;
  /** The Catalog Format the user was last told about; absent when never informed. */
  informedFormat: number | undefined;
  isFirstRun: boolean;
}

export function shouldShowCatalogUpdateNotice({ integrated, stale, informedFormat, isFirstRun }: CatalogUpdateNoticeInput): boolean {
  if (isFirstRun || !integrated || !stale) return false;
  return informedFormat === undefined || informedFormat < REQUIRED_CATALOG_FORMAT;
}

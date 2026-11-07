export const E2E_PROPERTY: string;
export const UPDATES_ENABLED_META_NAME: string;
export const UPDATES_ENABLED_PLACEHOLDER: string;
export const E2E_PRESENT_EXPRESSION: string;
export function updatesEnabledValue(e2e: boolean): string;
export function releaseDebuggable(e2e: boolean): boolean;
export function withUpdatesEnabledPlaceholder(manifestXml: string): string;
export function resolveUpdatesEnabledPlaceholder(manifestXml: string, e2e: boolean): string;
export function withE2eBuildSettings(appBuildGradle: string): string;

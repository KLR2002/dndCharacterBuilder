// Node 24 resolves an explicit directory argument through index.js.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const checksDir = fileURLToPath(new URL(".", import.meta.url));
for (const file of readdirSync(checksDir).filter(file => file.endsWith(".test.ts")).sort()) {
  await import(pathToFileURL(join(checksDir, file)).href);
}

// Node 24 resolves an explicit directory argument through index.js.
const { readdirSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const { join } = require("node:path");
(async () => {
  for (const file of readdirSync(__dirname).filter(file => file.endsWith(".test.ts")).sort()) {
    await import(pathToFileURL(join(__dirname, file)).href);
  }
})();

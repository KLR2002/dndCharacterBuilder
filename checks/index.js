// Node 24 resolves an explicit directory argument through index.js, so this file must keep its name.
/* global __dirname */
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
(async () => {
  for (const file of readdirSync(__dirname).filter(file => file.endsWith(".test.ts")).sort()) {
    await import(pathToFileURL(join(__dirname, file)).href);
  }
})();

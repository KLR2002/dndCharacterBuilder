// A tiny static file server for an `expo export -p web` output folder: it serves files from the export
// directory and falls back to the route's index.html (the root one for unknown routes), so client-side
// routes such as /character/<id> work. Usage: node scripts/lib/static-server.mjs <dir> <port>
import http from "node:http";
import fs from "node:fs";
import { extname, join, normalize } from "node:path";

const root = normalize(process.argv[2]);
const port = Number(process.argv[3]);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let file = normalize(join(root, pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = fs.existsSync(join(file, "index.html")) ? join(file, "index.html") : join(root, "index.html");
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`serving ${root} on port ${port}`));

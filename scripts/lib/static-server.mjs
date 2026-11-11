// A tiny static file server for an `expo export -p web` output folder: it serves files from the export
// directory and falls back to the route's index.html (the root one for unknown routes), so client-side
// routes such as /character/<id> work. Usage: node scripts/lib/static-server.mjs <dir> <port>
import http from "node:http";
import fs from "node:fs";
import path, { extname, join, resolve } from "node:path";

const root = resolve(process.argv[2]);
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

// A file is inside the export folder only when its relative path stays within it: a sibling folder whose name
// starts with the same text (`dist-old` beside `dist`) must not pass.
function isInside(file) {
  const rel = path.relative(root, file);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname.includes("\0")) throw new Error("NUL in path");
  } catch {
    res.writeHead(400);
    res.end("bad request");
    return;
  }
  let file = resolve(join(root, pathname));
  if (!isInside(file)) {
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
});

server.on("error", (error) => {
  console.error(`static server on port ${port} failed: ${error.message}`);
  process.exit(1);
});

server.listen(port, () => console.log(`serving ${root} on port ${port}`));

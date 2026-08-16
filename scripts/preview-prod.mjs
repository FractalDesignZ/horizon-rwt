#!/usr/bin/env node
/**
 * Local stand-in for Vercel route order:
 *   1. filesystem (.vercel/output/static)
 *   2. nitro server function
 * Used only to verify the production build renders (asset MIME + HTML).
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const ROOT = "/workspace/.vercel/output/static";
const PORT = Number(process.env.PROD_PREVIEW_PORT || 8090);
const MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ico": "image/x-icon",
};

const nitro = await import("/workspace/.vercel/output/functions/__server.func/index.mjs");
const handle = nitro.default;

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const rel = decodeURIComponent(url.pathname);
  const file = normalize(join(ROOT, rel));
  if (file.startsWith(ROOT) && existsSync(file) && statSync(file).isFile()) {
    res.statusCode = 200;
    res.setHeader("content-type", MIME[extname(file)] || "application/octet-stream");
    createReadStream(file).pipe(res);
    return;
  }
  try {
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
    });
    const response = await handle.fetch(request);
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end("preview error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`prod preview http://127.0.0.1:${PORT}/`);
});

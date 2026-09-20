import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { configuration, createGateway } from "./gateway.mjs";
const config = configuration(),
  gateway = createGateway(config);
const root = fileURLToPath(new URL("../", import.meta.url));
const vite = config.production
  ? null
  : await (
      await import("vite")
    ).createServer({
      root,
      server: {
        middlewareMode: true,
        hmr: {
          port: Number(
            process.env.PULSE_HMR_PORT ||
              Number(process.env.PORT || 8080) + 10000,
          ),
        },
      },
      appType: "spa",
    });
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    return res.end(req.method === "HEAD" ? undefined : '{"status":"ok"}');
  }
  if (await gateway(req, res)) return;
  if (vite) return vite.middlewares(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    return res.end();
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, config.origin).pathname,
    );
    const target = path.resolve(root, "dist", "." + pathname),
      base = path.join(root, "dist");
    if (!target.startsWith(base + path.sep) && target !== base) {
      res.writeHead(404);
      return res.end();
    }
    let bytes,
      ext = path.extname(target);
    try {
      bytes = await readFile(target);
    } catch {
      if (ext) {
        res.writeHead(404);
        return res.end();
      }
      bytes = await readFile(path.join(base, "index.html"));
      ext = ".html";
    }
    res.setHeader(
      "Cache-Control",
      pathname.startsWith("/assets/") && ext !== ".html"
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' https://appleid.cdn-apple.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: https:; connect-src 'self' https:; frame-src 'self' https://appleid.apple.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch {
    res.writeHead(500);
    res.end("Unable to load Pulse");
  }
});
const port = Number(process.env.PORT || 8080);
server.listen(port, process.env.PULSE_H5_BIND_HOST || "127.0.0.1", () =>
  console.log(`Pulse H5: ${config.origin}`),
);

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 15000).unref();
  });

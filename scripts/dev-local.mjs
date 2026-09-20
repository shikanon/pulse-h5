import net from "node:net";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  repo = process.env.PULSE_API_REPO || path.resolve(root, "../pulse-api");
const data = path.join(root, ".data/local-api");
await mkdir(data, { recursive: true });
const apiPort = process.env.PULSE_LOCAL_API_PORT || "18887",
  h5Port = process.env.PORT || "8080",
  origin = `http://127.0.0.1:${h5Port}`;
for (const port of [apiPort, h5Port])
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () =>
      reject(Error(`Port ${port} is in use; choose another local port`)),
    );
    probe.listen(Number(port), "127.0.0.1", () => probe.close(resolve));
  });
const api = spawn(process.env.GO_BINARY || "go", ["run", "./cmd/pulse-api"], {
  cwd: repo,
  stdio: "inherit",
  detached: true,
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    PULSE_ENVIRONMENT: "development",
    PULSE_BIND_HOST: "127.0.0.1",
    PORT: apiPort,
    DATA_FILE: path.join(data, "pulse.json"),
    PULSE_ARTIFACT_ROOT: path.join(data, "artifacts"),
    PUBLIC_WEB_ORIGIN: origin,
    CORS_ORIGINS: process.env.PULSE_LOCAL_CORS_ORIGINS || origin,
    PULSE_AGENT_MODE: "deterministic-local",
    GENERATION_STAGE_DELAY_MS: "450",
  },
});
let web;
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  if (api.pid) {
    try {
      process.kill(-api.pid, "SIGTERM");
    } catch {}
  }
  web?.kill("SIGTERM");
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
api.on("error", (e) => {
  console.error("Cannot start local API:", e.message);
  close();
  process.exitCode = 1;
});
api.on("exit", () => {
  if (!closing) {
    close();
    process.exitCode = 1;
  }
});
try {
  for (let i = 0; i < 60; i++) {
    if (closing) break;
    let ready = false;
    try {
      ready = (await fetch(`http://127.0.0.1:${apiPort}/healthz`)).ok;
    } catch {}
    if (ready) {
      web = spawn(process.execPath, ["server/index.mjs"], {
        cwd: root,
        stdio: "inherit",
        env: {
          ...process.env,
          NODE_ENV: "development",
          PORT: h5Port,
          PULSE_API_ORIGIN: `http://127.0.0.1:${apiPort}`,
          PULSE_H5_ORIGIN: origin,
          PULSE_DEV_USER: "pulse.h5.e2e",
        },
      });
      web.on("exit", close);
      web.on("error", (e) => {
        console.error("Cannot start H5:", e.message);
        close();
        process.exitCode = 1;
      });
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!web && !closing) throw Error("Local API failed to become ready");
} catch (e) {
  console.error(e.message);
  close();
  process.exitCode = 1;
}

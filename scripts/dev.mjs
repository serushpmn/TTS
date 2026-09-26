import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const python = path.join(
  root,
  "backend",
  ".venv",
  isWin ? "Scripts/python.exe" : "bin/python",
);
const npmCmd = isWin ? "npm.cmd" : "npm";
const children = [];

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!existsSync(python)) {
  fail("Backend virtualenv missing. Run once:  npm run setup");
}
if (!existsSync(path.join(root, "frontend", "node_modules"))) {
  fail("Frontend packages missing. Run once:  npm run setup");
}

function run(label, command, args, cwd) {
  console.log(`→ starting ${label}`);
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`\n[${label}] stopped (${signal || code}). Closing the rest…`);
    shutdown(typeof code === "number" ? code : 1);
  });
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.pid) continue;
    try {
      if (isWin) {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          shell: true,
        });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run(
  "backend",
  python,
  ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
  path.join(root, "backend"),
);
run(
  "frontend",
  npmCmd,
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
  path.join(root, "frontend"),
);

setTimeout(() => {
  const url = "http://localhost:5173";
  console.log(`\nDialogue Studio → ${url}\nPress Ctrl+C to stop both servers.\n`);
  if (isWin) {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}, 2800);

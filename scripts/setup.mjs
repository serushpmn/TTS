import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const venvPython = path.join(
  root,
  "backend",
  ".venv",
  isWin ? "Scripts/python.exe" : "bin/python",
);
const npmCmd = isWin ? "npm.cmd" : "npm";

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${command} ${args.join(" ")}`);
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: isWin });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function resolvePythonLauncher() {
  if (existsSync(venvPython)) return null;
  // Prefer 3.12, then 3.11, then 3.10 — Kokoro needs <3.13.
  return isWin ? "py" : "python3";
}

async function ensureVenv() {
  if (existsSync(venvPython)) {
    console.log("✓ backend/.venv already exists");
    return;
  }
  const launcher = resolvePythonLauncher();
  const backend = path.join(root, "backend");
  console.log("Creating backend/.venv with Python 3.12…");
  try {
    if (isWin) {
      await run(launcher, ["-3.12", "-m", "venv", ".venv"], backend);
    } else {
      await run(launcher, ["-m", "venv", ".venv"], backend);
    }
  } catch {
    if (isWin) {
      console.log("Python 3.12 not found via py launcher, trying 3.11…");
      await run("py", ["-3.11", "-m", "venv", ".venv"], backend);
    } else {
      throw new Error("Could not create venv. Install Python 3.10–3.12.");
    }
  }
}

async function main() {
  console.log("Dialogue Studio setup");
  await ensureVenv();
  await run(venvPython, ["-m", "pip", "install", "--upgrade", "pip"], path.join(root, "backend"));
  await run(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"], path.join(root, "backend"));
  await run(npmCmd, ["install"], path.join(root, "frontend"));
  console.log("\nSetup complete. Start the app with:\n  npm run dev\nor double-click Start.bat\n");
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message}`);
  process.exit(1);
});

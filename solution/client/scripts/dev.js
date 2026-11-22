import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const cwd = fileURLToPath(new URL("..", import.meta.url));
const processes = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const [command, args] of [
  [
    process.env.PYTHON || "../server/.venv/bin/python",
    [
      "-m",
      "uvicorn",
      "server.main:app",
      "--app-dir", "..",
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
    ],
  ],
  [process.execPath, ["node_modules/vite/bin/vite.js"]],
]) {
  const child = spawn(command, args, { stdio: "inherit", cwd });
  processes.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 1));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const forwarded = process.argv.slice(2);
const nextArgs = ["dev"];

for (let index = 0; index < forwarded.length; index += 1) {
  const argument = forwarded[index];
  if (argument === "--host") {
    nextArgs.push("--hostname", forwarded[index + 1]);
    index += 1;
  } else if (argument !== "--strictPort") {
    nextArgs.push(argument);
  }
}

const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...nextArgs], {
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});

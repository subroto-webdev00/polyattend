// Simulate the two pipeline behaviours to show why the schema step silently
// produced a broken file before.
const { execSync } = require("child_process");
// A command that fails, like pg_dump hitting a server version mismatch.
const failing = process.platform === "win32" ? "cmd /c exit 1" : "sh -c 'exit 1'";
function run(pipefail) {
  const s = pipefail
    ? `set -o pipefail; ${failing} | gzip > /dev/null; echo $?`
    : `${failing} | gzip > /dev/null; echo $?`;
  return execSync(`bash -c ${JSON.stringify(s)}`, { shell: "bash" }).toString().trim();
}
console.log("  WITHOUT pipefail (my old workflow): exit code = " + run(false) + "   <-- looked like success");
console.log("  WITH    pipefail (fixed)         : exit code = " + run(true)  + "   <-- now fails loudly");

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const distPublic = path.resolve(root, "dist", "public");
const indexHtml = path.resolve(distPublic, "index.html");

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(distPublic)) {
  fail(`error: missing client build directory: ${distPublic}\nrun: pnpm build`);
}

if (!fs.existsSync(indexHtml)) {
  fail(`error: missing client build entry: ${indexHtml}\nrun: pnpm build`);
}

// success: no output

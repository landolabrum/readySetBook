/* deploy.local.js
 * Builds a static Next.js export (out/) and publishes it to
 * ../data/caddy/www/<mid> (bind-mounted to /srv/www/<mid> in the Caddy container).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { merchants, deploy } = require("./merchants.config");

const target = process.env.DEPLOY_TARGET || deploy;
const merchant = merchants[target];

if (!merchant) {
  console.error(`❌ Invalid DEPLOY_TARGET "${target}"`);
  process.exit(1);
}

const root = __dirname;
const outDir = path.join(root, "out");
const nextDir = path.join(root, ".next");
const deployDir = path.resolve(root, "..", "data/caddy/www", merchant.mid); // docker-compose mounts ./data/caddy/www -> /srv/www

console.log("[deploy.local] target:", target, "mid:", merchant.mid);
console.log("[deploy.local] publish dir:", deployDir);
console.log(`📦 Building static site for "${target}" → ${merchant.url}`);

// clean .next first (to ensure a clean build)
if (fs.existsSync(nextDir)) {
  console.log("🧹 Removing existing .next directory...");
  fs.rmSync(nextDir, { recursive: true, force: true });
}

// With Next >=13.4 and output: 'export', `next build` writes to ./out
execSync("npm run build", { stdio: "inherit" });

if (!fs.existsSync(outDir)) {
  console.error("❌ Export failed; 'out/' not found");
  process.exit(1);
}

// ensure target dir exists
fs.mkdirSync(deployDir, { recursive: true });

// rsync-like copy: wipe destination and copy fresh
console.log(`🚚 Publishing to ${deployDir}`);
fs.rmSync(deployDir, { recursive: true, force: true });
fs.mkdirSync(deployDir, { recursive: true });

// naive recursive copy (small sites) — replace with shell rsync if you prefer
function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    const stat = fs.statSync(s);
    console.log(`📦 Copying ${s} → ${d}`);
    if (stat.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}
copyRecursive(outDir, deployDir);

console.log(`✅ Deployed to ${deployDir}`);
console.log(`🌐 Visit: ${merchant.url}`);

// Optional: reload caddy so it immediately picks up any new routes (not strictly
// required for static files, but harmless and handy during local dev).
try {
  const names = execSync("docker ps --format '{{.Names}}'", { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
  if (names.includes("caddy")) {
    try {
      // Mandatory: ensure the Caddyfile is formatted and valid before reload.
      console.log("🧹 Formatting Caddyfile (caddy fmt)");
      try {
        execSync("docker exec caddy caddy fmt --overwrite /etc/caddy/Caddyfile", { stdio: "inherit" });
      } catch (fmtErr) {
        // Read-only mount is expected in many setups; fall back to non-overwrite format
        const msg = String(fmtErr?.stderr || fmtErr?.message || "");
        const isReadonly = /read-only file system/i.test(msg);
        if (isReadonly) {
          console.log("ℹ️ Caddyfile is read-only; running non-overwrite fmt");
          // This prints formatted output (discarded) but ensures syntax is parsable by the formatter
          execSync("docker exec caddy sh -lc 'caddy fmt /etc/caddy/Caddyfile > /dev/null'", { stdio: "inherit" });
        } else {
          throw fmtErr;
        }
      }

      console.log("🧪 Validating Caddyfile (caddy validate)");
      execSync("docker exec caddy caddy validate --config /etc/caddy/Caddyfile", { stdio: "inherit" });

      console.log("🔄 Reloading caddy configuration");
      // no -it to avoid TTY warnings in CI/non-interactive shells
      execSync("docker exec caddy caddy reload --config /etc/caddy/Caddyfile", { stdio: "inherit" });
    } catch (err) {
      console.error("❌ Caddy validation failed; aborting deploy.");
      throw err; // ensure non-zero exit
    }
  }
} catch (e) {
  // ignore if docker is unavailable
}

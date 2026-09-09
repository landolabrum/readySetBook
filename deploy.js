const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");
const ghpages = require("gh-pages");
const { merchants, deploy } = require("./merchants.config");

// Publish target for gh-pages. Prefer SSH (this fleet authenticates to GitHub
// via SSH key — HTTPS has no credential helper here and fails "No anonymous
// write access"). Override with DEPLOY_REPO in contexts that need HTTPS+token.
const REPO =
  process.env.DEPLOY_REPO ||
  merchants[deploy]?.repo ||
  "git@github.com:landolabrum/deepturn.git";

// Next static export output folder (default for `next export`)
const OUT_DIR = path.join(__dirname, "out");
const target = process.env.DEPLOY_TARGET || deploy;
const merchant = merchants[target];
const customDomain =
  process.env.DEPLOY_DOMAIN ||
  (merchant?.url ? new URL(merchant.url).hostname : undefined);

function run(cmd) {
  execSync(cmd, {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
  });
}

async function main() {
  console.log(`[deploy] target: ${target} | site: ${merchant?.url || "unknown"} | repo: ${REPO}`);
  console.log(`[deploy] CNAME domain: ${customDomain || "(none)"}`);

  // Write build timestamp to static file
  const buildInfo = {
    timestamp: new Date().toISOString(),
    formatted: new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }),
    target,
    merchant: merchant?.name || target
  };
  const publicDir = path.join(__dirname, "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(publicDir, "build-info.json"),
    JSON.stringify(buildInfo, null, 2)
  );
  console.log(`[deploy] wrote build-info.json -> ${buildInfo.formatted}`);

  // Build (Next handles the static export via output: 'export')
  run("npm run build");

  if (customDomain) {
    fs.writeFileSync(path.join(OUT_DIR, "CNAME"), `${customDomain}\n`);
    console.log(`[deploy] wrote CNAME -> ${customDomain}`);
  } else {
    console.warn("[deploy] No custom domain detected; skipping CNAME");
  }

  ghpages.publish(
    OUT_DIR,
    {
      repo: REPO,
      branch: "gh-pages",
      dotfiles: true,
      message: `deploy ${new Date().toISOString()}`,
      verbose: true,
      // Optional: set commit author if your global config isn't set
      // user: { name: "admin", email: "admin@local" },
    },
    (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log("✅ Deployed to GitHub Pages");
    }
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

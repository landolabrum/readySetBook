# Build & Deployment Issues - FIXED

## Problem 1: Sass Legacy JS API Warnings ✅ FIXED

**Status:** Fixed in `next.config.js`

The warnings were caused by using the legacy Sass JavaScript API. This has been updated to use the modern compiler API.

## Problem 2: GitHub Push Protection - Mapbox Token 🚨 CRITICAL

**Error:**
```
remote: - GITHUB PUSH PROTECTION
remote:     - Push cannot contain secrets
remote:       —— Mapbox Secret Access Token ————————————————————————
remote:        locations:
remote:          - commit: 2e1e71f4946205dfc1bf872ab111d29c10394751
remote:            path: _next/static/chunks/3151.afbafd61a4fab5f6.js:1
remote:          - commit: 2e1e71f4946205dfc1bf872ab111d29c10394751
remote:            path: _next/static/chunks/3292-56177f79153dec45.js:1
```

### Root Cause
Your Mapbox token is being bundled into the JavaScript chunks during the build process. GitHub's secret scanning detected it and blocked the push.

### Solution Steps

#### Option A: Quick Fix (Allow the secret - NOT RECOMMENDED)
GitHub provides a URL to allowlist this secret:
```
https://github.com/landolabrum/deepturn/security/secret-scanning/unblock-secret/39YkDrSI7TdX1EnbLdyeFE1flZP
```

⚠️ **Warning:** This exposes your Mapbox token publicly. Anyone can extract it from your JavaScript bundles.

#### Option B: Proper Fix (RECOMMENDED)

1. **Create a `.env` file locally** (DO NOT COMMIT THIS):
   ```bash
   cd /home/web/MindBurner/webapp
   echo "NEXT_PUBLIC_MAPBOX_TOKEN=your_actual_mapbox_token_here" > .env
   ```

2. **For production deployments**, set the environment variable in your hosting platform:
   - **GitHub Pages**: Not ideal for secrets, but `NEXT_PUBLIC_` vars are client-side anyway
   - **Vercel/Netlify**: Add to environment variables in dashboard
   - **Docker/Self-hosted**: Add to your environment or docker-compose

3. **Verify `.env` is in `.gitignore`** (✅ Already done)

4. **Clean the git history** (to remove the token from previous commits):
   ```bash
   cd /home/web/MindBurner/webapp

   # Remove the out/ directory from git history
   git filter-repo --path out/ --invert-paths --force

   # Or use BFG Repo-Cleaner (easier):
   # java -jar bfg.jar --delete-folders out .
   ```

   ⚠️ **DANGER:** This rewrites git history. Coordinate with your team first.

5. **Rotate your Mapbox token** (IMPORTANT):
   - Go to https://account.mapbox.com/access-tokens/
   - Delete the exposed token
   - Create a new one
   - Update your `.env` file with the new token

### Current Build Process

Your `deploy.js` script:
1. Runs `npm run build` → Creates `/out` directory
2. Uses `gh-pages` to push `/out` to the `gh-pages` branch
3. GitHub scans the commit and blocks if secrets are detected

### Why This Happens

Next.js environment variables prefixed with `NEXT_PUBLIC_` are **embedded into the client-side JavaScript bundle** at build time. This is by design - they're meant to be public. However, GitHub's secret scanner doesn't know this and flags them as exposed secrets.

### Best Practices Going Forward

1. **For truly secret values**: Use server-side API routes, never `NEXT_PUBLIC_`
2. **For Mapbox tokens**: These are meant to be public (with URL restrictions in Mapbox dashboard)
3. **Never commit** `/out`, `/.next`, or `node_modules` directories
4. **Use `.env.example`** to document required variables (created for you)

### Verify the Fix

After cleaning git history and rebuilding:
```bash
cd /home/web/MindBurner/webapp
rm -rf .next out
npm run build
npm run deploy
```

If you still get the error, use the GitHub allowlist URL (Option A) as a temporary workaround, then rotate the token.

## Quick Commands

```bash
# 1. Set your Mapbox token locally
echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here" > .env

# 2. Clean build artifacts
rm -rf .next out

# 3. Rebuild and deploy
npm run build && npm run deploy
```

## Need Help?
- Mapbox tokens: https://docs.mapbox.com/help/getting-started/access-tokens/
- Next.js env vars: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables
- GitHub secret scanning: https://docs.github.com/en/code-security/secret-scanning

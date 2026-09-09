# Build Errors - Summary & Solutions

## ✅ Fixed Issues

### 1. Sass Legacy JS API Warnings
**Status:** FIXED
**What was changed:** Updated [next.config.js](next.config.js#L58) to use `api: 'modern-compiler'` instead of legacy Sass API.

### 2. GitHub Push Protection
**Status:** REQUIRES ACTION
**Error:** GitHub detected Mapbox token in built files and blocked push.

## 🚨 Critical: Mapbox Token Issue

Your Mapbox access token was embedded in the JavaScript bundles at:
- `_next/static/chunks/3151.afbafd61a4fab5f6.js`
- `_next/static/chunks/3292-56177f79153dec45.js`

### Why This Happened
- Environment variables with `NEXT_PUBLIC_` prefix are bundled into client JS
- GitHub's secret scanner detected the token pattern and blocked the push
- The token is from commit `2e1e71f4946205dfc1bf872ab111d29c10394751`

## 🔧 How to Fix

### Option 1: Allow the Secret (QUICK - Not Recommended)
Click this link to tell GitHub to allow this secret:
```
https://github.com/landolabrum/deepturn/security/secret-scanning/unblock-secret/39YkDrSI7TdX1EnbLdyeFE1flZP
```
⚠️ **Warning:** Your token will be public in your JavaScript files. Anyone can extract and use it.

### Option 2: Clean History & Rotate Token (RECOMMENDED)

1. **Set up environment variable locally:**
   ```bash
   cd /home/web/MindBurner/webapp
   echo "NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here" > .env
   ```

2. **Clean git history to remove the token:**
   ```bash
   # Install git-filter-repo if not installed:
   # pip3 install git-filter-repo

   git filter-repo --path out/ --invert-paths --force
   ```

3. **Rotate your Mapbox token:**
   - Visit https://account.mapbox.com/access-tokens/
   - Delete the old token (starts with `pk.`)
   - Create a new token
   - Update your `.env` file with the new token

4. **Rebuild and deploy:**
   ```bash
   rm -rf .next out
   npm run build
   npm run deploy
   ```

### Option 3: Use Interactive Fix Script
```bash
./fix-deployment.sh
```

## 📋 What Was Created

1. [`.env.example`](.env.example) - Template for environment variables
2. [`DEPLOYMENT_FIX.md`](DEPLOYMENT_FIX.md) - Detailed troubleshooting guide
3. [`fix-deployment.sh`](fix-deployment.sh) - Interactive fix script
4. Updated [`next.config.js`](next.config.js) - Fixed Sass warnings

## ✨ Understanding the Build

Your deployment process:
1. `npm run build` → Creates static files in `/out`
2. `npm run deploy` → Pushes `/out` to `gh-pages` branch
3. GitHub Pages serves from `gh-pages` branch

The `/out` and `/.next` directories are already in [`.gitignore`](.gitignore), which is correct.

## 🔐 Security Notes

- Mapbox tokens with `NEXT_PUBLIC_` are **meant to be public**
- Protect them using URL restrictions in your Mapbox dashboard
- For truly secret values, use server-side API routes (no `NEXT_PUBLIC_` prefix)
- Never commit `.env` files (already in `.gitignore`)

## 🎯 Quick Start

```bash
# 1. Create your environment file
echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_actual_token" > .env

# 2. Clean and rebuild
rm -rf .next out && npm run build

# 3. Deploy
npm run deploy
```

If you still get the GitHub error after cleaning, use Option 1 to allowlist the secret, then immediately rotate the token.

## 📚 Resources

- [Mapbox Access Tokens](https://docs.mapbox.com/help/getting-started/access-tokens/)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [Sass Modern API](https://sass-lang.com/documentation/js-api/)

## Need More Help?

The Sass warnings are now fixed. For the GitHub push protection:
- **Fastest:** Use the allowlist URL (Option 1)
- **Most Secure:** Clean history and rotate token (Option 2)
- **Easiest:** Run `./fix-deployment.sh` and follow prompts

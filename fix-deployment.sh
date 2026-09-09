#!/bin/bash
# fix-deployment.sh - Fix Sass warnings and GitHub push protection

set -e

cd "$(dirname "$0")"

echo "🔧 Fixing deployment issues..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  WARNING: .env file not found!"
    echo ""
    echo "Create a .env file with your Mapbox token:"
    echo "  echo 'NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here' > .env"
    echo ""
    echo "Get your token from: https://account.mapbox.com/access-tokens/"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to exit..."
fi

# Clean build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf .next out

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "✅ Sass warnings have been fixed in next.config.js"
echo ""
echo "🚨 IMPORTANT: GitHub Push Protection Issue"
echo ""
echo "Your previous build contained a Mapbox token in the JavaScript bundles."
echo "GitHub blocked the push to protect your secret."
echo ""
echo "OPTIONS:"
echo ""
echo "1. [RECOMMENDED] Clean git history and rotate token:"
echo "   - Remove out/ from git history"
echo "   - Create new Mapbox token"
echo "   - Update .env with new token"
echo ""
echo "2. [QUICK FIX] Allow GitHub to accept this secret:"
echo "   Visit: https://github.com/landolabrum/deepturn/security/secret-scanning/unblock-secret/39YkDrSI7TdX1EnbLdyeFE1flZP"
echo "   ⚠️  This exposes your token publicly!"
echo ""
echo "3. [WORKAROUND] Deploy to a different branch without gh-pages restrictions"
echo ""
read -p "Choose option (1/2/3) or press Ctrl+C to exit: " choice

case $choice in
    1)
        echo ""
        echo "To clean git history, run:"
        echo "  git filter-repo --path out/ --invert-paths --force"
        echo ""
        echo "Then rotate your Mapbox token at:"
        echo "  https://account.mapbox.com/access-tokens/"
        echo ""
        echo "Update your .env file with the new token and rebuild."
        ;;
    2)
        echo ""
        echo "Opening GitHub allowlist URL in 3 seconds..."
        sleep 3
        xdg-open "https://github.com/landolabrum/deepturn/security/secret-scanning/unblock-secret/39YkDrSI7TdX1EnbLdyeFE1flZP" 2>/dev/null || echo "Please visit the URL manually"
        ;;
    3)
        echo ""
        echo "Deploy to a different branch or hosting platform."
        echo "Consider: Vercel, Netlify, or Cloudflare Pages"
        ;;
    *)
        echo "Invalid option. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Ensure .env has NEXT_PUBLIC_MAPBOX_TOKEN set"
echo "  2. Run: npm run build"
echo "  3. Run: npm run deploy"
echo ""

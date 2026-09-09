/* eslint-disable no-console */
require("dotenv").config(); // loads .env into process.env
const path = require("path");
const { merchants, deploy } = require("./merchants.config"); // assumes CJS export

const target = process.env.DEPLOY_TARGET || deploy;
const merchant = merchants[target];

if (!merchant) {
  console.error(`[next.config] Invalid DEPLOY_TARGET "${target}"`);
  process.exit(1);
}

console.log("[next.config] DEPLOY_TARGET:", target);
console.log("[next.config] SITE_URL:", merchant.url);

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,

  output: "export",
  trailingSlash: true,

  // Configure output tracing root to silence monorepo lockfile warning
  outputFileTracingRoot: path.resolve(__dirname, ".."),

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },

  env: {
    SITE_URL: merchant.url,
  },

  /** 🔧 REQUIRED for Cloudflare dev tunnel */
  allowedDevOrigins: [
    "deepturn.com",
    "192.168.10.65"
  ],

  webpack: (config, { defaultLoaders, isServer }) => {
    // ---------- Match TS path aliases at runtime ----------
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@Canopy": path.resolve(__dirname, "src/modules/apps/Canopy"),
      "@ui": path.resolve(__dirname, "src/modules/ui"),
      "@webstack": path.resolve(__dirname, "src/webstack"),
      "@shared": path.resolve(__dirname, "src/modules/shared"),
      "@": path.resolve(__dirname, "src"),
      "~": path.resolve(__dirname), // keep legacy ~/... imports working
    };

    // ---------- Existing style handling with modern Sass API ----------
    config.module.rules.push({
      test: /\.s?css$/,
      oneOf: [
        { resourceQuery: /raw/, use: ["style-loader", "css-loader"] },
        {
          use: [
            defaultLoaders.babel,
            {
              loader: require("styled-jsx/webpack").loader,
              options: {
                type: "scoped",
                sassOptions: {
                  api: 'modern-compiler', // Use modern Sass API instead of legacy
                },
              },
            },
          ],
        },
      ],
    });

    // Fix ESM packages in node_modules when bundling for the client
    if (!isServer) {
      config.module.rules.push({
        test: /\.m?js$/,
        include: /node_modules/,
        resolve: { fullySpecified: false },
      });
    }

    return config;
  },

  experimental: {
    webpackBuildWorker: false,
  },
};

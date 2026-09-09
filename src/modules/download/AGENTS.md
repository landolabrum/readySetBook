# Download module — Product Engineer scope

User-facing **Download page** for the distributable MindBurn platform. Lists the three device classes and the **current build available**, and hands the user a one-command install for their class. Part of the "Make MindBurn distributable" initiative — procedural tracker: [`docs/AGENTS_TODO-DISTRIBUTABLE.md`](../../../../docs/AGENTS_TODO-DISTRIBUTABLE.md), design: [`docs/plans/distributable-platform-and-compose-dry.md`](../../../../docs/plans/distributable-platform-and-compose-dry.md).

## Structure (Page → List → Item → Details)
```
components/DownloadPage.tsx     controller; URL-driven state (?id=<deviceClass>); routes List ↔ Details
views/DownloadList/            DownloadList.tsx + DownloadListItem.tsx — 3 cards grouped BY DEVICE CLASS
views/DownloadDetails/         what MindBurn is + current build identity + requirements + install command
hooks/useDownloads.ts          fetch targets via getService<IDownloadService>(); returns {targets, loading, error}
models/IDownloadTarget.ts      deviceClass | label | icon | arch | os | requirements[] | installCommand | buildRef | builtAt
```
Copy the **ecommerce/Products** module as the template. Backing service: `core/services/DownloadService/`.

## Rules
1. **Three device classes only:** `apple-silicon`, `raspberry-pi`, `x86`. Group the list by class.
2. **No invented versions.** Build identity comes from `build-info.json` (`target`, `timestamp`) + `target_ref` from the API. There is no semver — say so in the UI; do not render a fake one.
3. **Subscription-gated.** The page requires customer login (existing JWT in `usage/customer/authenticate/`) and an **active/trialing** subscription via `POST /usage/checkout/paywall/subscription_status`. Not entitled → render a **Subscribe** CTA into the existing checkout and **hide install commands**. Entitled → call `POST /download/entitlement` for a short-lived token.
4. **Cert-free one-liner only.** Show a copy-able `curl … | sh -s -- --token <jwt>` command (no `.pkg`/`.dmg`/tarball download button — those trigger Mac Gatekeeper/notarization). Substitute the token from `POST /download/entitlement` into `installCommandTemplate`'s `{TOKEN}`. The static `GET /download/targets` payload carries **no token**.
5. **No client-side script/URL assembly, no secrets.** Entry scripts are static at `webapp/public/download/<class>.sh` (separate from `scripts/`); the frontend only displays/copies what the API returns. Never embed `SYSTEM_TOOL_TOKEN` or any credential; the entitlement token is minted server-side after the Stripe check.
6. **Conventions:** `<style jsx>{styles}</style>` + sibling `.scss`, BEM names. Reuse webstack `UiCard`, `AdaptGrid`, `UiButton`, `UiDetail`, `UiStatusBadge`, `UiIcon`, `UiLoader`. Register the route in `webapp/src/pages/download/index.tsx`.

## Boundaries
Cannot modify the compose layout, fleet scripts, or backend `/downloads/*` routes — those are Reliability/Platform scope. Surface what the API returns; raise issues at the boundary.

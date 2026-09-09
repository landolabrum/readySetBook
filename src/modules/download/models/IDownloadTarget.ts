// Relative Path: ./IDownloadTarget.ts
// Model for one downloadable MindBurn device class. There is NO semver — build
// identity is the rolling target ref + build-info.json timestamp (see AGENTS.md).

export type DeviceClass = 'apple-silicon' | 'raspberry-pi' | 'x86';

export interface IDownloadTarget {
  deviceClass: DeviceClass;
  label: string;                  // "Apple-Silicon Mac" | "Raspberry Pi 5" | "x86 Linux"
  // UiIcon name — MUST be one registered in FontAwesome.ts. Brand icons
  // (fa-apple/fa-raspberry-pi/fa-linux) are NOT registered; use generic device
  // icons: x86 → fa-desktop, raspberry-pi → fa-microchip, apple-silicon → fa-cube.
  icon: string;
  arch: 'arm64' | 'amd64';
  os: string;                     // "macOS 13+", "Raspberry Pi OS / Debian 12+", "Debian 13"
  requirements: string[];         // ["Docker + Colima", "8 GB RAM", …]
  // Cert-free one-liner with a {TOKEN} placeholder the frontend substitutes
  // with the short-lived entitlement JWT from POST /download/entitlement.
  installCommandTemplate: string; // "curl -fsSL https://<host>/download/mac.sh | sh -s -- --token {TOKEN}"
  entryScriptUrl: string;         // static, public/download/<class>.sh
  buildRef: string;               // target_ref (rolling) — NOT a version number
  builtAt: string;                // build-info.json timestamp (ISO)
  notes?: string;
}

// Server response for GET /download/targets (no token; carries build identity).
export interface IDownloadTargetsResponse {
  targets: IDownloadTarget[];
  buildRef?: string;
  builtAt?: string;
}

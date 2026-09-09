// Centralised timing and configuration constants for OverlayMedia.

/** MJPEG keepalive: force-reconnect interval for healthy image streams (ms). */
export const KEEPALIVE_MS = 120_000;

/** MJPEG error recovery: initial retry delay (ms). */
export const MJPEG_BASE_INTERVAL = 20_000;
/** MJPEG error recovery: maximum retry delay after exponential backoff (ms). */
export const MJPEG_MAX_INTERVAL = 120_000;

/** Maximum HLS.js fatal-error recoveries before trying codec fallback. */
export const MAX_HLS_RECOVERY = 3;

/** Delay between HLS network-error retries (ms). */
export const HLS_NETWORK_RETRY_MS = 3_000;

/** Pipeline polling: initial interval (ms). */
export const POLL_INITIAL_MS = 2_000;
/** Pipeline polling: backed-off interval (ms). */
export const POLL_BACKOFF_MS = 10_000;
/** Pipeline polling: polls before automatic backoff. */
export const POLL_BACKOFF_THRESHOLD = 30;

/** Iframe load timeout before marking as error (ms). */
export const IFRAME_LOAD_TIMEOUT = 6_000;

/** Fallback broll video URL when no media source is available. */
export const FALLBACK_BROLL_URL =
  `${process.env.NEXT_PUBLIC_FILESERVER_BASE_URL ?? 'https://mb1-orch-1.tiktok.soy/files/'}srv/mb1/broll/sample.mp4`;

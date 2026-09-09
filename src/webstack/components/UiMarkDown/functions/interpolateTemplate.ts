/**
 * Template interpolation for UiMarkdown.
 *
 * Resolves {{variable}} placeholders (or custom delimiters) against a
 * variables map, while skipping fenced code blocks and inline code.
 */

const DEFAULT_DELIMS: [string, string] = ['{{', '}}'];

/** Safely resolve a dot-path (e.g., "user.name.first") against an object */
function resolvePath(obj: any, path: string): unknown {
    if (!obj) return undefined;
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = obj;
    for (const p of parts) {
        if (p === '') continue;
        if (cur != null && Object.prototype.hasOwnProperty.call(cur, p)) {
            cur = (cur as any)[p];
        } else {
            return undefined;
        }
    }
    return cur;
}

export interface InterpolateOpts {
    strict?: boolean;
    delimiters?: [string, string];
}

/**
 * Interpolate variables into a template, skipping code blocks and inline code.
 * - Supports {{var}} (or custom delimiters)
 * - Escaped delimiters like \{{name}} are preserved (no replacement, backslash removed)
 * - Skips fenced code blocks ```...``` and inline code `...`
 */
export function interpolateTemplate(
    template: string,
    vars: Record<string, unknown> = {},
    opts?: InterpolateOpts
): string {
    const { strict = false, delimiters = DEFAULT_DELIMS } = opts || {};
    const [open, close] = delimiters;

    const esc = (s: string) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const re = new RegExp(
        String.raw`(?<!\\)` + esc(open) + String.raw`\s*([a-zA-Z0-9_.$\[\]-]+)\s*` + esc(close),
        'g'
    );
    const unescapeDelims = new RegExp(String.raw`\\` + esc(open), 'g');

    // Split into segments: replaceable text vs code (fenced / inline)
    const segments: Array<{ text: string; replace: boolean }> = [];
    let i = 0;

    while (i < template.length) {
        // fenced code block
        if (template.startsWith('```', i)) {
            const end = template.indexOf('\n```', i + 3);
            if (end !== -1) {
                const block = template.slice(i, end + 4);
                segments.push({ text: block, replace: false });
                i = end + 4;
                continue;
            }
        }
        // inline code
        if (template[i] === '`') {
            const end = template.indexOf('`', i + 1);
            if (end !== -1) {
                const inline = template.slice(i, end + 1);
                segments.push({ text: inline, replace: false });
                i = end + 1;
                continue;
            }
        }
        // normal text until next code marker
        const nextFence = template.indexOf('```', i);
        const nextInline = template.indexOf('`', i);
        const next = [nextFence, nextInline].filter(n => n !== -1);
        const end = next.length ? Math.min(...next) : template.length;
        const normal = template.slice(i, end);
        segments.push({ text: normal, replace: true });
        i = end;
    }

    return segments
        .map(seg => {
            if (!seg.replace) {
                return seg.text.replace(unescapeDelims, open);
            }
            return seg.text
                .replace(re, (_m, path: string) => {
                    const val = resolvePath(vars, path);
                    if (val === undefined || val === null) {
                        return strict ? '' : `${open}${path}${close}`;
                    }
                    return typeof val === 'string' ? val : String(val);
                })
                .replace(unescapeDelims, open);
        })
        .join('');
}

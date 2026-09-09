/**
 * Token injection utilities for UiMarkdown.
 *
 * Converts shorthand notations and ::token(...) syntax in raw markdown
 * into lightweight HTML spans that ReactMarkdown can map to components.
 */

/** Shorthand: :icon-name: → <span data-uicon="icon-name"/> */
export function injectShorthandIcons(input: string): string {
    const re = /(?<!:):([a-zA-Z0-9_\-]+):(?!:)/g;
    return input.replace(re, (_m, name) => `<span data-uicon="${name}"></span>`);
}

/** Shorthand: :qr:https://url: → <span data-qr="https://url"/> */
export function injectShorthandQr(input: string): string {
    const re = /:qr:([^:\s]+):/g;
    return input.replace(re, (_m, url) => `<span data-qr="${url}"></span>`);
}

/**
 * Convert ::icon(name:"...", color:..., size:[w,h], variant:...)
 * tokens into lightweight HTML tags that ReactMarkdown can map to UiIcon.
 */
export function injectIconTags(input: string): string {
    const re =
        /::icon\(\s*name:\s*"([^"]+)"\s*(?:,\s*color:\s*(?:"([^"]*)"|undefined))?\s*(?:,\s*size:\s*\[\s*(\d+)?\s*(?:,\s*(\d+))?\s*\])?\s*(?:,\s*variant:\s*(?:"([^"]*)"|undefined))?\s*\)/g;
    return input.replace(re, (_m, name, color, w, h, variant) => {
        const attrs = [
            `data-uicon="${name}"`,
            color ? `data-color="${color}"` : '',
            w ? `data-w="${w}"` : '',
            h ? `data-h="${h}"` : '',
            variant ? `data-variant="${variant}"` : '',
        ]
            .filter(Boolean)
            .join(' ');
        return `<span ${attrs}></span>`;
    });
}

/**
 * Convert ::qr(srcUrl:"...", size:..., color:"...", background:"...", variant:"...", icon:{name:"...", size:..., color:"..."})
 * tokens into lightweight HTML tags that ReactMarkdown can map to UiQr.
 */
export function injectQrTags(input: string): string {
    const re =
        /::qr\(\s*srcUrl:\s*"([^"]+)"\s*(?:,\s*size:\s*(\d+))?\s*(?:,\s*color:\s*"([^"]*)")?\s*(?:,\s*background:\s*"([^"]*)")?\s*(?:,\s*variant:\s*"([^"]*)")?\s*(?:,\s*icon:\s*\{\s*name:\s*"([^"]*)"\s*(?:,\s*size:\s*(\d+|undefined))?\s*(?:,\s*color:\s*(?:"([^"]*)"|undefined))?\s*\})?\s*\)/g;
    return input.replace(re, (_m, srcUrl, size, color, bg, variant, iconName, iconSize, iconColor) => {
        const attrs = [
            `data-qr="${srcUrl}"`,
            size ? `data-size="${size}"` : '',
            color ? `data-color="${color}"` : '',
            bg ? `data-bg="${bg}"` : '',
            variant ? `data-variant="${variant}"` : '',
            iconName ? `data-icon-name="${iconName}"` : '',
            iconSize && iconSize !== 'undefined' ? `data-icon-size="${iconSize}"` : '',
            iconColor ? `data-icon-color="${iconColor}"` : '',
        ]
            .filter(Boolean)
            .join(' ');
        return `<span ${attrs}></span>`;
    });
}

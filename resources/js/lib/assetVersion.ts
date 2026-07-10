/**
 * Cache-busting stamp for the version-less `/tree/current` assets. The backend
 * emits it as a `<meta name="tree-asset-version">` tag (its value is the content
 * hash written by publish.mjs on every data refresh). Read it once, synchronously
 * at module load, so every tree URL builder can append it before any fetch runs -
 * no React prop threading. A data refresh changes the hash → new URLs → the
 * browser refetches, while unchanged data keeps the long immutable cache.
 */
function readAssetVersion(): string {
    if (typeof document === 'undefined') {
        return '';
    }

    const meta = document.querySelector('meta[name="tree-asset-version"]');

    return meta?.getAttribute('content') ?? '';
}

const ASSET_VERSION = readAssetVersion();

/** Append `?v=<stamp>` to a tree asset URL, preserving any existing query. */
export function withAssetVersion(url: string): string {
    if (!ASSET_VERSION) {
        return url;
    }

    return `${url}${url.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;
}

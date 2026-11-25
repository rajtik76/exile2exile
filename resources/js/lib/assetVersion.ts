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

let assetVersion = readAssetVersion();

/**
 * Hand over the stamp where there is no document to read it from: the server
 * render gets it from the page props, so it builds the same URLs the browser
 * will and hydration finds nothing to repair. A stamp already read wins.
 */
export function primeAssetVersion(version: unknown): void {
    if (assetVersion === '' && typeof version === 'string') {
        assetVersion = version;
    }
}

/** Append `?v=<stamp>` to a tree asset URL, preserving any existing query. */
export function withAssetVersion(url: string): string {
    if (!assetVersion) {
        return url;
    }

    return `${url}${url.includes('?') ? '&' : '?'}v=${assetVersion}`;
}

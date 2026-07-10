import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The stamp is read once at module load, so each case re-imports after seeding
// (or clearing) the <meta> tag.
beforeEach(() => {
    vi.resetModules();
    document.head.querySelector('meta[name="tree-asset-version"]')?.remove();
});

afterEach(() => {
    document.head.querySelector('meta[name="tree-asset-version"]')?.remove();
});

function seedVersion(value: string): void {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'tree-asset-version');
    meta.setAttribute('content', value);
    document.head.appendChild(meta);
}

test('leaves the url untouched when no version meta is present', async () => {
    const { withAssetVersion } = await import('@/lib/assetVersion');

    expect(withAssetVersion('/tree/skills.webp')).toBe('/tree/skills.webp');
});

test('appends the stamp with the right separator for each url shape', async () => {
    seedVersion('abc123');
    const { withAssetVersion } = await import('@/lib/assetVersion');

    expect(withAssetVersion('/tree/skills.webp')).toBe(
        '/tree/skills.webp?v=abc123',
    );
    expect(withAssetVersion('/tree/skills.webp?lod=2')).toBe(
        '/tree/skills.webp?lod=2&v=abc123',
    );
});

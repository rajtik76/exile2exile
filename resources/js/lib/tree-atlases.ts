import type { RenderResources } from '@poe2-toolkit/tree-react';
import { withAssetVersion } from '@/lib/assetVersion';

/**
 * Loads GGG webp atlases + their JSON frame maps into a {@link RenderResources}
 * the tree renderer can blit from. This is harness glue: it knows GGG's atlas
 * naming (the `frame:` prefix, per-variant icon keys) and normalises it to the
 * domain keys `@poe2-toolkit/tree-react` looks up. Geometry stays in the core; this only
 * supplies pixels.
 */

interface AtlasJson {
    frames: Record<
        string,
        { frame: { x: number; y: number; w: number; h: number } }
    >;
}

/** Atlases that back nodes: skill icons, frames, mastery patterns. */
const NODE_ATLASES = ['skills', 'frame', 'mastery-effect-active'] as const;

export async function loadTreeAtlases(
    assetBase: string,
): Promise<RenderResources> {
    const frames: RenderResources['manifest']['frames'] = {};
    const atlases: RenderResources['atlases'] = {};

    await Promise.all(
        NODE_ATLASES.map(async (name) => {
            const [json, image] = await Promise.all([
                fetch(withAssetVersion(`${assetBase}/${name}.json`)).then(
                    (response) => response.json() as Promise<AtlasJson>,
                ),
                loadImage(withAssetVersion(`${assetBase}/${name}.webp`)),
            ]);
            atlases[name] = image;
            const tag = `${name}:`;

            for (const [key, value] of Object.entries(json.frames)) {
                // Strip the atlas-name tag (`frame:`, `line:`); keep variant-prefixed
                // keys like `normalActive:` / `masteryEffectActive:`.
                const domainKey = key.startsWith(tag)
                    ? key.slice(tag.length)
                    : key;
                frames[domainKey] = {
                    atlas: name,
                    x: value.frame.x,
                    y: value.frame.y,
                    w: value.frame.w,
                    h: value.frame.h,
                };
            }
        }),
    );

    return { manifest: { frames }, atlases };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
    });
}

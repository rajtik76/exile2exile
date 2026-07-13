import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { withAssetVersion } from '@/lib/assetVersion';
import type { ReferenceSprite } from '@/lib/planReferences';

/**
 * Shared tooltip system. Every tooltip in the project (item, gem, rune,
 * passive-tree node, ...) is composed from these same blocks and tokens
 * - never hand-roll a new tooltip or bespoke styles, just assemble these.
 */

/** Fontin SmallCaps - the game's own tooltip typeface, self-hosted (see app.css). */
const FONTIN = { fontFamily: "'Fontin SmallCaps', serif" } as const;

/** Colour triplet tinting a card to its entity (rarity / socket / element). */
export interface TooltipAccent {
    text: string;
    edge: string;
    glow: string;
}

/** Item-rarity accent, matching the game's item-name palette. */
export function rarityTone(rarity: string): TooltipAccent {
    switch (rarity.toUpperCase()) {
        case 'MAGIC':
            // The game's own magic-item blue.
            return {
                text: '#8888ff',
                edge: '#6a74d0',
                glow: 'rgba(136,136,255,0.30)',
            };
        case 'RARE':
            // The game's own rare-item yellow.
            return {
                text: '#ffff77',
                edge: '#c2a23c',
                glow: 'rgba(255,255,119,0.30)',
            };
        case 'UNIQUE':
            // #af6025 is PoE1's burnt-orange unique; PoE2 overrides it to a
            // brighter, more saturated orange for the item name specifically.
            return {
                text: '#ef6916',
                edge: '#af6025',
                glow: 'rgba(239,105,22,0.32)',
            };
        default:
            // NORMAL (white) - bright neutral so it reads clearly, never gilded.
            return {
                text: '#f7f7f3',
                edge: '#c8c5b8',
                glow: 'rgba(245,245,238,0.36)',
            };
    }
}

/** Centred stat list, one line per mod - matches the game's own tooltip layout. */
export function BulletList({
    lines,
    color,
}: {
    lines: string[];
    color: string;
}) {
    return (
        <ul>
            {lines.map((line, j) => (
                <li key={j} className="font-medium" style={{ color }}>
                    {line}
                </li>
            ))}
        </ul>
    );
}

/** Small pill used for tooltip tags (gem tags, …). Shares the tooltip palette. */
export function TooltipBadge({
    children,
    color,
}: {
    children: React.ReactNode;
    color?: string;
}) {
    // A colour tints the pill to the entity's game colour (e.g. attribute
    // requirements); without one it uses the default neutral token.
    if (color) {
        return (
            <span
                className="inline-flex items-center rounded-[3px] border px-2 py-0.5 text-xs font-medium tracking-wide"
                style={{
                    color,
                    borderColor: `${color}66`,
                    backgroundColor: `${color}1f`,
                }}
            >
                {children}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center rounded-[3px] border border-[#2a2833] bg-[#13131b] px-2 py-0.5 text-xs font-medium tracking-wide text-[#a7acb8]">
            {children}
        </span>
    );
}

/**
 * A single icon cropped out of a sprite atlas sheet with CSS, for art that ships
 * only in an atlas (notable passives). `size` is any CSS length - `1.1em` inline in
 * a chip, `2.5rem` in a tooltip header - and the crop scales uniformly to it.
 */
export function SpriteIcon({
    sprite,
    size,
    className,
}: {
    sprite: ReferenceSprite;
    size: string;
    className?: string;
}) {
    // scale = size / frameWidth; every length below is that scale applied to the
    // atlas geometry, expressed as a calc() so it works for em- or rem-based sizes.
    const scaled = (value: number): string =>
        `calc(${size} * ${value} / ${sprite.w})`;

    return (
        <span
            aria-hidden
            className={className}
            style={{
                display: 'inline-block',
                width: size,
                height: size,
                backgroundImage: `url(${withAssetVersion(sprite.url)})`,
                backgroundPosition: `${scaled(-sprite.x)} ${scaled(-sprite.y)}`,
                backgroundSize: `${scaled(sprite.sheetW)} ${scaled(sprite.sheetH)}`,
                backgroundRepeat: 'no-repeat',
            }}
        />
    );
}

/** Faint gold rule separating tooltip sections, as in the game. */
export function TooltipRule() {
    return (
        <div className="mx-auto my-2.5 h-px w-4/5 bg-gradient-to-r from-transparent via-[#c9a24a]/45 to-transparent" />
    );
}

/**
 * Which rarity banner {@link TooltipCard} draws behind its header, keyed to the
 * game's own `ItemsHeader{Rarity}{Left,Middle,Right}` GGPK art (decoded by
 * `tools/poe-data-extract` into `public/icons/poe2/ui/tooltip-header-*`). Left/right
 * are the carved corner caps (a different motif per rarity - spearhead for Rare,
 * a leaf scroll for Unique); middle tiles between them. Only items carry a rarity,
 * so gems/runes/tree nodes render {@link TooltipCard} without this prop and get a
 * plain header instead.
 */
export type TooltipRarityFrame = 'white' | 'magic' | 'rare' | 'unique';

/** Maps an item rarity string to its {@link TooltipRarityFrame} banner. */
export function rarityFrame(rarity: string): TooltipRarityFrame {
    switch (rarity.toUpperCase()) {
        case 'MAGIC':
            return 'magic';
        case 'RARE':
            return 'rare';
        case 'UNIQUE':
            return 'unique';
        default:
            return 'white';
    }
}

/**
 * One end cap of the rarity banner (the game's own carved corner art - a
 * spearhead for Rare, a leaf scroll for Unique, ...). A real `<img>`, not a
 * background-image on a sized box: browsers size an `<img>` with `height: 100%`
 * from its own intrinsic aspect ratio reliably, where a CSS `aspect-ratio` on an
 * absolutely-positioned box does not.
 */
function HeaderCap({
    frame,
    side,
}: {
    frame: TooltipRarityFrame;
    side: 'left' | 'right';
}) {
    return (
        <img
            aria-hidden
            alt=""
            src={withAssetVersion(
                `/icons/poe2/ui/tooltip-header-${frame}-${side}.png`,
            )}
            className="pointer-events-none absolute top-0 h-full w-auto max-w-none"
            style={{ [side]: 0 }}
        />
    );
}

/**
 * Shared tooltip card: a framed panel with an icon-led header and an optional
 * body. Every hover tooltip (item, gem, rune, tree node) is built from this.
 * Pass `frame` (an item's rarity) to draw the game's own carved header banner;
 * without it the header is a plain hairline (gems, runes, tree nodes).
 */
export function TooltipCard({
    accent,
    icon,
    iconNode,
    title,
    subtitle,
    frame,
    children,
}: {
    accent: TooltipAccent;
    icon?: string | null;
    /** A pre-rendered icon (e.g. a cropped {@link SpriteIcon}); wins over `icon`. */
    iconNode?: React.ReactNode;
    title: string;
    subtitle?: string;
    /** An item's rarity - draws the game's own carved banner behind the header. */
    frame?: TooltipRarityFrame;
    children?: React.ReactNode;
}) {
    return (
        <div
            className="overflow-hidden shadow-2xl backdrop-blur-sm"
            style={{
                background: 'rgba(2,2,3,0.75)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
            }}
        >
            <div
                className="relative flex items-center justify-center gap-3 px-4 py-3"
                style={
                    frame
                        ? undefined
                        : {
                              background: `linear-gradient(180deg, ${accent.glow}, transparent)`,
                              borderTop: `2px solid ${accent.edge}`,
                              borderBottom: `1px solid ${accent.edge}`,
                          }
                }
            >
                {frame && (
                    <>
                        {/* Painted first (behind the caps): a later sibling with no
                            z-index still wins the paint order in the same stacking
                            context, so the caps must come after this or it covers them.
                            Stretched to fill (not tiled): tiling this repeating strip
                            at an arbitrary header width always leaves a visible seam
                            at the tile boundary, since the header's width is never a
                            whole multiple of the tile's native width. A single
                            stretched copy has no boundary to seam at. */}
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0"
                            style={{
                                backgroundPosition: 'center',
                                backgroundSize: '100% 100%',
                                backgroundRepeat: 'no-repeat',
                                backgroundImage: `url(${withAssetVersion(`/icons/poe2/ui/tooltip-header-${frame}-middle.png`)})`,
                            }}
                        />
                        <HeaderCap frame={frame} side="left" />
                        <HeaderCap frame={frame} side="right" />
                    </>
                )}

                {!frame &&
                    (iconNode
                        ? iconNode
                        : icon && (
                              <img
                                  src={icon}
                                  alt=""
                                  aria-hidden
                                  loading="lazy"
                                  className="relative size-10 shrink-0 rounded-sm object-contain"
                              />
                          ))}
                <div className="relative min-w-0 text-center">
                    {/* Header in Fontin SmallCaps (the game's own tooltip face); the
                        second line smaller. The body below reads in the same face. */}
                    <p
                        className="text-xl leading-tight tracking-wide"
                        style={{
                            ...FONTIN,
                            color: accent.text,
                            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                        }}
                    >
                        {title}
                    </p>
                    {subtitle && (
                        <p
                            className="mt-0.5 text-base leading-tight tracking-wide"
                            style={{
                                ...FONTIN,
                                color: accent.text,
                                textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                                opacity: 0.85,
                            }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            {children && (
                <div
                    className="px-5 py-3 text-center text-base leading-tight"
                    style={FONTIN}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

/**
 * Cursor-following tooltip wrapper: fixed beside the pointer, to its right when
 * it fits else to its left, clamped vertically into the viewport. Portalled to
 * the body so no panel clips it, and pointer-transparent so it never steals the
 * hover it tracks. The standard placement for gem and passive-tree tooltips.
 */
export function CursorTooltip({
    x,
    y,
    children,
}: {
    x: number;
    y: number;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);

    // Measure after layout so the vertical clamp uses the real card height.
    // Intentionally runs every render (content height changes with the hovered
    // entity); the prev-equals guard makes setState a no-op when unchanged, so
    // it can never loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const h = ref.current?.offsetHeight ?? 0;
        setHeight((prev) => (prev === h ? prev : h));
    });

    const gap = 16;
    const tipWidth = Math.min(416, window.innerWidth * 0.88); // 26rem cap
    const fitsRight = x + gap + tipWidth <= window.innerWidth;
    const left = fitsRight ? x + gap : x - gap - tipWidth;

    // Centre on the cursor, then keep the whole card inside the viewport.
    const top = Math.max(
        8,
        Math.min(y - height / 2, window.innerHeight - height - 8),
    );

    return createPortal(
        <div
            ref={ref}
            className="pointer-events-none fixed z-[120] w-[26rem] max-w-[88vw]"
            style={{ left, top }}
        >
            {children}
        </div>,
        document.body,
    );
}

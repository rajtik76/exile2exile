import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DISPLAY, ENGRAVED } from '@/components/brand';
import { withAssetVersion } from '@/lib/assetVersion';
import type { ReferenceSprite } from '@/lib/planReferences';

/**
 * Shared tooltip system. Per docs/DESIGN.md every tooltip in the project (item,
 * gem, rune, passive-tree node, …) is composed from these same blocks and tokens
 * - never hand-roll a new tooltip or bespoke styles, just assemble these.
 */

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
            return {
                text: '#8f9bff',
                edge: '#6a74d0',
                glow: 'rgba(120,135,255,0.30)',
            };
        case 'RARE':
            return {
                text: '#e9c95a',
                edge: '#c2a23c',
                glow: 'rgba(233,201,90,0.30)',
            };
        case 'UNIQUE':
            return {
                text: '#cf8a4a',
                edge: '#c4702e',
                glow: 'rgba(207,138,74,0.32)',
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

/** Bulleted stat list with a hanging indent, so wrapped lines stay readable. */
export function BulletList({
    lines,
    color,
}: {
    lines: string[];
    color: string;
}) {
    return (
        <ul className="space-y-0.5">
            {lines.map((line, j) => (
                <li key={j} className="flex gap-2 leading-tight">
                    <span
                        aria-hidden
                        className="mt-[0.6em] size-1 shrink-0 rounded-full"
                        style={{ background: color }}
                    />
                    <span className="font-medium" style={{ color }}>
                        {line}
                    </span>
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
 * Shared tooltip card: a framed panel with an icon-led header and an optional
 * body. Every hover tooltip (item, gem, rune, tree node) is built from this.
 */
export function TooltipCard({
    accent,
    icon,
    iconNode,
    title,
    subtitle,
    children,
}: {
    accent: TooltipAccent;
    icon?: string | null;
    /** A pre-rendered icon (e.g. a cropped {@link SpriteIcon}); wins over `icon`. */
    iconNode?: React.ReactNode;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}) {
    return (
        <div
            className="overflow-hidden shadow-2xl backdrop-blur-sm"
            style={{
                background: 'rgba(8,8,11,0.97)',
                boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.8), 0 0 0 1px ${accent.edge}, 0 12px 30px rgba(0,0,0,0.7)`,
            }}
        >
            <div
                className="flex items-center gap-3 px-4 py-3"
                style={{
                    background: `linear-gradient(180deg, ${accent.glow}, transparent)`,
                    borderTop: `2px solid ${accent.edge}`,
                    borderBottom: `1px solid ${accent.edge}`,
                }}
            >
                {iconNode
                    ? iconNode
                    : icon && (
                          <img
                              src={icon}
                              alt=""
                              aria-hidden
                              loading="lazy"
                              className="size-10 shrink-0 rounded-sm object-contain"
                          />
                      )}
                <div className="min-w-0 text-left">
                    {/* Header in the engraved display face (Marcellus SC); the second
                        line smaller. The body below reads in Lexend. */}
                    <p
                        className="text-xl leading-tight font-bold tracking-wide"
                        style={{ ...ENGRAVED, color: accent.text }}
                    >
                        {title}
                    </p>
                    {subtitle && (
                        <p
                            className="mt-0.5 text-base leading-tight font-semibold tracking-wide"
                            style={{
                                ...DISPLAY,
                                color: accent.text,
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
                    className="px-5 py-3 text-left text-base leading-snug"
                    style={{ fontFamily: "'Lexend', sans-serif" }}
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

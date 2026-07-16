import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { withAssetVersion } from '@/lib/assetVersion';
import type {
    GemRequires,
    GemScaling,
    GemScalingLevel,
    GemScalingStat,
    ReferenceSprite,
} from '@/lib/planReferences';

/**
 * Shared tooltip system. Every tooltip in the project (item, gem, rune,
 * passive-tree node, ...) is composed from these same blocks and tokens
 * - never hand-roll a new tooltip or bespoke styles, just assemble these.
 */

/** Fontin SmallCaps - the game's own tooltip typeface, self-hosted (see app.css). */
const FONTIN = { fontFamily: "'Fontin SmallCaps', serif" } as const;

/**
 * Fontin's regular (non-small-caps) cut - the game's own face for a gem tooltip's
 * category tags and its italic flavour description, which the game sets in normal
 * case unlike everything else in the card (title, stat labels, mod lines all stay
 * in {@link FONTIN}).
 */
const FONTIN_REGULAR = { fontFamily: "'Fontin', serif" } as const;

/**
 * Gem tooltip palette, pixel-matched against poe2db's own stylesheet
 * (`--gem-color` and the `.typeLine`/`.secDescrText` rules) rather than guessed -
 * see the tooltip-header-frame investigation this was confirmed against.
 */
export const GEM_TITLE_COLOR = '#1ba29b';
/** Subtitle ("Spell") and every stat row's label (e.g. "Cost:") - all but "Requires:". */
export const GEM_LABEL_COLOR = '#6e9a97';
/** A rune/soul core's title colour - pixel-matched the same way as the gem palette. */
export const RUNE_TITLE_COLOR = '#aa9e82';
/**
 * A notable/keystone passive's title colour - pixel-matched against poe2db's own
 * `.notablePopup .itemHeader { color: #F9E6CA }` rule. Independent of `accent.text`
 * (which stays teal for the card's edge/glow and the tree-map panel below it).
 */
export const NOTABLE_TITLE_COLOR = '#f9e6ca';
/**
 * Muted grey shared across tooltip bodies: a gem's category tags and its
 * "Requires:" label, the dash inside a numeric range, and a rune's type line
 * ("Rune"/"Soul Core") plus its own "Requires:" label.
 */
export const MUTED_TEXT_COLOR = '#7f7f7f';
/** The gem's flavour/description text (italic). */
const GEM_DESC_COLOR = '#baad85';

/**
 * The game's own mod-line blue (same value as the magic-item name colour in
 * {@link rarityTone}, but named separately since its meaning here is "this is a
 * modifier line", not "this item is magic rarity"). Used for item explicit/implicit
 * mods, rune effects, and gem stat lines - anywhere a tooltip lists mechanical
 * effect text rather than flavour or a title.
 */
export const MOD_TEXT_COLOR = '#8888ff';

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
        <ul className="space-y-0.5">
            {lines.map((line, j) => (
                <li key={j} style={{ color }}>
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
export function TooltipRule({ color = '#c9a24a' }: { color?: string }) {
    return (
        <div
            className="mx-auto my-2.5 h-px w-4/5"
            style={{
                background: `linear-gradient(90deg, transparent, ${color}73, transparent)`,
            }}
        />
    );
}

/**
 * Which banner {@link TooltipCard} draws behind its header, keyed to the game's
 * own `ItemsHeader{Variant}{Left,Middle,Right}` GGPK art (decoded by
 * `tools/poe-data-extract` into `public/icons/poe2/ui/tooltip-header-*`). Left/right
 * are the carved corner caps (a different motif per variant - spearhead for Rare,
 * a leaf scroll for Unique); middle tiles between them.
 *
 * `white`/`magic`/`rare`/`unique` come from an item's rarity (see {@link rarityFrame}).
 * `currency` is the banner runes and soul cores use - both share one GGPK `ItemClass`
 * (`SoulCore`) and the game renders both with the currency banner; there is no
 * separate rune/soul-core header art in the GGPK (verified: `itemsheaderrune*` /
 * `itemsheadersoulcore*` don't exist, `itemsheadercurrency*` does and matches the
 * in-game tooltip). `notable` is the passive tree's own banner (`NotablePassiveHeader*`
 * GGPK art, a distinct texture set from the item/currency banners above) - it also
 * switches the title to {@link NOTABLE_TITLE_COLOR} and a larger FontinRegular face,
 * matching the game's own notable tooltip rather than the smaller FontinSmallCaps
 * every other frame uses. Gems use no frame at all - {@link ReferenceTooltip} paints
 * their `hoverImage` behind the header instead, matching the game's own gem tooltip,
 * which has no carved banner.
 */
export type TooltipRarityFrame =
    'white' | 'magic' | 'rare' | 'unique' | 'currency' | 'notable';

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
 * Pass `frame` (an item's rarity, or `currency` for runes/soul cores) to draw the
 * game's own carved header banner; pass `backgroundImage` (a gem's hover art) to
 * paint full-card art behind everything instead, matching the game's own gem
 * tooltip, which has no carved banner. Neither prop set gives a plain hairline
 * header (runes/tree nodes with no art of their own).
 */
export function TooltipCard({
    accent,
    icon,
    iconNode,
    title,
    subtitle,
    subtitleColor,
    frame,
    backgroundImage,
    headerImage,
    children,
}: {
    accent: TooltipAccent;
    icon?: string | null;
    /** A pre-rendered icon (e.g. a cropped {@link SpriteIcon}); wins over `icon`. */
    iconNode?: React.ReactNode;
    title: string;
    subtitle?: string;
    /** Subtitle colour override; defaults to `accent.text` (same as the title). */
    subtitleColor?: string;
    /** An item's rarity, or `currency` for runes/soul cores - draws the game's own carved banner behind the header. */
    frame?: TooltipRarityFrame;
    /**
     * A gem's hover-art background (`GemHoverImage`), painted full-card, top-right,
     * at 80% width - matches the game's own gem tooltip. Mutually exclusive with
     * `frame` in practice (only items/runes get a `frame`, only gems get this).
     */
    backgroundImage?: string | null;
    /**
     * A gem's header art (`GemHoverTitle`), painted left-aligned within the header
     * only, `background-size: contain` - the single-image header a gem tooltip uses
     * instead of a `frame`'s carved left/middle/right banner (pixel-matched against
     * poe2db's own `.item-popup--poe2.GemPopup .itemHeader` rule). Left-aligns the
     * title/subtitle and drops the header icon to match. Mutually exclusive with
     * `frame`.
     */
    headerImage?: string | null;
    children?: React.ReactNode;
}) {
    const leftAlign = Boolean(headerImage);
    const isNotableTitle = frame === 'notable';

    return (
        <div
            className="relative overflow-hidden shadow-2xl backdrop-blur-sm"
            style={{
                background: 'rgba(0,0,0,0.75)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
            }}
        >
            {backgroundImage && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage: `url(${withAssetVersion(backgroundImage)})`,
                        backgroundPosition: 'right top',
                        backgroundSize: '80% auto',
                        backgroundRepeat: 'no-repeat',
                    }}
                />
            )}

            <div
                className={`relative flex items-center gap-3 py-3 ${frame && !headerImage ? 'px-14' : 'px-4'} ${leftAlign ? 'justify-start' : 'justify-center'}`}
                style={
                    frame || headerImage
                        ? headerImage
                            ? {
                                  backgroundImage: `url(${withAssetVersion(headerImage)})`,
                                  backgroundPosition: 'left top',
                                  backgroundSize: 'contain',
                                  backgroundRepeat: 'no-repeat',
                              }
                            : undefined
                        : {
                              background: `linear-gradient(180deg, ${accent.glow}, transparent)`,
                              borderTop: `2px solid ${accent.edge}`,
                              borderBottom: `1px solid ${accent.edge}`,
                          }
                }
            >
                {frame && !headerImage && (
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
                    !headerImage &&
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
                <div
                    className={`relative min-w-0 ${leftAlign ? 'pl-[25px] text-left' : 'text-center'}`}
                >
                    {/* Header in Fontin SmallCaps (the game's own tooltip face); the
                        second line smaller. The body below reads in the same face.
                        A notable's title is the one exception - the game sets it in
                        the larger FontinRegular face and a fixed colour instead.
                        Both sizes shrink one step below the card's own min-width
                        breakpoint (sm) - the card itself is capped to 88vw there, so
                        the desktop size would otherwise force wrapping/overflow on a
                        narrow phone regardless of how short the title is. */}
                    <p
                        className={`leading-tight tracking-wide ${isNotableTitle ? 'text-xl sm:text-[26px]' : 'text-base sm:text-xl'}`}
                        style={{
                            ...(isNotableTitle ? FONTIN_REGULAR : FONTIN),
                            color: isNotableTitle
                                ? NOTABLE_TITLE_COLOR
                                : accent.text,
                            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                        }}
                    >
                        {title}
                    </p>
                    {subtitle && (
                        <p
                            className="mt-0.5 text-sm leading-tight tracking-wide sm:text-base"
                            style={{
                                ...FONTIN,
                                color: subtitleColor ?? accent.text,
                                textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                                opacity: subtitleColor ? 1 : 0.85,
                            }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            {children && (
                <div
                    className={`relative px-5 py-3 text-sm leading-tight sm:text-base ${leftAlign ? 'text-left' : 'text-center'}`}
                    style={FONTIN}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

/** The highest gem level the in-game tooltip's "Level:"/stat ranges ever display - further levels (up to 40 in the raw data) come from mechanics outside normal play and aren't shown by default. Matches poe2db's own reference tooltip. */
const GEM_MAX_DISPLAY_LEVEL = 20;

/** `scaling.levels` capped at {@link GEM_MAX_DISPLAY_LEVEL} - empty only if the source data itself is empty. */
function cappedLevels(levels: GemScalingLevel[]): GemScalingLevel[] {
    return levels.filter((level) => level.level <= GEM_MAX_DISPLAY_LEVEL);
}

/**
 * Splits a stat/mod line into coloured segments: a parenthesised range like
 * `(1—20)` gets white digits and a grey em dash, a lone number (with an optional
 * leading `+`) is plain white, everything else inherits the caller's colour
 * (the mod-blue). Mirrors the game's own tooltip number styling exactly - pixel
 * checked against a reference screenshot, not guessed.
 */
function renderNumberedText(text: string): React.ReactNode {
    const pattern =
        /(\([+-]?\d+(?:\.\d+)?—[+-]?\d+(?:\.\d+)?\))|([+-]?\d+(?:\.\d+)?)/g;
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }

        if (match[1]) {
            // A range: "(a—b)" - split the dash out for its own grey colour.
            const [, low, high] = /^\(([^—]+)—(.+)\)$/.exec(match[1]) ?? [];

            nodes.push(
                <Fragment key={key++}>
                    <span style={{ color: '#fff' }}>({low}</span>
                    <span style={{ color: MUTED_TEXT_COLOR }}>—</span>
                    <span style={{ color: '#fff' }}>{high})</span>
                </Fragment>,
            );
        } else {
            nodes.push(
                <span key={key++} style={{ color: '#fff' }}>
                    {match[0]}
                </span>,
            );
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }

    return nodes;
}

/**
 * Centred mod/effect lines, mod-blue with numeric values picked out white (see
 * {@link renderNumberedText}). Shared shape for a rune/notable tooltip's effect
 * list - anywhere a tooltip lists mechanical effect text with no bullets.
 */
export function ModLines({ lines }: { lines: string[] }) {
    return (
        <div className="space-y-0.5" style={{ color: MOD_TEXT_COLOR }}>
            {lines.map((line, i) => (
                <div key={i}>{renderNumberedText(line)}</div>
            ))}
        </div>
    );
}

/** `n` formatted exactly as it appears in a rendered stat line (matches `GemScalingStat.text`'s own number formatting). */
function formatStatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Combines one stat across two levels into the range-notation line the game's own
 * tooltip shows (e.g. level 1's "Deals 1 to 13 Lightning Damage" + level 20's
 * "Deals 20 to 386 Lightning Damage" → "Deals (1—20) to (13—386) Lightning
 * Damage"). A stat whose value doesn't change between the two levels (e.g. a flat
 * "50% increased Magnitude of Shock inflicted") is left as-is - single numbers
 * don't get a range wrapped around them.
 */
function combineStatText(first: GemScalingStat, last: GemScalingStat): string {
    if (first.min === last.min && first.max === last.max) {
        return first.text;
    }

    let text = first.text;
    let searchFrom = 0;

    // A plain indexOf would match the token inside an unrelated larger number
    // (e.g. token "1" inside "10%") - require it not be flanked by another digit.
    const isDigit = (ch: string | undefined) =>
        ch !== undefined && ch >= '0' && ch <= '9';

    const replaceOnce = (value: number, rangeMax: number) => {
        const token = formatStatNumber(value);
        let idx = text.indexOf(token, searchFrom);

        while (
            idx !== -1 &&
            (isDigit(text[idx - 1]) || isDigit(text[idx + token.length]))
        ) {
            idx = text.indexOf(token, idx + 1);
        }

        if (idx === -1) {
            return;
        }

        const replacement = `(${token}—${formatStatNumber(rangeMax)})`;
        text =
            text.slice(0, idx) + replacement + text.slice(idx + token.length);
        searchFrom = idx + replacement.length;
    };

    replaceOnce(first.min, last.min);

    if (first.max !== first.min) {
        replaceOnce(first.max, last.max);
    }

    return text;
}

/**
 * Combines a gem's per-level stat lines into the game's own range-notation display
 * (see {@link combineStatText}), pairing each level's stats by array index - the
 * same stat set applies to every level, only the values scale, so position is a
 * reliable identity (verified against a live extract, not assumed).
 */
function combineStatLines(
    first: GemScalingStat[],
    last: GemScalingStat[],
): string[] {
    if (first.length !== last.length) {
        // Longer than expected to happen in practice (see the doc above) - fall
        // back to the highest level's own numbers rather than guess a pairing.
        return last.map((stat) => stat.text);
    }

    return first.map((stat, i) => combineStatText(stat, last[i]));
}

/** A single min/max pair across the displayed level range, or `null` when there's nothing to show. */
function minMax(values: (number | null)[]): [number, number] | null {
    const present = values.filter((v): v is number => v !== null);

    return present.length > 0
        ? [Math.min(...present), Math.max(...present)]
        : null;
}

/** One label:value row in a gem tooltip's stat block (Tier, Level, Cost, ...). */
function GemStatRow({
    label,
    labelColor = GEM_LABEL_COLOR,
    children,
}: {
    label: string;
    labelColor?: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <span style={{ color: labelColor }}>{label}</span>{' '}
            <span style={{ color: '#fff' }}>{children}</span>
        </div>
    );
}

/**
 * A gem tooltip's full body: category tags, the Tier/Level/Cost/... stat block,
 * flavour description, per-level scaling stats and quality bonuses - everything
 * below {@link TooltipCard}'s header. Pixel-matched against a reference tooltip
 * (colours, alignment, dividers), not the generic centred layout every other
 * reference type shares.
 */
export function GemTooltipBody({
    tags,
    description,
    scaling,
    requires,
}: {
    tags: string[];
    description: string | null;
    scaling: GemScaling | null;
    requires: GemRequires | null;
}) {
    const levels = scaling ? cappedLevels(scaling.levels) : [];
    const first = levels[0] ?? null;
    const last = levels[levels.length - 1] ?? null;

    const cost = first && last ? minMax([first.cost, last.cost]) : null;
    const castTime =
        first && last ? minMax([first.castTime, last.castTime]) : null;
    const cooldown =
        first && last ? minMax([first.cooldown, last.cooldown]) : null;
    // The extractor's own `reservation` field doesn't distinguish percent vs flat
    // amount or which resource pool - it's the raw stored number. Rendered as a
    // percent (the common case for aura/reservation skills) rather than omitted.
    const reservation =
        first && last ? minMax([first.reservation, last.reservation]) : null;
    const crit =
        first && last
            ? minMax([
                  first.spellCritChance || first.attackCritChance,
                  last.spellCritChance || last.attackCritChance,
              ])
            : null;

    const statLines =
        first && last ? combineStatLines(first.stats, last.stats) : [];

    return (
        <>
            {tags.length > 0 && (
                <div
                    className="mb-2"
                    style={{ ...FONTIN_REGULAR, color: MUTED_TEXT_COLOR }}
                >
                    {tags.join(', ')}
                </div>
            )}

            {/* Tier is a known gap - @poe2-toolkit/gem-extractor doesn't resolve it
                yet (see its README) - the row is skipped entirely rather than
                showing a wrong or placeholder value. */}

            {first && last && first.level !== last.level && (
                <GemStatRow label="Level:">
                    {renderNumberedText(`(${first.level}—${last.level})`)}
                </GemStatRow>
            )}

            {cost && (
                <GemStatRow label="Cost:">
                    {renderNumberedText(
                        cost[0] === cost[1]
                            ? String(cost[0])
                            : `(${cost[0]}—${cost[1]})`,
                    )}{' '}
                    Mana
                </GemStatRow>
            )}

            {castTime && (
                <GemStatRow label="Cast Time:">
                    {renderNumberedText(
                        castTime[0] === castTime[1]
                            ? castTime[0].toFixed(2)
                            : `(${castTime[0].toFixed(2)}—${castTime[1].toFixed(2)})`,
                    )}{' '}
                    sec
                </GemStatRow>
            )}

            {reservation && (
                <GemStatRow label="Reservation:">
                    {renderNumberedText(
                        reservation[0] === reservation[1]
                            ? String(reservation[0])
                            : `(${reservation[0]}—${reservation[1]})`,
                    )}
                    %
                </GemStatRow>
            )}

            {cooldown && (
                <GemStatRow label="Cooldown Time:">
                    {renderNumberedText(
                        cooldown[0] === cooldown[1]
                            ? cooldown[0].toFixed(2)
                            : `(${cooldown[0].toFixed(2)}—${cooldown[1].toFixed(2)})`,
                    )}{' '}
                    sec
                </GemStatRow>
            )}

            {crit && crit[1] > 0 && (
                <GemStatRow label="Critical Hit Chance:">
                    {renderNumberedText(
                        crit[0] === crit[1]
                            ? crit[0].toFixed(2)
                            : `(${crit[0].toFixed(2)}—${crit[1].toFixed(2)})`,
                    )}
                    %
                </GemStatRow>
            )}

            {requires && (
                <GemStatRow label="Requires:" labelColor={MUTED_TEXT_COLOR}>
                    {renderNumberedText(
                        `Level (${requires.level[0]}—${requires.level[1]})`,
                    )}
                    {requires.str && (
                        <>
                            ,{' '}
                            {renderNumberedText(
                                `(${requires.str[0]}—${requires.str[1]})`,
                            )}{' '}
                            Str
                        </>
                    )}
                    {requires.dex && (
                        <>
                            ,{' '}
                            {renderNumberedText(
                                `(${requires.dex[0]}—${requires.dex[1]})`,
                            )}{' '}
                            Dex
                        </>
                    )}
                    {requires.int && (
                        <>
                            ,{' '}
                            {renderNumberedText(
                                `(${requires.int[0]}—${requires.int[1]})`,
                            )}{' '}
                            Int
                        </>
                    )}
                </GemStatRow>
            )}

            {description && (
                <>
                    <TooltipRule color={GEM_TITLE_COLOR} />
                    <p
                        className="text-center"
                        style={{ ...FONTIN_REGULAR, color: GEM_DESC_COLOR }}
                    >
                        <em>{description}</em>
                    </p>
                </>
            )}

            {statLines.length > 0 && (
                <>
                    <TooltipRule color={GEM_TITLE_COLOR} />
                    <div
                        className="space-y-1 text-center"
                        style={{ color: MOD_TEXT_COLOR }}
                    >
                        {statLines.map((line, i) => (
                            <div key={i}>{renderNumberedText(line)}</div>
                        ))}
                    </div>
                </>
            )}

            {scaling && scaling.qualityStats.length > 0 && (
                <>
                    <p
                        className="mt-3 mb-1 text-center"
                        style={{ color: '#fff' }}
                    >
                        Additional Effects From Quality:
                    </p>
                    <div
                        className="space-y-1 text-center"
                        style={{ color: MOD_TEXT_COLOR }}
                    >
                        {scaling.qualityStats.map((stat, i) => (
                            <div key={i}>{renderNumberedText(stat.text)}</div>
                        ))}
                    </div>
                </>
            )}
        </>
    );
}

/**
 * A rune/soul-core tooltip's full body: its type line, an optional level
 * requirement, and its effect lines - everything below {@link TooltipCard}'s
 * header. Pixel-matched against a reference tooltip, same as {@link GemTooltipBody}.
 */
export function RuneTooltipBody({
    category,
    levelRequirement,
    effects,
}: {
    category: string;
    levelRequirement: number | null;
    effects: string[];
}) {
    return (
        <>
            <div style={{ color: MUTED_TEXT_COLOR }}>{category}</div>

            {(levelRequirement !== null || effects.length > 0) && (
                <TooltipRule color={MUTED_TEXT_COLOR} />
            )}

            {levelRequirement !== null && (
                <>
                    <div>
                        <span style={{ color: MUTED_TEXT_COLOR }}>
                            REQUIRES:{' '}
                        </span>
                        <span style={{ color: '#fff' }}>
                            LEVEL {levelRequirement}
                        </span>
                    </div>

                    {effects.length > 0 && (
                        <TooltipRule color={MUTED_TEXT_COLOR} />
                    )}
                </>
            )}

            {effects.length > 0 && <ModLines lines={effects} />}
        </>
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
    const [width, setWidth] = useState(0);

    // Measure after layout so the vertical clamp uses the real card height, and
    // the horizontal placement below uses the card's real (fit-content) width -
    // it's no longer a fixed 26rem, it grows to keep a title on one line where
    // it fits. Intentionally runs every render (both change with the hovered
    // entity); the prev-equals guards make setState a no-op when unchanged, so
    // it can never loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(() => {
        const h = ref.current?.offsetHeight ?? 0;
        setHeight((prev) => (prev === h ? prev : h));
        const w = ref.current?.offsetWidth ?? 0;
        setWidth((prev) => (prev === w ? prev : w));
    });

    const gap = 16;
    // Before the first measured render, fall back to the card's own max-width
    // (see the className below) - the conservative upper bound, not the
    // min-width - so a title that grows the card past the min never gets
    // placed against a too-small estimate and overflows the viewport for a
    // frame before the real measurement corrects it.
    const tipWidth = width || Math.min(512, window.innerWidth * 0.88);
    const fitsRight = x + gap + tipWidth <= window.innerWidth;

    // Clamp horizontally into the viewport, same as the vertical clamp below -
    // on a narrow phone the card is wider than the space on either side of the
    // cursor, and without this it renders partly (or entirely) off-screen
    // instead of just sitting flush against the nearer edge.
    const left = Math.max(
        8,
        Math.min(
            fitsRight ? x + gap : x - gap - tipWidth,
            window.innerWidth - tipWidth - 8,
        ),
    );

    // Centre on the cursor, then keep the whole card inside the viewport.
    const top = Math.max(
        8,
        Math.min(y - height / 2, window.innerHeight - height - 8),
    );

    return createPortal(
        <div
            ref={ref}
            // min-w matches max-w's 88vw ceiling - a plain min-w-[26rem] (416px)
            // wins over max-w on any viewport narrower than that (CSS min-width
            // always overrides a conflicting max-width), forcing the card wider
            // than the screen on mobile regardless of the max-w cap below.
            className="pointer-events-none fixed z-[120] w-max max-w-[min(32rem,88vw)] min-w-[min(26rem,88vw)]"
            style={{ left, top }}
        >
            {children}
        </div>,
        document.body,
    );
}

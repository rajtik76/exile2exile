import { useEffect, useRef, useState } from 'react';
import {
    CursorTooltip,
    GEM_LABEL_COLOR,
    GEM_TITLE_COLOR,
    GemTooltipBody,
    ModLines,
    MOD_TEXT_COLOR,
    RUNE_TITLE_COLOR,
    RuneTooltipBody,
    SpriteIcon,
    TooltipBadge,
    TooltipCard,
    TooltipRule,
} from '@/components/build/tooltip';
import type { TooltipAccent } from '@/components/build/tooltip';
import NotableTreeMap from '@/components/planner/NotableTreeMap';
import type { PlanReference } from '@/lib/planReferences';

/** The GGPK-decoded gem tooltip header art (`GemHoverTitle`, see tools/poe-data-extract). */
const GEM_HEADER_IMAGE = '/icons/poe2/ui/tooltip-header-gem-title.png';

/** Gem socket colour from the single-letter attribute (b/g/r/w). */
const SOCKET: Record<string, string> = {
    r: '#d0584a',
    g: '#5fbf6a',
    b: '#4a8fe0',
};

/**
 * Text/tooltip accent for a reference: gem socket colour, rune gold, notable teal,
 * unique orange.
 */
export function accentColor(type: string, color?: string | null): string {
    if (type === 'gem') {
        return SOCKET[color ?? ''] ?? '#cdc6b8';
    }

    if (type === 'rune') {
        return '#e9c95a';
    }

    return type === 'notable' ? '#7fd4c9' : '#cf8a4a';
}

/**
 * Wraps any trigger (an inline chip, an equipment slot icon…) with the shared build
 * tooltip - the same {@link TooltipCard} used for gems and items. Renders the
 * reference's category, tags, effect/description text and unique flavour on hover.
 */
export default function ReferenceTooltip({
    reference,
    children,
    className,
    disabled = false,
}: {
    reference?: PlanReference;
    children: React.ReactNode;
    className?: string;
    /** Suppress the tooltip entirely (e.g. while a drag is in progress). */
    disabled?: boolean;
}) {
    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);

    const isOpen = cursor !== null;

    // A wheel/trackpad scroll moves the content under a stationary cursor
    // without firing mousemove/mouseleave - the trigger never learns the
    // pointer left it, so the tooltip would otherwise stay stuck open over
    // whatever ends up under the cursor. Capture phase so this fires for a
    // scroll on any nested scrollable ancestor, not just the window. Depends
    // on the open/closed boolean, not `cursor` itself - the coordinates
    // change on every mousemove while open, which would otherwise tear down
    // and re-add this listener on every pixel of movement.
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const close = () => setCursor(null);

        document.addEventListener('scroll', close, {
            capture: true,
            passive: true,
        });

        return () =>
            document.removeEventListener('scroll', close, { capture: true });
    }, [isOpen]);

    const type = reference?.type ?? 'gem';
    const name = reference?.name ?? '';
    const icon = reference?.icon ?? null;
    const sprite = reference?.sprite ?? null;
    const category = reference?.category ?? null;
    const tags = reference?.tags ?? [];
    const tooltip = reference?.tooltip ?? null;
    const flavour = reference?.flavour ?? null;
    const hoverImage = reference?.hoverImage ?? null;
    const scaling = reference?.scaling ?? null;
    const requires = reference?.requires ?? null;
    const levelRequirement = reference?.levelRequirement ?? null;
    const isGem = type === 'gem';
    const isRune = type === 'rune';
    const isNotable = type === 'notable';
    // A keystone is a `type: 'notable'` reference too (see IconResolver/treeNotables'
    // `notableReference` - keystones and ascendancy notables share the same category
    // field, both sourced from the tree data's own `isKeystone`/`ascendancy`), but the
    // game draws it with its own more ornate banner rather than the plain notable one.
    const isKeystone = category === 'Keystone';

    // A gem's header shows its primary tag ("Spell", "Attack", "Warcry", ...) as
    // the subtitle, same as the game's own tooltip - the body's own tag list below
    // excludes it so it isn't listed twice.
    const gemSubtitle = tags[0];
    const gemTags = tags.slice(1);

    // A rune/soul core's own type ("Rune"/"Soul Core") moves into the body's own
    // first line (see RuneTooltipBody) rather than the header subtitle, matching
    // the game's own tooltip. A notable's mod lines share the same shape (see
    // ModLines) - no bullets, mod-blue text, numbers picked out white.
    const effectLines = (tooltip ?? '')
        .split('\n')
        .filter((line) => line.trim() !== '');

    const color = accentColor(type, reference?.color);
    const accent: TooltipAccent = {
        // A gem's title is always the game's own fixed teal, and a rune's the
        // game's own tan - neither is socket-tinted, unlike the chip/badges
        // elsewhere - pixel-matched against poe2db's reference tooltips, not the
        // socket ring colour.
        text: isGem ? GEM_TITLE_COLOR : isRune ? RUNE_TITLE_COLOR : color,
        edge: color,
        glow: `${color}28`,
    };

    const hasTooltip = Boolean(
        reference &&
        (tooltip ||
            tags.length ||
            category ||
            flavour ||
            scaling ||
            requires ||
            levelRequirement),
    );

    return (
        <span
            ref={triggerRef}
            className={className}
            // No hover on touch devices - a tap focuses the trigger instead, so
            // this doubles as the mobile fallback (mirrors HoverTooltip's own
            // group-focus-within pattern, just without a group/CSS-only trick
            // since this tooltip follows the cursor rather than the trigger).
            // Only a real tab stop when there's something to show - an
            // unresolved reference has no popover, so it shouldn't eat a stop.
            tabIndex={disabled || !hasTooltip ? -1 : 0}
            onMouseEnter={(event) =>
                setCursor({ x: event.clientX, y: event.clientY })
            }
            onMouseMove={(event) =>
                setCursor({ x: event.clientX, y: event.clientY })
            }
            onMouseLeave={() => setCursor(null)}
            onFocus={() => {
                // Clicking a focusable element also fires focus in most
                // browsers - skip repositioning when the mouse already placed
                // the cursor, or a click on an already-hovered trigger would
                // make the tooltip visibly jump to the trigger's centre.
                setCursor((prev) => {
                    if (prev !== null) {
                        return prev;
                    }

                    const rect = triggerRef.current?.getBoundingClientRect();

                    return rect
                        ? {
                              x: rect.left + rect.width / 2,
                              y: rect.top + rect.height / 2,
                          }
                        : prev;
                });
            }}
            onBlur={() => setCursor(null)}
        >
            {children}

            {cursor && hasTooltip && !disabled && (
                <CursorTooltip x={cursor.x} y={cursor.y}>
                    <>
                        <TooltipCard
                            accent={accent}
                            icon={isGem ? undefined : icon}
                            iconNode={
                                !isGem && sprite ? (
                                    <SpriteIcon
                                        sprite={sprite}
                                        size="2.5rem"
                                        className="shrink-0 rounded-sm"
                                    />
                                ) : undefined
                            }
                            title={name}
                            subtitle={
                                isGem
                                    ? gemSubtitle
                                    : isRune
                                      ? undefined
                                      : (category ?? undefined)
                            }
                            subtitleColor={isGem ? GEM_LABEL_COLOR : undefined}
                            frame={
                                isRune
                                    ? 'currency'
                                    : isKeystone
                                      ? 'keystone'
                                      : isNotable
                                        ? 'notable'
                                        : undefined
                            }
                            backgroundImage={isGem ? hoverImage : undefined}
                            headerImage={isGem ? GEM_HEADER_IMAGE : undefined}
                        >
                            {isGem ? (
                                <GemTooltipBody
                                    tags={gemTags}
                                    description={tooltip}
                                    scaling={scaling}
                                    requires={requires}
                                />
                            ) : isRune ? (
                                <RuneTooltipBody
                                    category={category ?? 'Rune'}
                                    levelRequirement={levelRequirement}
                                    effects={effectLines}
                                />
                            ) : isNotable ? (
                                effectLines.length > 0 && (
                                    <ModLines lines={effectLines} />
                                )
                            ) : (
                                <>
                                    {tags.length > 0 && (
                                        <div className="mb-2.5 flex flex-wrap gap-1.5">
                                            {tags.map((tag, index) => (
                                                <TooltipBadge key={index}>
                                                    {tag
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                        tag.slice(1)}
                                                </TooltipBadge>
                                            ))}
                                        </div>
                                    )}

                                    {tooltip && (
                                        <>
                                            {tags.length > 0 && <TooltipRule />}
                                            <p
                                                style={{
                                                    color: MOD_TEXT_COLOR,
                                                }}
                                            >
                                                {tooltip}
                                            </p>
                                        </>
                                    )}

                                    {flavour && (
                                        <p className="text-[15px] leading-snug whitespace-pre-line text-[#a08fd0] italic">
                                            {flavour}
                                        </p>
                                    )}
                                </>
                            )}
                        </TooltipCard>

                        {/* A second panel below the card: a wireframe mini-map of the
                        tree with this notable highlighted, so the reader sees where
                        it sits at a glance. */}
                        {type === 'notable' && reference?.id && (
                            <div className="mt-2 overflow-hidden rounded-sm border border-[#2a2833] bg-[#0b0b12]/95 shadow-2xl backdrop-blur-sm">
                                <div
                                    className="border-b border-[#2a2833] px-4 py-2 text-xs font-semibold tracking-wide uppercase"
                                    style={{ color }}
                                >
                                    Tree location
                                </div>
                                <div className="p-2">
                                    <NotableTreeMap name={reference.id} />
                                </div>
                            </div>
                        )}
                    </>
                </CursorTooltip>
            )}
        </span>
    );
}

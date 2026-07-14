import { useState } from 'react';
import {
    BulletList,
    CursorTooltip,
    GEM_LABEL_COLOR,
    GEM_TITLE_COLOR,
    GemTooltipBody,
    MOD_TEXT_COLOR,
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
    const isGem = type === 'gem';

    // A gem's header shows its primary tag ("Spell", "Attack", "Warcry", ...) as
    // the subtitle, same as the game's own tooltip - the body's own tag list below
    // excludes it so it isn't listed twice.
    const gemSubtitle = tags[0];
    const gemTags = tags.slice(1);

    const color = accentColor(type, reference?.color);
    const accent: TooltipAccent = {
        // A gem's title is always the game's own fixed teal, not socket-tinted -
        // pixel-matched against poe2db's `--gem-color`, not the socket ring colour
        // used for the chip/badges elsewhere.
        text: isGem ? GEM_TITLE_COLOR : color,
        edge: color,
        glow: `${color}28`,
    };

    const hasTooltip = Boolean(
        reference &&
        (tooltip || tags.length || category || flavour || scaling || requires),
    );

    return (
        <span
            className={className}
            onMouseEnter={(event) =>
                setCursor({ x: event.clientX, y: event.clientY })
            }
            onMouseMove={(event) =>
                setCursor({ x: event.clientX, y: event.clientY })
            }
            onMouseLeave={() => setCursor(null)}
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
                                isGem ? gemSubtitle : (category ?? undefined)
                            }
                            subtitleColor={isGem ? GEM_LABEL_COLOR : undefined}
                            frame={type === 'rune' ? 'currency' : undefined}
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

                                    {tooltip &&
                                        (type === 'rune' ||
                                            type === 'notable') && (
                                            <BulletList
                                                lines={tooltip
                                                    .split('\n')
                                                    .filter(
                                                        (line) =>
                                                            line.trim() !== '',
                                                    )}
                                                color={color}
                                            />
                                        )}

                                    {tooltip &&
                                        type !== 'rune' &&
                                        type !== 'notable' && (
                                            <>
                                                {tags.length > 0 && (
                                                    <TooltipRule />
                                                )}
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

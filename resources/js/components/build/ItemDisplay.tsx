import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Filigree } from '@/components/build/Panel';
import {
    BulletList,
    rarityFrame,
    rarityTone,
    TooltipBadge,
    TooltipCard,
    TooltipRule,
} from '@/components/build/tooltip';
import type { TooltipAccent } from '@/components/build/tooltip';

/**
 * The equipment display used by the build planner. A {@link SlotTile} draws an item's
 * art, overlays its socketed runes and reveals the full {@link ItemTooltip} on hover;
 * passing `onEdit` makes the tile interactive for editing. Callers feed the
 * {@link Item} shape, so the visual is defined in exactly one place.
 */

export interface Item {
    /** Inventory slot label (used by the paper-doll mapping). */
    slot: string;
    rarity: string;
    name: string;
    baseType: string;
    itemLevel: number | null;
    icon: string | null;
    twoHanded: boolean;
    itemClass: string | null;
    levelRequirement: number | null;
    // Attribute requirements - optional; the planner does not author them, but an
    // imported item may carry them.
    requiredStrength?: number | null;
    requiredDexterity?: number | null;
    requiredIntelligence?: number | null;
    // The item's own defensive/quality properties, shown above requirements (0/absent hides
    // the line). Block is shields-only. These are what the planner authors instead of attributes.
    quality?: number | null;
    armour?: number | null;
    evasion?: number | null;
    energyShield?: number | null;
    block?: number | null;
    runes: Rune[];
    /** Empty rune sockets to draw (as bare rings) after the filled ones. */
    emptySockets?: number;
    implicitMods: string[];
    /** The explicit mods as the game shows them by default: same-stat mods summed into
     *  one line (see aggregateModLines). */
    explicitMods: string[];
    /** The per-affix breakdown shown while Alt is held (the game's detailed view): each
     *  authored affix with its generation type, tier and `value(min-max)` lines. Absent
     *  for items whose mods aren't authored affixes (e.g. imported items). */
    modDetails?: ItemModDetail[];
    /** Unique-item flavour/lore text (lines joined by "\n"), shown italic. */
    flavour?: string | null;
}

export interface Rune {
    name: string;
    icon: string | null;
    levelRequirement: number | null;
    effects: string[];
}

/** One authored affix in the Alt-held detailed view: its type, tier and rendered lines. */
export interface ItemModDetail {
    type: 'prefix' | 'suffix' | null;
    tier: number | null;
    lines: string[];
}

export type TooltipAlign = 'left' | 'center' | 'right';

/** Gem socket / attribute colour from the single-letter attribute (b/g/r/w). */
export function socketColor(color: string | null): string {
    switch (color) {
        case 'r':
            return '#d0584a';
        case 'g':
            return '#5fbf6a';
        case 'b':
            return '#4a8fe0';
        default:
            return '#cdc6b8';
    }
}

/** Close any click-pinned tooltip when the pointer moves onto another trigger. */
export function dismissPinnedTooltip() {
    const active = document.activeElement;

    if (active instanceof HTMLElement) {
        active.blur();
    }
}

/**
 * Forces every item/rune tooltip beneath it to open on a fixed side; null lets each
 * tooltip auto-flip by viewport fit.
 */
export const TooltipSideContext = createContext<'left' | 'right' | null>(null);

/** Positioned, hover/focus-revealed tooltip to the side of its trigger. */
export function HoverTooltip({
    show,
    children,
}: {
    show: string;
    children: React.ReactNode;
}) {
    const forcedSide = useContext(TooltipSideContext);
    const ref = useRef<HTMLDivElement>(null);
    const [autoSide, setAutoSide] = useState<'right' | 'left'>('right');

    useEffect(() => {
        if (forcedSide) {
            return;
        }

        const trigger = ref.current?.parentElement;

        if (!trigger) {
            return;
        }

        const place = () => {
            const rect = trigger.getBoundingClientRect();
            const tipWidth = Math.min(416, window.innerWidth * 0.88);

            setAutoSide(
                rect.right + 8 + tipWidth <= window.innerWidth
                    ? 'right'
                    : 'left',
            );
        };

        place();
        window.addEventListener('resize', place);

        return () => window.removeEventListener('resize', place);
    }, [forcedSide]);

    const side = forcedSide ?? autoSide;
    const pos = side === 'right' ? 'left-full ml-2' : 'right-full mr-2';

    return (
        <div
            ref={ref}
            // Pointer-transparent while merely hovered: the panel is wide enough to
            // overlap neighbouring paper-doll slots, and without this the mouse can
            // wander onto the floating panel itself and keep it (and the trigger's
            // group-hover) open indefinitely, even over another item's tile. Once
            // pinned open (a click focuses the trigger - group-focus-within, either
            // the default group or the rune-scoped `group/rune`), it regains normal
            // pointer events so its text can be selected/copied.
            className={`pointer-events-none absolute top-1/2 z-[60] hidden w-[26rem] max-w-[88vw] -translate-y-1/2 select-text group-focus-within:pointer-events-auto group-focus-within/rune:pointer-events-auto ${pos} ${show}`}
        >
            {children}
        </div>
    );
}

/**
 * GGPK socket textures: the empty ring, and the game's own filled overlays (blue rune
 * star / red soul-core orb). A filled socket is the ring with its overlay on top.
 * Decoded from the GGPK by build-data.mjs.
 */
const EMPTY_SOCKET_IMAGE = '/icons/poe2/ui/socket-empty.png';
const RUNE_SOCKET_IMAGE = '/icons/poe2/ui/rune-socket.png';
const SOUL_CORE_SOCKET_IMAGE = '/icons/poe2/ui/soul-core-socket.png';

/** Whether a socketed item is a soul core (red orb) rather than a rune (blue star). */
function isSoulCore(name: string): boolean {
    return /soul\s*core/i.test(name);
}

/**
 * The socket visual, filling its container: the bare GGPK ring always drawn, with
 * the game's rune star / soul-core orb layered on top when `name` is a filled
 * socket. `null`/omitted `name` renders the empty ring. Both the paper-doll badges
 * and the planner's socket editor share this so every socket looks identical.
 */
export function SocketIcon({ name }: { name?: string | null }) {
    return (
        <span className="relative block aspect-square w-full">
            <img
                src={EMPTY_SOCKET_IMAGE}
                alt=""
                aria-hidden
                loading="lazy"
                className="h-full w-full object-contain"
            />
            {name != null && (
                <img
                    src={
                        isSoulCore(name)
                            ? SOUL_CORE_SOCKET_IMAGE
                            : RUNE_SOCKET_IMAGE
                    }
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-contain"
                />
            )}
        </span>
    );
}

/** An empty rune socket - the bare GGPK socket ring, no contents. Fills its cell. */
export function EmptySocketBadge() {
    return (
        <span className="pointer-events-none block aspect-square w-full">
            <SocketIcon />
        </span>
    );
}

const RUNE_ACCENT: TooltipAccent = {
    text: '#ecd49a',
    edge: '#7d6228',
    glow: 'rgba(201,162,74,0.18)',
};

/** A socketed rune, shown as a round socket centred on the item, with its tooltip. */
export function RuneBadge({
    rune,
    onActiveChange,
}: {
    rune: Rune;
    onActiveChange: (active: boolean) => void;
}) {
    return (
        <div
            className="group/rune pointer-events-auto relative aspect-square w-full"
            tabIndex={0}
            aria-label={rune.name}
            onMouseEnter={() => onActiveChange(true)}
            onMouseLeave={() => onActiveChange(false)}
            onFocus={() => onActiveChange(true)}
            onBlur={() => onActiveChange(false)}
        >
            {/* Empty socket ring, with the game's rune star / soul-core orb over it. */}
            <SocketIcon name={rune.name} />

            <HoverTooltip show="group-focus-within/rune:block group-hover/rune:block">
                <TooltipCard
                    accent={RUNE_ACCENT}
                    icon={rune.icon}
                    title={rune.name}
                    subtitle="Socketed Rune"
                >
                    {rune.levelRequirement !== null && (
                        <p className="text-sm text-[#a7acb8]">
                            Requires Level{' '}
                            <span className="font-medium text-[#f1f3f8]">
                                {rune.levelRequirement}
                            </span>
                        </p>
                    )}

                    {rune.effects.length > 0 && (
                        <>
                            {rune.levelRequirement !== null && <TooltipRule />}
                            <BulletList lines={rune.effects} color="#8888ff" />
                        </>
                    )}
                </TooltipCard>
            </HoverTooltip>
        </div>
    );
}

/**
 * An item's sockets, overlaid and centred on its art: filled runes first, then
 * empty rings. A two-column grid so a third socket drops to the first column of a
 * second row (`[1][2]` / `[3]`) rather than straddling the centre; one socket takes
 * a single centred column. Shared by the paper-doll and the planner preview so every
 * item shows sockets identically.
 */
export function SocketCluster({
    runes,
    emptySockets = 0,
    onRuneActiveChange,
    padClassName = 'p-[6%]',
}: {
    runes: Rune[];
    emptySockets?: number;
    onRuneActiveChange: (active: boolean) => void;
    /** Tailwind padding for the overlay box; tune per host tile size. */
    padClassName?: string;
}) {
    const count = runes.length + emptySockets;

    if (count === 0) {
        return null;
    }

    const twoColumn = count >= 2;

    return (
        <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center ${padClassName}`}
        >
            <div
                className="grid gap-[8%]"
                style={{
                    gridTemplateColumns: `repeat(${twoColumn ? 2 : 1}, minmax(0, 1fr))`,
                    width: twoColumn ? '84%' : '42%',
                }}
            >
                {runes.map((rune, i) => (
                    <RuneBadge
                        key={`r${i}`}
                        rune={rune}
                        onActiveChange={onRuneActiveChange}
                    />
                ))}
                {Array.from({ length: emptySockets }, (_, i) => (
                    <EmptySocketBadge key={`e${i}`} />
                ))}
            </div>
        </div>
    );
}

/**
 * Level and attribute requirements as badges: Level in white, STR/DEX/INT in their
 * game colours (the same red/green/blue as gem sockets).
 */
/**
 * The item's defensive/quality properties - quality, the three defence types and block
 * (shields only) - each shown on its own line with the value emphasised, in the game's
 * tooltip order. A property at 0 or absent is hidden; nothing renders when none are set.
 */
function Properties({ item }: { item: Item }) {
    const lines: Array<{ key: string; label: string; value: string }> = [];

    if (item.quality) {
        lines.push({
            key: 'quality',
            label: 'Quality',
            value: `+${item.quality}%`,
        });
    }

    if (item.armour) {
        lines.push({ key: 'armour', label: 'Armour', value: `${item.armour}` });
    }

    if (item.evasion) {
        lines.push({
            key: 'evasion',
            label: 'Evasion Rating',
            value: `${item.evasion}`,
        });
    }

    if (item.energyShield) {
        lines.push({
            key: 'es',
            label: 'Energy Shield',
            value: `${item.energyShield}`,
        });
    }

    if (item.block) {
        lines.push({ key: 'block', label: 'Block', value: `${item.block}%` });
    }

    if (lines.length === 0) {
        return null;
    }

    return (
        <div className="mt-0.5">
            {lines.map((line) => (
                <p key={line.key} className="text-sm text-[#a7acb8]">
                    {line.label}:{' '}
                    <span className="font-medium text-[#f1f3f8]">
                        {line.value}
                    </span>
                </p>
            ))}
        </div>
    );
}

function Requirements({ item }: { item: Item }) {
    const badges: Array<{ key: string; label: string; color: string }> = [];

    if (item.levelRequirement !== null) {
        badges.push({
            key: 'lvl',
            label: `Level ${item.levelRequirement}`,
            color: '#f1f3f8',
        });
    }

    if (item.requiredStrength) {
        badges.push({
            key: 'str',
            label: `${item.requiredStrength} STR`,
            color: socketColor('r'),
        });
    }

    if (item.requiredDexterity) {
        badges.push({
            key: 'dex',
            label: `${item.requiredDexterity} DEX`,
            color: socketColor('g'),
        });
    }

    if (item.requiredIntelligence) {
        badges.push({
            key: 'int',
            label: `${item.requiredIntelligence} INT`,
            color: socketColor('b'),
        });
    }

    if (badges.length === 0) {
        return null;
    }

    return (
        <div className="mt-2">
            <p className="mb-1 text-xs font-semibold tracking-[0.12em] text-[#a7acb8] uppercase">
                Requirements
            </p>
            <div className="flex flex-wrap gap-1.5">
                {badges.map((badge) => (
                    <TooltipBadge key={badge.key} color={badge.color}>
                        {badge.label}
                    </TooltipBadge>
                ))}
            </div>
        </div>
    );
}

/** The detail-view modifier key's label - "Option" on macOS, "Alt" elsewhere. The
 *  KeyboardEvent key is "Alt" on both (macOS maps Option to it), so only the label differs. */
const ALT_LABEL =
    typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
        ? 'Option'
        : 'Alt';

/** Whether the Alt (macOS Option) key is currently held - the game's detail-view modifier. */
function useAltHeld(): boolean {
    const [held, setHeld] = useState(false);

    useEffect(() => {
        const down = (event: KeyboardEvent) => {
            if (event.key === 'Alt') {
                setHeld(true);
            }
        };
        const up = (event: KeyboardEvent) => {
            if (event.key === 'Alt') {
                setHeld(false);
            }
        };
        const reset = () => setHeld(false);

        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        window.addEventListener('blur', reset);

        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', reset);
        };
    }, []);

    return held;
}

/** An affix's short badge: `P3` for prefixes, `S6` for suffixes (letter + tier). */
function detailBadge(detail: ItemModDetail): string {
    const letter =
        detail.type === 'prefix' ? 'P' : detail.type === 'suffix' ? 'S' : '';

    return letter === '' ? 'mod' : `${letter}${detail.tier ?? ''}`;
}

/** One affix row: its P/S-tier badge followed by its `value(min-max)` lines. */
function ModDetailRow({ detail }: { detail: ItemModDetail }) {
    return (
        <div>
            <span className="mr-2 text-xs font-semibold tracking-[0.08em] text-[#8a8f9c] uppercase">
                {detailBadge(detail)}
            </span>
            {detail.lines.map((line, index) => (
                <span key={index} className="text-sm text-[#aab6ff]">
                    {line}
                    {index < detail.lines.length - 1 ? ', ' : ''}
                </span>
            ))}
        </div>
    );
}

/**
 * The Alt-held detailed view: each authored affix on its own showing `value(min-max)` -
 * the breakdown the game reveals under Alt. Prefixes are grouped on top and suffixes
 * below, split by a rule, each labelled `P<tier>` / `S<tier>`.
 */
function ModDetailList({ details }: { details: ItemModDetail[] }) {
    const prefixes = details.filter((detail) => detail.type === 'prefix');
    const suffixes = details.filter((detail) => detail.type !== 'prefix');

    return (
        <div className="flex flex-col gap-1.5">
            {prefixes.map((detail, index) => (
                <ModDetailRow key={`p${index}`} detail={detail} />
            ))}

            {prefixes.length > 0 && suffixes.length > 0 && <TooltipRule />}

            {suffixes.map((detail, index) => (
                <ModDetailRow key={`s${index}`} detail={detail} />
            ))}
        </div>
    );
}

/** In-game item tooltip, built from the shared card. */
/**
 * The item tooltip's card - shared by the hover tooltip on a paper-doll tile and the
 * cursor tooltip on the priority strip, so both read identically.
 */
export function ItemCard({ item }: { item: Item }) {
    const tone = rarityTone(item.rarity);
    const hasName = item.name !== '' && item.name !== item.baseType;
    const hasMods =
        item.implicitMods.length > 0 || item.explicitMods.length > 0;
    // Hold Alt to swap the summed explicit lines for the per-affix breakdown, like the game.
    const showDetail = useAltHeld() && (item.modDetails?.length ?? 0) > 0;

    return (
        <TooltipCard
            accent={tone}
            icon={item.icon}
            title={hasName ? item.name : item.baseType}
            subtitle={hasName ? item.baseType : undefined}
            frame={rarityFrame(item.rarity)}
        >
            {item.itemClass && (
                <p className="text-sm font-medium tracking-[0.08em] text-[#d6dae2]">
                    {item.itemClass}
                </p>
            )}

            {item.itemLevel !== null && (
                <p className="mt-0.5 text-sm text-[#a7acb8]">
                    Item Level:{' '}
                    <span className="font-medium text-[#f1f3f8]">
                        {item.itemLevel}
                    </span>
                </p>
            )}

            <Properties item={item} />

            <Requirements item={item} />

            {hasMods && <TooltipRule />}

            {item.implicitMods.length > 0 && (
                <BulletList lines={item.implicitMods} color="#8888ff" />
            )}

            {item.implicitMods.length > 0 && item.explicitMods.length > 0 && (
                <TooltipRule />
            )}

            {item.explicitMods.length > 0 &&
                (showDetail ? (
                    <ModDetailList details={item.modDetails ?? []} />
                ) : (
                    <BulletList lines={item.explicitMods} color="#8888ff" />
                ))}

            {(item.modDetails?.length ?? 0) > 0 && (
                <p className="mt-2 text-[0.6875rem] tracking-[0.08em] text-[#6f7480] uppercase">
                    Hold {ALT_LABEL} for tiers
                </p>
            )}

            {item.flavour && (
                <>
                    <TooltipRule />
                    <p
                        className="text-[0.9375rem] leading-tight whitespace-pre-line italic"
                        style={{ color: tone.text, opacity: 0.65 }}
                    >
                        {item.flavour}
                    </p>
                </>
            )}
        </TooltipCard>
    );
}

export function ItemTooltip({ item }: { item: Item }) {
    return (
        <HoverTooltip show="group-focus-within:block group-hover:block group-has-[[data-priority]:hover]:hidden! group-has-[[data-priority]:focus]:hidden!">
            <ItemCard item={item} />
        </HoverTooltip>
    );
}

/**
 * A single paper-doll cell: the item's art in a rarity-toned frame, its socketed
 * runes overlaid, and the item tooltip on hover. Read-only by default; pass `onEdit`
 * (planner) to make the cell open its editor on click and show a clear button.
 */
export function SlotTile({
    slot,
    item,
    ghostItem = null,
    align = 'center',
    strip = false,
    flask = false,
    trinket = false,
    trinketSize = '2.6rem',
    highlighted = false,
    style,
    onEdit,
    onClear,
    overlay,
}: {
    slot: string;
    item: Item | null;
    ghostItem?: Item | null;
    align?: TooltipAlign;
    strip?: boolean;
    flask?: boolean;
    trinket?: boolean;
    /** Trinket tile edge length; the planner's larger paper-doll overrides the default. */
    trinketSize?: string;
    /** Ring the item's actual frame (not the wider grid cell) - used for the priority
     *  strip's cross-highlight, so a narrow flask lights up at its own width. */
    highlighted?: boolean;
    style?: React.CSSProperties;
    onEdit?: () => void;
    onClear?: () => void;
    /**
     * Corner controls drawn over the tile (planner priority square / picker). A `[data-priority]`
     * element inside it hides the item tooltip on hover via CSS `:has` (see {@link ItemTooltip}),
     * so its own hint shows instead of the big item card - with no mount-timing flash.
     */
    overlay?: React.ReactNode;
}) {
    const [artFailed, setArtFailed] = useState(false);
    // Hovering a rune suppresses the item tooltip, so they never overlap.
    const [runeActive, setRuneActive] = useState(false);
    const tone = item ? rarityTone(item.rarity) : null;
    const showArt = item?.icon && !artFailed;
    // Trinkets get their size inline (runtime value), so Tailwind never purges it.
    const trinketStyle: React.CSSProperties | undefined = trinket
        ? { width: trinketSize, height: trinketSize }
        : undefined;
    const sizeClass = strip ? 'size-[3.25rem]' : trinket ? '' : 'h-full w-full';
    const flaskJustify =
        align === 'left'
            ? 'justify-start'
            : align === 'right'
              ? 'justify-end'
              : 'justify-center';

    // A right-side slot opens its tooltip to the left (and vice versa), so it never
    // runs off the doll's edge. An ancestor that forces a side (a whole column) still
    // wins over the per-slot align.
    const ancestorSide = useContext(TooltipSideContext);
    const alignedSide: 'left' | 'right' | null =
        align === 'right' ? 'left' : align === 'left' ? 'right' : null;
    const tooltipSide = ancestorSide ?? alignedSide;

    return (
        <TooltipSideContext.Provider value={tooltipSide}>
            <div
                className={`group relative ${sizeClass} ${flask ? `flex ${flaskJustify}` : ''} ${onEdit ? 'cursor-pointer' : ''}`}
                style={{ ...trinketStyle, ...style }}
                tabIndex={item ? 0 : -1}
                onMouseEnter={dismissPinnedTooltip}
                onClick={onEdit}
            >
                {/* The frame column: sized to the art (narrow for flasks), so the tooltip,
                clear button and priority overlay all anchor to the item, not the wider
                grid cell a left/right-justified flask leaves around it. */}
                <div
                    className={`relative flex h-full items-center justify-center rounded-[2px] ${flask ? 'w-[45%] min-w-[1.6rem]' : 'w-full'} ${highlighted ? 'ring-2 ring-[var(--pl-accent-lit)]' : ''}`}
                >
                    <div
                        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[2px] border bg-gradient-to-b from-[#0a0a10] to-[#0a0a10] transition ${onEdit && !item ? 'border-dashed hover:border-[#c9a24a]/80 hover:bg-[#c9a24a]/5' : ''}`}
                        style={{
                            borderColor: tone
                                ? tone.edge
                                : onEdit && !item
                                  ? 'rgba(201,162,74,0.45)'
                                  : '#13131b',
                            boxShadow: tone
                                ? `inset 0 0 26px -12px ${tone.glow}, 0 0 6px -3px ${tone.glow}`
                                : 'inset 0 0 20px -14px rgba(0,0,0,0.9)',
                        }}
                    >
                        {item ? (
                            showArt ? (
                                <img
                                    src={item.icon as string}
                                    alt={item.name || item.baseType}
                                    loading="lazy"
                                    onError={() => setArtFailed(true)}
                                    className="h-full w-full object-contain p-1"
                                />
                            ) : (
                                <span
                                    className="line-clamp-3 px-1 text-center text-[9px] leading-tight font-medium"
                                    style={{ color: tone?.text }}
                                >
                                    {item.name || item.baseType}
                                </span>
                            )
                        ) : ghostItem?.icon ? (
                            <img
                                src={ghostItem.icon}
                                alt=""
                                aria-hidden
                                loading="lazy"
                                className="h-full w-full object-contain p-1 opacity-50"
                            />
                        ) : trinket ? (
                            <Filigree />
                        ) : (
                            <span
                                className={`px-1 text-center text-[8px] tracking-wide uppercase ${onEdit ? 'text-[#8a7a52] group-hover:text-[#c9a24a]' : 'text-[#4a4855]'}`}
                            >
                                {slot}
                            </span>
                        )}
                    </div>

                    {item && (
                        <SocketCluster
                            runes={item.runes}
                            emptySockets={item.emptySockets ?? 0}
                            onRuneActiveChange={setRuneActive}
                        />
                    )}

                    {item && !runeActive && <ItemTooltip item={item} />}

                    {onClear && item && (
                        <button
                            type="button"
                            title="Clear slot"
                            onClick={(event) => {
                                event.stopPropagation();
                                onClear();
                            }}
                            className="absolute top-1.5 right-1.5 z-[61] hidden size-4 items-center justify-center rounded-full bg-[#e0584f] text-[10px] text-white group-hover:flex"
                        >
                            ✕
                        </button>
                    )}

                    {overlay}
                </div>
            </div>
        </TooltipSideContext.Provider>
    );
}

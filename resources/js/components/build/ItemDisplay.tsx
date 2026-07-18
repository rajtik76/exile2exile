import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Filigree } from '@/components/build/Panel';
import {
    BulletList,
    MOD_TEXT_COLOR,
    MUTED_TEXT_COLOR,
    rarityFrame,
    rarityTone,
    RUNE_TITLE_COLOR,
    RuneTooltipBody,
    TooltipBadge,
    TooltipCard,
    TooltipRule,
} from '@/components/build/tooltip';
import type { TooltipAccent } from '@/components/build/tooltip';
import type { WeaponStatLine } from '@/lib/weaponStats';

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
    icon: string | null;
    twoHanded: boolean;
    /** Whether the item is Corrupted - shown as a red footer line in the tooltip. */
    corrupted?: boolean;
    /** The GGPK item class (e.g. "Sceptre", "Gloves") - the game's own first tooltip line. */
    category?: string | null;
    /** The rolled item level (1-100), shown as its own line above Requirements. */
    itemLevel?: number | null;
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
    /**
     * The derived weapon-stat lines (base WeaponTypes row + local mods + quality) -
     * Physical/elemental damage, Critical Hit Chance, Attacks per Second, Reload Time,
     * Weapon Range, and Spirit (sceptres) - in the game tooltip's order. Empty for
     * anything that isn't a weapon or Spirit-granting base. See {@link weaponStatLines}.
     */
    weaponStats?: WeaponStatLine[];
    runes: Rune[];
    /** Empty rune sockets to draw (as bare rings) after the filled ones. */
    emptySockets?: number;
    implicitMods: string[];
    /** The explicit mods as the game shows them by default: same-stat mods summed into
     *  one line (see aggregateModLines). */
    explicitMods: string[];
    /** Unique-item flavour/lore text (lines joined by "\n"), shown italic. */
    flavour?: string | null;
}

export interface Rune {
    name: string;
    icon: string | null;
    levelRequirement: number | null;
    effects: string[];
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

/** Positioned, hover/focus-revealed tooltip anchored to its trigger. */
export function HoverTooltip({
    show,
    children,
}: {
    show: string;
    children: React.ReactNode;
}) {
    const forcedSide = useContext(TooltipSideContext);
    const ref = useRef<HTMLDivElement>(null);
    const [autoSide, setAutoSide] = useState<
        'right' | 'left' | 'top' | 'bottom'
    >('right');

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
            // The panel is hidden (display:none) until hover, so its real
            // fit-content width can't be measured up front - use its widest
            // possible width (the same ceiling the className below caps it at)
            // as a conservative estimate, so this never picks a side only for
            // the panel to then overflow the viewport.
            const tipWidth = Math.min(512, window.innerWidth * 0.88);
            const fitsRight = rect.right + 8 + tipWidth <= window.innerWidth;
            const fitsLeft = rect.left - 8 - tipWidth >= 0;

            if (fitsRight || fitsLeft) {
                setAutoSide(fitsRight ? 'right' : 'left');

                return;
            }

            // Neither side has room - a centre paper-doll slot (helmet, body
            // armour, belt, the middle charm) on a narrow screen, where the
            // panel is wider than the space to either flank. Drop to above/
            // below instead, whichever has more room; flipping sides alone
            // could never fit these, the trigger has no side clearance at all.
            setAutoSide(
                window.innerHeight - rect.bottom >= rect.top ? 'bottom' : 'top',
            );
        };

        place();
        window.addEventListener('resize', place);

        return () => window.removeEventListener('resize', place);
    }, [forcedSide]);

    const side = forcedSide ?? autoSide;
    const pos =
        side === 'right'
            ? 'top-1/2 left-full ml-2 -translate-y-1/2'
            : side === 'left'
              ? 'top-1/2 right-full mr-2 -translate-y-1/2'
              : side === 'bottom'
                ? 'top-full left-1/2 mt-2 -translate-x-1/2'
                : 'bottom-full left-1/2 mb-2 -translate-x-1/2';

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
            // The 26rem floor keeps the desktop layout roomy, but on a narrow
            // screen it alone would overflow every side (and top/bottom centred)
            // placement alike - drop it below the `sm` breakpoint so only the
            // 88vw ceiling governs there.
            className={`pointer-events-none absolute z-[65] hidden w-max max-w-[min(32rem,88vw)] min-w-[26rem] select-text group-focus-within:pointer-events-auto group-focus-within/rune:pointer-events-auto max-sm:min-w-0 ${pos} ${show}`}
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
    text: RUNE_TITLE_COLOR,
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
                    title={rune.name}
                    frame="currency"
                >
                    <RuneTooltipBody
                        category={isSoulCore(rune.name) ? 'Soul Core' : 'Rune'}
                        levelRequirement={rune.levelRequirement}
                        effects={rune.effects}
                    />
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
 * A weapon-stat elemental damage line's numeric value colour, by its {@link
 * weaponStatLines} label - the game's own per-element palette. The label itself always
 * stays muted, only the value is tinted.
 */
const ELEMENTAL_DAMAGE_COLOR: Record<string, string> = {
    'Fire Damage': 'rgb(150, 0, 0)',
    'Cold Damage': 'rgb(54, 100, 146)',
    'Lightning Damage': 'rgb(255, 215, 0)',
    'Chaos Damage': 'rgb(208, 32, 144)',
};

/**
 * The item's defensive/quality properties (quality, the three defence types, block) and
 * the derived weapon-stat lines (Physical/elemental damage, Crit, Attacks per Second,
 * Reload Time, Weapon Range, Spirit) - one unified block, in the game tooltip's order.
 * A property at 0/absent is hidden; nothing renders when none are set. A weapon line the
 * item's own local mods or quality changed shows in the mod-text blue, same as the game's
 * augmented stats; an unmodified base line shows plain.
 */
/** One property line: a label plus one or more colour-tinted value segments (comma-joined). */
interface PropertyLine {
    key: string;
    label: string;
    segments: Array<{ value: string; color: string }>;
}

/** Combines fire/cold/lightning weapon-stat lines into one "Elemental Damage" line, in
 * that fixed order - the game's own display convention. Chaos Damage never joins it,
 * always its own line (still coloured via {@link ELEMENTAL_DAMAGE_COLOR}). */
const COMBINED_ELEMENT_ORDER = [
    'Fire Damage',
    'Cold Damage',
    'Lightning Damage',
] as const;

function Properties({ item }: { item: Item }) {
    const lines: PropertyLine[] = [];

    if (item.quality) {
        lines.push({
            key: 'quality',
            label: 'Quality',
            segments: [{ value: `+${item.quality}%`, color: MOD_TEXT_COLOR }],
        });
    }

    if (item.armour) {
        lines.push({
            key: 'armour',
            label: 'Armour',
            segments: [{ value: `${item.armour}`, color: MOD_TEXT_COLOR }],
        });
    }

    if (item.evasion) {
        lines.push({
            key: 'evasion',
            label: 'Evasion Rating',
            segments: [{ value: `${item.evasion}`, color: MOD_TEXT_COLOR }],
        });
    }

    if (item.energyShield) {
        lines.push({
            key: 'es',
            label: 'Energy Shield',
            segments: [
                { value: `${item.energyShield}`, color: MOD_TEXT_COLOR },
            ],
        });
    }

    if (item.block) {
        lines.push({
            key: 'block',
            label: 'Block',
            segments: [{ value: `${item.block}%`, color: MOD_TEXT_COLOR }],
        });
    }

    // Fire/Cold/Lightning weapon lines merge into one "Elemental Damage" line (fixed
    // order, comma-joined); Chaos Damage never joins it and any other weapon-stat line
    // (Physical Damage, Critical Hit Chance, ...) passes through untouched.
    const weaponStats = item.weaponStats ?? [];
    let elementalDamagePlaced = false;

    for (const weaponLine of weaponStats) {
        if (
            (COMBINED_ELEMENT_ORDER as readonly string[]).includes(
                weaponLine.label,
            )
        ) {
            if (elementalDamagePlaced) {
                continue;
            }

            elementalDamagePlaced = true;

            const segments = COMBINED_ELEMENT_ORDER.flatMap((label) => {
                const line = weaponStats.find((l) => l.label === label);

                return line
                    ? [
                          {
                              value: line.value,
                              color: ELEMENTAL_DAMAGE_COLOR[label],
                          },
                      ]
                    : [];
            });

            lines.push({
                key: 'elemental-damage',
                label: 'Elemental Damage',
                segments,
            });

            continue;
        }

        lines.push({
            key: weaponLine.label,
            label: weaponLine.label,
            segments: [
                {
                    value: weaponLine.value,
                    color:
                        ELEMENTAL_DAMAGE_COLOR[weaponLine.label] ??
                        (weaponLine.modified ? MOD_TEXT_COLOR : '#fff'),
                },
            ],
        });
    }

    if (lines.length === 0) {
        return null;
    }

    return (
        <div className="mt-0.5 space-y-0.5">
            {lines.map((line) => (
                <p key={line.key} style={{ color: MUTED_TEXT_COLOR }}>
                    {line.label}:{' '}
                    {line.segments.map((segment, index) => (
                        <span key={index}>
                            {index > 0 && ', '}
                            <span style={{ color: segment.color }}>
                                {segment.value}
                            </span>
                        </span>
                    ))}
                </p>
            ))}
        </div>
    );
}

function Requirements({ item }: { item: Item }) {
    const badges: Array<{ key: string; label: string; color: string }> = [];

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
            <p
                className="mb-1 text-xs font-semibold tracking-[0.12em] uppercase"
                style={{ color: MUTED_TEXT_COLOR }}
            >
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

    return (
        <TooltipCard
            accent={tone}
            icon={item.icon}
            title={hasName ? item.name : item.baseType}
            subtitle={hasName ? item.baseType : undefined}
            frame={rarityFrame(item.rarity)}
        >
            {item.category && (
                <p style={{ color: MUTED_TEXT_COLOR }}>{item.category}</p>
            )}

            <Properties item={item} />

            {item.itemLevel != null && (
                <>
                    <TooltipRule />

                    <p style={{ color: MUTED_TEXT_COLOR }}>
                        Item Level:{' '}
                        <span style={{ color: '#fff' }}>{item.itemLevel}</span>
                    </p>
                </>
            )}

            <Requirements item={item} />

            {hasMods && <TooltipRule />}

            {item.implicitMods.length > 0 && (
                <BulletList lines={item.implicitMods} color={MOD_TEXT_COLOR} />
            )}

            {item.implicitMods.length > 0 && item.explicitMods.length > 0 && (
                <TooltipRule />
            )}

            {item.explicitMods.length > 0 && (
                <BulletList lines={item.explicitMods} color={MOD_TEXT_COLOR} />
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

            {item.corrupted && (
                <>
                    <TooltipRule />
                    <p className="text-[#d20000]">Corrupted</p>
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
                    className={`relative flex h-full items-center justify-center rounded-[10px] ${flask ? 'w-[45%] min-w-[1.6rem]' : 'w-full'} ${highlighted ? 'ring-2 ring-[var(--pl-accent-lit)]' : ''}`}
                >
                    <div
                        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] border transition ${onEdit && !item ? 'hover:border-[#c9a24a]/70 hover:bg-[#c9a24a]/[0.06]' : ''}`}
                        style={{
                            borderColor: tone ? tone.edge : '#1e1e26',
                            // A filled tile tints its background with the rarity's own
                            // glow (as the game's inventory does), fading into the dark
                            // base so the art stays readable.
                            background: tone
                                ? `radial-gradient(85% 85% at 50% 18%, ${tone.glow} 0%, transparent 70%), linear-gradient(180deg, #14141c 0%, #0a0a10 100%)`
                                : 'radial-gradient(65% 65% at 50% 32%, rgba(201,162,74,0.06), transparent 72%), linear-gradient(180deg, #131319 0%, #0a0a0e 100%)',
                            boxShadow: tone
                                ? `inset 0 0 26px -12px ${tone.glow}, 0 0 6px -3px ${tone.glow}`
                                : 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 0 22px -14px rgba(0,0,0,0.85)',
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
                            <span className="flex flex-col items-center gap-1">
                                {onEdit && (
                                    <svg
                                        aria-hidden
                                        viewBox="0 0 16 16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        className="size-3 text-[#4a4855] transition group-hover:text-[#c9a24a]"
                                    >
                                        <path d="M8 3.5 V12.5 M3.5 8 H12.5" />
                                    </svg>
                                )}
                                <span
                                    className={`px-1 text-center text-[8px] tracking-wide uppercase ${onEdit ? 'text-[#8a7a52] group-hover:text-[#c9a24a]' : 'text-[#4a4855]'}`}
                                >
                                    {slot}
                                </span>
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
                            className="pointer-events-none absolute top-1.5 right-1.5 z-[61] flex size-5 items-center justify-center rounded-full bg-[var(--pl-panel)] text-[#ff8a80] opacity-0 shadow-[inset_0_0_0_2px_#e0584f,0_1px_4px_rgba(0,0,0,0.6)] transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-[#e0584f] hover:text-white"
                        >
                            <svg
                                aria-hidden
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                className="size-2.5"
                            >
                                <path d="M4 4 L12 12 M12 4 L4 12" />
                            </svg>
                        </button>
                    )}

                    {overlay}
                </div>
            </div>
        </TooltipSideContext.Provider>
    );
}

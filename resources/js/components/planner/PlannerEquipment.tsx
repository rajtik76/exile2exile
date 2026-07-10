import { Fragment, useState } from 'react';
import {
    dismissPinnedTooltip,
    ItemCard,
    SlotTile,
    SocketCluster,
    SocketIcon,
} from '@/components/build/ItemDisplay';
import type { Item, Rune } from '@/components/build/ItemDisplay';
import { Filigree } from '@/components/build/Panel';
import { CursorTooltip, rarityTone } from '@/components/build/tooltip';
import AddButton from '@/components/planner/AddButton';
import Button from '@/components/planner/Button';
import ModPicker from '@/components/planner/ModPicker';
import { useMods } from '@/components/planner/ModsContext';
import ReferencePicker from '@/components/planner/ReferencePicker';
import { useReferences } from '@/components/planner/ReferencesContext';
import ScaleToFit from '@/components/planner/ScaleToFit';
import { Modal } from '@/components/planner/ui/Overlay';
import { Divider } from '@/components/planner/ui/Text';
import { deriveRarity } from '@/lib/itemRarity';
import { itemErrors } from '@/lib/itemRules';
import {
    aggregateModLines,
    defaultModValues,
    modDisplayLines,
    renderModDetail,
    renderModLines,
} from '@/lib/modLines';
import type { ModInfo, ModMap } from '@/lib/modLines';
import { refKey } from '@/lib/planReferences';
import type { PlanReference, ReferenceMap } from '@/lib/planReferences';
import { priorityOptions } from '@/lib/priority';
import {
    EQUIPMENT_SLOTS,
    MAX_ITEM_QUALITY,
    MODS_PER_RARITY,
    RARITY_COLOR,
    SLOT_MAX_SOCKETS,
} from '@/types/planner';
import type {
    ItemPlan,
    ItemProps,
    ItemRarity,
    ItemReq,
    ItemStat,
    RuneRef,
} from '@/types/planner';

type SlotDef = (typeof EQUIPMENT_SLOTS)[number];

/** A blank item for a freshly opened slot. */
function emptyItem(): ItemPlan {
    return {
        rarity: 'normal',
        base: null,
        req: { level: 0 },
        props: {
            quality: 0,
            armour: 0,
            evasion: 0,
            energyShield: 0,
            block: 0,
        },
        stats: [],
        sockets: [],
        priority: null,
    };
}

/** Whether an item carries anything worth keeping (requirements alone don't count). */
function isEmptyItem(item: ItemPlan): boolean {
    return (
        item.base === null &&
        item.stats.length === 0 &&
        item.sockets.every((socket) => socket === null)
    );
}

/** Modifier text colour, matching the blue item mods on tools like mobalytics. */
const MOD_COLOR = '#8aa0c8';

/**
 * The items paper-doll: a grid of equipment slots the author
 * fills. Each slot holds a full PoB-style item - a rarity, a GGPK base/unique (its
 * icon + implicits), attribute requirements, real GGPK affixes rolled to a value, and
 * rune sockets - edited in a modal. Only the base/unique ref, rune refs and mod ids are
 * stored; icons, wording and ranges all resolve live.
 */
export default function PlannerEquipment({
    slots,
    editable,
    onChange,
}: {
    slots: Record<string, ItemPlan>;
    editable: boolean;
    onChange?: (slots: Record<string, ItemPlan>) => void;
}) {
    const { map } = useReferences();
    const { map: modMap } = useMods();
    const [openSlot, setOpenSlot] = useState<string | null>(null);
    // The slot whose priority-strip miniature is hovered - its paper-doll tile lights up.
    const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

    function setItem(slotKey: string, item: ItemPlan): void {
        onChange?.({ ...slots, [slotKey]: item });
    }

    function clearSlot(slotKey: string): void {
        const next = { ...slots };
        delete next[slotKey];
        onChange?.(next);
        setOpenSlot(null);
    }

    // A two-handed main weapon claims the off-hand: it can't be edited, and shows a
    // dimmed ghost of the weapon when empty (as the game does).
    const mainWeapon = slots.weapon1;
    const mainWeaponRef = mainWeapon?.base
        ? map[refKey(mainWeapon.base.type, mainWeapon.base.id)]
        : undefined;
    const offhandBlocked = mainWeaponRef?.twoHanded ?? false;

    /** One paper-doll cell: its item, editor and priority controls. */
    function renderSlot(slot: SlotDef): React.ReactNode {
        const item = slots[slot.key];
        const blocked = slot.key === 'weapon2' && offhandBlocked;
        const ghostItem =
            blocked && mainWeapon && (!item || isEmptyItem(item))
                ? toDisplayItem(slot, mainWeapon, map, modMap)
                : null;

        return (
            <div
                key={slot.key}
                // Charms sit inside the shared flex wrapper below; every other slot
                // is placed directly on the grid.
                style={
                    slot.trinket
                        ? undefined
                        : { gridColumn: slot.column, gridRow: slot.row }
                }
                className="relative"
            >
                <SlotTile
                    slot={slot.label}
                    item={
                        item && !blocked
                            ? toDisplayItem(slot, item, map, modMap)
                            : null
                    }
                    ghostItem={ghostItem}
                    flask={slot.flask}
                    trinket={slot.trinket}
                    trinketSize="3.5rem"
                    align={slot.align}
                    highlighted={hoveredSlot === slot.key}
                    overlay={
                        item && !isEmptyItem(item) && !blocked ? (
                            <PrioritySelector
                                editable={editable}
                                rarity={item.rarity}
                                priority={item.priority}
                                slots={slots}
                                slotKey={slot.key}
                                onSet={(priority) =>
                                    setItem(slot.key, { ...item, priority })
                                }
                            />
                        ) : undefined
                    }
                    onEdit={
                        editable && !blocked
                            ? () => {
                                  // Drop the hover/focus tooltip so it never shows
                                  // above the open modal.
                                  dismissPinnedTooltip();
                                  setOpenSlot((open) =>
                                      open === slot.key ? null : slot.key,
                                  );
                              }
                            : undefined
                    }
                    onClear={
                        editable && item && !blocked
                            ? () => clearSlot(slot.key)
                            : undefined
                    }
                />

                {editable && !blocked && openSlot === slot.key && (
                    <SlotEditor
                        slot={slot}
                        item={item ?? emptyItem()}
                        onChange={(next) => setItem(slot.key, next)}
                        onClear={() => clearSlot(slot.key)}
                        onClose={() => {
                            if (item && isEmptyItem(item)) {
                                clearSlot(slot.key);
                            }

                            setOpenSlot(null);
                        }}
                    />
                )}
            </div>
        );
    }

    // Only slots with a priority set, in that order, for the strip under the doll -
    // an item with no priority has no place in it. A two-hander's blocked off-hand is
    // excluded.
    const orderedItems = EQUIPMENT_SLOTS.map((slot) => ({
        slot,
        item: slots[slot.key],
    }))
        .filter(
            (entry): entry is { slot: SlotDef; item: ItemPlan } =>
                !!entry.item &&
                !!entry.item.base &&
                entry.item.priority !== null &&
                !isEmptyItem(entry.item) &&
                !(entry.slot.key === 'weapon2' && offhandBlocked),
        )
        .sort((a, b) => (a.item.priority ?? 0) - (b.item.priority ?? 0));

    return (
        <div className="flex flex-col items-center gap-4">
            {/* The doll is a rigid 10-column grid, wider than a phone - scale it down to
                fit rather than overflow. Its geometry is untouched. z-10 lifts the whole
                doll (ScaleToFit's transform traps the tooltip's own z-index in a stacking
                context) above the later priority strip, so a hovered item's tooltip is
                never painted under the strip's miniatures. */}
            <ScaleToFit className="z-10">
                <div
                    className="grid w-fit gap-1.5"
                    style={{
                        gridTemplateColumns: 'repeat(10, 3.5rem)',
                        gridAutoRows: '3.5rem',
                    }}
                >
                    {EQUIPMENT_SLOTS.filter((slot) => !slot.trinket).map(
                        renderSlot,
                    )}

                    {/* Charms: three squares centred on the bottom row, between the flasks. */}
                    <div
                        className="flex items-center justify-center gap-1.5"
                        style={{
                            gridColumn: '4 / span 4',
                            gridRow: '7 / span 2',
                        }}
                    >
                        {EQUIPMENT_SLOTS.filter((slot) => slot.trinket).map(
                            renderSlot,
                        )}
                    </div>
                </div>
            </ScaleToFit>

            {orderedItems.length > 0 && (
                <PriorityStrip
                    items={orderedItems}
                    map={map}
                    modMap={modMap}
                    onHover={setHoveredSlot}
                />
            )}
        </div>
    );
}

/**
 * A strip under the paper-doll listing every filled item in gearing-priority order:
 * a miniature rarity-framed icon with its priority number, so the "get this first"
 * order reads at a glance without hovering each slot.
 */
function PriorityStrip({
    items,
    map,
    modMap,
    onHover,
}: {
    items: Array<{ slot: SlotDef; item: ItemPlan }>;
    map: ReferenceMap;
    modMap: ModMap;
    /** Report which slot is hovered so its paper-doll tile can highlight (null = none). */
    onHover: (slotKey: string | null) => void;
}) {
    // The hovered miniature and the cursor, driving a portalled tooltip that can't be
    // clipped by the panel's overflow (unlike the tile's in-flow hover tooltip).
    const [active, setActive] = useState<{
        slotKey: string;
        x: number;
        y: number;
    } | null>(null);

    const activeEntry = active
        ? items.find((entry) => entry.slot.key === active.slotKey)
        : undefined;

    return (
        <div
            className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[var(--pl-radius-lg)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] px-3 py-2"
            style={{ boxShadow: 'var(--pl-shadow)' }}
        >
            <span className="pl-text-2xs mr-1 tracking-[var(--pl-label-tracking)] text-[var(--pl-faint)] uppercase">
                Priority
            </span>
            {items.map(({ slot, item }) => {
                const reference = item.base
                    ? map[refKey(item.base.type, item.base.id)]
                    : undefined;
                const tone = rarityTone(item.rarity);
                const label = reference?.name ?? item.base?.id ?? slot.label;

                return (
                    <div
                        key={slot.key}
                        onMouseEnter={() => onHover(slot.key)}
                        onMouseMove={(event) =>
                            setActive({
                                slotKey: slot.key,
                                x: event.clientX,
                                y: event.clientY,
                            })
                        }
                        onMouseLeave={() => {
                            onHover(null);
                            setActive(null);
                        }}
                        className="relative flex size-9 shrink-0 items-center justify-center rounded-[2px] border bg-[#08080b]"
                        style={{
                            borderColor: tone.edge,
                            boxShadow: `0 0 6px ${tone.glow}`,
                        }}
                    >
                        {reference?.icon ? (
                            <img
                                src={reference.icon}
                                alt={label}
                                loading="lazy"
                                className="max-h-[82%] max-w-[82%] object-contain"
                            />
                        ) : (
                            <span
                                className="line-clamp-2 px-0.5 text-center text-[7px] leading-tight font-medium"
                                style={{ color: tone.text }}
                            >
                                {label}
                            </span>
                        )}

                        {item.priority !== null && (
                            <span
                                className="pl-text-2xs absolute right-0 bottom-0 flex size-4 items-center justify-center rounded-tl-[3px] rounded-br-[1px] border font-semibold tabular-nums"
                                style={{
                                    borderColor: tone.edge,
                                    backgroundColor: '#0b0a08',
                                    color: tone.text,
                                }}
                            >
                                {item.priority}
                            </span>
                        )}
                    </div>
                );
            })}

            {/* Portalled cursor tooltip - same card as the paper-doll, never clipped. */}
            {active && activeEntry && (
                <CursorTooltip x={active.x} y={active.y}>
                    <ItemCard
                        item={toDisplayItem(
                            activeEntry.slot,
                            activeEntry.item,
                            map,
                            modMap,
                        )}
                    />
                </CursorTooltip>
            )}
        </div>
    );
}

/**
 * The item's filled rune sockets as display runes. Every filled socket renders (its
 * glyph comes from the name/id, so it shows even before the reference resolves); a
 * resolved reference just adds the icon and effects for the tooltip.
 */
function resolveRunes(sockets: (RuneRef | null)[], map: ReferenceMap): Rune[] {
    return sockets
        .filter((socket): socket is RuneRef => socket !== null)
        .map((socket) => {
            const reference: PlanReference | undefined =
                map[refKey('rune', socket.id)];

            return {
                name: reference?.name ?? socket.id,
                icon: reference?.icon ?? null,
                levelRequirement: null,
                effects: reference?.tooltip
                    ? reference.tooltip
                          .split('\n')
                          .filter((line) => line.trim() !== '')
                    : [],
            };
        });
}

/** Adapt a planner item (plus live-resolved refs/mods) to the shared display Item shape. */
function toDisplayItem(
    slot: SlotDef,
    item: ItemPlan,
    map: ReferenceMap,
    modMap: ModMap,
): Item {
    const baseRef = item.base
        ? map[refKey(item.base.type, item.base.id)]
        : undefined;

    // Author affixes paired with their resolved mod (unresolved ids drop out).
    const resolvedStats = item.stats.flatMap((stat) => {
        const mod = modMap[stat.modId];

        return mod ? [{ mod, values: stat.values }] : [];
    });

    return {
        slot: slot.key,
        rarity: item.rarity,
        name: baseRef?.name ?? slot.label,
        baseType: baseRef?.name ?? slot.label,
        icon: baseRef?.icon ?? null,
        twoHanded: baseRef?.twoHanded ?? false,
        itemClass: baseRef?.category ?? null,
        itemLevel: item.req.level || null,
        levelRequirement: null,
        // The item's authored defensive/quality properties (0 = hidden in the tooltip).
        quality: item.props.quality || null,
        armour: item.props.armour || null,
        evasion: item.props.evasion || null,
        energyShield: item.props.energyShield || null,
        block: item.props.block || null,
        runes: resolveRunes(item.sockets, map),
        emptySockets: item.sockets.filter((socket) => socket === null).length,
        // A base's own fixed implicit lines (read-only), from the resolved base ref.
        implicitMods: baseRef?.implicits ?? [],
        // Unique flavour/lore, shown italic at the foot of the tooltip.
        flavour: baseRef?.flavour ?? null,
        // Same-stat affixes are summed into one line, as the game shows them by default.
        explicitMods: aggregateModLines(
            resolvedStats.flatMap(({ mod, values }) =>
                renderModLines(mod, values),
            ),
        ),
        // The per-affix breakdown for the Alt-held detailed view.
        modDetails: resolvedStats.map(({ mod, values }) => ({
            type: mod.type,
            tier: mod.tier,
            lines: renderModDetail(mod, values),
        })),
    };
}

/** The item's defensive/quality property fields. Block is shields-only (see isShield). */
const PROP_FIELDS: Array<{
    key: keyof ItemProps;
    label: string;
    shieldOnly?: boolean;
}> = [
    { key: 'quality', label: 'Quality' },
    { key: 'armour', label: 'Armour' },
    { key: 'evasion', label: 'Evasion' },
    { key: 'energyShield', label: 'Energy Shield' },
    { key: 'block', label: 'Block', shieldOnly: true },
];

const NUMBER_INPUT =
    'pl-text-sm w-full rounded-[var(--pl-radius)] border border-[var(--pl-input-border)] bg-[var(--pl-input-bg)] px-2 py-1 text-[var(--pl-text)] outline-none focus-visible:border-[var(--pl-focus)]';

const SECTION_LABEL =
    'pl-text-2xs mb-1.5 tracking-[var(--pl-label-tracking)] text-[var(--pl-faint)] uppercase';

/** A digit-only text field - no spinner, and an empty value shows blank, not a 0. */
function NumberField({
    value,
    onChange,
    className,
}: {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}) {
    return (
        <input
            type="text"
            inputMode="numeric"
            value={value === 0 ? '' : String(value)}
            placeholder="0"
            onChange={(event) => {
                // Digits only, no leading zeros - a lone 0 clears the field.
                const digits = event.target.value
                    .replace(/[^0-9]/g, '')
                    .replace(/^0+/, '');
                onChange(digits === '' ? 0 : Number(digits));
            }}
            className={className}
        />
    );
}

/** Prefix/suffix badge colours, shared by the picker and the mod rows. */
const MOD_TYPE_STYLE: Record<'prefix' | 'suffix', React.CSSProperties> = {
    prefix: { color: '#8fb3ff', backgroundColor: '#8fb3ff20' },
    suffix: { color: '#e0b070', backgroundColor: '#e0b07020' },
};

/** A small pill showing the item's derived rarity, tinted its own game colour. */
function RarityBadge({ rarity }: { rarity: ItemRarity }) {
    const color = RARITY_COLOR[rarity];
    const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);

    return (
        <span
            className="pl-text-xs rounded-[var(--pl-radius)] border px-2 py-0.5 font-semibold capitalize"
            style={{
                color,
                borderColor: `${color}66`,
                backgroundColor: `${color}1f`,
            }}
        >
            {label}
        </span>
    );
}

function SlotEditor({
    slot,
    item,
    onChange,
    onClear,
    onClose,
}: {
    slot: SlotDef;
    item: ItemPlan;
    onChange: (item: ItemPlan) => void;
    onClear: () => void;
    onClose: () => void;
}) {
    const { map, addReference } = useReferences();
    const { map: modMap, addMod } = useMods();
    const [pickerOpen, setPickerOpen] = useState(!item.base);
    const [modPickerOpen, setModPickerOpen] = useState(false);
    const [socketPicker, setSocketPicker] = useState<number | null>(null);

    const reference = item.base
        ? map[refKey(item.base.type, item.base.id)]
        : undefined;
    // Rarity is derived, never chosen (unique base → Unique; else the prefix/suffix
    // count decides). commit() keeps the stored item.rarity in sync on every change.
    const rarity = deriveRarity(item.base, item.stats, modMap);
    const rarityColor = RARITY_COLOR[rarity];
    const isUnique = item.base?.type === 'unique';
    const maxSockets = SLOT_MAX_SOCKETS[slot.key] ?? 0;
    const runes = resolveRunes(item.sockets, map);

    // Author modifiers apply to any non-unique base (a unique carries its own). Flasks
    // and charms have no rare tier, so they cap at Magic (1 prefix + 1 suffix); gear at
    // Rare (3 + 3).
    const showMods = !!item.base && !isUnique;
    const maxPerType =
        slot.flask || slot.trinket
            ? MODS_PER_RARITY.magic
            : MODS_PER_RARITY.rare;
    const modCounts = { prefix: 0, suffix: 0 };

    for (const stat of item.stats) {
        const mod = modMap[stat.modId];

        if (mod) {
            modCounts[mod.type] += 1;
        }
    }

    const implicits = reference?.implicits ?? [];
    // Block is a shield-only property (bucklers included); foci/quivers don't block.
    const isShield = /shield|buckler/i.test(reference?.category ?? '');
    const propFields = PROP_FIELDS.filter(
        (field) => !field.shieldOnly || isShield,
    );

    // The editor won't close on an illegal item - the author fixes it (or clears the
    // slot) first, so a broken item never reaches the form. The server re-validates
    // the whole request on submit.
    const errors = itemErrors(slot.key, item, modMap);

    function attemptClose(): void {
        if (errors.length === 0) {
            onClose();
        }
    }

    // Every mutation flows through commit so the stored rarity always matches the base
    // and mods, and mods stay grouped prefixes-first (suffixes below). `extra` folds in
    // a mod not yet in the shared map (a fresh pick).
    function commit(next: ItemPlan, extra?: ModMap): void {
        const lookup = extra ? { ...modMap, ...extra } : modMap;
        const rank = (stat: ItemStat): number => {
            const type = lookup[stat.modId]?.type;

            return type === 'prefix' ? 0 : type === 'suffix' ? 1 : 2;
        };
        // Array.sort is stable, so mods keep their order within each affix type.
        const stats = [...next.stats].sort((a, b) => rank(a) - rank(b));

        onChange({
            ...next,
            stats,
            rarity: deriveRarity(next.base, stats, lookup),
        });
    }

    function pickBase(picked: PlanReference): void {
        addReference(picked);
        const nextBase = {
            type: picked.type as 'base' | 'unique',
            id: picked.id,
        };

        // A unique carries its own modifiers, so any author mods are dropped on the pick.
        commit({
            ...item,
            base: nextBase,
            stats: picked.type === 'unique' ? [] : item.stats,
        });
        setPickerOpen(false);
    }

    function setReq(key: keyof ItemReq, value: number): void {
        commit({ ...item, req: { ...item.req, [key]: Math.max(0, value) } });
    }

    function setProp(key: keyof ItemProps, value: number): void {
        // Quality caps at 20; every property floors at 0.
        const clamped =
            key === 'quality'
                ? Math.min(MAX_ITEM_QUALITY, Math.max(0, value))
                : Math.max(0, value);
        commit({ ...item, props: { ...item.props, [key]: clamped } });
    }

    function addModifier(mod: ModInfo): void {
        addMod(mod);
        commit(
            {
                ...item,
                stats: [
                    ...item.stats,
                    { modId: mod.id, values: defaultModValues(mod) },
                ],
            },
            { [mod.id]: mod },
        );
        setModPickerOpen(false);
    }

    function replaceModifier(index: number, mod: ModInfo): void {
        addMod(mod);
        commit(
            {
                ...item,
                stats: item.stats.map((stat, position) =>
                    position === index
                        ? { modId: mod.id, values: defaultModValues(mod) }
                        : stat,
                ),
            },
            { [mod.id]: mod },
        );
    }

    // Affix groups already on the item - a group can hold only one mod, so the picker
    // hides any group already present (skipping `exceptIndex`, the row being changed).
    function groupsInUse(exceptIndex?: number): string[] {
        return item.stats
            .filter((_, position) => position !== exceptIndex)
            .map((stat) => modMap[stat.modId]?.group)
            .filter((group): group is string => !!group);
    }

    // Generation types already at their cap (e.g. 3 prefixes) - the picker hides them so
    // an over-cap mod can't be added. `exceptIndex` is the row being changed, whose own
    // type is freed for the swap.
    function fullTypesInUse(exceptIndex?: number): Array<'prefix' | 'suffix'> {
        const counts = { prefix: 0, suffix: 0 };

        item.stats.forEach((stat, position) => {
            if (position === exceptIndex) {
                return;
            }

            const mod = modMap[stat.modId];

            if (mod) {
                counts[mod.type] += 1;
            }
        });

        return (['prefix', 'suffix'] as const).filter(
            (kind) => counts[kind] >= maxPerType,
        );
    }

    function setSocket(index: number, rune: RuneRef | null): void {
        commit({
            ...item,
            sockets: item.sockets.map((socket, position) =>
                position === index ? rune : socket,
            ),
        });
    }

    return (
        <Modal onClose={attemptClose}>
            <div>
                <div
                    className="flex items-center gap-3 border-b px-4 py-3"
                    style={{
                        borderColor: 'var(--pl-header-border)',
                        background: 'var(--pl-header-bg)',
                    }}
                >
                    <h3
                        className="pl-text-lg"
                        style={{
                            color: 'var(--pl-heading)',
                            fontFamily: 'var(--pl-font-head)',
                            fontWeight: 'var(--pl-heading-weight)',
                        }}
                    >
                        {slot.label}
                    </h3>
                    <Button
                        icon
                        variant="ghost"
                        onClick={attemptClose}
                        title="Close"
                        className="ml-auto"
                    >
                        ✕
                    </Button>
                </div>

                <div className="flex gap-4 p-4">
                    {/* Left: base picker above the item's art, which fills the column. */}
                    <div className="flex w-44 shrink-0 flex-col gap-2">
                        <div className="relative">
                            {item.base && !pickerOpen ? (
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className="pl-text-sm min-w-0 flex-1 truncate"
                                        style={{ color: rarityColor }}
                                    >
                                        {reference?.name ?? item.base.id}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setPickerOpen(true)}
                                    >
                                        Change
                                    </Button>
                                </div>
                            ) : (
                                <ReferencePicker
                                    // "item" searches both craftable bases and uniques of
                                    // the slot's categories in one list (picking a unique
                                    // makes the item Unique; a base leaves rarity to derive
                                    // from the mods you add). Categories keep a life-flask
                                    // slot from ever listing a wand.
                                    lockType="item"
                                    categories={slot.categories}
                                    placeholder={`Find a ${slot.label.toLowerCase()} (base or unique)…`}
                                    onPick={pickBase}
                                    onClose={() =>
                                        item.base && setPickerOpen(false)
                                    }
                                />
                            )}
                        </div>

                        <div
                            className="relative flex flex-1 items-center justify-center rounded-[var(--pl-radius-lg)] border-2 bg-[var(--pl-input-bg)] p-2"
                            style={{
                                borderColor: `${rarityColor}aa`,
                                minHeight: '12rem',
                            }}
                        >
                            {reference?.icon ? (
                                <img
                                    src={reference.icon}
                                    alt=""
                                    className="max-h-full max-w-full object-contain"
                                />
                            ) : (
                                <span className="size-10 opacity-30">
                                    <Filigree />
                                </span>
                            )}

                            {item.sockets.length > 0 && (
                                <SocketCluster
                                    runes={runes}
                                    emptySockets={
                                        item.sockets.filter(
                                            (socket) => socket === null,
                                        ).length
                                    }
                                    onRuneActiveChange={() => {}}
                                    padClassName="p-[10%]"
                                />
                            )}
                        </div>
                    </div>

                    {/* Right: item-tooltip-style layout - requirements, implicits, mods, runes. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div>
                            <p className={SECTION_LABEL}>Item level</p>
                            <label className="flex items-center gap-2">
                                <span className="pl-text-sm w-12 text-[var(--pl-muted)]">
                                    Level
                                </span>
                                <NumberField
                                    value={item.req.level}
                                    onChange={(value) => setReq('level', value)}
                                    className={`${NUMBER_INPUT} max-w-24`}
                                />
                                {/* Rarity is derived from the base + mods, shown here. */}
                                <span className="ml-auto">
                                    <RarityBadge rarity={rarity} />
                                </span>
                            </label>
                        </div>

                        <Divider />

                        <div>
                            <p className={SECTION_LABEL}>Properties</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {propFields.map((field) => (
                                    <label
                                        key={field.key}
                                        className="flex min-w-0 items-center gap-1.5"
                                    >
                                        <span className="pl-text-xs shrink-0 basis-24 text-[var(--pl-muted)]">
                                            {field.label}
                                        </span>
                                        <NumberField
                                            value={item.props[field.key]}
                                            onChange={(value) =>
                                                setProp(field.key, value)
                                            }
                                            className={`${NUMBER_INPUT} min-w-0`}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        {implicits.length > 0 && (
                            <>
                                <Divider />
                                <div>
                                    <p className={SECTION_LABEL}>Implicit</p>
                                    <div className="flex flex-col gap-0.5">
                                        {implicits.map((line, index) => (
                                            <p
                                                key={index}
                                                className="pl-text-sm text-[#7f8aa3]"
                                            >
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {showMods && (
                            <>
                                <Divider />
                                <div>
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <p className="pl-text-2xs tracking-[var(--pl-label-tracking)] text-[var(--pl-faint)] uppercase">
                                            Modifiers
                                        </p>
                                        <span className="pl-text-2xs text-[var(--pl-faint)]">
                                            {modCounts.prefix}/{maxPerType}{' '}
                                            prefix · {modCounts.suffix}/
                                            {maxPerType} suffix
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        {item.stats.map((stat, index) => {
                                            // A rule splits the prefix block from the
                                            // suffix block (stats are sorted that way).
                                            const dividesHere =
                                                modMap[stat.modId]?.type ===
                                                    'suffix' &&
                                                modMap[
                                                    item.stats[index - 1]?.modId
                                                ]?.type === 'prefix';

                                            return (
                                                <Fragment key={index}>
                                                    {dividesHere && (
                                                        <div className="my-0.5 flex items-center gap-2">
                                                            <span
                                                                className="h-px flex-1"
                                                                style={{
                                                                    background:
                                                                        MOD_TYPE_STYLE
                                                                            .suffix
                                                                            .color,
                                                                    opacity: 0.55,
                                                                }}
                                                            />
                                                            <span
                                                                className="pl-text-2xs tracking-[var(--pl-label-tracking)] uppercase"
                                                                style={{
                                                                    color: MOD_TYPE_STYLE
                                                                        .suffix
                                                                        .color,
                                                                }}
                                                            >
                                                                Suffixes
                                                            </span>
                                                            <span
                                                                className="h-px flex-1"
                                                                style={{
                                                                    background:
                                                                        MOD_TYPE_STYLE
                                                                            .suffix
                                                                            .color,
                                                                    opacity: 0.55,
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    <ModRow
                                                        stat={stat}
                                                        mod={modMap[stat.modId]}
                                                        base={
                                                            item.base?.type ===
                                                            'base'
                                                                ? item.base.id
                                                                : null
                                                        }
                                                        categories={
                                                            slot.categories
                                                        }
                                                        excludeGroups={groupsInUse(
                                                            index,
                                                        )}
                                                        fullTypes={fullTypesInUse(
                                                            index,
                                                        )}
                                                        onReplace={(picked) =>
                                                            replaceModifier(
                                                                index,
                                                                picked,
                                                            )
                                                        }
                                                        onChange={(next) =>
                                                            commit({
                                                                ...item,
                                                                stats: item.stats.map(
                                                                    (
                                                                        current,
                                                                        position,
                                                                    ) =>
                                                                        position ===
                                                                        index
                                                                            ? next
                                                                            : current,
                                                                ),
                                                            })
                                                        }
                                                        onRemove={() =>
                                                            commit({
                                                                ...item,
                                                                stats: item.stats.filter(
                                                                    (
                                                                        _,
                                                                        position,
                                                                    ) =>
                                                                        position !==
                                                                        index,
                                                                ),
                                                            })
                                                        }
                                                    />
                                                </Fragment>
                                            );
                                        })}

                                        {/* Both prefix and suffix at their cap - nothing
                                            left to add, so hide the button entirely. */}
                                        {fullTypesInUse().length < 2 && (
                                            <div className="relative">
                                                <AddButton
                                                    leadingPlus
                                                    onClick={() =>
                                                        setModPickerOpen(
                                                            (open) => !open,
                                                        )
                                                    }
                                                >
                                                    Add modifier
                                                </AddButton>
                                                {modPickerOpen && (
                                                    <ModPicker
                                                        base={
                                                            item.base?.type ===
                                                            'base'
                                                                ? item.base.id
                                                                : null
                                                        }
                                                        categories={
                                                            slot.categories
                                                        }
                                                        excludeGroups={groupsInUse()}
                                                        fullTypes={fullTypesInUse()}
                                                        onPick={addModifier}
                                                        onClose={() =>
                                                            setModPickerOpen(
                                                                false,
                                                            )
                                                        }
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {maxSockets > 0 && (
                            <>
                                <Divider />
                                <div>
                                    <p className={SECTION_LABEL}>
                                        Rune sockets
                                    </p>
                                    <div className="flex flex-col gap-1.5">
                                        {item.sockets.map((socket, index) => (
                                            <Socket
                                                key={index}
                                                rune={socket}
                                                pickerOpen={
                                                    socketPicker === index
                                                }
                                                onOpen={() =>
                                                    setSocketPicker((open) =>
                                                        open === index
                                                            ? null
                                                            : index,
                                                    )
                                                }
                                                onPick={(rune) => {
                                                    setSocket(index, rune);
                                                    setSocketPicker(null);
                                                }}
                                                onClosePicker={() =>
                                                    setSocketPicker(null)
                                                }
                                                onRemove={() =>
                                                    commit({
                                                        ...item,
                                                        sockets:
                                                            item.sockets.filter(
                                                                (_, position) =>
                                                                    position !==
                                                                    index,
                                                            ),
                                                    })
                                                }
                                            />
                                        ))}

                                        {item.sockets.length < maxSockets && (
                                            <AddButton
                                                leadingPlus
                                                className="self-start"
                                                onClick={() =>
                                                    commit({
                                                        ...item,
                                                        sockets: [
                                                            ...item.sockets,
                                                            null,
                                                        ],
                                                    })
                                                }
                                            >
                                                Socket
                                            </AddButton>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {errors.length > 0 && (
                    <ul
                        role="alert"
                        className="pl-text-xs border-t border-[var(--pl-danger)] bg-[var(--pl-danger-soft)] px-4 py-2 text-[var(--pl-danger-lit)]"
                    >
                        {errors.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                )}

                <div
                    className="flex items-center justify-between border-t px-4 py-3"
                    style={{ borderColor: 'var(--pl-header-border)' }}
                >
                    <Button variant="danger" size="sm" onClick={onClear}>
                        Clear slot
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={attemptClose}
                        disabled={errors.length > 0}
                    >
                        Done
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

function Socket({
    rune,
    pickerOpen,
    onOpen,
    onPick,
    onClosePicker,
    onRemove,
}: {
    rune: RuneRef | null;
    pickerOpen: boolean;
    onOpen: () => void;
    onPick: (rune: RuneRef) => void;
    onClosePicker: () => void;
    onRemove: () => void;
}) {
    const { map, addReference } = useReferences();
    const reference = rune ? map[refKey('rune', rune.id)] : undefined;

    // One socket per row: its rune's icon + name (so the choice is visible without
    // hovering the item), a button to pick/change it, and a remove. The picker opens
    // right beside the row.
    return (
        <div className="relative">
            <div className="flex items-center gap-2 rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] p-1.5">
                {/* The rune's own art (soul-core icon); an empty ring for a blank socket. */}
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--pl-radius)] bg-[var(--pl-input-bg)]">
                    {reference?.icon ? (
                        <img
                            src={reference.icon}
                            alt=""
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                        />
                    ) : (
                        <SocketIcon name={null} />
                    )}
                </span>

                <span className="pl-text-sm min-w-0 flex-1 truncate">
                    {reference?.name ?? (
                        <span className="text-[var(--pl-muted)]">
                            Empty socket
                        </span>
                    )}
                </span>

                <Button variant="ghost" size="sm" onClick={onOpen}>
                    {rune ? 'Change' : 'Pick rune'}
                </Button>
                <Button
                    icon
                    variant="danger"
                    title="Remove socket"
                    onClick={onRemove}
                >
                    ✕
                </Button>
            </div>

            {pickerOpen && (
                <ReferencePicker
                    lockType="rune"
                    placeholder="Find a rune…"
                    onPick={(picked) => {
                        addReference(picked);
                        onPick({ type: 'rune', id: picked.id });
                    }}
                    onClose={onClosePicker}
                />
            )}
        </div>
    );
}

/** A bounded digit input for one rolled mod value, clamped to its tier's range. */
function ModValueInput({
    value,
    min,
    max,
    onChange,
}: {
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}) {
    return (
        <input
            type="text"
            inputMode="numeric"
            value={String(value)}
            title={`${min}-${max}`}
            onChange={(event) => {
                const raw = event.target.value.replace(/[^0-9-]/g, '');
                const parsed = raw === '' || raw === '-' ? min : Number(raw);
                const clamped = Math.max(
                    min,
                    Math.min(max, Number.isNaN(parsed) ? min : parsed),
                );
                onChange(clamped);
            }}
            className="pl-text-sm w-12 rounded-[var(--pl-radius)] border border-[var(--pl-input-border)] bg-[var(--pl-input-bg)] px-1 py-0.5 text-center text-[#a9c0ec] outline-none focus-visible:border-[var(--pl-focus)]"
        />
    );
}

function ModRow({
    stat,
    mod,
    base,
    categories,
    excludeGroups,
    fullTypes,
    onChange,
    onReplace,
    onRemove,
}: {
    stat: ItemStat;
    mod: ModInfo | undefined;
    /** The picked base (for the change picker's roll filtering), or null. */
    base: string | null;
    categories: string[];
    /** Affix groups already on the item (this row excluded) - hidden in the picker. */
    excludeGroups: string[];
    /** Generation types at their cap (this row excluded) - hidden in the picker. */
    fullTypes: Array<'prefix' | 'suffix'>;
    onChange: (stat: ItemStat) => void;
    onReplace: (mod: ModInfo) => void;
    onRemove: () => void;
}) {
    const [changing, setChanging] = useState(false);

    function setValue(rollIndex: number, value: number): void {
        const values = [...stat.values];
        values[rollIndex] = value;
        onChange({ ...stat, values });
    }

    return (
        <div className="relative">
            <div className="flex items-start gap-2 rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel-2)] px-2 py-1.5">
                <span
                    className="pl-text-2xs mt-1 rounded-xs px-1 py-px font-semibold uppercase tabular-nums"
                    style={mod ? MOD_TYPE_STYLE[mod.type] : undefined}
                >
                    {mod
                        ? `${mod.type === 'prefix' ? 'P' : 'S'}${mod.tier ?? ''}`
                        : '?'}
                </span>

                <div className="min-w-0 flex-1">
                    {mod ? (
                        modDisplayLines(mod).map((tokens, lineIndex) => (
                            <div
                                key={lineIndex}
                                className="flex flex-wrap items-center gap-x-1 gap-y-1"
                            >
                                {tokens.map((token, tokenIndex) =>
                                    token.kind === 'text' ? (
                                        <span
                                            key={tokenIndex}
                                            className="pl-text-sm"
                                            style={{ color: MOD_COLOR }}
                                        >
                                            {token.text}
                                        </span>
                                    ) : (
                                        <ModValueInput
                                            key={tokenIndex}
                                            value={
                                                stat.values[token.rollIndex] ??
                                                token.min
                                            }
                                            min={token.min}
                                            max={token.max}
                                            onChange={(next) =>
                                                setValue(token.rollIndex, next)
                                            }
                                        />
                                    ),
                                )}
                            </div>
                        ))
                    ) : (
                        <span className="pl-text-xs text-[var(--pl-faint)]">
                            Resolving modifier…
                        </span>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChanging((open) => !open)}
                    >
                        Change
                    </Button>
                    <Button
                        icon
                        variant="danger"
                        title="Remove modifier"
                        onClick={onRemove}
                    >
                        ✕
                    </Button>
                </div>
            </div>

            {changing && (
                <ModPicker
                    base={base}
                    categories={categories}
                    excludeGroups={excludeGroups}
                    fullTypes={fullTypes}
                    initialGroup={mod?.group ?? undefined}
                    onPick={(picked) => {
                        onReplace(picked);
                        setChanging(false);
                    }}
                    onClose={() => setChanging(false)}
                />
            )}
        </div>
    );
}

/**
 * The priority control built into a filled item's bottom-right corner, styled as part of
 * the rarity frame: a square tinted the frame's own border colour showing the priority
 * number, or `#` when unset. Clicking opens a picker offering only the numbers no other
 * slot has taken (the rest greyed) - the editor's answer to the game's "which piece to
 * chase first" order. Read-only shows the number square (no `#` prompt, nothing to pick).
 */
function PrioritySelector({
    editable,
    rarity,
    priority,
    slots,
    slotKey,
    onSet,
}: {
    editable: boolean;
    rarity: ItemRarity;
    priority: number | null;
    slots: Record<string, ItemPlan>;
    slotKey: string;
    onSet: (priority: number | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const tone = rarityTone(rarity);

    // The corner square, flush with the frame and edged in the frame's border colour.
    // `data-priority` hides the item tooltip on hover via CSS `:has` (see ItemTooltip).
    const cornerStyle: React.CSSProperties = {
        borderColor: tone.edge,
        backgroundColor: 'var(--pl-panel)',
        color: tone.text,
    };
    const cornerClass =
        // Below the item tooltip (z-60) so a hover never shows the corner poking through.
        // Border weight matches the item frame (1px); only the bottom-right corner is
        // rounded, to sit flush inside the frame's own rounded-[2px] corner.
        'group/prio pl-text-xs absolute right-0 bottom-0 z-[50] flex size-5 items-center justify-center rounded-br-[2px] border font-semibold tabular-nums shadow-[0_0_4px_rgba(0,0,0,0.7)]';

    // The small hint shown while the pointer is over the square (the item card is hidden).
    const hint = (
        <span className="pl-text-sm pointer-events-none absolute right-0 bottom-full z-[65] mb-1.5 hidden rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel)] px-2.5 py-1 font-normal whitespace-nowrap text-[var(--pl-text-strong)] shadow-xl group-focus-within/prio:block group-hover/prio:block">
            {priority !== null ? `Priority #${priority}` : 'Set priority'}
        </span>
    );

    if (!editable) {
        return priority !== null ? (
            <span className={cornerClass} style={cornerStyle} data-priority>
                {priority}
                {hint}
            </span>
        ) : null;
    }

    function toggle(event: React.MouseEvent): void {
        event.stopPropagation();
        setOpen((current) => !current);
    }

    return (
        <>
            <button
                type="button"
                data-priority
                onClick={toggle}
                className={`${cornerClass} transition hover:brightness-125`}
                style={cornerStyle}
            >
                {priority !== null ? priority : '#'}
                {hint}
            </button>

            {open && (
                <PriorityMenu
                    options={priorityOptions(slots, slotKey)}
                    current={priority}
                    onPick={(value) => {
                        onSet(value);
                        setOpen(false);
                    }}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

/** The number grid a priority is picked from: taken numbers greyed, current highlighted. */
function PriorityMenu({
    options,
    current,
    onPick,
    onClose,
}: {
    options: Array<{ value: number; taken: boolean }>;
    current: number | null;
    onPick: (priority: number | null) => void;
    onClose: () => void;
}) {
    return (
        <>
            <div
                className="fixed inset-0 z-[75]"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
            />
            <div
                className="absolute top-full right-0 z-[80] mt-1 w-max rounded-[var(--pl-radius)] border border-[var(--pl-panel-border)] bg-[var(--pl-panel)] p-1.5 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <p className="pl-text-2xs mb-1 px-0.5 tracking-[var(--pl-label-tracking)] text-[var(--pl-faint)] uppercase">
                    Priority
                </p>
                <div className="grid grid-cols-5 gap-1">
                    {options.map(({ value, taken }) => {
                        const isCurrent = value === current;
                        const disabled = taken && !isCurrent;

                        return (
                            <button
                                key={value}
                                type="button"
                                disabled={disabled}
                                onClick={() => onPick(value)}
                                className={`pl-text-2xs flex size-6 items-center justify-center rounded-[var(--pl-radius)] tabular-nums transition ${
                                    isCurrent
                                        ? 'bg-[var(--pl-accent)] font-semibold text-[#15120b]'
                                        : disabled
                                          ? 'cursor-not-allowed text-[var(--pl-faint)] opacity-50'
                                          : 'text-[var(--pl-text)] hover:bg-[var(--pl-accent-soft)]'
                                }`}
                            >
                                {value}
                            </button>
                        );
                    })}
                </div>
                {current !== null && (
                    <button
                        type="button"
                        onClick={() => onPick(null)}
                        className="pl-text-2xs mt-1.5 w-full rounded-[var(--pl-radius)] px-1 py-1 text-center text-[var(--pl-muted)] transition hover:bg-white/5"
                    >
                        Clear priority
                    </button>
                )}
            </div>
        </>
    );
}

import { Fragment, useState } from 'react';
import { SocketCluster } from '@/components/build/ItemDisplay';
import AddButton from '@/components/planner/AddButton';
import Button from '@/components/planner/Button';
import { resolveRunes } from '@/components/planner/equipment/displayItem';
import type { SlotDef } from '@/components/planner/equipment/displayItem';
import {
    clampedProp,
    countModTypes,
    fullTypesInUse as computeFullTypes,
    groupsInUse as computeGroupsInUse,
    normalizeItem,
    visiblePropFields,
    withBasePicked,
    withUniqueModValues,
} from '@/components/planner/equipment/itemEdits';
import ModRow from '@/components/planner/equipment/ModRow';
import Socket from '@/components/planner/equipment/Socket';
import { MOD_TYPE_STYLE } from '@/components/planner/equipment/style';
import UniqueModRow from '@/components/planner/equipment/UniqueModRow';
import ModPicker from '@/components/planner/ModPicker';
import { useMods } from '@/components/planner/ModsContext';
import ReferencePicker from '@/components/planner/ReferencePicker';
import { useReferences } from '@/components/planner/ReferencesContext';
import { TextInput } from '@/components/planner/ui/Field';
import { Modal } from '@/components/planner/ui/Overlay';
import { Divider } from '@/components/planner/ui/Text';
import { deriveRarity } from '@/lib/itemRarity';
import { itemErrors } from '@/lib/itemRules';
import { defaultModValues } from '@/lib/modLines';
import type { ModInfo, ModMap } from '@/lib/modLines';
import { refKey } from '@/lib/planReferences';
import type { PlanReference } from '@/lib/planReferences';
import {
    MAX_ITEM_NAME_LENGTH,
    MAX_ITEM_SOCKETS,
    MODS_PER_RARITY,
    RARITY_COLOR,
    SLOT_MAX_SOCKETS,
} from '@/types/planner';
import type { ItemPlan, ItemProps, RuneRef } from '@/types/planner';

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

/** The game's own Corrupted red - matches the tooltip's footer line. */
const CORRUPTED_COLOR = '#d20000';

/** A toggle pill for the item's Corrupted flag, tinted the tooltip's own Corrupted
 * red so it reads the same way in both places. */
function CorruptedToggle({
    active,
    onToggle,
}: {
    active: boolean;
    onToggle: (active: boolean) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onToggle(!active)}
            aria-pressed={active}
            className="pl-text-xs rounded-[var(--pl-radius)] border px-2 py-0.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            style={
                active
                    ? {
                          color: CORRUPTED_COLOR,
                          borderColor: `${CORRUPTED_COLOR}66`,
                          backgroundColor: `${CORRUPTED_COLOR}1f`,
                      }
                    : {
                          color: 'var(--pl-muted)',
                          borderColor: 'var(--pl-input-border)',
                      }
            }
        >
            Corrupted
        </button>
    );
}

export default function SlotEditor({
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
    // Every unique-mod input currently holding a typed-but-uncommitted invalid value,
    // keyed by `${line.key}#${rollIndex}` - reported live by UniqueModRow. While any
    // exist, Done and every other mutating control (sockets, Corrupted, the base
    // picker's Change) lock; only Clear slot and closing (✕/Esc/backdrop) still work.
    const [invalidUniqueMods, setInvalidUniqueMods] = useState<Set<string>>(
        new Set(),
    );
    const hasInvalidInput = invalidUniqueMods.size > 0;

    function reportUniqueModValidity(id: string, invalid: boolean): void {
        setInvalidUniqueMods((current) => {
            const already = current.has(id);

            if (invalid === already) {
                return current;
            }

            const next = new Set(current);

            if (invalid) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });
    }

    // Captured once, at mount - whether this editor opened on an empty slot (a fresh
    // pick, not yet finished) or an already-configured item. Drives what closing while
    // an invalid value is pending does: clear the half-finished pick, or just leave.
    const [openedEmpty] = useState(item.base === null);

    const reference = item.base
        ? map[refKey(item.base.type, item.base.id)]
        : undefined;
    // Rarity is derived, never chosen (unique base → Unique; else the prefix/suffix
    // count decides). commit() keeps the stored item.rarity in sync on every change.
    const rarity = deriveRarity(item.base, item.stats, modMap);
    const rarityColor = RARITY_COLOR[rarity];
    const isUnique = item.base?.type === 'unique';
    // A unique can carry more sockets than its slot's rares (Greymake wears four on a
    // helmet), so uniques take the global ceiling instead of the slot's.
    const slotSockets = SLOT_MAX_SOCKETS[slot.key] ?? 0;
    const maxSockets =
        isUnique && slotSockets > 0 ? MAX_ITEM_SOCKETS : slotSockets;
    const runes = resolveRunes(item.sockets, map);

    // Author modifiers apply to any non-unique base (a unique carries its own). Flasks
    // and charms have no rare tier, so they cap at Magic (1 prefix + 1 suffix); gear at
    // Rare (3 + 3).
    const showMods = !!item.base && !isUnique;
    const maxPerType =
        slot.flask || slot.trinket
            ? MODS_PER_RARITY.magic
            : MODS_PER_RARITY.rare;
    const modCounts = countModTypes(item.stats, modMap);

    const implicits = reference?.implicits ?? [];
    // A unique's own mods/implicits, structured - rendered with editable value inputs
    // instead of the base's plain-text `implicits` above (which stays as read-only GGPK
    // data for a non-unique). See UniqueModRow.
    const uniqueImplicitLines = reference?.implicitLines ?? [];
    const uniqueExplicitLines = reference?.modLines ?? [];
    // The fields gated by the resolved base's own GGPK defensive stats (null when
    // unresolved, or for a unique with no synced base type yet - every defence field
    // then stays visible), with a shield-name heuristic as block's fallback.
    const propFields = visiblePropFields(reference);

    // Done stays disabled while the item is illegal (an already-committed error, e.g.
    // too many affixes) or a unique-mod field holds an uncommitted invalid value - the
    // author fixes it (or clears the slot) first, so a broken item never reaches the
    // form. The server re-validates the whole request on submit either way.
    const errors = itemErrors(slot.key, item, modMap, reference);
    const doneDisabled = errors.length > 0 || hasInvalidInput;

    // Unlike Done, closing (✕ / Esc / clicking the backdrop) always works - Cancel
    // should never be blocked by validation, that's what makes it Cancel. A pending
    // invalid unique-mod value was never committed to `item` in the first place (see
    // UniqueModRow), so there is nothing to roll back on the data side; the one thing
    // this does is decide what "closing" now that the pick is incomplete: a freshly
    // opened, still-empty slot didn't have anything worth keeping half-finished, so it
    // clears instead of leaving a unique with no rolled values sitting in the slot.
    function requestClose(): void {
        if (hasInvalidInput && openedEmpty) {
            onClear();

            return;
        }

        onClose();
    }

    // Every mutation flows through commit so the stored rarity always matches the base
    // and mods, and mods stay grouped prefixes-first (suffixes below). `extra` folds in
    // a mod not yet in the shared map (a fresh pick). See normalizeItem.
    function commit(next: ItemPlan, extra?: ModMap): void {
        const lookup = extra ? { ...modMap, ...extra } : modMap;

        onChange(normalizeItem(next, lookup));
    }

    function pickBase(picked: PlanReference): void {
        addReference(picked);
        commit(withBasePicked(item, picked));
        setPickerOpen(false);
    }

    function setName(value: string): void {
        commit({ ...item, name: value.slice(0, MAX_ITEM_NAME_LENGTH) });
    }

    function setCorrupted(value: boolean): void {
        commit({ ...item, corrupted: value });
    }

    function setProp(key: keyof ItemProps, value: number): void {
        commit({
            ...item,
            props: { ...item.props, [key]: clampedProp(key, value) },
        });
    }

    function setUniqueModValues(key: string, values: number[]): void {
        commit(withUniqueModValues(item, key, values));
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
        return computeGroupsInUse(item.stats, modMap, exceptIndex);
    }

    // Generation types already at their cap (e.g. 3 prefixes) - the picker hides them so
    // an over-cap mod can't be added. `exceptIndex` is the row being changed, whose own
    // type is freed for the swap.
    function fullTypesInUse(exceptIndex?: number): Array<'prefix' | 'suffix'> {
        return computeFullTypes(item.stats, modMap, maxPerType, exceptIndex);
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
        <Modal onClose={requestClose}>
            <div>
                <div
                    className="flex items-center gap-3 border-b px-4 py-3"
                    style={{
                        borderColor: 'var(--pl-header-border)',
                        background: 'var(--pl-header-bg)',
                    }}
                >
                    {/* Below sm the full art column (a fixed 11rem wide) has nowhere to
                        go next to the form - it's hidden there (see the row below), so
                        its only trace on mobile is this header thumbnail instead. */}
                    {reference?.icon && (
                        <img
                            src={reference.icon}
                            alt=""
                            className="size-9 shrink-0 rounded-[var(--pl-radius)] border-2 bg-[var(--pl-input-bg)] object-contain p-0.5 sm:hidden"
                            style={{ borderColor: `${rarityColor}aa` }}
                        />
                    )}
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
                        onClick={requestClose}
                        title="Close editor"
                        className="ml-auto"
                    >
                        ✕
                    </Button>
                </div>

                <div className="flex flex-col gap-4 p-4 sm:flex-row">
                    {/* Left: the item's art, which fills the column. Hidden below sm -
                        the fixed-width column has no room next to the form on a phone,
                        so a small thumbnail moves into the header above instead. */}
                    <div className="hidden w-44 shrink-0 flex-col gap-2 sm:flex">
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
                                <span className="flex flex-col items-center gap-2 px-3 text-center">
                                    <span
                                        aria-hidden
                                        className="text-6xl leading-none font-semibold text-[#3a3844]"
                                    >
                                        ?
                                    </span>
                                    <span className="pl-text-xs text-[#6b6878]">
                                        Choose an item - rarity is detected
                                        automatically
                                    </span>
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

                    {/* Right: item-tooltip-style layout - base picker, name, requirements,
                    implicits, mods, runes. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        {/* A native <fieldset disabled> locks every control it contains in
                        one place - no per-control `disabled` prop to remember to thread.
                        It stops at the unique-mods section below on purpose: those inputs
                        are exactly what the author needs to keep reaching to fix the value
                        that triggered the lock in the first place. `contents` keeps it out
                        of the flex layout entirely.

                        Note for tests: jsdom does not implement the fieldset-disables-
                        descendants cascade (only real browsers do), so this can't be
                        asserted through a descendant's own `.disabled` in a jsdom test -
                        assert `fieldset.disabled` itself instead. */}
                        <fieldset
                            disabled={hasInvalidInput}
                            className="contents"
                        >
                            <div className="relative">
                                {/* Like a mod row's own Change picker: the title row (once a
                            base is picked) stays put and toggles the picker above it,
                            instead of the picker replacing the row outright. */}
                                {(pickerOpen || !item.base) && (
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

                                {item.base && (
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
                                            onClick={() =>
                                                setPickerOpen((open) => !open)
                                            }
                                        >
                                            Change
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className={SECTION_LABEL}>Name</p>
                                <label className="flex items-center gap-2">
                                    <TextInput
                                        value={item.name}
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                        maxLength={MAX_ITEM_NAME_LENGTH}
                                        placeholder="Optional custom name…"
                                        className="flex-1"
                                    />
                                    <CorruptedToggle
                                        active={item.corrupted}
                                        onToggle={setCorrupted}
                                    />
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

                            {/* A base's own fixed implicit lines are read-only GGPK data - a
                            unique's implicits/mods below are its own, editable, synced
                            values instead (see UniqueModRow). */}
                            {!isUnique && implicits.length > 0 && (
                                <>
                                    <Divider />
                                    <div>
                                        <p className={SECTION_LABEL}>
                                            Implicit
                                        </p>
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
                        </fieldset>

                        {isUnique &&
                            (uniqueImplicitLines.length > 0 ||
                                uniqueExplicitLines.length > 0) && (
                                <>
                                    <Divider />
                                    <div>
                                        <p className={SECTION_LABEL}>
                                            Modifiers
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                            {uniqueImplicitLines.map((line) => (
                                                <UniqueModRow
                                                    key={line.key}
                                                    line={line}
                                                    values={
                                                        item.uniqueMods.find(
                                                            (stat) =>
                                                                stat.key ===
                                                                line.key,
                                                        )?.values ?? []
                                                    }
                                                    onChange={(values) =>
                                                        setUniqueModValues(
                                                            line.key,
                                                            values,
                                                        )
                                                    }
                                                    onValidityChange={
                                                        reportUniqueModValidity
                                                    }
                                                />
                                            ))}
                                            {uniqueExplicitLines.map((line) => (
                                                <UniqueModRow
                                                    key={line.key}
                                                    line={line}
                                                    values={
                                                        item.uniqueMods.find(
                                                            (stat) =>
                                                                stat.key ===
                                                                line.key,
                                                        )?.values ?? []
                                                    }
                                                    onChange={(values) =>
                                                        setUniqueModValues(
                                                            line.key,
                                                            values,
                                                        )
                                                    }
                                                    onValidityChange={
                                                        reportUniqueModValidity
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                        {/* Sockets/rare-mods live in a second fieldset - the unique-mods
                        section above them stays out of the lock, same reasoning as the
                        first fieldset. */}
                        <fieldset
                            disabled={hasInvalidInput}
                            className="contents"
                        >
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
                                                        item.stats[index - 1]
                                                            ?.modId
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
                                                            mod={
                                                                modMap[
                                                                    stat.modId
                                                                ]
                                                            }
                                                            base={
                                                                item.base
                                                                    ?.type ===
                                                                'base'
                                                                    ? item.base
                                                                          .id
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
                                                            onReplace={(
                                                                picked,
                                                            ) =>
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
                                                                item.base
                                                                    ?.type ===
                                                                'base'
                                                                    ? item.base
                                                                          .id
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
                                            {item.sockets.map(
                                                (socket, index) => (
                                                    <Socket
                                                        key={index}
                                                        rune={socket}
                                                        pickerOpen={
                                                            socketPicker ===
                                                            index
                                                        }
                                                        onOpen={() =>
                                                            setSocketPicker(
                                                                (open) =>
                                                                    open ===
                                                                    index
                                                                        ? null
                                                                        : index,
                                                            )
                                                        }
                                                        onPick={(rune) => {
                                                            setSocket(
                                                                index,
                                                                rune,
                                                            );
                                                            setSocketPicker(
                                                                null,
                                                            );
                                                        }}
                                                        onClosePicker={() =>
                                                            setSocketPicker(
                                                                null,
                                                            )
                                                        }
                                                        onRemove={() =>
                                                            commit({
                                                                ...item,
                                                                sockets:
                                                                    item.sockets.filter(
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
                                                ),
                                            )}

                                            {item.sockets.length <
                                                maxSockets && (
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
                        </fieldset>
                    </div>
                </div>

                {(errors.length > 0 || hasInvalidInput) && (
                    <ul
                        role="alert"
                        className="pl-text-xs border-t border-[var(--pl-danger)] bg-[var(--pl-danger-soft)] px-4 py-2 text-[var(--pl-danger-lit)]"
                    >
                        {hasInvalidInput && (
                            <li>
                                Fix the highlighted modifier value before
                                continuing.
                            </li>
                        )}
                        {errors.map((message, index) => (
                            <li key={index}>{message}</li>
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
                        onClick={onClose}
                        disabled={doneDisabled}
                    >
                        Done
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

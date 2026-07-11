import { Fragment, useState } from 'react';
import { SocketCluster } from '@/components/build/ItemDisplay';
import { Filigree } from '@/components/build/Panel';
import AddButton from '@/components/planner/AddButton';
import Button from '@/components/planner/Button';
import { resolveRunes } from '@/components/planner/equipment/displayItem';
import type { SlotDef } from '@/components/planner/equipment/displayItem';
import ModRow from '@/components/planner/equipment/ModRow';
import Socket from '@/components/planner/equipment/Socket';
import { MOD_TYPE_STYLE } from '@/components/planner/equipment/style';
import ModPicker from '@/components/planner/ModPicker';
import { useMods } from '@/components/planner/ModsContext';
import ReferencePicker from '@/components/planner/ReferencePicker';
import { useReferences } from '@/components/planner/ReferencesContext';
import { Modal } from '@/components/planner/ui/Overlay';
import { Divider } from '@/components/planner/ui/Text';
import { deriveRarity } from '@/lib/itemRarity';
import { itemErrors } from '@/lib/itemRules';
import { defaultModValues } from '@/lib/modLines';
import type { ModInfo, ModMap } from '@/lib/modLines';
import { refKey } from '@/lib/planReferences';
import type { PlanReference } from '@/lib/planReferences';
import {
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

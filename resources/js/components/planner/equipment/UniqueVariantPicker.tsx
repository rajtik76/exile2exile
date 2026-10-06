import { SelectInput } from '@/components/planner/ui/Field';
import {
    groupIds,
    groupOptions,
    hasIndependentVariants,
    normaliseVariantSelection,
    usesVersionedOrGroupedVariants,
} from '@/lib/uniqueVariants';
import type {
    NormalisedVariantSelection,
    UniqueVariantModel,
    UniqueVariantSelection,
} from '@/lib/uniqueVariants';

const SECTION_LABEL =
    'pl-text-xs mb-1 uppercase tracking-wide text-[var(--pl-muted)]';

function toSelection(
    normalised: NormalisedVariantSelection,
): UniqueVariantSelection {
    const selection: UniqueVariantSelection = {};

    if (normalised.variant !== null) {
        selection.variant = normalised.variant;
    }

    if (Object.keys(normalised.alts).length > 0) {
        selection.alts = normalised.alts;
    }

    if (normalised.version !== null) {
        selection.version = normalised.version;
    }

    if (Object.keys(normalised.groups).length > 0) {
        selection.groups = normalised.groups;
    }

    return selection;
}

function VariantSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: number | null;
    options: { id: number; name: string }[];
    onChange: (id: number) => void;
}) {
    return (
        <label className="flex min-w-0 flex-col">
            <span className={SECTION_LABEL}>{label}</span>
            <SelectInput
                value={value ?? ''}
                onChange={(event) => onChange(Number(event.target.value))}
            >
                {options.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.name}
                    </option>
                ))}
            </SelectInput>
        </label>
    );
}

/**
 * The variant picks of a unique with Path of Building variants - the same choices PoB
 * offers on such an item: its variant (plus any alt variants), its version, or one pick
 * per variant group. Which axes show follows the model (see `uniqueVariants.ts`); every
 * change is re-normalised, so a pick that clashes (a group taking a variant another group
 * holds) settles on PoB's own fallback.
 */
export default function UniqueVariantPicker({
    model,
    selection,
    onChange,
}: {
    model: UniqueVariantModel;
    selection: UniqueVariantSelection | [] | undefined;
    onChange: (selection: UniqueVariantSelection) => void;
}) {
    const current = normaliseVariantSelection(model, selection);
    const variantOptions = model.variants.map((name, index) => ({
        id: index + 1,
        name,
    }));

    function pick(next: NormalisedVariantSelection): void {
        onChange(
            toSelection(normaliseVariantSelection(model, toSelection(next))),
        );
    }

    const selects: React.ReactNode[] = [];

    if (model.versions.length > 0) {
        selects.push(
            <VariantSelect
                key="version"
                label="Version"
                value={current.version}
                options={model.versions.map((name, index) => ({
                    id: index + 1,
                    name,
                }))}
                onChange={(version) => pick({ ...current, version })}
            />,
        );
    }

    const showsMainVariant = usesVersionedOrGroupedVariants(model)
        ? hasIndependentVariants(model)
        : variantOptions.length > 0;

    if (showsMainVariant) {
        selects.push(
            <VariantSelect
                key="variant"
                label="Variant"
                value={current.variant}
                options={variantOptions}
                onChange={(variant) => pick({ ...current, variant })}
            />,
        );
    }

    if (!usesVersionedOrGroupedVariants(model)) {
        model.altSlots.forEach((slot, index) => {
            selects.push(
                <VariantSelect
                    key={`alt-${slot}`}
                    label={`Variant ${index + 2}`}
                    value={current.alts[slot] ?? null}
                    options={variantOptions}
                    onChange={(variant) =>
                        pick({
                            ...current,
                            alts: { ...current.alts, [slot]: variant },
                        })
                    }
                />,
            );
        });
    }

    groupIds(model).forEach((groupId, index) => {
        const options = groupOptions(model, groupId, current.version);

        if (options.length === 0) {
            return;
        }

        selects.push(
            <VariantSelect
                key={`group-${groupId}`}
                label={`Variant ${index + 1}`}
                value={current.groups[groupId] ?? null}
                options={options.map((id) => ({
                    id,
                    name: model.variants[id - 1] ?? String(id),
                }))}
                onChange={(variant) =>
                    pick({
                        ...current,
                        groups: { ...current.groups, [groupId]: variant },
                    })
                }
            />,
        );
    });

    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{selects}</div>
    );
}

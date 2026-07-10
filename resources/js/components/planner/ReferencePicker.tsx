import { useState } from 'react';
import { SpriteIcon } from '@/components/build/tooltip';
import { SegmentedControl } from '@/components/planner/Button';
import SearchPicker from '@/components/planner/SearchPicker';
import type { PlanReference } from '@/lib/planReferences';
import planner from '@/routes/planner';

type TypeFilter =
    'all' | 'gem' | 'rune' | 'unique' | 'notable' | 'base' | 'item';

/**
 * Searches the GGPK catalogue (gems, runes and unique/base items) and lets the author
 * pick one to insert as an inline reference. Built on the shared {@link SearchPicker},
 * so it matches the mod picker's look and arrow-key behaviour; it only adds the
 * reference fetch, an optional type filter and the row rendering.
 */
export default function ReferencePicker({
    onPick,
    onClose,
    lockType,
    categories,
    gemKind,
    excludeIds,
    anchorEl,
    placeholder = 'Search gems, runes, uniques & notables…',
}: {
    onPick: (reference: PlanReference) => void;
    onClose: () => void;
    /** Restrict the search to one type and hide the filter (e.g. equipment slots).
     * "item" searches both craftable bases and uniques of the slot categories. */
    lockType?: 'gem' | 'rune' | 'unique' | 'base' | 'item';
    /** Restrict item results to these base categories (e.g. a weapon slot). */
    categories?: string[];
    /** Restrict gem results to a group slot: "skill" (active/spirit) or "support". */
    gemKind?: 'skill' | 'support';
    /** Drop these reference ids from the results (e.g. gems already in the group). */
    excludeIds?: string[];
    /** Element to anchor the dropdown under (the trigger that opened it). */
    anchorEl?: HTMLElement | null;
    placeholder?: string;
}) {
    const [type, setType] = useState<TypeFilter>(lockType ?? 'all');
    // A locked picker always searches its lockType, even after the prop changes (e.g. a
    // slot toggled base↔unique) - the mutable `type` state only drives the unlocked filter,
    // so it must never override the lock (that leak let gems show in an equipment slot).
    const activeType: TypeFilter = lockType ?? type;

    async function search(query: string): Promise<PlanReference[]> {
        const trimmed = query.trim();

        if (trimmed === '') {
            return [];
        }

        const params: Record<string, string> = { q: trimmed };

        if (activeType !== 'all') {
            params.type = activeType;
        }

        if (categories && categories.length > 0) {
            params.categories = categories.join(',');
        }

        if (gemKind && activeType === 'gem') {
            params.gemKind = gemKind;
        }

        const response = await fetch(
            planner.references.url({ query: params }),
            {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            },
        );

        if (!response.ok) {
            return [];
        }

        const body: { results?: PlanReference[] } = await response.json();
        const results = body.results ?? [];

        return excludeIds && excludeIds.length > 0
            ? results.filter((reference) => !excludeIds.includes(reference.id))
            : results;
    }

    const header = lockType ? undefined : (
        <div className="mb-2">
            <SegmentedControl
                value={type}
                onChange={setType}
                options={[
                    { value: 'all', label: 'All' },
                    { value: 'gem', label: 'Gems' },
                    { value: 'rune', label: 'Runes' },
                    { value: 'unique', label: 'Uniques' },
                    { value: 'notable', label: 'Notables' },
                ]}
            />
        </div>
    );

    return (
        <SearchPicker<PlanReference>
            search={search}
            keyOf={(reference) => `${reference.type}:${reference.id}`}
            onSelect={onPick}
            onClose={onClose}
            anchorEl={anchorEl}
            placeholder={placeholder}
            header={header}
            // The unlocked picker shows a five-option type filter that's wider than the
            // default popover; widen it so the categories don't overflow the panel.
            width={lockType ? undefined : 440}
            // categories is a stable per-slot constant; join keeps the dep primitive.
            deps={[
                activeType,
                categories?.join(','),
                gemKind,
                excludeIds?.join(','),
            ]}
            renderOption={(reference) => (
                <>
                    {reference.icon ? (
                        <img
                            src={reference.icon}
                            alt=""
                            loading="lazy"
                            className="size-6 shrink-0 rounded-[2px] object-contain"
                        />
                    ) : reference.sprite ? (
                        <SpriteIcon
                            sprite={reference.sprite}
                            size="1.5rem"
                            className="shrink-0 rounded-[2px]"
                        />
                    ) : (
                        <span className="size-6 shrink-0 rounded-[2px] bg-[var(--pl-panel-2)]" />
                    )}
                    <span className="min-w-0 flex-1">
                        <span className="pl-text-sm block truncate text-[var(--pl-text-strong)]">
                            {reference.name}
                        </span>
                        {reference.category && (
                            <span className="pl-text-xs block truncate text-[var(--pl-muted)]">
                                {reference.category}
                            </span>
                        )}
                    </span>
                </>
            )}
        />
    );
}

import { useRef, useState } from 'react';
import Button from '@/components/planner/Button';
import SearchPicker from '@/components/planner/SearchPicker';
import type { ModInfo, ModRoll } from '@/lib/modLines';
import planner from '@/routes/planner';

/** One tier of an affix in a search result. */
interface ModTier {
    id: string;
    tier: number | null;
    level: number;
    stats: string[];
    rolls: ModRoll[];
    families: string[];
    /** Reaches the base only through desecration (the Well of Souls), never naturally. */
    desecrated: boolean;
    /** Reaches the base only through an essence, never naturally. */
    essence: boolean;
    /** Reaches the base only through the Kalguuran genesis tree, never naturally. */
    genesis: boolean;
    /** Reaches the base only through boss influence, never naturally. */
    influence: boolean;
}

/** An affix group: one wording, its prefix/suffix type and its tier ladder. */
interface ModGroup {
    group: string;
    type: 'prefix' | 'suffix';
    label: string;
    tiers: ModTier[];
}

/**
 * One navigable row: either an affix group (first step, expands to its tiers) or a
 * single tier of the expanded group (second step, the actual pick).
 */
type ModOption =
    | { kind: 'group'; group: ModGroup }
    | { kind: 'tier'; group: ModGroup; tier: ModTier };

const TYPE_STYLE: Record<'prefix' | 'suffix', React.CSSProperties> = {
    prefix: { color: '#8fb3ff', backgroundColor: '#8fb3ff20' },
    suffix: { color: '#e0b070', backgroundColor: '#e0b07020' },
};

/** Craft-only tier badges: the flag on the tier, its label and accent colour. */
const CRAFT_BADGES = [
    ['desecrated', 'Desecrated', '#b48fff'],
    ['essence', 'Essence', '#6fd3c7'],
    ['genesis', 'Genesis', '#9fd36f'],
    ['influence', 'Influence', '#e09a70'],
] as const;

/**
 * Word-based match, mirroring the server's affix search: every whitespace-separated
 * term must appear somewhere in the haystack, in any order. A plain substring test
 * would drop tiers the first step just offered ("to attack" finds the affix by words,
 * but is not a contiguous substring of "+3 to Level of all Attack Skills").
 */
export function matchesTerms(haystack: string, query: string): boolean {
    const hay = haystack.toLowerCase();

    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => hay.includes(term));
}

/** Turn a picked tier into the resolved mod stored + rendered on the item. */
function toModInfo(group: ModGroup, tier: ModTier): ModInfo {
    return {
        id: tier.id,
        name: '',
        group: group.group,
        type: group.type,
        tier: tier.tier,
        level: tier.level,
        stats: tier.stats,
        rolls: tier.rolls,
        families: tier.families,
    };
}

/**
 * The item modifier picker: searches the real GGPK affixes a base can roll (filtered to
 * the base, or the slot's categories before a base is picked). Two steps - pick an affix,
 * then a tier - both navigable by arrow keys via the shared {@link SearchPicker}, so it
 * matches the reference picker. Affixes already on the item are hidden via `excludeGroups`.
 */
export default function ModPicker({
    base,
    categories,
    type,
    excludeGroups = [],
    fullTypes = [],
    initialGroup,
    onPick,
    onClose,
}: {
    base: string | null;
    categories: string[];
    /** Restrict the offered affixes to this generation type (the section being filled). */
    type?: 'prefix' | 'suffix';
    /** Affix groups already on the item - hidden, since a group holds only one mod. */
    excludeGroups?: string[];
    /** Generation types already at their cap (e.g. 3 prefixes) - hidden entirely. */
    fullTypes?: Array<'prefix' | 'suffix'>;
    /** When changing an existing mod, the group of the current mod - the picker opens
     * straight on its tier ladder; the back button returns to the affix list with this
     * row pre-highlighted, so every other affix stays reachable. */
    initialGroup?: string;
    onPick: (mod: ModInfo) => void;
    onClose: () => void;
}) {
    // The affix whose tier ladder is open (second step), or null while listing affixes.
    const [expanded, setExpanded] = useState<ModGroup | null>(null);
    // Auto-expand to `initialGroup` runs once, on the first affix-list fetch.
    const autoExpanded = useRef(false);

    async function search(query: string): Promise<ModOption[]> {
        // Second step: the expanded affix's tiers, filtered by the search box.
        if (expanded) {
            const needle = query.trim();
            const tiers = needle
                ? expanded.tiers.filter((tier) =>
                      matchesTerms(tier.stats.join(' '), needle),
                  )
                : expanded.tiers;

            return tiers.map((tier) => ({
                kind: 'tier',
                group: expanded,
                tier,
            }));
        }

        // First step: the affixes the base can roll.
        const url = planner.mods.url({
            query: {
                base: base ?? undefined,
                categories:
                    categories.length > 0 ? categories.join(',') : undefined,
                q: query.trim() || undefined,
            },
        });

        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
            return [];
        }

        const body: { results?: ModGroup[] } = await response.json();
        const exclude = new Set(excludeGroups);
        const fullType = new Set(fullTypes);

        const options: ModOption[] = (body.results ?? [])
            .filter(
                (group) =>
                    !exclude.has(group.group) &&
                    !fullType.has(group.type) &&
                    (!type || group.type === type),
            )
            .map((group) => ({ kind: 'group', group }));

        // First open of a "change" picker: jump straight to the current mod's ladder.
        // The back button returns to this list (current affix pre-highlighted there).
        if (!autoExpanded.current && initialGroup) {
            autoExpanded.current = true;
            const match = options.find(
                (option) =>
                    option.kind === 'group' &&
                    option.group.group === initialGroup,
            );

            if (match && match.kind === 'group') {
                setExpanded(match.group);
            }
        }

        return options;
    }

    function select(option: ModOption): void {
        if (option.kind === 'group') {
            setExpanded(option.group);
        } else {
            onPick(toModInfo(option.group, option.tier));
        }
    }

    const header = expanded ? (
        <div className="mb-2 flex items-start gap-2 px-1.5">
            <span className="flex w-8 shrink-0 justify-start">
                <Button
                    icon
                    onClick={() => setExpanded(null)}
                    title="Back to all modifiers"
                >
                    <svg
                        viewBox="0 0 16 16"
                        aria-hidden
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-[1.1em]"
                    >
                        <path d="M10 4 L6 8 L10 12" />
                    </svg>
                </Button>
            </span>
            <span className="pl-text-xs min-w-0 flex-1 pt-1 font-medium break-words text-[var(--pl-text)]">
                {expanded.label}
            </span>
        </div>
    ) : undefined;

    return (
        <SearchPicker<ModOption>
            // Remount on step change so the affix query doesn't linger as a tier
            // filter (and vice versa) - each step starts with a blank search box.
            key={
                expanded
                    ? `tiers:${expanded.group}|${expanded.type}`
                    : 'affixes'
            }
            width={440}
            highlightKey={
                !expanded && initialGroup ? `g:${initialGroup}` : undefined
            }
            search={search}
            keyOf={(option) =>
                option.kind === 'group'
                    ? `g:${option.group.group}`
                    : `t:${option.tier.id}`
            }
            onSelect={select}
            onClose={onClose}
            placeholder={
                expanded
                    ? 'Filter tiers…'
                    : 'Search modifiers (life, cold res…)'
            }
            header={header}
            emptyText="No modifiers roll here."
            deps={[
                expanded,
                base,
                categories.join(','),
                type,
                excludeGroups.join(','),
                fullTypes.join(','),
            ]}
            renderOption={(option) =>
                option.kind === 'group' ? (
                    <>
                        <span
                            className="pl-text-2xs mt-0.5 rounded-xs px-1 py-px font-semibold uppercase"
                            style={TYPE_STYLE[option.group.type]}
                        >
                            {option.group.type === 'prefix' ? 'P' : 'S'}
                        </span>
                        <span className="pl-text-sm min-w-0 flex-1 break-words text-[var(--pl-text)]">
                            {option.group.label}
                        </span>
                        <span className="pl-text-2xs shrink-0 whitespace-nowrap text-[var(--pl-faint)]">
                            {option.group.tiers.length}T ›
                        </span>
                    </>
                ) : (
                    <>
                        <span className="pl-text-2xs mt-0.5 w-8 shrink-0 text-[var(--pl-faint)]">
                            {option.tier.tier !== null
                                ? `T${option.tier.tier}`
                                : '-'}
                        </span>
                        <span className="pl-text-xs min-w-0 flex-1 break-words text-[var(--pl-text)]">
                            {option.tier.stats.join(', ')}
                        </span>
                        {CRAFT_BADGES.map(([key, label, color]) =>
                            option.tier[key] ? (
                                <span
                                    key={key}
                                    className="pl-text-2xs mt-0.5 shrink-0 rounded-xs px-1 py-px font-semibold uppercase"
                                    style={{
                                        color,
                                        backgroundColor: `${color}20`,
                                    }}
                                >
                                    {label}
                                </span>
                            ) : null,
                        )}
                        <span className="pl-text-2xs shrink-0 whitespace-nowrap text-[var(--pl-faint)]">
                            lvl {option.tier.level}
                        </span>
                    </>
                )
            }
        />
    );
}

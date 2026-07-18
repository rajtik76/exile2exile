import SearchPicker from '@/components/planner/SearchPicker';
import { renderModLines } from '@/lib/modLines';
import type { ModInfo, ModRoll } from '@/lib/modLines';
import planner from '@/routes/planner';
import type { ItemMod } from '@/types/planner';

/** One tier of an affix in a search result. */
interface ModTier {
    id: string;
    /** The real GGG affix name (e.g. "of Decay") - what `BuildFilterBuilder` keys a
     *  trade filter's `HasExplicitMod` block on, distinct from the group's own
     *  number-free `label`. */
    name: string;
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

/** One suggestion row: one tier of one affix, or the free-typed text itself. */
type Suggestion =
    | { kind: 'tier'; group: ModGroup; tier: ModTier }
    | { kind: 'text'; text: string };

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

/** The always-present "commit exactly what you typed" row's stable key. */
const CUSTOM_KEY = 'custom';

/**
 * Word-based match, mirroring the server's affix search: every whitespace-separated
 * term must appear somewhere in the haystack, in any order. A plain substring test
 * would drop tiers the search just offered ("to attack" finds the affix by words, but
 * is not a contiguous substring of "+3 to Level of all Attack Skills").
 */
export function matchesTerms(haystack: string, query: string): boolean {
    const hay = haystack.toLowerCase();

    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => hay.includes(term));
}

/** Turn a picked tier into its resolved mod (for rendering its concrete text). */
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
 * A picked tier's frozen snapshot at its default (minimum) roll - the same shape
 * `PlanItemSchema::canonicalMod` stores server-side. Mirrors `ModCatalogue::modSnapshot`:
 * `text` is the tier's rendered line(s) joined by "\n", `family` its first mutual-
 * exclusion group.
 */
function toItemMod(group: ModGroup, tier: ModTier): ItemMod {
    const mod = toModInfo(group, tier);
    const values = mod.rolls.map((roll) => roll.min);

    return {
        modId: mod.id,
        text: renderModLines(mod, values).join('\n'),
        name: tier.name,
        type: mod.type,
        family: mod.families[0] ?? null,
        tier: mod.tier,
        rolls: mod.rolls,
        values,
    };
}

/**
 * The item modifier picker: a free-text box (type, or paste a whole line straight out
 * of PoB) with live typeahead suggestions from the real GGPK affixes a base can roll.
 * Clicking a suggestion commits its exact wording at its tier's default roll; picking
 * nothing and confirming the typed text instead commits it verbatim as a plain-text
 * line (no `modId`) - the server stores it either way (see `PlanItemSchema::canonicalMod`),
 * so an unrecognised wording or a dead affix is never a blocker, just unmatched.
 */
export default function ModPicker({
    base,
    categories,
    type,
    excludeFamilies = [],
    fullTypes = [],
    initialText = '',
    onSave,
    onClose,
}: {
    base: string | null;
    categories: string[];
    /** Restrict the offered affixes to this generation type (the section being filled). */
    type?: 'prefix' | 'suffix';
    /** Mutual-exclusion families already on the item - hidden, mirroring the server's
     *  one-mod-per-family rule (see `ModCatalogue::modErrors`). A stat only carries its
     *  frozen `family`, not the affix's own tier-ladder id, so exclusion is family-wide
     *  rather than the single exact wording a `Change` row is replacing. */
    excludeFamilies?: string[];
    /** Generation types already at their cap (e.g. 3 prefixes) - hidden entirely. */
    fullTypes?: Array<'prefix' | 'suffix'>;
    /** Prefills the search box - the current stat's own text when changing one. */
    initialText?: string;
    onSave: (mod: ItemMod) => void;
    onClose: () => void;
}) {
    async function search(query: string): Promise<Suggestion[]> {
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

        const body: { results?: ModGroup[] } = response.ok
            ? await response.json()
            : {};

        const exclude = new Set(excludeFamilies);
        const fullType = new Set(fullTypes);

        const groups = (body.results ?? []).filter(
            (group) =>
                !group.tiers.some((tier) =>
                    tier.families.some((family) => exclude.has(family)),
                ) &&
                !fullType.has(group.type) &&
                (!type || group.type === type),
        );

        // Every matching tier, across every matching affix - a flat list, not a
        // group/tier drilldown, so a click commits a concrete wording in one step.
        const tiers: Suggestion[] = groups.flatMap((group) =>
            [...group.tiers]
                .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))
                .map((tier) => ({ kind: 'tier' as const, group, tier })),
        );

        // Always offer "use exactly what you typed" - the fallback for a wording the
        // catalogue doesn't know (a typo, or an affix a future patch has dropped).
        const trimmed = query.trim();

        return trimmed === ''
            ? tiers
            : [...tiers, { kind: 'text', text: trimmed }];
    }

    function select(option: Suggestion): void {
        if (option.kind === 'text') {
            onSave({
                modId: null,
                text: option.text,
                name: null,
                type: null,
                family: null,
                tier: null,
                rolls: null,
                values: [],
            });
        } else {
            onSave(toItemMod(option.group, option.tier));
        }

        onClose();
    }

    return (
        <SearchPicker<Suggestion>
            width={440}
            initialQuery={initialText}
            search={search}
            // The typed-text fallback stays pre-highlighted only when opening blank (the
            // "add a new mod" flow), so Enter right after typing commits it without an
            // arrow key - arrowing away still reaches every real suggestion underneath.
            // A "Change" reopen seeds `initialText` with the row's own current text, most
            // often an already-matched mod's - pre-highlighting the fallback there would
            // let a bare Enter silently downgrade a matched affix to plain text, so it's
            // left to an explicit pick instead.
            highlightKey={initialText === '' ? CUSTOM_KEY : undefined}
            keyOf={(option) =>
                option.kind === 'text' ? CUSTOM_KEY : `t:${option.tier.id}`
            }
            onSelect={select}
            onClose={onClose}
            placeholder="Type or paste a modifier line…"
            emptyText="No modifiers roll here."
            deps={[
                base,
                categories.join(','),
                type,
                excludeFamilies.join(','),
                fullTypes.join(','),
            ]}
            renderOption={(option) =>
                option.kind === 'text' ? (
                    <span className="pl-text-sm min-w-0 flex-1 text-[var(--pl-muted)] italic">
                        Use as typed: “{option.text}”
                    </span>
                ) : (
                    <>
                        <span
                            className="pl-text-2xs mt-0.5 rounded-xs px-1 py-px font-semibold uppercase"
                            style={TYPE_STYLE[option.group.type]}
                        >
                            {option.group.type === 'prefix' ? 'P' : 'S'}
                            {option.tier.tier ?? ''}
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

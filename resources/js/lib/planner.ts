import {
    BASE_PHASES,
    MAX_CUSTOM_TABS,
    SECTION_KEYS,
    SINGLE_KEY,
} from '@/types/planner';
import type {
    PlanBuild,
    PlanData,
    PlanEntry,
    PlanGroup,
    PlanSection,
    PlanTab,
    PlanTreeAllocation,
    SectionKey,
} from '@/types/planner';

/** A short, collision-resistant id for a new entry or custom tab (client-only). */
function uid(prefix: string): string {
    const random =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);

    return `${prefix}-${random}`;
}

export function emptyEntry(sectionKey: SectionKey): PlanEntry {
    const entry: PlanEntry = { id: uid('e'), name: '', note: '', priority: 1 };

    if (sectionKey === 'gems') {
        entry.kind = 'active';
    }

    return entry;
}

export function emptyGroup(): PlanGroup {
    return { notes: '', entries: [] };
}

export function emptyAllocation(): PlanTreeAllocation {
    return {
        allocated: [],
        attributeChoices: {},
        weaponSets: {},
        jewels: {},
        treeVersion: null,
    };
}

export function emptyBuild(): PlanBuild {
    return { className: null, ascendId: null };
}

export function emptySection(): PlanSection {
    return {
        items: { ...emptyGroup(), slots: {} },
        gems: { ...emptyGroup(), groups: [] },
        tree: { ...emptyGroup(), allocation: emptyAllocation() },
    };
}

export function makeCustomTab(label: string): PlanTab {
    return { id: uid('c'), label, kind: 'custom' };
}

/**
 * The next phase "Add phase" reveals: the first base phase not yet present (in fixed
 * order), or a fresh custom phase once every base phase is shown. Null when the custom
 * cap is reached, so the button hides. Base phases are revealed one at a time, so the
 * plan always holds a leading prefix of {@link BASE_PHASES}.
 */
export function nextPhaseTab(tabs: PlanTab[]): PlanTab | null {
    const present = new Set(tabs.map((tab) => tab.id));
    const nextBase = BASE_PHASES.find((phase) => !present.has(phase.id));

    if (nextBase) {
        return { id: nextBase.id, label: nextBase.label, kind: 'base' };
    }

    const customCount = tabs.filter((tab) => tab.kind === 'custom').length;

    return customCount < MAX_CUSTOM_TABS ? makeCustomTab('New phase') : null;
}

/**
 * A deep copy of a phase's whole section set - items (paper-doll + priorities), gems
 * (groups + priorities), passive tree (allocation + notable priority) and every notes
 * field. Used when a new phase inherits the previous phase's plan. Plain JSON data, so
 * a structural clone is enough.
 */
export function clonePlanSection(section: PlanSection): PlanSection {
    return JSON.parse(JSON.stringify(section)) as PlanSection;
}

/** Recompute 1..n priorities to match list order after any reorder/add/remove. */
export function reindex(entries: PlanEntry[]): PlanEntry[] {
    return entries.map((entry, index) => ({ ...entry, priority: index + 1 }));
}

/** Which section set a given tab/mode edits: the reserved key when tabs are off. */
export function activeSectionKey(
    mode: PlanData['mode'],
    activeTabId: string,
): string {
    return mode === 'single' ? SINGLE_KEY : activeTabId;
}

/** Read a tab's section set, falling back to an empty one so the UI never breaks. */
export function sectionFor(plan: PlanData, key: string): PlanSection {
    return plan.sections[key] ?? emptySection();
}

/**
 * An in-progress editor snapshot, autosaved to localStorage so unsaved edits
 * survive a hard refresh. It carries the whole content plus the open tab, but never
 * the secret edit token - that always comes fresh from the server.
 */
export interface PlanDraft {
    title: string;
    description: string;
    mode: PlanData['mode'];
    build: PlanBuild;
    tabs: PlanTab[];
    sections: Record<string, PlanSection>;
    activeTabId: string;
}

/** localStorage key for a plan's draft: per-slug when editing, a shared key for a
 *  brand-new plan (which has no slug yet). */
export function draftKeyFor(slug: string | null): string {
    return `planner-draft:${slug ?? 'new'}`;
}

export function loadDraft(key: string): PlanDraft | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(key);

        return raw ? (JSON.parse(raw) as PlanDraft) : null;
    } catch {
        return null;
    }
}

export function saveDraft(key: string, draft: PlanDraft): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
        // Quota or private-mode failures are non-fatal - the draft is a convenience.
    }
}

export function clearDraft(key: string): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.removeItem(key);
    } catch {
        // Ignore - see saveDraft.
    }
}

export { SECTION_KEYS, SINGLE_KEY };

import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import { classPortrait } from '@/components/build/classPortrait';
import FilterPanel from '@/components/planner/FilterPanel';
import type {
    FilterThemePayload,
    StrictnessPayload,
} from '@/components/planner/FilterPanel';
import { ModsProvider } from '@/components/planner/ModsContext';
import PhaseTabs from '@/components/planner/PhaseTabs';
import PlannerEquipment from '@/components/planner/PlannerEquipment';
import PlannerGems, { GemsViewToggle } from '@/components/planner/PlannerGems';
import PlannerTree from '@/components/planner/PlannerTree';
import { ReferencesProvider } from '@/components/planner/ReferencesContext';
import RichText from '@/components/planner/RichText';
import TreeNotablePriority from '@/components/planner/TreeNotablePriority';
import { Panel } from '@/components/planner/ui/Panel';
import { Eyebrow, Heading } from '@/components/planner/ui/Text';
import { resolveAscendancyName } from '@/lib/classCatalog';
import { loadGemsView, saveGemsView } from '@/lib/gemsView';
import type { GemsView } from '@/lib/gemsView';
import type { ModMap } from '@/lib/modLines';
import {
    activeSectionKey,
    emptyAllocation,
    sectionFor,
    SECTION_KEYS,
} from '@/lib/planner';
import type { ReferenceMap } from '@/lib/planReferences';
import { useTreeData } from '@/lib/useTreeData';
import planner from '@/routes/planner';
import { SECTION_META } from '@/types/planner';
import type {
    PlanBuild,
    PlanData,
    PlanGroup,
    PlanMode,
    SectionKey,
} from '@/types/planner';

/**
 * The read-only build guide, resolved by public slug. It mirrors the editor's layout
 * one-to-one - same header, phase tabs, panels and passive-tree canvas - with every
 * field locked: prose renders as {@link RichText}, the paper-doll, gems and tree draw
 * un-editable. The tree keeps only its zoom, search and points-spent chrome so a
 * reader can explore the allocation without changing it.
 */
export default function PlannerShow({
    slug,
    title,
    plan,
    meta,
    references,
    mods,
    filterThemes,
    filterStrictness,
}: {
    slug: string;
    title: string;
    plan: PlanData;
    meta: { title: string; description: string };
    references: ReferenceMap;
    mods: ModMap;
    filterThemes: FilterThemePayload[];
    filterStrictness: StrictnessPayload[];
}) {
    const [activeTabId, setActiveTabId] = useState<string>(
        plan.tabs[0]?.id ?? 'act-1',
    );

    // Gems layout (icon grid vs named list) - a display preference remembered in
    // localStorage, toggled from the gems panel header even in the read-only viewer.
    const [gemsView, setGemsViewState] = useState<GemsView>(loadGemsView);
    const setGemsView = (view: GemsView): void => {
        setGemsViewState(view);
        saveGemsView(view);
    };

    const mode = plan.mode as PlanMode;
    const sectionKey = activeSectionKey(mode, activeTabId);
    const section = sectionFor(plan, sectionKey);

    // The chosen class/ascendancy drives the header label and the faded backdrop -
    // resolved from the live tree (the build stores only ids), exactly as the editor.
    const build = plan.build as PlanBuild;
    const { data: treeData } = useTreeData();
    const selectedAscName = treeData
        ? resolveAscendancyName(treeData, build.className, build.ascendId)
        : null;
    const portrait = build.className
        ? classPortrait(build.className, selectedAscName)
        : null;

    return (
        <div className="relative mx-auto max-w-5xl px-4 pt-8 pb-28">
            <Head title={meta.title || title}>
                {meta.description && (
                    <meta name="description" content={meta.description} />
                )}
            </Head>

            <ReferencesProvider map={references}>
                <ModsProvider map={mods}>
                    {/* Class/ascendancy centre art as a page backdrop, mirroring the
                    editor: the round GGPK medallion faded into the page. */}
                    {portrait && (
                        <div
                            aria-hidden
                            className="pointer-events-none absolute inset-x-0 top-0 z-0 flex justify-center overflow-hidden"
                        >
                            <img
                                alt=""
                                src={portrait.src}
                                className="w-[620px] max-w-none opacity-45 select-none"
                                style={{
                                    maskImage:
                                        'radial-gradient(circle at 50% 42%, black 44%, transparent 64%)',
                                    WebkitMaskImage:
                                        'radial-gradient(circle at 50% 42%, black 44%, transparent 64%)',
                                }}
                            />
                        </div>
                    )}

                    <div className="planner-reading relative z-10">
                        {/* Phase switcher pinned above the guide, mirroring the editor.
                        On the public page it opens revealed rather than collapsed. */}
                        {mode === 'phases' && (
                            <PhaseTabs
                                mode={mode}
                                tabs={plan.tabs}
                                activeTabId={activeTabId}
                                defaultOpen
                                onSelectTab={setActiveTabId}
                            />
                        )}

                        <header className="mb-6 pt-4">
                            <Eyebrow>Build guide</Eyebrow>
                            {build.className && (
                                <p className="pl-text-sm mt-1">
                                    <span className="font-semibold text-[var(--pl-text-strong)]">
                                        {build.className}
                                    </span>
                                    {selectedAscName && (
                                        <>
                                            <span className="px-1.5 text-[var(--pl-faint)]">
                                                ·
                                            </span>
                                            <span className="text-[var(--pl-accent-lit)]">
                                                {selectedAscName}
                                            </span>
                                        </>
                                    )}
                                </p>
                            )}
                            <Heading level={1} className="mt-6">
                                {title || 'Untitled build'}
                            </Heading>
                        </header>

                        {plan.description.trim() !== '' && (
                            <Panel
                                title="Build description"
                                collapsible
                                className="mb-4"
                            >
                                <div className="max-w-3xl text-[var(--pl-text)]">
                                    <RichText text={plan.description} />
                                </div>
                            </Panel>
                        )}

                        <FilterPanel
                            themes={filterThemes}
                            strictness={filterStrictness}
                            buildSlug={slug}
                            phase={
                                mode === 'phases'
                                    ? (plan.tabs.find(
                                          (tab) => tab.id === activeTabId,
                                      )?.label ?? null)
                                    : null
                            }
                            className="mb-4"
                        />

                        <div className="flex flex-col gap-4">
                            {SECTION_KEYS.map((key) => (
                                <ReadSection
                                    key={`${sectionKey}:${key}`}
                                    sectionKey={key}
                                    group={section[key]}
                                    action={
                                        key === 'gems' &&
                                        (section.gems.groups?.length ?? 0) >
                                            0 ? (
                                            <GemsViewToggle
                                                value={gemsView}
                                                onChange={setGemsView}
                                            />
                                        ) : undefined
                                    }
                                    visual={
                                        // Paper-doll and the passive tree always draw -
                                        // an empty build reads as an unfilled slot grid /
                                        // unallocated tree, never a hidden section. Gems
                                        // only appear once a group exists.
                                        key === 'tree' ? (
                                            <PlannerTree
                                                editable={false}
                                                build={build}
                                                allocation={
                                                    section.tree.allocation ??
                                                    emptyAllocation()
                                                }
                                            />
                                        ) : key === 'items' ? (
                                            <PlannerEquipment
                                                editable={false}
                                                slots={
                                                    section.items.slots ?? {}
                                                }
                                            />
                                        ) : key === 'gems' &&
                                          (section.gems.groups?.length ?? 0) >
                                              0 ? (
                                            <PlannerGems
                                                editable={false}
                                                view={gemsView}
                                                groups={
                                                    section.gems.groups ?? []
                                                }
                                            />
                                        ) : undefined
                                    }
                                />
                            ))}
                        </div>

                        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-[var(--pl-divider)] pt-6">
                            <p className="pl-text-sm text-[var(--pl-muted)]">
                                Want to write your own?
                            </p>
                            <Link
                                href={planner.create.url()}
                                className="pl-text-sm inline-flex items-center rounded-[var(--pl-radius)] border border-[var(--pl-accent)] bg-[var(--pl-accent)] px-4 py-2 font-medium text-[#15120b] transition hover:brightness-110"
                            >
                                Start a build plan
                            </Link>
                        </div>
                    </div>
                </ModsProvider>
            </ReferencesProvider>
        </div>
    );
}

/**
 * One content group rendered read-only, mirroring {@link SectionEditor}: the visual
 * (paper-doll, gems or the passive-tree canvas) sits above the tree's notable-priority
 * list, with the author's notes as prose below. Empty groups say so.
 */
function ReadSection({
    sectionKey,
    group,
    visual,
    action,
}: {
    sectionKey: SectionKey;
    group: PlanGroup;
    visual?: React.ReactNode;
    action?: React.ReactNode;
}) {
    const meta = SECTION_META[sectionKey];
    const isTree = sectionKey === 'tree';
    const allocated = group.allocation?.allocated ?? [];
    const hasNotes = group.notes.trim() !== '';
    const showPriority = isTree && allocated.length > 0;
    const hasContent = Boolean(visual) || showPriority || hasNotes;

    return (
        <Panel title={meta.label} collapsible overflowVisible action={action}>
            {visual && <div className="mb-5">{visual}</div>}

            {showPriority && (
                <div className="mb-4">
                    <p className="pl-text-sm mb-4 text-[var(--pl-muted)]">
                        {meta.hint}
                    </p>
                    <TreeNotablePriority
                        editable={false}
                        priority={group.notablePriority ?? []}
                        allocated={allocated}
                    />
                </div>
            )}

            {hasNotes && (
                <div className="mt-4 text-[var(--pl-text)]">
                    <RichText text={group.notes} />
                </div>
            )}

            {!hasContent && (
                <p className="pl-text-sm text-[var(--pl-muted)]">
                    Nothing here yet.
                </p>
            )}
        </Panel>
    );
}

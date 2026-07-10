import MarkdownField from '@/components/planner/MarkdownField';
import TreeNotablePriority from '@/components/planner/TreeNotablePriority';
import { Panel } from '@/components/planner/ui/Panel';
import { SECTION_META } from '@/types/planner';
import type { PlanGroup, SectionKey } from '@/types/planner';

/**
 * The editor for one content group (items, gems or passive tree) within a phase.
 * Items drive priority from the paper-doll badges, gems from the visual gem-group grid
 * and the passive tree from the notables the author allocates (see
 * {@link TreeNotablePriority}); below sits a free-text notes field for prose.
 */
export default function SectionEditor({
    sectionKey,
    group,
    onChange,
    visual,
    action,
}: {
    sectionKey: SectionKey;
    group: PlanGroup;
    onChange: (group: PlanGroup) => void;
    /** Optional visual (e.g. the passive tree) rendered above the priority list. */
    visual?: React.ReactNode;
    /** Optional control shown in the panel header (e.g. the gems layout switch). */
    action?: React.ReactNode;
}) {
    const meta = SECTION_META[sectionKey];
    const isTree = sectionKey === 'tree';

    return (
        <Panel title={meta.label} collapsible overflowVisible action={action}>
            {visual && <div className="mb-5">{visual}</div>}

            {isTree && (
                <div className="mb-4">
                    <p className="pl-text-sm mb-4 text-[var(--pl-muted)]">
                        {meta.hint}
                    </p>
                    <TreeNotablePriority
                        editable
                        priority={group.notablePriority ?? []}
                        allocated={group.allocation?.allocated ?? []}
                        onChange={(notablePriority) =>
                            onChange({ ...group, notablePriority })
                        }
                    />
                </div>
            )}

            <div className="mt-4">
                <MarkdownField
                    label="Notes"
                    value={group.notes}
                    onChange={(notes) => onChange({ ...group, notes })}
                    placeholder={`Anything about ${meta.label.toLowerCase()} worth noting…`}
                    rows={3}
                    maxLength={20000}
                />
            </div>
        </Panel>
    );
}

import { useState } from 'react';
import { gameVersionLabel } from '@/components/build/GameVersion';
import Button from '@/components/planner/Button';
import { Panel } from '@/components/planner/ui/Panel';
import type { PlanTreeReport } from '@/lib/planMigration';
import type { TreeSnapshotRef } from '@/lib/treeSource';

export type GearKind = 'item' | 'rune' | 'gem' | 'mod' | 'uniqueMod';

export interface GearReport {
    removed: { kind: GearKind; name: string; phases: string[] }[];
    changed: {
        kind: GearKind;
        name: string;
        before: string;
        after: string;
        phases: string[];
    }[];
}

export interface PlanConversion extends TreeSnapshotRef {
    slug: string;
    gameEra: string;
    eraName: string | null;
    gear: GearReport;
}

const KIND_LABEL: Record<GearKind, string> = {
    item: 'Item',
    rune: 'Rune',
    gem: 'Gem',
    mod: 'Modifier',
    uniqueMod: 'Unique modifier',
};

export default function PlanConversionReport({
    source,
    gear,
    tree,
}: {
    source: { gameEra: string; eraName: string | null };
    gear: GearReport;
    tree: PlanTreeReport;
}) {
    const [open, setOpen] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    if (dismissed) {
        return null;
    }

    const version = gameVersionLabel({
        era: source.gameEra,
        name: source.eraName,
    });
    const treeDropped = tree.removed.length + tree.disconnected.length;
    const hasDetails =
        gear.removed.length + gear.changed.length > 0 ||
        tree.changed.length + treeDropped > 0;

    return (
        <Panel
            title={`Converted from ${version}`}
            className="mb-4"
            action={
                <div className="flex items-center gap-2">
                    {hasDetails && (
                        <Button
                            variant="ghost"
                            onClick={() => setOpen((value) => !value)}
                            aria-expanded={open}
                        >
                            {open ? 'Hide details' : 'Details'}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        onClick={() => setDismissed(true)}
                        aria-label="Dismiss the conversion report"
                    >
                        ×
                    </Button>
                </div>
            }
        >
            <div
                className="pl-text-sm space-y-1 text-[var(--pl-text)]"
                role="status"
            >
                {tree.classMissing ? (
                    <p className="text-[var(--pl-danger-lit)]">
                        The class is not in the current game, so the passive
                        trees were cleared. Pick a class to carry on.
                    </p>
                ) : (
                    <p>
                        Passive trees: {tree.unchanged} unchanged ·{' '}
                        {tree.changed.length} changed · {tree.removed.length} no
                        longer exist · {tree.disconnected.length} lost their
                        path
                        {tree.ascendancyMissing
                            ? ' · the ascendancy is gone'
                            : ''}
                    </p>
                )}
                <p>
                    Gear: {gear.removed.length} removed · {gear.changed.length}{' '}
                    changed
                </p>
                <p className="text-[var(--pl-muted)]">
                    This is a new copy; the original stays as it was. Check the
                    build and save it to get a new link.
                </p>
            </div>

            {open && (
                <div className="pl-text-sm mt-4 grid gap-5 sm:grid-cols-2">
                    <section>
                        <ListTitle>
                            Gear removed ({gear.removed.length})
                        </ListTitle>
                        <ul className="space-y-1">
                            {gear.removed.map((entry) => (
                                <li key={`${entry.kind}:${entry.name}`}>
                                    <span className="text-[var(--pl-muted)]">
                                        {KIND_LABEL[entry.kind]}:
                                    </span>{' '}
                                    {entry.name}
                                    <Phases phases={entry.phases} />
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section>
                        <ListTitle>
                            Gear changed ({gear.changed.length})
                        </ListTitle>
                        <ul className="space-y-2">
                            {gear.changed.map((entry) => (
                                <li key={`${entry.before}:${entry.after}`}>
                                    <p className="text-[var(--pl-muted)] line-through">
                                        {entry.before}
                                    </p>
                                    <p>{entry.after}</p>
                                    <Phases phases={entry.phases} />
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section>
                        <ListTitle>
                            Passives changed ({tree.changed.length})
                        </ListTitle>
                        <ul className="space-y-2">
                            {tree.changed.map((node) => (
                                <li key={node.id}>
                                    <p className="text-[var(--pl-text-strong)]">
                                        {node.name}
                                        {node.previousName !== node.name &&
                                            ` (was ${node.previousName})`}
                                        <Phases phases={node.phases} />
                                    </p>
                                    {node.before.map((line, index) => (
                                        <p
                                            key={`b${index}`}
                                            className="text-[var(--pl-muted)] line-through"
                                        >
                                            {line}
                                        </p>
                                    ))}
                                    {node.after.map((line, index) => (
                                        <p key={`a${index}`}>{line}</p>
                                    ))}
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section>
                        <ListTitle>Passives dropped ({treeDropped})</ListTitle>
                        <ul className="space-y-1">
                            {tree.removed.map((node) => (
                                <li key={node.id}>
                                    {node.name}{' '}
                                    <span className="text-[var(--pl-muted)]">
                                        (no longer exists)
                                    </span>
                                    <Phases phases={node.phases} />
                                </li>
                            ))}
                            {tree.disconnected.map((node) => (
                                <li key={node.id}>
                                    {node.name}{' '}
                                    <span className="text-[var(--pl-muted)]">
                                        (lost its path)
                                    </span>
                                    <Phases phases={node.phases} />
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            )}
        </Panel>
    );
}

function ListTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="pl-text-xs mb-1.5 font-semibold tracking-[0.14em] text-[var(--pl-accent)] uppercase">
            {children}
        </h3>
    );
}

function Phases({ phases }: { phases: string[] }) {
    return (
        <span className="text-[var(--pl-faint)]"> - {phases.join(', ')}</span>
    );
}

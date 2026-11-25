import { useState } from 'react';
import { gameVersionLabel } from '@/components/build/GameVersion';
import {
    BAR_GUTTER,
    ClearGlyph,
    ICON_SEGMENT,
    LABEL,
} from '@/components/passive-tree/chrome';
import type {
    ChangedNode,
    DroppedNode,
    TreeMigrationReport,
} from '@/lib/treeMigration';

export interface ConversionSource {
    gameEra: string;
    eraName: string | null;
}

export function TreeConversionReport({
    source,
    className,
    report,
}: {
    source: ConversionSource;
    className: string;
    report: TreeMigrationReport;
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
    const dropped = report.removed.length + report.disconnected.length;
    const hasDetails = report.changed.length > 0 || dropped > 0;

    return (
        <div
            className={`notice relative z-10 border-t-0 border-r-0 py-3 font-ui ${BAR_GUTTER}`}
            role="status"
        >
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 text-sm">
                    <p className={LABEL}>Converted from {version}</p>
                    {report.classMissing ? (
                        <p className="mt-1 text-blood-lit">
                            The {className} class is not in the current tree, so
                            none of its passives could be carried over.
                        </p>
                    ) : (
                        <p className="mt-1">
                            {report.unchanged} unchanged
                            {` · ${report.changed.length} changed`}
                            {` · ${report.removed.length} no longer exist`}
                            {` · ${report.disconnected.length} lost their path`}
                            {report.ascendancyMissing
                                ? ' · the ascendancy is gone'
                                : ''}
                        </p>
                    )}
                    <p className="mt-1 text-mist">
                        This is a new copy; the original stays as it was. Check
                        the tree and save it to get a new link.
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {hasDetails ? (
                        <button
                            type="button"
                            onClick={() => setOpen((value) => !value)}
                            aria-expanded={open}
                            className="btn btn-sm btn-iron"
                        >
                            {open ? 'Hide details' : 'Details'}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        aria-label="Dismiss the conversion report"
                        className={ICON_SEGMENT}
                    >
                        <ClearGlyph />
                    </button>
                </div>
            </div>

            {open ? (
                <div className="mt-3 grid max-h-[40vh] gap-4 overflow-y-auto pr-1 text-sm sm:grid-cols-3">
                    <ChangedList nodes={report.changed} />
                    <DroppedList
                        title="No longer exist"
                        nodes={report.removed}
                    />
                    <DroppedList
                        title="Lost their path"
                        nodes={report.disconnected}
                    />
                </div>
            ) : null}
        </div>
    );
}

function ChangedList({ nodes }: { nodes: ChangedNode[] }) {
    return (
        <section>
            <h3 className={LABEL}>Changed ({nodes.length})</h3>
            <ul className="mt-1.5 space-y-2">
                {nodes.map((node) => (
                    <li key={node.id}>
                        <p className="text-paper">
                            {node.name}
                            {node.previousName !== node.name ? (
                                <span className="text-mist">
                                    {' '}
                                    (was {node.previousName})
                                </span>
                            ) : null}
                        </p>
                        <StatLines
                            lines={node.before}
                            className="text-mist line-through"
                        />
                        <StatLines lines={node.after} className="text-bone" />
                    </li>
                ))}
            </ul>
        </section>
    );
}

function StatLines({
    lines,
    className,
}: {
    lines: string[];
    className: string;
}) {
    return lines.map((line, index) => (
        <p key={index} className={`text-[13px] ${className}`}>
            {line}
        </p>
    ));
}

function DroppedList({
    title,
    nodes,
}: {
    title: string;
    nodes: DroppedNode[];
}) {
    return (
        <section>
            <h3 className={LABEL}>
                {title} ({nodes.length})
            </h3>
            <ul className="mt-1.5 space-y-0.5 text-bone">
                {nodes.map((node) => (
                    <li key={node.id}>{node.name}</li>
                ))}
            </ul>
        </section>
    );
}

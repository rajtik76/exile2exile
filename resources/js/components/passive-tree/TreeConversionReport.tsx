import { useState } from 'react';
import { INPUT_FONT, PANEL_FONT } from '@/components/passive-tree/chrome';
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

    const version = `${source.gameEra}${source.eraName ? ` (${source.eraName})` : ''}`;
    const dropped = report.removed.length + report.disconnected.length;
    const hasDetails = report.changed.length > 0 || dropped > 0;

    return (
        <div
            className="relative z-10 border-b border-[#40331a] bg-[#120c06] px-3 py-3 sm:px-6"
            style={INPUT_FONT}
            role="status"
        >
            <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 text-sm text-[#cdb784]">
                    <p
                        className="text-[11px] font-semibold tracking-[0.22em] text-[#b39a64] uppercase"
                        style={PANEL_FONT}
                    >
                        Converted from PoE2 {version}
                    </p>
                    {report.classMissing ? (
                        <p className="mt-1 text-[#e0a58f]">
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
                    <p className="mt-1 text-[#8a7850]">
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
                            className="rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#ecc878] uppercase transition-colors hover:bg-[#f0c869]/12 focus-visible:bg-[#f0c869]/12 focus-visible:outline-none"
                            style={{ border: '1px solid rgba(199,154,63,0.6)' }}
                        >
                            {open ? 'Hide details' : 'Details'}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => setDismissed(true)}
                        aria-label="Dismiss the conversion report"
                        className="grid size-8 place-items-center rounded-full text-[#b39a64] transition-colors hover:bg-[#f0c869]/12 hover:text-[#ecc878] focus-visible:bg-[#f0c869]/12 focus-visible:outline-none"
                    >
                        ×
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
            <h3 className="text-xs font-semibold tracking-[0.14em] text-[#b39a64] uppercase">
                Changed ({nodes.length})
            </h3>
            <ul className="mt-1.5 space-y-2">
                {nodes.map((node) => (
                    <li key={node.id}>
                        <p className="text-[#ffe6a8]">
                            {node.name}
                            {node.previousName !== node.name ? (
                                <span className="text-[#8a7850]">
                                    {' '}
                                    (was {node.previousName})
                                </span>
                            ) : null}
                        </p>
                        <StatLines
                            lines={node.before}
                            className="text-[#8a7850] line-through"
                        />
                        <StatLines
                            lines={node.after}
                            className="text-[#cdb784]"
                        />
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
        <p key={index} className={`text-xs ${className}`}>
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
            <h3 className="text-xs font-semibold tracking-[0.14em] text-[#b39a64] uppercase">
                {title} ({nodes.length})
            </h3>
            <ul className="mt-1.5 space-y-0.5 text-[#cdb784]">
                {nodes.map((node) => (
                    <li key={node.id}>{node.name}</li>
                ))}
            </ul>
        </section>
    );
}

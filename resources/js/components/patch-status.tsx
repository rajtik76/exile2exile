import { usePatchStatus } from '@/lib/usePatchStatus';
import type { PatchStatus } from '@/lib/usePatchStatus';

/*
 * The live patch read-outs: what the watcher last saw on GGG's patch server and
 * the patch this site's own game data is built from. Both read the same
 * {@link usePatchStatus} hook, so the footer and the patch-webhook page always
 * agree; each renders nothing before the first patch poll.
 */

/** The pulsing dot: the watcher is alive and polling. */
function LivePing() {
    return (
        <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-verdigris opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-verdigris shadow-[0_0_8px_var(--color-verdigris)]" />
        </span>
    );
}

/** Whether the site's data is on the latest patch; nothing while unknown. */
function DataFreshness({ status }: { status: PatchStatus }) {
    if (!status.dataVersion) {
        return null;
    }

    const tag =
        'inline-flex h-5 items-center rounded-[2px] border px-2 font-ui text-xs font-semibold';

    return status.isDataCurrent ? (
        <span className={`${tag} border-verdigris/50 text-verdigris`}>
            current
        </span>
    ) : (
        <span
            className={`${tag} border-ember-700 bg-ember-500/10 text-ember-300`}
        >
            behind
        </span>
    );
}

const DATA_TITLE = "The patch the app's bundled game data is built from";

/**
 * The compact read-out in the footer. Top row: the heartbeat and the latest
 * PoE2 version beside the release age and last-checked time, both kept fresh
 * by the hook's poll. Bottom row: the request-only patch the site's own data
 * is built from, flagged current or behind.
 */
export function PatchStatusWidget() {
    const status = usePatchStatus();

    if (!status) {
        return null;
    }

    return (
        <div className="panel w-fit font-ui text-[13px] text-slate">
            <div className="flex items-center gap-3.5 px-3.5 py-2.5">
                <span className="flex items-center gap-2.5">
                    <LivePing />
                    <span className="text-sm font-semibold text-paper tabular-nums">
                        PoE2&nbsp;{status.version}
                    </span>
                </span>

                <span className="h-8 w-px bg-line" aria-hidden="true" />

                <div className="flex flex-col leading-[1.45] tabular-nums">
                    <span title={new Date(status.releasedAt).toLocaleString()}>
                        released {status.releasedAgo}
                    </span>
                    <span title={new Date(status.checkedAt).toLocaleString()}>
                        checked {status.checkedAgo}
                    </span>
                </div>
            </div>

            <div
                className="flex items-center gap-2 border-t border-line px-3.5 py-2"
                title={DATA_TITLE}
            >
                <span className="text-mist">web data</span>
                <span className="font-semibold text-paper tabular-nums">
                    {status.dataVersion ?? '-'}
                </span>
                <DataFreshness status={status} />
            </div>
        </div>
    );
}

/** One cell of the status strip: a small-caps label over a value. */
function StatusCell({
    label,
    value,
    title,
    badge,
}: {
    label: React.ReactNode;
    value: string;
    title?: string;
    badge?: React.ReactNode;
}) {
    return (
        <div className="bg-stone-900 p-4">
            <div className="flex items-center gap-2 font-label text-[15px] tracking-[0.06em] text-pewter-300">
                {label}
            </div>
            <div
                className="mt-1 flex items-center gap-2 font-ui text-[15px] text-paper tabular-nums"
                title={title}
            >
                <span>{value}</span>
                {badge}
            </div>
        </div>
    );
}

/**
 * The same read-out as a four-cell strip, for the patch-webhook page. Latest
 * version and the two relative times poll every 60s; the data version is
 * request-only.
 */
export function PatchStatusPanel() {
    const status = usePatchStatus();

    if (!status) {
        return null;
    }

    return (
        <div className="panel grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            <StatusCell
                label={
                    <>
                        <LivePing />
                        Latest
                    </>
                }
                value={`PoE2 ${status.version}`}
            />
            <StatusCell
                label="Released"
                value={status.releasedAgo}
                title={new Date(status.releasedAt).toLocaleString()}
            />
            <StatusCell
                label="Checked"
                value={status.checkedAgo}
                title={new Date(status.checkedAt).toLocaleString()}
            />
            <StatusCell
                label="App data"
                value={status.dataVersion ?? '-'}
                title={DATA_TITLE}
                badge={<DataFreshness status={status} />}
            />
        </div>
    );
}

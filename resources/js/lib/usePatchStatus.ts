import { usePage, usePoll } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/** Latest-version status shared from the server (see Poe2PatchStatus). */
export type PatchProp = {
    version: string;
    checkedAt: string;
    releasedAt: string;
} | null;

export interface PatchStatus {
    /**
     * Raw GGG patch string the patch server last reported (e.g. "4.5.4.4.3"),
     * shown verbatim rather than translated into a guessed in-game version -
     * GGG's raw build number doesn't map onto the player-facing one predictably.
     */
    version: string;
    /** ISO time the version released (first detected by the patch watcher). */
    releasedAt: string;
    /** ISO time we last polled the patch server. */
    checkedAt: string;
    /** "3d ago" - time since the version released. */
    releasedAgo: string;
    /** "1m ago" - time since the last patch-server poll. */
    checkedAgo: string;
    /** The version the app's committed data was built from, or null. */
    dataVersion: string | null;
    /** Whether the app's data is on the latest released version. */
    isDataCurrent: boolean;
}

/** Short, human "x ago" from an ISO timestamp. */
function ago(iso: string, now: number): string {
    const minutes = Math.max(
        0,
        Math.floor((now - new Date(iso).getTime()) / 60000),
    );

    if (minutes < 1) {
        return 'just now';
    }

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
        return `${days}d ago`;
    }

    return `${Math.floor(days / 7)}w ago`;
}

/**
 * Headless patch status: reads the shared props, polls the latest-version status
 * every 60s (partial reload of just `patch`), and ticks the relative-time
 * read-out between polls. Returns the computed data only - each surface (footer,
 * patch-webhook page) styles it itself. Null before the first patch poll.
 *
 * `dataVersion` is intentionally request-only: it rides the initial props and is
 * not part of the poll, so it changes only when a data refresh ships a new
 * build, not on the 60s tick.
 */
export function usePatchStatus(): PatchStatus | null {
    const props = usePage().props;
    const [now, setNow] = useState(() => Date.now());

    usePoll(60_000, { only: ['patch'] });

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 30_000);

        return () => window.clearInterval(id);
    }, []);

    const patch = props.patch as PatchProp;

    if (!patch) {
        return null;
    }

    const dataVersion =
        (props.dataVersion as string | null | undefined) ?? null;

    return {
        version: patch.version,
        releasedAt: patch.releasedAt,
        checkedAt: patch.checkedAt,
        releasedAgo: ago(patch.releasedAt, now),
        checkedAgo: ago(patch.checkedAt, now),
        dataVersion,
        isDataCurrent: dataVersion !== null && dataVersion === patch.version,
    };
}

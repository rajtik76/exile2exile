import { useSyncExternalStore } from 'react';

const mql =
    typeof window === 'undefined'
        ? undefined
        : window.matchMedia('(pointer: coarse)');

function subscribe(callback: () => void): () => void {
    if (!mql) {
        return () => {};
    }

    mql.addEventListener('change', callback);

    return () => {
        mql.removeEventListener('change', callback);
    };
}

function hasCoarsePointer(): boolean {
    return mql?.matches ?? false;
}

function getServerSnapshot(): boolean {
    return false;
}

/**
 * Whether the primary pointer is coarse (touch/pen). Drives the passive tree's
 * switch from a hover tooltip to a tap-pinned one, since touch surfaces report
 * no hover. Stays live for devices that swap input modes (a tablet docking a
 * mouse), and is SSR-safe - it reports `false` until hydrated.
 */
export function useCoarsePointer(): boolean {
    return useSyncExternalStore(subscribe, hasCoarsePointer, getServerSnapshot);
}

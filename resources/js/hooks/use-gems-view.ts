import { useSyncExternalStore } from 'react';
import { DEFAULT_GEMS_VIEW, loadGemsView, saveGemsView } from '@/lib/gemsView';
import type { GemsView } from '@/lib/gemsView';

const listeners = new Set<() => void>();

// Kept in memory too, so a toggle still applies for the session when storage fails.
let current: GemsView | null = null;

function subscribe(callback: () => void): () => void {
    listeners.add(callback);

    return () => {
        listeners.delete(callback);
    };
}

function getSnapshot(): GemsView {
    current ??= loadGemsView();

    return current;
}

function getServerSnapshot(): GemsView {
    return DEFAULT_GEMS_VIEW;
}

function setGemsView(view: GemsView): void {
    current = view;
    saveGemsView(view);
    listeners.forEach((listener) => listener());
}

/**
 * The remembered gems layout and its setter. SSR-safe: hydration renders the
 * default, then switches to the stored choice, so the server HTML always matches.
 */
export function useGemsView(): [GemsView, (view: GemsView) => void] {
    return [
        useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
        setGemsView,
    ];
}

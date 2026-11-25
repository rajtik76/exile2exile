import { useSyncExternalStore } from 'react';

function subscribe(): () => void {
    return () => {};
}

function getSnapshot(): boolean {
    return true;
}

function getServerSnapshot(): boolean {
    return false;
}

/**
 * Whether the component renders in the browser after hydration. False on the
 * server and during hydration, so browser-only output (portals into `<body>`)
 * never makes the client tree differ from the server HTML.
 */
export function useHydrated(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import PublicLayout from '@/layouts/public-layout';

// App name is server-rendered into a <meta> from config('app.name'), so the
// title shares one APP_NAME source - no build-time copy. SSR-guarded (no DOM in
// dev SSR): the client re-titles on hydration.
const appName =
    (typeof document !== 'undefined'
        ? document
              .querySelector('meta[name="app-name"]')
              ?.getAttribute('content')
        : null) || 'Exile to Exile';

createInertiaApp({
    // Resolve pages ourselves (instead of letting @inertiajs/vite auto-inject the glob)
    // so we can exclude co-located `*.test.tsx` files - otherwise the plugin's
    // `pages/**/*.tsx` glob bundles them as page chunks and ships test code.
    resolve: (name) => {
        const pages = import.meta.glob<{ default: ComponentType }>([
            './pages/**/*.tsx',
            '!./pages/**/*.test.tsx',
        ]);
        const page = pages[`./pages/${name}.tsx`];

        if (!page) {
            throw new Error(`Inertia page not found: ${name}`);
        }

        return page().then((module) => module.default);
    },
    title: (title) => (title ? `${title} - ${appName}` : appName),
    // Every page is public; there is no authed area yet. The class-portrait
    // test harness renders bare so its visual snapshot is chrome-independent.
    layout: (name) =>
        name === 'test/class-portraits' ? undefined : PublicLayout,
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// Set light / dark mode on load.
initializeTheme();

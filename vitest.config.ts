import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Frontend unit tests (hooks and pure view logic) run under jsdom. The React
 * plugin runs without the react-compiler babel pass the app build uses - the
 * tests exercise plain hook behaviour, not compiled output.
 */
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
        },
        dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['resources/js/**/*.test.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            // The hand-written application layer - pure view logic and hooks.
            // Generated Wayfinder routes/actions and the Inertia page shells are
            // out of scope (they are wiring, not logic worth pinning here).
            include: ['resources/js/lib/**', 'resources/js/hooks/**'],
            thresholds: {
                statements: 95,
                lines: 95,
                functions: 90,
                // The remaining branch gaps are SSR guards (`typeof window ===
                // 'undefined'`) that jsdom can't reach.
                branches: 80,
            },
        },
    },
});

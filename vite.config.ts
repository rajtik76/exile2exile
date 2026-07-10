import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        // The @poe2-toolkit/tree-react package declares react as a peer
        // dependency; dedupe keeps a single React instance so hooks don't see a
        // null React when the package resolves its own copy. pixi.js is deduped
        // too so a linked toolkit (npm link during local development) shares the
        // app's single Pixi rather than bundling its own.
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'pixi.js'],
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
});

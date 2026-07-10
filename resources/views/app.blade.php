<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="tree-asset-version" content="{{ $treeAssetVersion ?? '' }}">
        <meta name="app-name" content="{{ config('app.name') }}">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }
        </style>

        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        @fonts

        {{-- Per-page AI/SEO metadata, server-rendered so it survives a raw fetch
             (no SSR): pages that expose a machine-readable document (e.g. a shared
             build) set a `meta` prop with a digest and a link to its JSON.

             Kept OUTSIDE <x-inertia::head>: the description/link aren't managed by
             Inertia's client head manager, so it must not reconcile them away on
             hydration. Only the title lives inside, where Inertia owns it. --}}
        @php($meta = data_get($page ?? [], 'props.meta'))
        @isset($meta['description'])
            <meta name="description" content="{{ $meta['description'] }}">
        @endisset
        @isset($meta['alternateJson'])
            <link rel="alternate" type="application/json" href="{{ $meta['alternateJson'] }}" title="Machine-readable build data">
        @endisset

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ $meta['title'] ?? config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        {{-- Server-rendered build summary for machine readers. Rendered OUTSIDE
             #app so React never wipes it, and `sr-only` (off-screen, not
             display:none/aria-hidden) so it stays in the raw HTML a markdown fetch
             reads while staying invisible to sighted users. This is the one layer
             that survives every fetch path: no head meta, no scripts, no JS. --}}
        @php($summary = data_get($page ?? [], 'props.summary'))
        @isset($summary)
            <div class="sr-only">
                <h1>{{ $summary['class'] }}@if ($summary['ascendancy']) - {{ $summary['ascendancy'] }}@endif - Path of Exile 2 passive tree build</h1>
                <p>Class: {{ $summary['class'] }}. Ascendancy: {{ $summary['ascendancy'] ?? 'none' }}. {{ $summary['pointsAllocated'] }} passive points allocated. Attributes from passives - Strength {{ $summary['attributes']['str'] }}, Dexterity {{ $summary['attributes']['dex'] }}, Intelligence {{ $summary['attributes']['int'] }}, unspecified {{ $summary['attributes']['unspecified'] }}.</p>
                @if (! empty($summary['notables']))
                    <p>Notable passives: {{ implode(', ', $summary['notables']) }}.</p>
                @endif
                @if (! empty($summary['keystones']))
                    <p>Keystones: {{ implode(', ', $summary['keystones']) }}.</p>
                @endif
                @isset($meta['alternateJson'])
                    <p>Full machine-readable build data for this build is available as JSON at: <a href="{{ $meta['alternateJson'] }}">{{ $meta['alternateJson'] }}</a></p>
                @endisset
            </div>
        @endisset
        <x-inertia::app />
    </body>
</html>

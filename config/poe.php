<?php

declare(strict_types=1);

use App\Support\TreeDataVersion;

return [

    /*
    |--------------------------------------------------------------------------
    | Bundled game-data version
    |--------------------------------------------------------------------------
    |
    | Versions the decode/reference/icon/mod caches so they bust when the bundled
    | data changes. Derived from the data's own committed stamp
    | (public/tree/current/version.json: the extraction patch + tree content hash),
    | so a data refresh carries its own new version - no manual bump. POE_DATA_VERSION
    | stays only as an optional override (normally unset).
    |
    */

    'data_version' => env('POE_DATA_VERSION') ?: TreeDataVersion::stamp(),

    /*
    |--------------------------------------------------------------------------
    | Economy data (poe2scout)
    |--------------------------------------------------------------------------
    |
    | Live market prices for the loot-filter generator. Prices are not game data
    | and cannot come from GGPK, so poe2scout is the approved external source (it
    | covers currency + uniques only - rare items carry no market index). Their
    | data moves in 6-hour blocks, so the sync refreshes on that cadence and the
    | request path reads only the locally-cached snapshot, never the API.
    |
    */

    'economy' => [
        'base_url' => env('POE2SCOUT_BASE_URL', 'https://api.poe2scout.com'),

        'realm' => env('POE2SCOUT_REALM', 'poe2'),

        // Push-monitor URL (e.g. Uptime Kuma) pinged after a successful economy sync; the
        // scheduler in routes/console.php only wires the ping when this is set, so a failed
        // or skipped run withholds it and the monitor raises the alarm. Blank = off.
        'heartbeat_url' => env('POE2SCOUT_SYNC_HEARTBEAT_URL'),

        // poe2scout asks sustained clients to identify themselves with a contactable
        // User-Agent (their README); it is not an auth credential. The default tags the
        // app environment onto the version so non-production traffic (e.g. local dev)
        // identifies itself as such - "ExileToExile/1.0-local (…)" - while production
        // stays clean. An explicit POE2SCOUT_USER_AGENT overrides the whole string.
        'user_agent' => env('POE2SCOUT_USER_AGENT', sprintf(
            'ExileToExile/1.0%s (+%s; contact: %s)',
            env('APP_ENV', 'production') === 'production' ? '' : '-'.env('APP_ENV', 'local'),
            env('APP_URL'),
            env('CONTACT_EMAIL')
        )),

        'timeout' => 15,

        // Page size for the paginated ByCategory endpoints.
        'per_page' => 250,

        // Safety cap so a runaway Pages count can't loop forever.
        'max_pages' => 200,

        // Leagues to sync. Empty = auto (the current softcore league, resolved from
        // the API's IsCurrent flag). Set explicit canonical league names (the API's
        // `Value`, e.g. "Runes of Aldur") to override, comma-separated. Each name is
        // trimmed, so surrounding spaces after a comma are tolerated.
        'leagues' => array_values(array_filter(array_map(
            trim(...),
            explode(',', (string) env('POE2SCOUT_LEAGUES', '')),
        ), static fn (string $league): bool => $league !== '')),
    ],

];

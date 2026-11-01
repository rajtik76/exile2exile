<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Dashboard Credentials
    |--------------------------------------------------------------------------
    |
    | HTTP Basic Auth for the internal /stats dashboard. No login system yet, so the
    | single operator credential lives here. Leave either value empty and the dashboard
    | refuses every request.
    |
    */

    'user' => env('STATS_USER', ''),

    'password' => env('STATS_PASS', ''),

    /*
    |--------------------------------------------------------------------------
    | Umami
    |--------------------------------------------------------------------------
    |
    | Website id of the self-hosted Umami instance. The tracker is served from
    | this origin through the nginx proxy in docker/nginx.conf. Leave empty and
    | no tracker is rendered.
    |
    */

    'umami_website_id' => env('UMAMI_WEBSITE_ID', ''),

];

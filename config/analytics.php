<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Dashboard Credentials
    |--------------------------------------------------------------------------
    |
    | HTTP Basic Auth for the first-party /stats dashboard. No login system yet, so the
    | single operator credential lives here. Leave either value empty and the dashboard
    | refuses every request.
    |
    */

    'user' => env('STATS_USER', ''),

    'password' => env('STATS_PASS', ''),

];

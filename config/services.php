<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | Stores credentials for third party services such as Mailgun, Postmark, AWS and
    | more. This is the de facto, conventional location for packages to locate the
    | various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
     * Discord webhook that receives a "new patch" announcement when the watcher
     * detects a fresh PoE2 version. Leave empty to disable (e.g. locally).
     */
    'discord' => [
        'patch_webhook' => env('DISCORD_PATCH_WEBHOOK', ''),
    ],

];

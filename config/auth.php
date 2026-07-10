<?php

use App\Models\User;

return [

    /*
    |--------------------------------------------------------------------------
    | Authentication Defaults
    |--------------------------------------------------------------------------
    |
    | Defines the default authentication "guard" and password reset "broker". Change
    | these as required, but they're a perfect start for most applications.
    |
    */

    'defaults' => [
        'guard' => env('AUTH_GUARD', 'web'),
        'passwords' => env('AUTH_PASSWORD_BROKER', 'users'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Authentication Guards
    |--------------------------------------------------------------------------
    |
    | Define every authentication guard for your application. The default uses session
    | storage plus the Eloquent user provider.
    |
    | All authentication guards have a user provider, which defines how users are
    | retrieved from your database or other storage system. Typically Eloquent.
    |
    | Supported: "session"
    |
    */

    'guards' => [
        'web' => [
            'driver' => 'session',
            'provider' => 'users',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | User Providers
    |--------------------------------------------------------------------------
    |
    | All authentication guards have a user provider, which defines how users are
    | retrieved from your database or other storage system. Typically Eloquent.
    |
    | With multiple user tables or models you may configure multiple providers to
    | represent the model / table, then assign them to any extra guards you define.
    |
    | Supported: "database", "eloquent"
    |
    */

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model' => env('AUTH_MODEL', User::class),
        ],

        // 'users' => [
        //     'driver' => 'database',
        //     'table' => 'users',
        // ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Resetting Passwords
    |--------------------------------------------------------------------------
    |
    | Specify the behavior of Laravel's password reset functionality, including the
    | table used for token storage and the user provider invoked to retrieve users.
    |
    | The expiry time is the number of minutes each reset token stays valid. Keeping
    | tokens short-lived gives less time to guess them. Change this as needed.
    |
    | The throttle setting is the number of seconds a user must wait before generating
    | more password reset tokens, preventing a very large amount being generated quickly.
    |
    */

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table' => env('AUTH_PASSWORD_RESET_TOKEN_TABLE', 'password_reset_tokens'),
            'expire' => 60,
            'throttle' => 60,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Password Confirmation Timeout
    |--------------------------------------------------------------------------
    |
    | The number of seconds before a password confirmation window expires and users
    | must re-enter their password via the confirmation screen. Three hours by default.
    |
    */

    'password_timeout' => env('AUTH_PASSWORD_TIMEOUT', 10800),

];

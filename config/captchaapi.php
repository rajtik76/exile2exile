<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Enabled
    |--------------------------------------------------------------------------
    |
    | Master kill-switch for the package. When false, the `ValidCaptcha`
    | rule passes silently and `<x-captchaapi::widget />` renders nothing —
    | a single env var to drop captcha protection in local development, CI,
    | staging, or during an incident without touching wiring or templates.
    |
    */

    'enabled' => (bool) env('CAPTCHAAPI_ENABLED', true),

    /*
    |--------------------------------------------------------------------------
    | Site key
    |--------------------------------------------------------------------------
    |
    | Public site key from https://captchaapi.eu/dashboard. Safe to expose
    | in the browser.
    |
    */

    'site_key' => env('CAPTCHAAPI_SITE_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Secret key
    |--------------------------------------------------------------------------
    |
    | Sent as a Bearer token when your backend verifies a response. Keep it
    | server-side. Rotate it from the dashboard: while a rotation is pending the
    | server accepts both keys, so your deploy needs no precise cutover.
    |
    */

    'secret_key' => env('CAPTCHAAPI_SECRET_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Base URL
    |--------------------------------------------------------------------------
    |
    | API origin for both the widget script and the verify call. Override
    | only when self-hosting or proxying. Defaults to https://captchaapi.eu.
    |
    */

    'base_url' => env('CAPTCHAAPI_BASE_URL'),

    /*
    |--------------------------------------------------------------------------
    | Verify timeout
    |--------------------------------------------------------------------------
    |
    | Seconds to wait for the verify call before treating the server as
    | unreachable and applying the fail policy below.
    |
    */

    'timeout' => (int) env('CAPTCHAAPI_VERIFY_TIMEOUT', 5),

    /*
    |--------------------------------------------------------------------------
    | Fail policy
    |--------------------------------------------------------------------------
    |
    | What happens when the verify call cannot reach a verdict — the server
    | is unreachable or returns a 5xx. With fail_open true (the default), the
    | submission is allowed through: a captcha guards a public form, and your
    | own outage blocking every submission is worse than the rare bot slipping
    | past during it. Set false for sensitive actions (login, payment) where a
    | missed bot costs more than a blocked visitor; the visitor is then asked
    | to try again, never told they failed the captcha. An attacker cannot
    | reach this path — verification is server-to-server, off the browser.
    |
    */

    'fail_open' => (bool) env('CAPTCHAAPI_FAIL_OPEN', true),

    /*
    |--------------------------------------------------------------------------
    | Locale
    |--------------------------------------------------------------------------
    |
    | Force the widget UI language. The package ships server-side validation
    | translations for `en` and `cs`; the widget itself supports more. When
    | null, falls back to <html lang>, then English.
    |
    */

    'locale' => env('CAPTCHAAPI_LOCALE'),

    /*
    |--------------------------------------------------------------------------
    | Preload mode
    |--------------------------------------------------------------------------
    |
    | 'lazy' (default) waits for first form interaction; 'eager' fires the
    | challenge on page load (snappier submit, costs one challenge per view).
    |
    */

    'preload' => env('CAPTCHAAPI_PRELOAD', 'lazy'),

    /*
    |--------------------------------------------------------------------------
    | Debug mode
    |--------------------------------------------------------------------------
    |
    | Logs widget timing breakdown to the browser console.
    |
    */

    'debug' => (bool) env('CAPTCHAAPI_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | Submit mode
    |--------------------------------------------------------------------------
    |
    | 'submit' (widget default) calls native form.submit() after solving;
    | 'event' dispatches a captchaapi:solved CustomEvent instead — needed for
    | Livewire / Inertia / htmx / fetch flows. Per-form data-captcha-mode
    | attributes always win.
    |
    */

    'mode' => env('CAPTCHAAPI_MODE'),

];

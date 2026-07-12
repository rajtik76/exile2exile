<?php

use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\StatsBasicAuth;
use App\Http\Middleware\TrackPageView;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Behind Coolify's Traefik reverse proxy (TLS terminated upstream).
        // Trust forwarded headers so generated URLs use https, not http://host:8080.
        $middleware->trustProxies(at: '*');

        // No login page yet (arrives via the PoE account / OAuth).
        // Send guests who hit an authed route back to the public home instead.
        $middleware->redirectGuestsTo('/');

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // RFC 8058 one-click unsubscribe: mail providers POST to the signed
        // link server-to-server, with no session and no CSRF token. The route
        // stays protected by its URL signature instead.
        $middleware->validateCsrfTokens(except: ['newsletter/unsubscribe/*']);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            TrackPageView::class,
        ]);

        // HTTP Basic Auth gate for the first-party /stats dashboard.
        $middleware->alias(['stats.auth' => StatsBasicAuth::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Precognitive live-validation requests (e.g. the build import form)
        // need their validation errors as JSON, not a redirect.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->isAttemptingPrecognition(),
        );

        // Render the branded Atlas error page (Inertia `error`) for the HTTP
        // statuses a visitor might actually land on. 500s stay on the default
        // debug page locally so the stack trace is not hidden while developing.
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            $status = $response->getStatusCode();
            $branded = [403, 404, 419, 500, 503];

            if ($request->isAttemptingPrecognition() || $request->is('api/*')) {
                return $response;
            }

            if ($status === 500 && app()->hasDebugModeEnabled()) {
                return $response;
            }

            if (! in_array($status, $branded, true)) {
                return $response;
            }

            return Inertia::render('error', ['status' => $status])
                ->toResponse($request)
                ->setStatusCode($status);
        });
    })->create();

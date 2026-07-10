<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the analytics dashboard with HTTP Basic Auth. There is no login system
 * yet, so the single operator credential lives in the environment
 * (STATS_USER / STATS_PASS) rather than the users table.
 */
class StatsBasicAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = Config::string('analytics.user');
        $pass = Config::string('analytics.password');

        // An unconfigured credential must never fall open to an empty login.
        $configured = $user !== '' && $pass !== '';
        $matches = hash_equals($user, (string) $request->getUser())
            && hash_equals($pass, (string) $request->getPassword());

        if (! $configured || ! $matches) {
            return response('Unauthorized', Response::HTTP_UNAUTHORIZED, [
                'WWW-Authenticate' => 'Basic realm="Stats"',
            ]);
        }

        return $next($request);
    }
}

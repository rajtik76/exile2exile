<?php

namespace App\Http\Middleware;

use App\Models\PageView;
use App\Support\DeviceType;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Jaybizzle\CrawlerDetect\CrawlerDetect;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * First-party, cookieless page-view tracking. Records one row per successful
 * GET page load (cold or Inertia SPA navigation), excluding crawlers and the
 * analytics dashboard itself.
 *
 * Runs as a terminable middleware so the write happens after the response is
 * flushed to the client - the visitor never waits on it. The raw IP is hashed
 * with the app key and the date and discarded, so no personal data is stored.
 */
class TrackPageView
{
    /**
     * Paths excluded from tracking: the dashboard, one-shot result/redirect
     * endpoints, the health check and the local-only test harness.
     *
     * @var list<string>
     */
    private const array EXCLUDED = ['stats', 'stats/*', 'up', '__test/*'];

    /**
     * Handle an incoming request. Tracking itself is deferred to terminate().
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    /**
     * Record the view after the response has been sent to the browser.
     */
    public function terminate(Request $request, Response $response): void
    {
        if (! $this->shouldTrack($request, $response)) {
            return;
        }

        try {
            PageView::query()->create([
                'path' => $request->path(),
                'referrer' => $request->headers->get('referer'),
                'visitor' => $this->visitorHash($request),
                'inertia' => $request->headers->has('X-Inertia'),
                'device' => DeviceType::fromUserAgent($request->userAgent())->value,
            ]);
        } catch (Throwable) {
            // Analytics must never break a request that already succeeded.
        }
    }

    /**
     * Track only successful GET page loads from real browsers.
     */
    private function shouldTrack(Request $request, Response $response): bool
    {
        return $request->isMethod('GET')
            && $response->isSuccessful()
            && ! $request->is(...self::EXCLUDED)
            && ! (new CrawlerDetect)->isCrawler($request->userAgent());
    }

    /**
     * Pseudonymous per-day visitor key. Salting with the app key stops the hash
     * being reversed by brute-forcing IP + user agent; rotating it daily keeps
     * the value from being a stable cross-day identifier.
     */
    private function visitorHash(Request $request): string
    {
        return hash('xxh128', implode('|', [
            $request->ip(),
            $request->userAgent() ?? '',
            now()->format('Y-m-d'),
            Config::string('app.key'),
        ]));
    }
}

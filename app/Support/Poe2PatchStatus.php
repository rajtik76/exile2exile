<?php

namespace App\Support;

use App\Models\PatchRelease;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * The public-facing patch status: the current PoE2 version and when we last
 * polled the patch server. Written by the watcher on every poll, read by the
 * Inertia middleware to feed the nav read-out - a cache hit on every request,
 * never a query once the watcher has run.
 */
class Poe2PatchStatus
{
    private const string CACHE_KEY = 'poe2:patch:status';

    public function __construct(private readonly Cache $cache) {}

    /**
     * Record that the patch server was just polled, with the raw version it
     * reported. Stored forever; superseded on the next poll.
     */
    public function record(string $rawVersion): void
    {
        // The release time is when we first saw this version - the PatchRelease
        // row the watcher creates on detection. Resolve it here (the watcher
        // path, every few minutes), so the web request only reads the cache.
        $release = PatchRelease::query()->where('version', $rawVersion)->first();
        $releasedAt = $release !== null ? $release->created_at : now();

        $this->cache->forever(self::CACHE_KEY, [
            'version' => $rawVersion,
            'checked_at' => now()->toIso8601String(),
            'released_at' => $releasedAt->toIso8601String(),
        ]);
    }

    /**
     * The current status for display, or null before the first poll.
     *
     * @return array{version: string, checkedAt: string, releasedAt: string}|null
     */
    public function current(): ?array
    {
        $status = $this->cache->get(self::CACHE_KEY);

        if (is_array($status)) {
            // `released_at` is absent until the watcher next runs after a deploy
            // that predates this field; fall back to the version's release row.
            $releasedAt = $status['released_at']
                ?? PatchRelease::query()
                    ->where('version', $status['version'])
                    ->first()?->created_at?->toIso8601String()
                ?? $status['checked_at'];

            return [
                'version' => Poe2Version::display($status['version']),
                'checkedAt' => $status['checked_at'],
                'releasedAt' => $releasedAt,
            ];
        }

        // Cold cache (fresh deploy before the first poll): fall back to the last
        // recorded release. We never observed the poll time, so the release
        // timestamp is the best stand-in for both.
        $release = PatchRelease::query()->latest('id')->first();

        if ($release === null) {
            return null;
        }

        $releasedAt = $release->created_at?->toIso8601String() ?? now()->toIso8601String();

        return [
            'version' => Poe2Version::display($release->version),
            'checkedAt' => $releasedAt,
            'releasedAt' => $releasedAt,
        ];
    }
}

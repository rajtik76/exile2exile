<?php

declare(strict_types=1);

namespace App\Pob\Decoding;

use App\Pob\Data\BuildSnapshot;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Caches decoded snapshots for a week so a given build code is parsed at most once
 * per week across all requests and users, which also bounds the store's growth.
 * Safe because decoding is a pure function of the code:
 * the key is a checksum of the code plus the data version and snapshot schema
 * version, so edited builds, a new league, or a changed snapshot shape all yield
 * a different key.
 *
 * As a backstop, a cached value that is not a {@see BuildSnapshot} (e.g. an
 * incompatible entry left by older code) is treated as a miss and re-decoded.
 * Decode failures are not cached - they propagate to the caller (the validator),
 * which turns them into an "invalid data" verdict.
 */
final readonly class CachingBuildDecoder implements BuildDecoder
{
    public function __construct(
        private BuildDecoder $decoder,
        private Cache $cache,
        private string $dataVersion,
    ) {}

    public function import(string $code): BuildSnapshot
    {
        $key = sprintf(
            'pob.snapshot:%s:%d:%s',
            $this->dataVersion,
            BuildSnapshot::SCHEMA_VERSION,
            sha1($code),
        );

        $cached = $this->cache->get($key);

        if ($cached instanceof BuildSnapshot) {
            return $cached;
        }

        $snapshot = $this->decoder->import($code);
        $this->cache->put($key, $snapshot, now()->addWeek());

        return $snapshot;
    }
}

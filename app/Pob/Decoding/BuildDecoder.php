<?php

declare(strict_types=1);

namespace App\Pob\Decoding;

use App\Pob\Data\BuildSnapshot;

/**
 * Turns a canonical PoB export code into a {@see BuildSnapshot}.
 *
 * A pure function of the code (for a given parser + bundled data), which is what
 * makes a content-addressed cache safe - see {@see CachingBuildDecoder}.
 */
interface BuildDecoder
{
    /**
     * @throws \Throwable when the code cannot be decoded (corrupt, unsupported).
     */
    public function import(string $code): BuildSnapshot;
}

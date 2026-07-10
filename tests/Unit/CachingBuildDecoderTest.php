<?php

declare(strict_types=1);

use App\Pob\Data\BuildSnapshot;
use App\Pob\Data\CharacterClass;
use App\Pob\Decoding\BuildDecoder;
use App\Pob\Decoding\CachingBuildDecoder;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository;

function snapshot(): BuildSnapshot
{
    return new BuildSnapshot(
        level: 1,
        class: CharacterClass::Mercenary,
        ascendancy: null,
        classId: 0,
        treeVersion: '0_5',
        passiveNodes: [],
        skillGroups: [],
        items: [],
    );
}

/**
 * A decoder that counts how often it actually decodes, to prove caching.
 */
function countingDecoder(): BuildDecoder
{
    return new class implements BuildDecoder
    {
        public int $calls = 0;

        public function import(string $code): BuildSnapshot
        {
            $this->calls++;

            return snapshot();
        }
    };
}

it('decodes once and serves repeats from cache', function () {
    $inner = countingDecoder();
    $decoder = new CachingBuildDecoder($inner, new Repository(new ArrayStore), 'test');

    $decoder->import('abc');
    $decoder->import('abc');

    expect($inner->calls)->toBe(1);
});

it('re-decodes when the cached value is not a snapshot', function () {
    $inner = countingDecoder();
    $cache = new Repository(new ArrayStore);
    $decoder = new CachingBuildDecoder($inner, $cache, 'test');

    // Simulate an incompatible entry left by older code under the same key.
    $key = sprintf('pob.snapshot:test:%d:%s', BuildSnapshot::SCHEMA_VERSION, sha1('abc'));
    $cache->forever($key, ['not' => 'a snapshot']);

    $result = $decoder->import('abc');

    expect($result)->toBeInstanceOf(BuildSnapshot::class)
        ->and($inner->calls)->toBe(1);
});

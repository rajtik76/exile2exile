<?php

declare(strict_types=1);

namespace App\Pob\Source;

use App\Pob\Data\BuildSnapshot;
use App\Pob\Decoding\BuildDecoder;

/**
 * Base for any source that ultimately yields a Path of Building 2 export code.
 *
 * It does one thing: turn this source's input into a PoB code, then hand it to
 * the shared {@see BuildDecoder} (which owns caching). Each subclass only has to
 * recognise its input and extract the code from it.
 */
abstract class PobCodeSource implements BuildSource
{
    public function __construct(protected readonly BuildDecoder $decoder) {}

    abstract public function supports(string $input): bool;

    /**
     * Extract the raw PoB export code from this source's input, fetching it
     * remotely if necessary.
     *
     * @throws \InvalidArgumentException when the code cannot be obtained.
     */
    abstract protected function fetchCode(string $input): string;

    public function import(string $input): BuildSnapshot
    {
        return $this->decoder->import($this->resolveCode($input));
    }

    /**
     * Resolve this source's input to a raw PoB export code (fetching remotely if
     * necessary), without decoding it. Lets callers persist the canonical code
     * and re-decode later.
     *
     * @throws \InvalidArgumentException when the code cannot be obtained.
     */
    public function resolveCode(string $input): string
    {
        return $this->fetchCode($input);
    }
}

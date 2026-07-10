<?php

declare(strict_types=1);

namespace App\Pob\Source;

use App\Pob\Data\BuildSnapshot;
use App\Pob\Validation\BuildValidator;
use InvalidArgumentException;

/**
 * A single place a build can be imported from (a raw PoB code, a pobb.in link,
 * a poe.ninja character, a guide page, …).
 *
 * A source has one responsibility: recognise its own input and decode it into
 * the canonical snapshot. Whether the decoded build is *valid* (current tree,
 * known gems) is decided one layer up - see {@see BuildValidator}.
 */
interface BuildSource
{
    /**
     * Whether this source recognises the given input as its own.
     */
    public function supports(string $input): bool;

    /**
     * Decode the input into the canonical, source-agnostic snapshot.
     *
     * @throws InvalidArgumentException when the input cannot be resolved or decoded.
     */
    public function import(string $input): BuildSnapshot;
}

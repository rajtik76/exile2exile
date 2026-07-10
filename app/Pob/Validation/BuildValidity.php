<?php

declare(strict_types=1);

namespace App\Pob\Validation;

use App\Pob\Data\BuildSnapshot;

/**
 * Outcome of validating one build: whether it can be used (decoded cleanly and
 * sits entirely on the current league's data), the reasons it cannot, and the
 * decoded snapshot when valid (so callers need not decode again).
 */
final readonly class BuildValidity
{
    /**
     * @param  list<string>  $errors
     */
    private function __construct(
        public bool $valid,
        public array $errors,
        public ?BuildSnapshot $snapshot,
    ) {}

    public static function valid(BuildSnapshot $snapshot): self
    {
        return new self(true, [], $snapshot);
    }

    /**
     * @param  list<string>  $errors
     */
    public static function invalid(array $errors): self
    {
        return new self(false, $errors, null);
    }
}

<?php

declare(strict_types=1);

namespace App\Pob\Data;

/**
 * A socket / link group: one or more active skills plus their support gems.
 */
final readonly class GemGroup
{
    /**
     * @param  list<Gem>  $gems
     */
    public function __construct(
        public string $label,
        public array $gems,
    ) {}

    /**
     * @return array{label: string, gems: list<array<string, mixed>>}
     */
    public function toArray(): array
    {
        return [
            'label' => $this->label,
            'gems' => array_map(static fn (Gem $gem): array => $gem->toArray(), $this->gems),
        ];
    }
}

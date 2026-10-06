<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

/**
 * Which of an item's PoB variants are picked: the same choices PoB stores on an item as
 * `Selected Variant`, `Selected Alt Variant` (up to `Five`), `Selected Version` and
 * `Selected Variant Group`. Ids are 1-based, as in PoB. Always normalised against a
 * {@see PobItemVariants} before use, so every field here is a valid pick for that item.
 */
final readonly class VariantSelection
{
    /**
     * @param  array<int, int>  $alts  alt slot (1-5) => variant id
     * @param  array<int, int>  $groups  group id => variant id
     */
    public function __construct(
        public ?int $variant = null,
        public array $alts = [],
        public ?int $version = null,
        public array $groups = [],
    ) {}

    /**
     * Read an untrusted stored or submitted selection. Anything malformed is dropped, so
     * normalising the result against the item falls back to PoB's default for that axis.
     */
    public static function fromArray(mixed $raw): self
    {
        if (! is_array($raw)) {
            return new self;
        }

        return new self(
            variant: self::positiveInt($raw['variant'] ?? null),
            alts: self::intMap($raw['alts'] ?? null),
            version: self::positiveInt($raw['version'] ?? null),
            groups: self::intMap($raw['groups'] ?? null),
        );
    }

    /**
     * @return array{variant?: int, alts?: array<int, int>, version?: int, groups?: array<int, int>}
     */
    public function toArray(): array
    {
        return array_filter([
            'variant' => $this->variant,
            'alts' => $this->alts,
            'version' => $this->version,
            'groups' => $this->groups,
        ], static fn (mixed $value): bool => $value !== null && $value !== []);
    }

    private static function positiveInt(mixed $value): ?int
    {
        return is_numeric($value) && (int) $value >= 1 ? (int) $value : null;
    }

    /**
     * @return array<int, int>
     */
    private static function intMap(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $map = [];

        foreach ($raw as $key => $value) {
            $id = self::positiveInt($key);
            $variant = self::positiveInt($value);

            if ($id !== null && $variant !== null) {
                $map[$id] = $variant;
            }
        }

        ksort($map);

        return $map;
    }
}

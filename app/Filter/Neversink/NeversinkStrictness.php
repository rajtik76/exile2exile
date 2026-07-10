<?php

declare(strict_types=1);

namespace App\Filter\Neversink;

/**
 * NeverSink's seven strictness levels, kept 1:1. Higher levels hide more clutter (NeverSink
 * switches on more hide layers as the number rises). Each maps to a vendored filter file
 * (resources/neversink/filters/<style>/<value>.filter). The backing value is the slug in the
 * download URL (`?strictness=3-strict`) and the vendored file name.
 */
enum NeversinkStrictness: string
{
    case Soft = '0-soft';
    case Regular = '1-regular';
    case SemiStrict = '2-semi-strict';
    case Strict = '3-strict';
    case VeryStrict = '4-very-strict';
    case UberStrict = '5-uber-strict';
    case UberPlusStrict = '6-uber-plus-strict';

    public static function default(): self
    {
        return self::Regular;
    }

    public function label(): string
    {
        return match ($this) {
            self::Soft => 'Soft',
            self::Regular => 'Regular',
            self::SemiStrict => 'Semi-strict',
            self::Strict => 'Strict',
            self::VeryStrict => 'Very strict',
            self::UberStrict => 'Uber strict',
            self::UberPlusStrict => 'Uber-plus strict',
        };
    }

    /** The 0-6 order, for the picker's intensity scale. */
    public function level(): int
    {
        return (int) explode('-', $this->value, 2)[0];
    }

    /**
     * A frontend-friendly view of every level for the strictness picker.
     *
     * @return list<array{value: string, label: string, level: int}>
     */
    public static function all(): array
    {
        return array_map(static fn (self $level): array => [
            'value' => $level->value,
            'label' => $level->label(),
            'level' => $level->level(),
        ], self::cases());
    }
}

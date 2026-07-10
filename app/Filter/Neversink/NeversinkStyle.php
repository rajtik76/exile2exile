<?php

declare(strict_types=1);

namespace App\Filter\Neversink;

/**
 * A NeverSink filter STYLE variant, used as the loot filter's colour theme. Each maps to a
 * vendored NeverSink filter set (see resources/neversink/filters/<value>); the design,
 * colours, sounds and effects are NeverSink's, kept 1:1. The backing value is both the slug
 * in the download URL (`?theme=cobalt`) and the vendored directory name.
 */
enum NeversinkStyle: string
{
    case Default = 'default';
    case Cobalt = 'cobalt';
    case Darkmode = 'darkmode';
    case Mythic = 'mythic';
    case Vaal = 'vaal';
    case Zen = 'zen';
    case Aura = 'aura';

    public static function default(): self
    {
        return self::Default;
    }

    public function label(): string
    {
        return match ($this) {
            self::Default => 'Default',
            self::Cobalt => 'Cobalt',
            self::Darkmode => 'Dark mode',
            self::Mythic => 'Mythic',
            self::Vaal => 'Vaal',
            self::Zen => 'Zen',
            self::Aura => 'Aura',
        };
    }

    /** A representative colour for the picker swatch (a hint, not read by the generator). */
    public function swatch(): string
    {
        return match ($this) {
            self::Default => '#c8964b',
            self::Cobalt => '#4682dc',
            self::Darkmode => '#6b7280',
            self::Mythic => '#a855f7',
            self::Vaal => '#c0392b',
            self::Zen => '#4ea86b',
            self::Aura => '#22d3ee',
        };
    }

    /**
     * A frontend-friendly view of every style for the theme picker.
     *
     * @return list<array{value: string, label: string, swatch: string}>
     */
    public static function all(): array
    {
        return array_map(static fn (self $style): array => [
            'value' => $style->value,
            'label' => $style->label(),
            'swatch' => $style->swatch(),
        ], self::cases());
    }
}

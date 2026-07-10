<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * Factory for every {@see Action} the generator emits, naming the styling intent
 * (textColor, minimapIcon, beam) so the correct keyword and argument shape is always
 * produced.
 */
final class Actions
{
    public static function textColor(Color $color): Action
    {
        return new ColorAction('SetTextColor', $color);
    }

    public static function borderColor(Color $color): Action
    {
        return new ColorAction('SetBorderColor', $color);
    }

    public static function backgroundColor(Color $color): Action
    {
        return new ColorAction('SetBackgroundColor', $color);
    }

    public static function fontSize(int $size): Action
    {
        return new FontSizeAction($size);
    }

    public static function minimapIcon(int $size, FilterColor $color, MinimapShape $shape): Action
    {
        return new MinimapIconAction($size, $color, $shape);
    }

    public static function beam(FilterColor $color, bool $temporary = false): Action
    {
        return new BeamAction($color, $temporary);
    }

    public static function alertSound(int $id, ?int $volume = null): Action
    {
        return new AlertSoundAction($id, $volume);
    }

    public static function disableDropSound(): Action
    {
        return new ToggleAction('DisableDropSound');
    }

    /** A styling line carried verbatim (used to reuse another filter's exact style). */
    public static function raw(string $line): Action
    {
        return new RawAction($line);
    }

    public static function enableDropSound(): Action
    {
        return new ToggleAction('EnableDropSound');
    }
}

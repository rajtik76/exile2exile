<?php

declare(strict_types=1);

namespace App\Pob\Data;

use InvalidArgumentException;

/**
 * A Path of Exile 2 base class, backed by the exact name PoB writes into
 * <Build className="…">. The canonical set mirrors the class portrait sheet
 * (resources/js/components/build/classPortrait.tsx).
 */
enum CharacterClass: string
{
    case Warrior = 'Warrior';
    case Ranger = 'Ranger';
    case Witch = 'Witch';
    case Mercenary = 'Mercenary';
    case Monk = 'Monk';
    case Sorceress = 'Sorceress';
    case Huntress = 'Huntress';
    case Druid = 'Druid';

    /**
     * Resolve PoB's className attribute to a class.
     *
     * @throws InvalidArgumentException when the name is not a known PoE2 class.
     */
    public static function fromName(string $name): self
    {
        return self::tryFrom(trim($name))
            ?? throw new InvalidArgumentException("Unknown character class \"{$name}\".");
    }
}

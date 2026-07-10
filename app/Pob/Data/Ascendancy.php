<?php

declare(strict_types=1);

namespace App\Pob\Data;

use InvalidArgumentException;

/**
 * A Path of Exile 2 ascendancy, backed by the exact name PoB writes into
 * <Build ascendClassName="…">. Each case knows the {@see CharacterClass} it
 * belongs to. The set mirrors the class portrait sheet
 * (resources/js/components/build/classPortrait.tsx).
 */
enum Ascendancy: string
{
    // Warrior
    case Titan = 'Titan';
    case Warbringer = 'Warbringer';
    case SmithOfKitava = 'Smith of Kitava';

    // Witch
    case Infernalist = 'Infernalist';
    case BloodMage = 'Blood Mage';
    case Lich = 'Lich';
    case AbyssalLich = 'Abyssal Lich';

    // Ranger
    case Deadeye = 'Deadeye';
    case Pathfinder = 'Pathfinder';

    // Sorceress
    case Stormweaver = 'Stormweaver';
    case Chronomancer = 'Chronomancer';
    case DiscipleOfVarashta = 'Disciple of Varashta';

    // Huntress
    case Amazon = 'Amazon';
    case SpiritWalker = 'Spirit Walker';
    case Ritualist = 'Ritualist';

    // Mercenary
    case Tactician = 'Tactician';
    case Witchhunter = 'Witchhunter';
    case GemlingLegionnaire = 'Gemling Legionnaire';

    // Monk
    case MartialArtist = 'Martial Artist';
    case Invoker = 'Invoker';
    case AcolyteOfChayula = 'Acolyte of Chayula';

    // Druid
    case Oracle = 'Oracle';
    case Shaman = 'Shaman';

    /**
     * The base class this ascendancy belongs to.
     */
    public function characterClass(): CharacterClass
    {
        return match ($this) {
            self::Titan, self::Warbringer, self::SmithOfKitava => CharacterClass::Warrior,
            self::Infernalist, self::BloodMage, self::Lich, self::AbyssalLich => CharacterClass::Witch,
            self::Deadeye, self::Pathfinder => CharacterClass::Ranger,
            self::Stormweaver, self::Chronomancer, self::DiscipleOfVarashta => CharacterClass::Sorceress,
            self::Amazon, self::SpiritWalker, self::Ritualist => CharacterClass::Huntress,
            self::Tactician, self::Witchhunter, self::GemlingLegionnaire => CharacterClass::Mercenary,
            self::MartialArtist, self::Invoker, self::AcolyteOfChayula => CharacterClass::Monk,
            self::Oracle, self::Shaman => CharacterClass::Druid,
        };
    }

    /**
     * Resolve PoB's ascendClassName attribute, treating an empty value or the
     * sentinel "None" as "not yet ascended".
     *
     * @throws InvalidArgumentException when a non-empty name is not a known ascendancy.
     */
    public static function tryFromName(?string $name): ?self
    {
        $name = trim((string) $name);

        if ($name === '' || $name === 'None') {
            return null;
        }

        return self::tryFrom($name)
            ?? throw new InvalidArgumentException("Unknown ascendancy \"{$name}\".");
    }
}

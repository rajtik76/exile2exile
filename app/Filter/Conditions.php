<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * Factory for every {@see Condition} the generator emits. Callers name the property they
 * mean (itemLevel, baseArmour, hasExplicitMod) and the correct keyword + shape is built
 * for them, so a filter can never be assembled from a mistyped keyword or a keyword paired
 * with the wrong value shape.
 */
final class Conditions
{
    /** `Class == "a" "b"` - the item's class is one of the given names. */
    public static function itemClass(string ...$names): Condition
    {
        return new TextListCondition('Class', Operator::Equals, ...$names);
    }

    /** `BaseType == "a" "b"` - the item's base type is one of the given names. */
    public static function baseType(string ...$names): Condition
    {
        return new TextListCondition('BaseType', Operator::Equals, ...$names);
    }

    public static function rarity(Rarity ...$rarities): Condition
    {
        return new RarityCondition(...$rarities);
    }

    public static function itemLevel(Operator $operator, int $value): Condition
    {
        return new NumericCondition('ItemLevel', $operator, $value);
    }

    public static function areaLevel(Operator $operator, int $value): Condition
    {
        return new NumericCondition('AreaLevel', $operator, $value);
    }

    /** `DropLevel <op> n` - the base type's own drop level, used for the leveling hide stairs. */
    public static function dropLevel(Operator $operator, int $value): Condition
    {
        return new NumericCondition('DropLevel', $operator, $value);
    }

    public static function stackSize(Operator $operator, int $value): Condition
    {
        return new NumericCondition('StackSize', $operator, $value);
    }

    public static function quality(Operator $operator, int $value): Condition
    {
        return new NumericCondition('Quality', $operator, $value);
    }

    public static function sockets(Operator $operator, int $value): Condition
    {
        return new NumericCondition('Sockets', $operator, $value);
    }

    /** `UnidentifiedItemTier >= n` - the game's aggregate quality of an unidentified item (higher is better). */
    public static function unidentifiedItemTier(Operator $operator, int $value): Condition
    {
        return new NumericCondition('UnidentifiedItemTier', $operator, $value);
    }

    public static function baseArmour(Operator $operator, int $value): Condition
    {
        return new NumericCondition('BaseArmour', $operator, $value);
    }

    public static function baseEvasion(Operator $operator, int $value): Condition
    {
        return new NumericCondition('BaseEvasion', $operator, $value);
    }

    public static function baseEnergyShield(Operator $operator, int $value): Condition
    {
        return new NumericCondition('BaseEnergyShield', $operator, $value);
    }

    public static function gemLevel(Operator $operator, int $value): Condition
    {
        return new NumericCondition('GemLevel', $operator, $value);
    }

    public static function waystoneTier(Operator $operator, int $value): Condition
    {
        return new NumericCondition('WaystoneTier', $operator, $value);
    }

    public static function width(Operator $operator, int $value): Condition
    {
        return new NumericCondition('Width', $operator, $value);
    }

    public static function height(Operator $operator, int $value): Condition
    {
        return new NumericCondition('Height', $operator, $value);
    }

    public static function identified(bool $value): Condition
    {
        return new FlagCondition('Identified', $value);
    }

    public static function corrupted(bool $value): Condition
    {
        return new FlagCondition('Corrupted', $value);
    }

    public static function mirrored(bool $value): Condition
    {
        return new FlagCondition('Mirrored', $value);
    }

    public static function anyEnchantment(bool $value): Condition
    {
        return new FlagCondition('AnyEnchantment', $value);
    }

    /** `HasExplicitMod >=n "a" "b"` - an identified item carrying (a count of) the named affixes. */
    public static function hasExplicitMod(Operator $operator, int $count, string ...$affixes): Condition
    {
        return new ModCondition($operator, $count, ...$affixes);
    }
}

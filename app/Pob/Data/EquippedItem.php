<?php

declare(strict_types=1);

namespace App\Pob\Data;

/**
 * An equipped item, normalized from PoB's raw item text block.
 */
final readonly class EquippedItem
{
    /**
     * @param  list<string>  $mods  Implicit mods first, then explicit, in source order.
     * @param  ?string  $icon  Web path to the item icon, or null when art is unavailable.
     * @param  bool  $twoHanded  Whether this is a two-handed weapon (occupies the off-hand).
     * @param  list<array{name: string, icon: ?string, levelRequirement: ?int, effects: list<string>}>  $runes  Runes socketed into the item.
     */
    public function __construct(
        public string $slot,
        public string $rarity,
        public string $name,
        public string $baseType,
        public ?int $itemLevel,
        public int $implicitsCount,
        public array $mods,
        public ?string $icon = null,
        public bool $twoHanded = false,
        public ?string $itemClass = null,
        public ?int $levelRequirement = null,
        public array $runes = [],
        public ?int $requiredStrength = null,
        public ?int $requiredDexterity = null,
        public ?int $requiredIntelligence = null,
        public ?int $quality = null,
        public ?int $armour = null,
        public ?int $evasion = null,
        public ?int $energyShield = null,
        public ?int $block = null,
    ) {}

    /**
     * @return list<string>
     */
    public function implicitMods(): array
    {
        return array_slice($this->mods, 0, $this->boundedImplicits());
    }

    /**
     * @return list<string>
     */
    public function explicitMods(): array
    {
        return array_slice($this->mods, $this->boundedImplicits());
    }

    /**
     * The implicit count clamped to the real mod-line count, so a malformed
     * "Implicits: N" (negative or over-range) can't misclassify every mod line.
     */
    private function boundedImplicits(): int
    {
        return max(0, min($this->implicitsCount, count($this->mods)));
    }

    /**
     * @return array{
     *     slot: string,
     *     rarity: string,
     *     name: string,
     *     baseType: string,
     *     itemLevel: ?int,
     *     icon: ?string,
     *     twoHanded: bool,
     *     itemClass: ?string,
     *     levelRequirement: ?int,
     *     requiredStrength: ?int,
     *     requiredDexterity: ?int,
     *     requiredIntelligence: ?int,
     *     quality: ?int,
     *     armour: ?int,
     *     evasion: ?int,
     *     energyShield: ?int,
     *     block: ?int,
     *     runes: list<array{name: string, icon: ?string, levelRequirement: ?int, effects: list<string>}>,
     *     implicitMods: list<string>,
     *     explicitMods: list<string>,
     * }
     */
    public function toArray(): array
    {
        return [
            'slot' => $this->slot,
            'rarity' => $this->rarity,
            'name' => $this->name,
            'baseType' => $this->baseType,
            'itemLevel' => $this->itemLevel,
            'icon' => $this->icon,
            'twoHanded' => $this->twoHanded,
            'itemClass' => $this->itemClass,
            'levelRequirement' => $this->levelRequirement,
            'requiredStrength' => $this->requiredStrength,
            'requiredDexterity' => $this->requiredDexterity,
            'requiredIntelligence' => $this->requiredIntelligence,
            'quality' => $this->quality,
            'armour' => $this->armour,
            'evasion' => $this->evasion,
            'energyShield' => $this->energyShield,
            'block' => $this->block,
            'runes' => $this->runes,
            'implicitMods' => $this->implicitMods(),
            'explicitMods' => $this->explicitMods(),
        ];
    }
}

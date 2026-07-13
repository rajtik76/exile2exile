<?php

declare(strict_types=1);

namespace App\Pob;

use App\Pob\Data\Ascendancy;
use App\Pob\Data\BuildSnapshot;
use App\Pob\Data\CharacterClass;
use App\Pob\Data\EquippedItem;
use App\Pob\Data\Gem;
use App\Pob\Data\GemGroup;
use App\Pob\Decoding\BuildDecoder;
use InvalidArgumentException;
use SimpleXMLElement;

/**
 * Decodes a Path of Building 2 export code into a canonical {@see BuildSnapshot}.
 *
 * Export format: URL-safe base64 -> zlib (deflate) -> XML rooted at <PathOfBuilding2>.
 */
final class PobImport implements BuildDecoder
{
    /** Largest accepted PoB code (base64). ~7x the largest real endgame build (~14 KB). */
    public const int MAX_CODE_BYTES = 102400;

    /** Largest accepted decoded XML, bounding zlib-bomb expansion (real builds are tens of KB). */
    public const int MAX_DECODED_BYTES = 4194304;

    public function __construct(private ?IconResolver $icons = null) {}

    private function icons(): IconResolver
    {
        return $this->icons ??= new IconResolver;
    }

    public function import(string $code): BuildSnapshot
    {
        return $this->fromXml($this->decode($code));
    }

    /**
     * Decode an export code to its raw XML string.
     */
    public function decode(string $code): string
    {
        $code = trim($code);

        if (strlen($code) > self::MAX_CODE_BYTES) {
            throw new InvalidArgumentException('PoB code is too large.');
        }

        $binary = base64_decode(strtr($code, '-_', '+/'), strict: false);

        if ($binary === '') {
            throw new InvalidArgumentException('PoB code is not valid base64.');
        }

        // Cap the decoded size so a zlib bomb (a tiny code that inflates to gigabytes) is
        // rejected here rather than exhausting memory - an OOM is an uncatchable fatal, so
        // the validator's catch() could not otherwise contain it.
        $xml = @gzuncompress($binary, self::MAX_DECODED_BYTES);

        if ($xml === false) {
            throw new InvalidArgumentException('PoB code could not be zlib-decompressed.');
        }

        return $xml;
    }

    public function fromXml(string $xml): BuildSnapshot
    {
        // LIBXML_NONET blocks any network access during the parse; external-entity loading
        // is off by default in modern libxml, so an untrusted export cannot pull in remote
        // or local resources via XXE.
        $root = @simplexml_load_string($xml, SimpleXMLElement::class, LIBXML_NONET);

        if (! $root instanceof SimpleXMLElement || $root->getName() !== 'PathOfBuilding2') {
            throw new InvalidArgumentException('Decoded XML is not a PathOfBuilding2 document.');
        }

        $build = $root->Build;

        $spec = $this->activeSpec($root);

        if ($spec === null) {
            throw new InvalidArgumentException('This Path of Building export has no passive-tree spec.');
        }

        return new BuildSnapshot(
            level: (int) ($build['level'] ?? 0),
            class: CharacterClass::fromName((string) ($build['className'] ?? '')),
            ascendancy: Ascendancy::tryFromName((string) ($build['ascendClassName'] ?? '')),
            classId: (int) ($spec['classId'] ?? 0),
            treeVersion: (string) ($spec['treeVersion'] ?? ''),
            passiveNodes: $this->parseNodes((string) ($spec['nodes'] ?? '')),
            skillGroups: $this->parseSkillGroups($root),
            items: $this->parseItems($root),
            attributes: $this->parsePlayerAttributes($build),
            attributeNodes: $this->parseAttributeOverrides($spec),
            jewels: $this->parseSocketedJewels($root, $spec),
            weaponSets: $this->parseWeaponSets($spec),
        );
    }

    /**
     * Weapon-set assignment per passive node, from the spec's <WeaponSet1 nodes>
     * and <WeaponSet2 nodes> children (PoB tags set-specific passives there). The
     * node ids also appear in the main `nodes` list; this only records which set
     * each belongs to, so the planner can colour and budget them apart.
     *
     * @return array<int, int>
     */
    private function parseWeaponSets(SimpleXMLElement $spec): array
    {
        $weaponSets = [];

        foreach ([1, 2] as $set) {
            foreach ($this->parseNodes((string) ($spec->{"WeaponSet{$set}"}['nodes'] ?? '')) as $nodeId) {
                $weaponSets[$nodeId] = $set;
            }
        }

        return $weaponSets;
    }

    /**
     * The character's total Strength/Dexterity/Intelligence, read from PoB's
     * calculated <Build><PlayerStat stat="Str|Dex|Int"> values (tree + gear +
     * base already folded in). Absent stats fall back to zero.
     *
     * @return array{str: int, dex: int, int: int}
     */
    private function parsePlayerAttributes(?SimpleXMLElement $build): array
    {
        $attributes = ['str' => 0, 'dex' => 0, 'int' => 0];

        if (! $build instanceof SimpleXMLElement) {
            return $attributes;
        }

        $byStat = [
            'Str' => 'str',
            'Dex' => 'dex',
            'Int' => 'int',
        ];

        foreach ($build->PlayerStat as $stat) {
            $key = $byStat[(string) ($stat['stat'] ?? '')] ?? null;

            if ($key !== null) {
                $attributes[$key] = (int) round((float) ($stat['value'] ?? 0));
            }
        }

        return $attributes;
    }

    private function activeSpec(SimpleXMLElement $root): ?SimpleXMLElement
    {
        $active = (int) ($root->Tree['activeSpec'] ?? 1);
        $specs = $root->Tree->Spec;
        $index = max(0, $active - 1);

        return $specs[$index] ?? $specs[0] ?? null;
    }

    /**
     * @return list<int>
     */
    private function parseNodes(string $nodes): array
    {
        if (trim($nodes) === '') {
            return [];
        }

        return array_values(array_map(
            static fn (string $id): int => (int) trim($id),
            array_filter(explode(',', $nodes), static fn (string $id): bool => trim($id) !== ''),
        ));
    }

    /**
     * Which generic +attribute nodes were assigned to Strength/Dexterity/Intelligence,
     * from <Spec><Overrides><AttributeOverride strNodes dexNodes intNodes>.
     *
     * @return array{str: list<int>, dex: list<int>, int: list<int>}
     */
    private function parseAttributeOverrides(SimpleXMLElement $spec): array
    {
        $override = $spec->Overrides->AttributeOverride ?? null;

        return [
            'str' => $this->parseNodes((string) ($override['strNodes'] ?? '')),
            'dex' => $this->parseNodes((string) ($override['dexNodes'] ?? '')),
            'int' => $this->parseNodes((string) ($override['intNodes'] ?? '')),
        ];
    }

    /**
     * Jewels socketed into the passive tree, keyed by the socket's tree node id,
     * from <Spec><Sockets><Socket nodeId itemId> referencing the build's items.
     *
     * @return array<int, array{name: string, rarity: string, baseType: string, mods: list<string>, icon: ?string}>
     */
    private function parseSocketedJewels(SimpleXMLElement $root, SimpleXMLElement $spec): array
    {
        $sockets = $spec->Sockets->Socket ?? null;

        if ($sockets === null) {
            return [];
        }

        $itemsById = [];

        foreach ($root->Items->Item as $item) {
            $itemsById[(int) ($item['id'] ?? 0)] = (string) $item;
        }

        $jewels = [];

        foreach ($sockets as $socket) {
            $nodeId = (int) ($socket['nodeId'] ?? 0);
            $itemId = (int) ($socket['itemId'] ?? 0);

            if ($nodeId === 0 || $itemId === 0 || ! isset($itemsById[$itemId])) {
                continue;
            }

            $jewel = $this->parseItemText('Jewel', $itemsById[$itemId]);

            $jewels[$nodeId] = [
                'name' => $jewel->name,
                'rarity' => $jewel->rarity,
                'baseType' => $jewel->baseType,
                'mods' => $jewel->mods,
                'icon' => $jewel->icon,
            ];
        }

        return $jewels;
    }

    /**
     * @return list<GemGroup>
     */
    private function parseSkillGroups(SimpleXMLElement $root): array
    {
        $active = (int) ($root->Skills['activeSkillSet'] ?? 1);
        $set = null;

        foreach ($root->Skills->SkillSet as $candidate) {
            if ((int) ($candidate['id'] ?? 0) === $active) {
                $set = $candidate;
                break;
            }
        }

        $set ??= $root->Skills->SkillSet[0] ?? null;

        if (! $set instanceof SimpleXMLElement) {
            return [];
        }

        $groups = [];

        foreach ($set->Skill as $skill) {
            $gems = [];

            foreach ($skill->Gem as $gem) {
                $gemId = (string) ($gem['gemId'] ?? '');
                $skillId = (string) ($gem['skillId'] ?? '');
                $name = (string) ($gem['nameSpec'] ?? '');

                // Skip entries with no gem item: empty socket slots, and innate
                // granted skills (e.g. Thorns) that carry a skillId but no gem
                // to show - they have no name and no icon.
                if ($name === '' && $gemId === '') {
                    continue;
                }

                $normalizedGemId = $gemId !== '' ? $this->normalizeGemId($gemId) : null;

                $gems[] = new Gem(
                    name: $name,
                    skillId: $skillId !== '' ? $skillId : null,
                    gemId: $normalizedGemId,
                    level: (int) ($gem['level'] ?? 1),
                    quality: (int) ($gem['quality'] ?? 0),
                    isSupport: $this->isSupportGem($gemId, $skillId),
                    icon: $this->icons()->gemIcon($normalizedGemId),
                    color: $this->icons()->gemColor($normalizedGemId),
                    category: $this->icons()->gemCategory($normalizedGemId),
                    description: $this->icons()->gemDescription($normalizedGemId),
                    tags: $this->icons()->gemTags($normalizedGemId),
                );
            }

            // A group with only empty sockets carries no gems - drop it.
            if ($gems === []) {
                continue;
            }

            $groups[] = new GemGroup(
                label: (string) ($skill['label'] ?? ''),
                gems: $gems,
            );
        }

        return $groups;
    }

    /**
     * PoB paths are inconsistent (.../Gem/... vs .../Gems/...); the final
     * segment is the stable identifier we match on.
     */
    private function normalizeGemId(string $gemId): string
    {
        $segments = explode('/', $gemId);

        return end($segments) ?: $gemId;
    }

    private function isSupportGem(string $gemId, string $skillId): bool
    {
        return str_contains($gemId, 'SupportGem') || str_starts_with($skillId, 'Support');
    }

    /**
     * @return list<EquippedItem>
     */
    private function parseItems(SimpleXMLElement $root): array
    {
        $itemSet = $this->activeItemSet($root);

        if (! $itemSet instanceof SimpleXMLElement) {
            return [];
        }

        $itemsById = [];

        foreach ($root->Items->Item as $item) {
            $itemsById[(int) ($item['id'] ?? 0)] = (string) $item;
        }

        $equipped = [];

        foreach ($itemSet->Slot as $slot) {
            $itemId = (int) ($slot['itemId'] ?? 0);

            if ($itemId === 0 || ! isset($itemsById[$itemId])) {
                continue;
            }

            $equipped[] = $this->parseItemText((string) ($slot['name'] ?? ''), $itemsById[$itemId]);
        }

        return $equipped;
    }

    private function activeItemSet(SimpleXMLElement $root): ?SimpleXMLElement
    {
        $active = (int) ($root->Items['activeItemSet'] ?? 1);

        foreach ($root->Items->ItemSet as $candidate) {
            if ((int) ($candidate['id'] ?? 0) === $active) {
                return $candidate;
            }
        }

        return $root->Items->ItemSet[0] ?? null;
    }

    /**
     * Parse PoB's raw item text block.
     *
     * Layout: "Rarity: X", then the name. NORMAL items are their own base type;
     * RARE/UNIQUE carry the base type on the next line; MAGIC items have no base
     * line at all (it is embedded in the affixed name). Then key/value metadata,
     * an "Implicits: N" marker, then the mod lines (the first N being implicit).
     */
    private function parseItemText(string $slot, string $text): EquippedItem
    {
        $lines = array_values(array_filter(
            array_map(trim(...), preg_split('/\r\n|\r|\n/', $text) ?: []),
            static fn (string $line): bool => $line !== '',
        ));

        $rarity = strtoupper($this->stripPrefix($lines[0] ?? '', 'Rarity:'));
        $name = $lines[1] ?? '';
        $baseType = $this->resolveBaseType($rarity, $name, $lines[2] ?? '');
        $requirements = $this->icons()->itemRequirements($baseType);

        $implicitsCount = 0;
        $modStart = null;

        foreach ($lines as $i => $line) {
            if (str_starts_with($line, 'Implicits:')) {
                $implicitsCount = (int) trim($this->stripPrefix($line, 'Implicits:'));
                $modStart = $i + 1;
                break;
            }
        }

        $rawModLines = $modStart === null
            ? []
            : array_map($this->stripModTags(...), array_slice($lines, $modStart));

        // "Corrupted"/"Mirrored" are item flags PoB appends after the mods, not
        // modifier lines; they are trailing, so implicit counting is safe.
        $corrupted = in_array('Corrupted', $rawModLines, true);
        $mods = array_values(array_filter(
            $rawModLines,
            static fn (string $line): bool => ! in_array($line, ['Corrupted', 'Mirrored'], true),
        ));

        return new EquippedItem(
            slot: $slot,
            rarity: $rarity,
            name: $name,
            baseType: $baseType,
            itemLevel: $this->intMeta($lines, 'Item Level:'),
            implicitsCount: $implicitsCount,
            mods: $mods,
            icon: $this->resolveItemIcon($rarity, $name, $baseType),
            twoHanded: $this->icons()->isTwoHanded($baseType),
            itemClass: $this->icons()->itemClass($baseType),
            levelRequirement: $this->intMeta($lines, 'LevelReq:'),
            runes: $this->parseRunes($lines),
            requiredStrength: ($requirements['str'] ?? 0) > 0 ? $requirements['str'] : null,
            requiredDexterity: ($requirements['dex'] ?? 0) > 0 ? $requirements['dex'] : null,
            requiredIntelligence: ($requirements['int'] ?? 0) > 0 ? $requirements['int'] : null,
            // The item's computed defensive properties (base + quality + affixes), as PoB
            // renders them - the same numbers the game tooltip shows. Block carries a "%".
            quality: $this->intMeta($lines, 'Quality:'),
            armour: $this->intMeta($lines, 'Armour:'),
            evasion: $this->intMeta($lines, 'Evasion:'),
            energyShield: $this->intMeta($lines, 'Energy Shield:'),
            block: $this->intMeta($lines, 'Block:'),
            corrupted: $corrupted,
        );
    }

    /**
     * Resolve an item's icon. A unique carries its own distinctive art (keyed by
     * the unique name in the GGPK item mapping since item-extractor 0.5.0), so
     * prefer it and fall back to the base type's generic icon when the unique art
     * is not vendored.
     */
    private function resolveItemIcon(string $rarity, string $name, string $baseType): ?string
    {
        $icon = $rarity === 'UNIQUE' ? $this->icons()->itemIcon($name) : null;

        return $icon ?? $this->icons()->itemIcon($baseType);
    }

    /**
     * Strip PoB mod-source tags ({rune}, {enchant}, {crafted}, {desecrated}, …)
     * from the front of a mod line, leaving the human-readable text.
     */
    private function stripModTags(string $mod): string
    {
        return trim((string) preg_replace('/^(?:\{[^}]*\}\s*)+/', '', $mod));
    }

    /**
     * Collect socketed runes (name, icon, and granted stats) from "Rune:" lines.
     *
     * @param  list<string>  $lines
     * @return list<array{name: string, icon: ?string, levelRequirement: ?int, effects: list<string>}>
     */
    private function parseRunes(array $lines): array
    {
        $runes = [];

        foreach ($lines as $line) {
            if (! str_starts_with($line, 'Rune:')) {
                continue;
            }

            foreach (explode(',', $this->stripPrefix($line, 'Rune:')) as $name) {
                $name = trim($name);

                if ($name === '') {
                    continue;
                }

                $data = $this->icons()->runeData($name);

                $runes[] = [
                    'name' => $name,
                    'icon' => $this->icons()->itemIcon($name),
                    'levelRequirement' => $data['levelRequirement'] ?? null,
                    'effects' => $data['effects'] ?? [],
                ];
            }
        }

        return $runes;
    }

    /**
     * Resolve an item's base type per rarity (see {@see parseItemText}).
     */
    private function resolveBaseType(string $rarity, string $name, string $afterName): string
    {
        if ($rarity === 'NORMAL') {
            return $name;
        }

        if ($rarity === 'MAGIC') {
            return $this->icons()->matchBaseType($name) ?? $name;
        }

        // RARE / UNIQUE carry the base on the next line - unless that is already a
        // metadata line (contains ':'), in which case fall back to name matching.
        if ($afterName !== '' && ! str_contains($afterName, ':')) {
            return $afterName;
        }

        return $this->icons()->matchBaseType($name) ?? $afterName;
    }

    private function stripPrefix(string $line, string $prefix): string
    {
        return str_starts_with($line, $prefix) ? trim(substr($line, strlen($prefix))) : $line;
    }

    /**
     * @param  list<string>  $lines
     */
    private function intMeta(array $lines, string $prefix): ?int
    {
        foreach ($lines as $line) {
            if (str_starts_with($line, $prefix)) {
                return (int) trim($this->stripPrefix($line, $prefix));
            }
        }

        return null;
    }
}

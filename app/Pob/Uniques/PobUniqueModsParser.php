<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

/**
 * Parses one PoB `Data/Uniques/*.lua` file (a `return { [[ ... ]], [[ ... ]] }` table of
 * long-bracket strings, one per unique) into plain data. Not a Lua interpreter - the
 * blocks are PoB item text, read the way PathOfBuilding-PoE2's `Classes/Item.lua`
 * ParseRaw reads it:
 *
 *   Name
 *   Base type
 *   spec lines           `Name: value` specs PoB knows (Source, League, Variant, Version,
 *                         Has Alt Variant, Selected ..., Limited to, Radius, Sockets, ...)
 *                         and `Requires Level N` - item properties, never mods
 *   Implicits: N         how many of the following mod lines are implicit
 *   mod line             any other line, including `Grants Skill: ...` and similar
 *   ...                  `Name: value` lines PoB does not know as a spec
 *
 * Mod lines keep their variant-selection tags (see {@see TaggedLine}); which lines are the
 * unique's real mods depends on the picked variant (see {@see PobItemVariants}). The
 * implicit count covers mod lines in source order, every variant's lines included, as PoB
 * counts them.
 */
final class PobUniqueModsParser
{
    /**
     * Spec names ParseRaw handles as item properties (`parseItemSpec` + the spec branches
     * of ParseRaw). A `Name: value` line with any other name is a mod line.
     */
    private const array SPEC_NAMES = [
        'Version', 'Base Variant', 'Variant', 'Selected Version', 'Selected Variant Group',
        'Selected Variant', 'Selected Base Variant', 'Unique ID', 'Item Level', 'Requires Class',
        'Charm Slots', 'Spirit', 'Quality', 'Sockets', 'Rune', 'Radius', 'Limited to',
        'Talisman Tier', 'Runic Ward', 'Evasion Rating', 'Energy Shield', 'Level',
        'Requires Level', 'LevelReq', 'Has Alt Variant', 'Has Alt Variant Two',
        'Has Alt Variant Three', 'Has Alt Variant Four', 'Has Alt Variant Five',
        'Selected Alt Variant', 'Selected Alt Variant Two', 'Selected Alt Variant Three',
        'Selected Alt Variant Four', 'Selected Alt Variant Five', 'Allow Duplicate Variants',
        'Has Variants', 'Selected Variants', 'League', 'Crafted', 'Implicit', 'Prefix', 'Suffix',
        'Implicits', 'Unreleased', 'Upgrade', 'Source', 'Cluster Jewel Skill',
        'Cluster Jewel Node Count', 'Catalyst', 'CatalystQuality', 'Note', 'Critical Hit Range',
        'Attacks per Second', 'Weapon Range', 'Critical Hit Chance', 'Physical Damage',
        'Elemental Damage', 'Chaos Damage', 'Fire Damage', 'Cold Damage', 'Lightning Damage',
        'Reload Time', 'Chance to Block', 'Block chance', 'Armour', 'Evasion', 'Requires',
    ];

    /** Whole lines ParseRaw reads as item flags or separators, never as mods. */
    private const array FLAG_LINES = [
        '--------', 'Requirements:', 'Sanctified', 'Mirrored', 'Corrupted', 'Twice Corrupted',
        'Desecrated Prefix', 'Desecrated Suffix',
    ];

    /**
     * @return list<array{name: string, base: string, league: ?string, variants: ?array<string, mixed>, lines: list<array{text: string, implicit: bool, variants?: list<int>, versions?: list<int>, groups?: list<int>}>}>
     */
    public function parse(string $lua): array
    {
        if (preg_match_all('/\[\[(.*?)\]\]/s', $lua, $matches) === false) {
            return [];
        }

        $uniques = [];

        foreach ($matches[1] as $block) {
            $unique = $this->parseBlock($block);

            if ($unique !== null) {
                $uniques[] = $unique;
            }
        }

        return $uniques;
    }

    /**
     * @return array{name: string, base: string, league: ?string, variants: ?array<string, mixed>, lines: list<array{text: string, implicit: bool, variants?: list<int>, versions?: list<int>, groups?: list<int>}>}|null
     */
    private function parseBlock(string $block): ?array
    {
        $lines = array_values(array_filter(
            array_map(trim(...), preg_split('/\r?\n/', trim($block)) ?: []),
            static fn (string $line): bool => $line !== '',
        ));

        if (count($lines) < 2) {
            return null;
        }

        $name = array_shift($lines);
        $base = (string) array_shift($lines);
        $league = null;
        $implicitCount = 0;
        $foundExplicit = false;
        $modLines = [];

        $inReminder = false;

        foreach ($lines as $line) {
            // Reminder text "(Explanation ...)", possibly over several lines.
            if ($inReminder || preg_match('/^\([A-Za-z]/', $line) === 1) {
                $inReminder = ! str_ends_with($line, ')');

                continue;
            }

            if (in_array($line, self::FLAG_LINES, true) || preg_match('/^Requires:? Level \d+/', $line) === 1) {
                continue;
            }

            $spec = self::specName($line);

            if ($spec !== null) {
                if ($spec === 'League') {
                    $league = trim(substr($line, strlen('League:')));
                }

                if ($spec === 'Implicits') {
                    $implicitCount = (int) trim(substr($line, strlen('Implicits:')));

                    continue;
                }

                if (! in_array($spec, self::SPEC_NAMES, true)) {
                    // ParseRaw: "Anything else is an explicit with a colon in it".
                    $foundExplicit = true;
                } elseif (! $foundExplicit) {
                    continue;
                }
            }

            $modLines[] = TaggedLine::parse($line);
        }

        $modLines = array_values(array_filter($modLines, static fn (TaggedLine $line): bool => $line->text !== ''));

        if ($modLines === []) {
            return null;
        }

        $variants = PobItemVariants::fromItemLines($lines);

        return [
            'name' => $name,
            'base' => $base,
            'league' => $league,
            'variants' => $variants?->toArray(),
            'lines' => array_map(
                static fn (TaggedLine $line, int $index): array => array_filter([
                    'text' => $line->text,
                    'implicit' => $index < $implicitCount,
                    'variants' => $line->variants,
                    'versions' => $line->versions,
                    'groups' => $line->groups,
                ], static fn (mixed $value): bool => $value !== null),
                $modLines,
                array_keys($modLines),
            ),
        ];
    }

    /**
     * The spec name of an untagged `Name: value` / `Requires X value` line, as PoB's
     * `parseItemSpec` reads it, or null for anything else. A tagged line is never a spec.
     */
    private static function specName(string $line): ?string
    {
        if (str_starts_with($line, '{')) {
            return null;
        }

        if (preg_match('/^([A-Za-z ()]+:?): (.+)$/', $line, $match) === 1) {
            return $match[1] === 'Class:' ? 'Requires Class' : $match[1];
        }

        if (preg_match('/^(Requires [A-Za-z]+) (.+)$/', $line, $match) === 1) {
            return $match[1];
        }

        return null;
    }
}

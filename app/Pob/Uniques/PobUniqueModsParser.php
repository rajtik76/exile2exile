<?php

declare(strict_types=1);

namespace App\Pob\Uniques;

/**
 * Parses one PoB `Data/Uniques/*.lua` file (a `return { [[ ... ]], [[ ... ]] }` table of
 * long-bracket strings, one per unique) into plain data. Not a Lua interpreter - PoB's
 * unique data has never used anything beyond this fixed line-based shape, so a regex/line
 * split is enough and avoids a Lua runtime dependency for one narrow data feed.
 *
 * Block shape (see PathOfBuildingCommunity/PathOfBuilding-PoE2, src/Data/Uniques/*.lua):
 *
 *   Name
 *   Base type
 *   Source: ...        (optional, metadata - dropped)
 *   League: ...         (optional)
 *   Variant: ...         (zero or more, dropped - the mod lines below carry the {variant:N}
 *                          tag when a line only applies to some variants)
 *   Radius: ... / Sockets: ...  (optional, metadata - dropped)
 *   Implicits: N         (optional, how many of the following lines are implicit mods)
 *   mod line
 *   mod line
 *   ...
 *
 * A mod line may be prefixed by one or more `{tag:value}` groups (variant selector, mod
 * tags, …); the tags are stripped, only the display text is kept.
 */
final class PobUniqueModsParser
{
    /**
     * @return list<array{name: string, base: string, league: ?string, implicitCount: int, mods: list<string>}>
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
     * @return array{name: string, base: string, league: ?string, implicitCount: int, mods: list<string>}|null
     */
    private function parseBlock(string $block): ?array
    {
        $lines = array_values(array_filter(
            preg_split('/\r?\n/', trim($block)) ?: [],
            static fn (string $line): bool => trim($line) !== '',
        ));

        if (count($lines) < 2) {
            return null;
        }

        $name = trim(array_shift($lines));
        $base = trim((string) array_shift($lines));
        $league = null;
        $implicitCount = 0;
        $mods = [];

        foreach ($lines as $line) {
            if (str_starts_with($line, 'Variant:')
                || str_starts_with($line, 'Radius:')
                || str_starts_with($line, 'Sockets:')
                || str_starts_with($line, 'Source:')
            ) {
                continue;
            }

            if (str_starts_with($line, 'League:')) {
                $league = trim(substr($line, strlen('League:')));

                continue;
            }

            if (str_starts_with($line, 'Implicits:')) {
                $implicitCount = (int) trim(substr($line, strlen('Implicits:')));

                continue;
            }

            $mods[] = trim(preg_replace('/^(\{[^}]*\})+/', '', $line) ?? $line);
        }

        if ($name === '' || $mods === []) {
            return null;
        }

        return [
            'name' => $name,
            'base' => $base,
            'league' => $league,
            'implicitCount' => $implicitCount,
            'mods' => $mods,
        ];
    }
}

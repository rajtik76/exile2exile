<?php

declare(strict_types=1);

namespace App\Pob\Gems;

/**
 * Reads the gem ids out of PoB's generated `Data/Gems.lua`. Only the `gameId` fields are
 * taken (e.g. "Metadata/Items/Gems/SkillGemIceNova"), reduced to their last path segment
 * - the key the GGPK gem catalogue uses. PoB lists one entry per gem effect, so a gem
 * base can repeat; the result is de-duplicated, in file order.
 *
 * The file is a Lua table, so an entry key defined twice keeps only its last definition -
 * the earlier one never reaches PoB (the file has duplicated "SkillGemSkeletalSniper",
 * whose dead first copy points at SkillGemSkeletalWarrior). Entries are read the same way.
 */
final class PobGemListParser
{
    /**
     * @return list<string>
     */
    public function parse(string $lua): array
    {
        preg_match_all('/\["([^"]+)"\]\s*=\s*\{/', $lua, $entries, PREG_OFFSET_CAPTURE);

        $gameIdByEntry = [];

        foreach ($entries[0] as $index => [$header, $offset]) {
            $end = $entries[0][$index + 1][1] ?? strlen($lua);
            $body = substr($lua, $offset, $end - $offset);

            if (preg_match('/\bgameId\s*=\s*"([^"]+)"/', $body, $match) === 1) {
                $gameIdByEntry[$entries[1][$index][0]] = $match[1];
            }
        }

        $ids = [];

        foreach ($gameIdByEntry as $gameId) {
            $slash = strrpos($gameId, '/');
            $id = $slash === false ? $gameId : substr($gameId, $slash + 1);

            if ($id !== '') {
                $ids[$id] = true;
            }
        }

        return array_map(strval(...), array_keys($ids));
    }
}

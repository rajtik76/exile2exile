<?php

declare(strict_types=1);

namespace App\Pob\Gems;

/**
 * Reads the gem ids out of PoB's generated `Data/Gems.lua`. Only the `gameId` fields are
 * taken (e.g. "Metadata/Items/Gems/SkillGemIceNova"), reduced to their last path segment
 * - the key the GGPK gem catalogue uses. PoB lists one entry per gem effect, so a gem
 * base can repeat; the result is de-duplicated, in file order.
 */
final class PobGemListParser
{
    /**
     * @return list<string>
     */
    public function parse(string $lua): array
    {
        preg_match_all('/\bgameId\s*=\s*"([^"]+)"/', $lua, $matches);

        $ids = [];

        foreach ($matches[1] as $gameId) {
            $slash = strrpos($gameId, '/');
            $id = $slash === false ? $gameId : substr($gameId, $slash + 1);

            if ($id !== '') {
                $ids[$id] = true;
            }
        }

        return array_map(strval(...), array_keys($ids));
    }
}

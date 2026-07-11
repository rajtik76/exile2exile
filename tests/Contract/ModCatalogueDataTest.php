<?php

declare(strict_types=1);

use App\Pob\ModCatalogue;
use Illuminate\Support\Facades\Storage;

/**
 * Guards the shape of every mod in the live GGPK affix catalogue: a mod without a
 * rendered stat line (or with a malformed roll) shows up in the modifier picker as an
 * empty row with no value to pick, and the import can never match its text. The
 * extractor skips unrenderable mods loudly; this pins that no such entry ships.
 */
it('every catalogue mod carries a rendered stat line and well-formed rolls', function () {
    $mods = json_decode((string) Storage::disk('game-data')->get('resources/poe2/ggpk/mods.json'), true);

    expect($mods)->toBeArray()->not->toBeEmpty();

    $catalogue = new ModCatalogue;
    $broken = [];

    foreach ($mods as $mod) {
        $resolved = $catalogue->resolve($mod['id']);

        if ($resolved === null) {
            $broken[] = "{$mod['id']}: not resolvable";

            continue;
        }

        if ($resolved['stats'] === [] || array_any($resolved['stats'], fn (string $line): bool => trim($line) === '')) {
            $broken[] = "{$mod['id']}: no rendered stat line";
        }

        foreach ($resolved['rolls'] as $roll) {
            if (! is_numeric($roll['min']) || ! is_numeric($roll['max']) || $roll['min'] > $roll['max']) {
                $broken[] = "{$mod['id']}: malformed roll ".json_encode($roll);
            }
        }
    }

    expect($broken)->toBe([]);
});

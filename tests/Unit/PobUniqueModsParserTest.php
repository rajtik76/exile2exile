<?php

declare(strict_types=1);

use App\Pob\Uniques\PobUniqueModsParser;

test('it parses name, base, league, implicit count and mod lines', function () {
    $lua = <<<'LUA'
        -- Item data (c) Grinding Gear Games

        return {
        -- Helmet: Armour
        [[
        Constricting Command
        Viper Cap
        League: Dawn of the Hunt
        Variant: Pre 0.3.0
        Variant: Current
        +(80-120) to maximum Life
        +(10-15) to all Attributes
        (8-12) Life Regeneration per second
        {variant:1}Pin Enemies which are Primed for Pinning
        {variant:2}Require (2-4) fewer enemies to be Surrounded
        ]],[[
        Black Sun Crest
        Wrapped Greathelm
        (50-80)% increased Armour
        (5-15)% increased Strength
        ]],
        }
        LUA;

    $uniques = (new PobUniqueModsParser)->parse($lua);

    expect($uniques)->toHaveCount(2);

    $constrictingCommand = $uniques[0];
    expect($constrictingCommand['name'])->toBe('Constricting Command')
        ->and($constrictingCommand['base'])->toBe('Viper Cap')
        ->and($constrictingCommand['league'])->toBe('Dawn of the Hunt')
        ->and($constrictingCommand['implicitCount'])->toBe(0)
        ->and($constrictingCommand['mods'])->toBe([
            '+(80-120) to maximum Life',
            '+(10-15) to all Attributes',
            '(8-12) Life Regeneration per second',
            'Pin Enemies which are Primed for Pinning',
            'Require (2-4) fewer enemies to be Surrounded',
        ]);

    expect($uniques[1]['name'])->toBe('Black Sun Crest')
        ->and($uniques[1]['league'])->toBeNull();
});

test('it strips stacked tags and honours the implicit count', function () {
    $lua = <<<'LUA'
        return {
        [[
        The Anvil
        Bloodstone Amulet
        Implicits: 1
        {tags:life}+(30-40) to maximum Life
        {variant:1}{tags:speed}10% reduced Movement Speed
        ]],
        }
        LUA;

    $unique = (new PobUniqueModsParser)->parse($lua)[0];

    expect($unique['implicitCount'])->toBe(1)
        ->and($unique['mods'])->toBe([
            '+(30-40) to maximum Life',
            '10% reduced Movement Speed',
        ]);
});

test('it drops metadata-only lines (Source, Radius, Sockets)', function () {
    $lua = <<<'LUA'
        return {
        [[
        Atziri's Splendour
        Sacrificial Regalia
        Source: Drops from unique{Atziri's Vault} in normal{Vaal Temple}
        Sockets: S S S S S S
        Implicits: 1
        +1 to Level of all Corrupted Skill Gems
        ]],
        }
        LUA;

    $unique = (new PobUniqueModsParser)->parse($lua)[0];

    expect($unique['mods'])->toBe(['+1 to Level of all Corrupted Skill Gems']);
});

test('a block with no mod lines is skipped', function () {
    $lua = <<<'LUA'
        return {
        [[
        Nameless Base Only
        ]],
        }
        LUA;

    expect((new PobUniqueModsParser)->parse($lua))->toBe([]);
});

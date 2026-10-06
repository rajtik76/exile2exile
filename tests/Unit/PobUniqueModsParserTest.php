<?php

declare(strict_types=1);

use App\Pob\Uniques\PobUniqueModsParser;

test('it parses name, base, league and mod lines with their variant tags', function () {
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
        ->and($constrictingCommand['variants']['variants'])->toBe(['Pre 0.3.0', 'Current'])
        ->and($constrictingCommand['lines'])->toBe([
            ['text' => '+(80-120) to maximum Life', 'implicit' => false],
            ['text' => '+(10-15) to all Attributes', 'implicit' => false],
            ['text' => '(8-12) Life Regeneration per second', 'implicit' => false],
            ['text' => 'Pin Enemies which are Primed for Pinning', 'implicit' => false, 'variants' => [1]],
            ['text' => 'Require (2-4) fewer enemies to be Surrounded', 'implicit' => false, 'variants' => [2]],
        ]);

    expect($uniques[1]['name'])->toBe('Black Sun Crest')
        ->and($uniques[1]['league'])->toBeNull()
        ->and($uniques[1]['variants'])->toBeNull();
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

    expect($unique['lines'])->toBe([
        ['text' => '+(30-40) to maximum Life', 'implicit' => true],
        ['text' => '10% reduced Movement Speed', 'implicit' => false, 'variants' => [1]],
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

    expect($unique['lines'])->toBe([['text' => '+1 to Level of all Corrupted Skill Gems', 'implicit' => true]]);
});

test('item properties PoB reads as specs are never mods, and do not shift the implicit count', function () {
    $lua = <<<'LUA'
        return {
        [[
        Guiding Palm
        Shrine Sceptre
        Variant: Fire
        Variant: Cold
        Requires Level 65
        Limited to: 1
        Implicits: 2
        {variant:1}Grants Skill: Level (1-20) Purity of Fire
        {variant:2}Grants Skill: Level (1-20) Purity of Ice
        +(5-10) to all Attributes
        ]],
        }
        LUA;

    $unique = (new PobUniqueModsParser)->parse($lua)[0];

    expect($unique['lines'])->toBe([
        ['text' => 'Grants Skill: Level (1-20) Purity of Fire', 'implicit' => true, 'variants' => [1]],
        ['text' => 'Grants Skill: Level (1-20) Purity of Ice', 'implicit' => true, 'variants' => [2]],
        ['text' => '+(5-10) to all Attributes', 'implicit' => false],
    ]);
});

test('a colon line PoB does not know as a spec is a mod', function () {
    $lua = <<<'LUA'
        return {
        [[
        Ring of Choice
        Gold Ring
        Left ring slot: Projectiles from Spells Fork
        Right ring slot: Projectiles from Spells Chain +1 times
        ]],
        }
        LUA;

    expect(array_column((new PobUniqueModsParser)->parse($lua)[0]['lines'], 'text'))->toBe([
        'Left ring slot: Projectiles from Spells Fork',
        'Right ring slot: Projectiles from Spells Chain +1 times',
    ]);
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

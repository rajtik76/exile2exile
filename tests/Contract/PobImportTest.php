<?php

declare(strict_types=1);

use App\Pob\Data\Ascendancy;
use App\Pob\Data\BuildSnapshot;
use App\Pob\Data\CharacterClass;
use App\Pob\Data\EquippedItem;
use App\Pob\PobImport;

function fixturePath(string $file): string
{
    return dirname(__DIR__, 2)."/resources/pob/poe2/{$file}";
}

function importFixture(string $file): BuildSnapshot
{
    return (new PobImport)->import(file_get_contents(fixturePath($file)));
}

const MERCENARY = 'mercenary-lvl19-runes-of-aldur-league.txt';
const WITCH = 'witch-lvl80-runes-of-aldur-league.txt';

it('decodes an export code to PathOfBuilding2 xml', function () {
    $xml = (new PobImport)->decode(file_get_contents(fixturePath(MERCENARY)));

    expect($xml)->toContain('<PathOfBuilding2>');
});

it('rejects a non-base64 code', function () {
    (new PobImport)->decode('not valid !!!');
})->throws(InvalidArgumentException::class);

it('parses the mercenary character header and tree', function () {
    $build = importFixture(MERCENARY);

    expect($build->level)->toBe(19)
        ->and($build->class)->toBe(CharacterClass::Mercenary)
        ->and($build->ascendancy)->toBeNull()
        ->and($build->treeVersion)->toBe('0_5')
        ->and($build->passiveNodes)->toHaveCount(23)
        ->and($build->passiveNodes)->toContain(51825, 47856);
});

it('parses the witch as a high-level Lich with a full tree', function () {
    $build = importFixture(WITCH);

    expect($build->level)->toBe(80)
        ->and($build->class)->toBe(CharacterClass::Witch)
        ->and($build->ascendancy)->toBe(Ascendancy::Lich)
        ->and($build->passiveNodes)->toHaveCount(111);
});

it('parses weapon-set node assignments from the spec', function () {
    $xml = <<<'XML'
    <PathOfBuilding2>
        <Build level="80" className="Witch" ascendClassName="" />
        <Tree activeSpec="1">
            <Spec classId="1" treeVersion="0_5" nodes="10,20,30,40">
                <WeaponSet1 nodes="20,30" />
                <WeaponSet2 nodes="40" />
            </Spec>
        </Tree>
        <Skills />
        <Items />
    </PathOfBuilding2>
    XML;

    $build = (new PobImport)->fromXml($xml);

    expect($build->weaponSets)->toBe([20 => 1, 30 => 1, 40 => 2]);
});

it('leaves weapon sets empty when the spec has none', function () {
    expect(importFixture(WITCH)->weaponSets)->toBe([]);
});

it('reads the character total attributes from PoB player stats', function () {
    expect(importFixture(MERCENARY)->attributes)
        ->toBe(['str' => 26, 'dex' => 21, 'int' => 36]);

    expect(importFixture(WITCH)->attributes)
        ->toBe(['str' => 47, 'dex' => 49, 'int' => 171]);
});

it('maps tree-socketed jewels to their socket node, name and mods', function () {
    $build = importFixture(WITCH);

    expect($build->jewels)->toHaveCount(3)
        ->and($build->jewels)->toHaveKey(7960);

    $jewel = $build->jewels[7960];

    expect($jewel['name'])->toBe('Oblivion Glisten')
        ->and($jewel['rarity'])->toBe('RARE')
        ->and($jewel['baseType'])->toBe('Sapphire')
        ->and($jewel['mods'])->toContain('12% increased Chaos Damage')
        ->and($jewel['icon'])->toBe('/icons/poe2/Art/2DItems/Jewels/SapphireJewel.png');
});

it('parses skill groups with active and support gems', function () {
    $build = importFixture(MERCENARY);

    $first = $build->skillGroups[0];
    $names = array_map(fn ($gem) => $gem->name, $first->gems);

    expect($names)->toBe(['Fragmentation Rounds', 'Elemental Armament I', 'Concentrated Area']);

    [$active, $support] = $first->gems;
    expect($active->isSupport)->toBeFalse()
        ->and($active->gemId)->toBe('SkillGemFragmentationRounds')
        ->and($support->isSupport)->toBeTrue();
});

it('attaches a resolved icon and colour to gems', function () {
    $build = importFixture(MERCENARY);

    $active = $build->skillGroups[0]->gems[0];

    expect($active->icon)->toStartWith('/icons/poe2/')
        ->and($active->icon)->toEndWith('.png')
        ->and($active->color)->toBeIn(['b', 'g', 'r', 'w']);
});

it('parses equipped items with slot, base type and mods', function () {
    $build = importFixture(MERCENARY);

    $helmet = collect($build->items)->firstWhere('slot', 'Helmet');

    expect($helmet)->toBeInstanceOf(EquippedItem::class)
        ->and($helmet->rarity)->toBe('RARE')
        ->and($helmet->name)->toBe('Pain Shelter')
        ->and($helmet->baseType)->toBe('Soldier Greathelm')
        ->and($helmet->itemLevel)->toBe(17)
        ->and($helmet->mods)->toContain('+73 to Armour');
});

it('derives the base type and icon for magic items lacking a base line', function () {
    $build = importFixture(WITCH);

    $magic = collect($build->items)->first(
        fn ($item) => strtoupper($item->rarity) === 'MAGIC' && str_contains($item->baseType, 'Charm'),
    );

    expect($magic->baseType)->toBe('Staunching Charm')
        ->and($magic->icon)->toStartWith('/icons/poe2/');
});

it('parses socketed runes and strips mod source tags', function () {
    $build = importFixture(WITCH);

    $boots = collect($build->items)->firstWhere('slot', 'Boots');

    expect(collect($boots->runes)->pluck('name'))->toContain('Greater Adept Rune')
        ->and($boots->runes[0]['icon'])->toStartWith('/icons/poe2/')
        ->and($boots->runes[0]['levelRequirement'])->toBe(30)
        ->and($boots->runes[0]['effects'])->not->toBeEmpty()
        ->and($boots->mods)->each(fn ($mod) => $mod->not->toStartWith('{'))
        ->and($boots->implicitMods())->toContain('+12 to Dexterity');
});

it('gives every equipped item a resolved icon', function () {
    $build = importFixture(WITCH);

    expect(collect($build->items)->every(fn ($item) => $item->icon !== null))->toBeTrue();
});

it('skips empty equipment slots', function () {
    $build = importFixture(MERCENARY);

    expect($build->items)->not->toBeEmpty()
        ->and(collect($build->items)->pluck('slot'))->not->toContain('Ring 3');
});

it('serialises a full snapshot (and its gems and items) to an array', function () {
    $data = importFixture(WITCH)->toArray();

    expect($data['className'])->toBe('Witch')
        ->and($data['level'])->toBe(80)
        ->and($data['ascendancy'])->toBe('Lich')
        ->and($data['passiveNodeCount'])->toBe(111)
        ->and($data['skillGroups'])->not->toBeEmpty()
        ->and($data['skillGroups'][0])->toBeArray()
        ->and($data['items'])->not->toBeEmpty()
        ->and($data['items'][0])->toHaveKeys(['slot', 'rarity', 'name', 'baseType']);
});

it('splits item mods into implicit and explicit', function () {
    $boots = collect(importFixture(WITCH)->items)->firstWhere('slot', 'Boots');

    expect($boots->implicitMods())->not->toBeEmpty()
        ->and($boots->explicitMods())->not->toBeEmpty()
        ->and([...$boots->implicitMods(), ...$boots->explicitMods()])->toBe($boots->mods);
});

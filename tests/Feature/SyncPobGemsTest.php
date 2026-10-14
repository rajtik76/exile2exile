<?php

declare(strict_types=1);

use App\Pob\Gems\PobGemStore;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

function fakePobGemsLua(string $lua): void
{
    Http::preventStrayRequests();

    Http::fake([
        'raw.githubusercontent.com/*' => Http::response($lua),
        'api.github.com/repos/*/commits/*' => Http::response(['sha' => 'fakecommit123']),
    ]);
}

function seedPobGemsSnapshot(int $count): void
{
    $root = config()->string('poe.pob_gems.storage_path');
    File::ensureDirectoryExists($root);
    File::put("{$root}/current.json", (string) json_encode([
        'syncedAt' => '2026-10-01T00:00:00+00:00',
        'sourceRef' => 'old',
        'gems' => array_map(fn (int $i): string => "SkillGem{$i}", range(1, $count)),
    ]));
}

beforeEach(function () {
    fakePobGemsRoot();
});

test('it syncs the gem ids from PoB, keyed like the GGPK gem catalogue', function () {
    fakePobGemsLua(<<<'LUA'
        return {
            ["Metadata/Items/Gems/SkillGemIceNova"] = {
                name = "Ice Nova",
                gameId = "Metadata/Items/Gems/SkillGemIceNova",
            },
            ["Metadata/Items/Gems/SkillGemIceNovaAlt"] = {
                name = "Ice Nova",
                gameId = "Metadata/Items/Gems/SkillGemIceNova",
            },
            ["Metadata/Items/Gems/SupportGemRally"] = {
                name = "Rally",
                gameId = "Metadata/Items/Gems/SupportGemRally",
            },
        }
        LUA);

    $this->artisan('poe2:sync-pob-gems')->assertSuccessful();

    expect(app(PobGemStore::class)->read())
        ->gems->toBe(['SkillGemIceNova', 'SupportGemRally'])
        ->sourceRef->toBe('PathOfBuildingCommunity/PathOfBuilding-PoE2@fakecommit123');
});

test('an entry key defined twice keeps only its last definition, as in Lua', function () {
    fakePobGemsLua(<<<'LUA'
        return {
            ["Metadata/Items/Gems/SkillGemSkeletalSniper"] = {
                gameId = "Metadata/Items/Gems/SkillGemSkeletalWarrior",
            },
            ["Metadata/Items/Gems/SkillGemSkeletalSniper"] = {
                gameId = "Metadata/Items/Gems/SkillGemSkeletalSniper",
            },
        }
        LUA);

    $this->artisan('poe2:sync-pob-gems')->assertSuccessful();

    expect(app(PobGemStore::class)->read()['gems'])->toBe(['SkillGemSkeletalSniper']);
});

test('it fails without writing when the download fails', function () {
    Http::preventStrayRequests();
    Http::fake(['raw.githubusercontent.com/*' => Http::response('', 404)]);

    $this->artisan('poe2:sync-pob-gems')->assertFailed();

    expect(app(PobGemStore::class)->read())->toBeNull();
});

test('it fails without writing when the file holds no gem ids', function () {
    fakePobGemsLua('return {}');

    $this->artisan('poe2:sync-pob-gems')->assertFailed();

    expect(app(PobGemStore::class)->read())->toBeNull();
});

test('it keeps the last snapshot when the new list shrinks by more than the allowed ratio', function () {
    seedPobGemsSnapshot(10);
    fakePobGemsLua('return { ["SkillGem1"] = { gameId = "Metadata/Items/Gems/SkillGem1" } }');

    $this->artisan('poe2:sync-pob-gems')
        ->expectsOutputToContain('not overwriting')
        ->assertFailed();

    expect(app(PobGemStore::class)->read())
        ->sourceRef->toBe('old')
        ->gems->toHaveCount(10);
});

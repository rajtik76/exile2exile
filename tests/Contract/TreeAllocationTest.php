<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('decodes a PoB code into the tree allocation', function () {
    $code = trim(file_get_contents(base_path('resources/pob/poe2/witch-lvl80-runes-of-aldur-league.txt')));

    $response = $this->postJson('/tree/allocation', ['code' => $code]);

    $response->assertSuccessful()
        ->assertJson([
            'className' => 'Witch',
            'ascendId' => 'Lich',
            'treeVersion' => '0_5',
        ]);

    // The unstable PoB classId must not leak onto the wire; the class is keyed
    // by name and the frontend resolves it to the live GGG id.
    expect($response->json('classId'))->toBeNull();
    expect($response->json('allocated'))->toBeArray()->toHaveCount(111);
});

it('identifies a build whose PoB classId is stale by class name', function () {
    $code = trim(file_get_contents(base_path('resources/pob/poe2/mercenary-pohx-build-0-4-compatible-with-0-5.txt')));

    $response = $this->postJson('/tree/allocation', ['code' => $code]);

    // The fixture carries PoB classId 3 (Duelist in the live tree); the endpoint
    // must report the build by its real class name instead.
    $response->assertSuccessful()
        ->assertJson(['className' => 'Mercenary']);
    expect($response->json('classId'))->toBeNull();
});

it('returns socketed tree jewels keyed by socket node id', function () {
    $code = trim(file_get_contents(base_path('resources/pob/poe2/witch-lvl80-runes-of-aldur-league.txt')));

    $response = $this->postJson('/tree/allocation', ['code' => $code]);

    $response->assertSuccessful()
        ->assertJson([
            'jewels' => [
                '7960' => [
                    'name' => 'Oblivion Glisten',
                    'rarity' => 'RARE',
                    'baseType' => 'Sapphire',
                    'icon' => '/icons/poe2/Art/2DItems/Jewels/SapphireJewel.png',
                ],
            ],
        ]);

    expect($response->json('jewels'))->toHaveCount(3);
});

it('rejects an empty code', function () {
    $this->postJson('/tree/allocation', ['code' => ''])
        ->assertInvalid(['code']);
});

it('rejects a garbage code', function () {
    $this->postJson('/tree/allocation', ['code' => 'not-a-real-build-code'])
        ->assertInvalid(['code']);
});

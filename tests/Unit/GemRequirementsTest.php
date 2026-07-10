<?php

declare(strict_types=1);

use App\Pob\GemRequirements;

it('returns the requirement for a known gem and level, null otherwise', function () {
    $reqs = new GemRequirements([
        'SkillGemFireball' => [
            'name' => 'Fireball',
            'levels' => [1 => ['requiredLevel' => 1, 'str' => 0, 'dex' => 0, 'int' => 12]],
        ],
    ]);

    expect($reqs->at('SkillGemFireball', 1))->toBe(['requiredLevel' => 1, 'str' => 0, 'dex' => 0, 'int' => 12])
        ->and($reqs->at('SkillGemFireball', 99))->toBeNull()
        ->and($reqs->at('UnknownGem', 1))->toBeNull();
});

it('lazily loads the vendored dataset when none is injected', function () {
    expect((new GemRequirements)->at('definitely-not-a-gem', 1))->toBeNull();
});

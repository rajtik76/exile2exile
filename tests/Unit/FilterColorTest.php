<?php

declare(strict_types=1);

use App\Filter\FilterColor;

it('gives every named colour a hex for the on-page preview', function () {
    foreach (FilterColor::cases() as $color) {
        expect($color->hex())->toMatch('/^#[0-9a-f]{6}$/');
    }
});

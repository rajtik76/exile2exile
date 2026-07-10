<?php

declare(strict_types=1);

use App\Filter\Economy\PriceTierPolicy;

test('tierOf maps a price to the highest breakpoint it meets', function () {
    $policy = PriceTierPolicy::default(); // [1, 5, 20, 100, 500]

    expect($policy->tierCount())->toBe(5)
        ->and($policy->tierOf(1000.0))->toBe(1)
        ->and($policy->tierOf(500.0))->toBe(1)
        ->and($policy->tierOf(100.0))->toBe(2)
        ->and($policy->tierOf(20.0))->toBe(3)
        ->and($policy->tierOf(5.0))->toBe(4)
        ->and($policy->tierOf(1.0))->toBe(5)
        ->and($policy->tierOf(0.5))->toBeNull();
});

test('floorFor returns the price at which a tier begins', function () {
    $policy = PriceTierPolicy::default(); // [1, 5, 20, 100, 500]

    expect($policy->floorFor(1))->toBe(500.0)
        ->and($policy->floorFor(2))->toBe(100.0)
        ->and($policy->floorFor(3))->toBe(20.0)
        ->and($policy->floorFor(5))->toBe(1.0);
});

test('breakpoints must be non-empty and ascending', function () {
    expect(fn () => new PriceTierPolicy([]))->toThrow(InvalidArgumentException::class)
        ->and(fn () => new PriceTierPolicy([10.0, 5.0]))->toThrow(InvalidArgumentException::class);
});

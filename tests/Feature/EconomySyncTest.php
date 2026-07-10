<?php

declare(strict_types=1);

use App\Models\EconomyPrice;
use Illuminate\Support\Facades\Http;

/**
 * Fake the whole poe2scout surface the sync touches: one current league, one currency
 * category and one unique category, each a single page of items.
 */
function fakeScoutApi(): void
{
    Http::preventStrayRequests();

    Http::fake(function ($request) {
        $path = (string) parse_url((string) $request->url(), PHP_URL_PATH);

        return match (true) {
            str_ends_with($path, '/Leagues') => Http::response([
                ['Value' => 'Runes of Aldur', 'ShortName' => 'runes', 'IsCurrent' => true],
            ]),
            str_ends_with($path, '/Items/Categories') => Http::response([
                'UniqueCategories' => [['ApiId' => 'weapon']],
                'CurrencyCategories' => [['ApiId' => 'currency']],
            ]),
            str_contains($path, '/Currencies/ByCategory') => Http::response([
                'CurrentPage' => 1,
                'Pages' => 1,
                'Total' => 2,
                'Items' => [
                    ['ApiId' => 'exalted', 'Text' => 'Exalted Orb', 'CurrentPrice' => 1.0, 'CurrentQuantity' => 1000, 'ItemMetadata' => ['base_type' => 'Exalted Orb']],
                    ['ApiId' => 'divine', 'Text' => 'Divine Orb', 'CurrentPrice' => 20.5, 'CurrentQuantity' => 500, 'ItemMetadata' => ['base_type' => 'Divine Orb']],
                ],
            ]),
            str_contains($path, '/Uniques/ByCategory') => Http::response([
                'CurrentPage' => 1,
                'Pages' => 1,
                'Total' => 1,
                'Items' => [
                    ['UniqueItemId' => 263, 'Name' => 'The Dancing Dervish', 'Type' => 'Scimitar', 'CurrentPrice' => 1500.0, 'CurrentQuantity' => 6],
                ],
            ]),
            default => Http::response([], 404),
        };
    });
}

test('the sync caches currency and unique prices for the current league', function () {
    fakeScoutApi();

    $this->artisan('poe2:sync-economy')->assertSuccessful();

    expect(EconomyPrice::count())->toBe(3);

    $exalted = EconomyPrice::where('name', 'Exalted Orb')->firstOrFail();
    expect($exalted->kind)->toBe('currency')
        ->and($exalted->category)->toBe('currency')
        ->and($exalted->price)->toBe(1.0)
        ->and($exalted->base_type)->toBe('Exalted Orb')
        ->and($exalted->quantity)->toBe(1000);

    // A unique keys on the base it drops on, not its unique name - that is all the
    // loot filter can match it by.
    $unique = EconomyPrice::where('name', 'The Dancing Dervish')->firstOrFail();
    expect($unique->kind)->toBe('unique')
        ->and($unique->base_type)->toBe('Scimitar')
        ->and($unique->price)->toBe(1500.0);
});

test('re-running updates prices in place without duplicating rows', function () {
    fakeScoutApi();

    $this->artisan('poe2:sync-economy')->assertSuccessful();
    $this->artisan('poe2:sync-economy')->assertSuccessful();

    expect(EconomyPrice::count())->toBe(3);
});

test('an explicit --league overrides discovery', function () {
    fakeScoutApi();

    $this->artisan('poe2:sync-economy', ['--league' => ['Runes of Aldur']])->assertSuccessful();

    expect(EconomyPrice::where('league', 'Runes of Aldur')->count())->toBe(3);
});

test('it fails when no league can be resolved', function () {
    Http::preventStrayRequests();
    Http::fake(['*/Leagues' => Http::response([])]);

    $this->artisan('poe2:sync-economy')->assertFailed();

    expect(EconomyPrice::count())->toBe(0);
});

// Regression: routes/console.php wires the success heartbeat from
// config('poe.economy.heartbeat_url'); the key must map POE2SCOUT_SYNC_HEARTBEAT_URL, or
// the ping is silently never sent and the push monitor alarms despite healthy syncs.
test('the economy heartbeat url maps the POE2SCOUT_SYNC_HEARTBEAT_URL env', function () {
    $url = 'https://status.example/api/push/abc123?status=up&msg=OK&ping=';

    putenv("POE2SCOUT_SYNC_HEARTBEAT_URL={$url}");
    $_ENV['POE2SCOUT_SYNC_HEARTBEAT_URL'] = $url;
    $_SERVER['POE2SCOUT_SYNC_HEARTBEAT_URL'] = $url;

    try {
        $config = require base_path('config/poe.php');

        expect($config['economy']['heartbeat_url'])->toBe($url);
    } finally {
        putenv('POE2SCOUT_SYNC_HEARTBEAT_URL');
        unset($_ENV['POE2SCOUT_SYNC_HEARTBEAT_URL'], $_SERVER['POE2SCOUT_SYNC_HEARTBEAT_URL']);
    }
});

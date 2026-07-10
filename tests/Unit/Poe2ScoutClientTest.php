<?php

declare(strict_types=1);

use App\Economy\Poe2ScoutClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// The client needs the Laravel container (config + Http factory) but no database.
uses(TestCase::class);

function scoutClient(): Poe2ScoutClient
{
    return app(Poe2ScoutClient::class);
}

test('currentLeague picks the current softcore league and skips hardcore', function () {
    Http::fake([
        '*/Leagues' => Http::response([
            ['Value' => 'Dawn of the Hunt', 'ShortName' => 'hunt', 'IsCurrent' => false],
            ['Value' => 'Runes of Aldur', 'ShortName' => 'runes', 'IsCurrent' => true],
            ['Value' => 'HC Runes of Aldur', 'ShortName' => 'runeshc', 'IsCurrent' => true],
        ]),
    ]);

    expect(scoutClient()->currentLeague())->toBe('Runes of Aldur');
});

test('currentLeague returns null when the API lists no current league', function () {
    Http::fake(['*/Leagues' => Http::response([
        ['Value' => 'Standard', 'ShortName' => 'standard', 'IsCurrent' => false],
    ])]);

    expect(scoutClient()->currentLeague())->toBeNull();
});

test('categories splits unique and currency api ids', function () {
    Http::fake(['*/Items/Categories' => Http::response([
        'UniqueCategories' => [['ApiId' => 'weapon'], ['ApiId' => 'armour']],
        'CurrencyCategories' => [['ApiId' => 'currency'], ['ApiId' => 'runes']],
    ])]);

    expect(scoutClient()->categories('Runes of Aldur'))->toBe([
        'unique' => ['weapon', 'armour'],
        'currency' => ['currency', 'runes'],
    ]);
});

test('currencies streams every page until the last', function () {
    Http::fake(function ($request) {
        parse_str((string) parse_url((string) $request->url(), PHP_URL_QUERY), $query);
        $page = (int) ($query['Page'] ?? 1);

        return Http::response([
            'CurrentPage' => $page,
            'Pages' => 2,
            'Total' => 3,
            'Items' => $page === 1
                ? [['Text' => 'Exalted Orb', 'CurrentPrice' => 1.0], ['Text' => 'Divine Orb', 'CurrentPrice' => 20.0]]
                : [['Text' => 'Mirror of Kalandra', 'CurrentPrice' => 100000.0]],
        ]);
    });

    $items = iterator_to_array(scoutClient()->currencies('Runes of Aldur', 'currency'), false);

    expect($items)->toHaveCount(3)
        ->and($items[2]['Text'])->toBe('Mirror of Kalandra');
});

test('a failed response throws rather than returning junk', function () {
    Http::fake(['*' => Http::response('upstream down', 503)]);

    scoutClient()->leagues();
})->throws(RuntimeException::class);

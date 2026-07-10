<?php

declare(strict_types=1);

namespace App\Economy;

use App\Console\Commands\SyncEconomyPrices;
use App\Models\EconomyPrice;
use Generator;
use Illuminate\Http\Client\Factory as Http;
use RuntimeException;

/**
 * A thin read client for the public poe2scout API (`api.poe2scout.com`), the approved
 * source of PoE2 economy prices. No auth exists; poe2scout only asks sustained clients
 * to send a contactable `User-Agent`, which every request here does.
 *
 * This is used by {@see SyncEconomyPrices} to refresh the local
 * {@see EconomyPrice} snapshot on the API's 6-hour cadence. Nothing in a
 * user request path should call it - reads go through the cached snapshot instead.
 */
final readonly class Poe2ScoutClient
{
    public function __construct(private Http $http) {}

    /**
     * Every league poe2scout tracks for our realm, each a raw league object
     * (`Value`, `ShortName`, `IsCurrent`, `DivinePrice`, …).
     *
     * @return list<array<string, mixed>>
     */
    public function leagues(): array
    {
        return array_values($this->get("/{$this->realm()}/Leagues"));
    }

    /**
     * The canonical name of the current softcore league (e.g. "Runes of Aldur"),
     * resolved from the API's `IsCurrent` flag. Hardcore leagues are skipped so the
     * default economy context is the one most builds trade in. Null when the API lists
     * no current league.
     */
    public function currentLeague(): ?string
    {
        foreach ($this->leagues() as $league) {
            $value = is_string($league['Value'] ?? null) ? $league['Value'] : '';
            $isHardcore = str_starts_with($value, 'HC ') || str_ends_with((string) ($league['ShortName'] ?? ''), 'hc');

            if (($league['IsCurrent'] ?? false) === true && ! $isHardcore && $value !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * The priceable item categories in a league, split into the two endpoint families.
     *
     * @return array{unique: list<string>, currency: list<string>}
     */
    public function categories(string $league): array
    {
        $body = $this->get("/{$this->realm()}/Leagues/".rawurlencode($league).'/Items/Categories');

        $apiIds = static fn (mixed $group): array => array_values(array_filter(
            array_map(
                static fn (mixed $category): ?string => is_array($category) && is_string($category['ApiId'] ?? null) ? $category['ApiId'] : null,
                is_array($group) ? $group : [],
            ),
            // Drop only the unmatched (null) entries - a legit ApiId of "0" or "" must survive.
            static fn (?string $id): bool => $id !== null,
        ));

        return [
            'unique' => $apiIds($body['UniqueCategories'] ?? []),
            'currency' => $apiIds($body['CurrencyCategories'] ?? []),
        ];
    }

    /**
     * Every stackable (currency-family) item in a league category, streamed page by
     * page. Each yielded value is a raw poe2scout item object.
     *
     * @return Generator<int, array<string, mixed>>
     */
    public function currencies(string $league, string $category): Generator
    {
        yield from $this->paginate(
            "/{$this->realm()}/Leagues/".rawurlencode($league).'/Currencies/ByCategory',
            $category,
        );
    }

    /**
     * Every unique item in a league category, streamed page by page.
     *
     * @return Generator<int, array<string, mixed>>
     */
    public function uniques(string $league, string $category): Generator
    {
        yield from $this->paginate(
            "/{$this->realm()}/Leagues/".rawurlencode($league).'/Uniques/ByCategory',
            $category,
        );
    }

    /**
     * Walk a paginated `ByCategory` endpoint, yielding each item until the last page.
     * A `max_pages` cap guards against a runaway `Pages` count.
     *
     * @return Generator<int, array<string, mixed>>
     */
    private function paginate(string $path, string $category): Generator
    {
        $page = 1;
        $maxPages = config()->integer('poe.economy.max_pages');

        do {
            $body = $this->get($path, [
                'Category' => $category,
                'Page' => $page,
                'PerPage' => config()->integer('poe.economy.per_page'),
            ]);

            foreach (is_array($body['Items'] ?? null) ? $body['Items'] : [] as $item) {
                if (is_array($item)) {
                    yield $item;
                }
            }

            $pages = (int) ($body['Pages'] ?? 1);
            $page++;
        } while ($page <= $pages && $page <= $maxPages);
    }

    /**
     * Issue one GET against the API and return the decoded JSON body as an array.
     *
     * @param  array<string, mixed>  $query
     * @return array<int|string, mixed>
     */
    private function get(string $path, array $query = []): array
    {
        $response = $this->http
            ->baseUrl(config()->string('poe.economy.base_url'))
            ->withHeader('User-Agent', config()->string('poe.economy.user_agent'))
            ->acceptJson()
            ->timeout(config()->integer('poe.economy.timeout'))
            ->retry(2, 500, throw: false)
            ->get($path, $query);

        if (! $response->successful()) {
            throw new RuntimeException("poe2scout request failed ({$response->status()}): {$path}");
        }

        $body = $response->json();

        if (! is_array($body)) {
            throw new RuntimeException("poe2scout returned a non-array body: {$path}");
        }

        return $body;
    }

    private function realm(): string
    {
        return config()->string('poe.economy.realm');
    }
}

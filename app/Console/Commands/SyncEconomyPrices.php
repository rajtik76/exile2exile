<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Economy\Poe2ScoutClient;
use App\Models\EconomyPrice;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Refresh the local poe2scout price snapshot ({@see EconomyPrice}) on the API's 6-hour
 * cadence (schedule in routes/console.php). The loot-filter generator reads this
 * snapshot, never poe2scout live, so a slow or down API degrades to slightly-stale
 * prices, not a broken filter.
 */
#[Signature('poe2:sync-economy {--league=* : Canonical league name(s) to sync; defaults to config or the current league}')]
#[Description('Refresh the cached poe2scout economy prices (currency + uniques) for the current league')]
class SyncEconomyPrices extends Command
{
    /** Rows buffered before an upsert flush, keeping each write bounded. */
    private const int BATCH_SIZE = 500;

    public function handle(Poe2ScoutClient $client): int
    {
        $leagues = $this->resolveLeagues($client);

        if ($leagues === []) {
            $this->error('No league to sync (none passed, none configured, and the API lists no current league).');

            return self::FAILURE;
        }

        $failed = 0;

        foreach ($leagues as $league) {
            try {
                $this->syncLeague($client, $league);
            } catch (\Throwable $e) {
                // Isolate a per-league API failure so the remaining leagues still sync - the
                // cached snapshot is meant to degrade to stale prices, not break the run.
                $failed++;
                $this->error("  Failed to sync \"{$league}\": {$e->getMessage()}");
                report($e);
            }
        }

        // Only a total wash-out is a command failure; a partial sync is still progress.
        return $failed === count($leagues) ? self::FAILURE : self::SUCCESS;
    }

    /**
     * The leagues to sync: an explicit `--league`, else the configured list, else the
     * current softcore league resolved from the API.
     *
     * @return list<string>
     */
    private function resolveLeagues(Poe2ScoutClient $client): array
    {
        /** @var list<string> $option */
        $option = $this->option('league');

        if ($option !== []) {
            return $option;
        }

        /** @var list<string> $configured */
        $configured = config()->array('poe.economy.leagues');

        if ($configured !== []) {
            return $configured;
        }

        $current = $client->currentLeague();

        return $current === null ? [] : [$current];
    }

    /**
     * Pull every priced item in one league - currency-family stackables and uniques,
     * across all their categories - and upsert them into the local snapshot in bounded
     * batches.
     */
    private function syncLeague(Poe2ScoutClient $client, string $league): void
    {
        $this->info("Syncing economy prices for \"{$league}\"…");

        $categories = $client->categories($league);
        $buffer = [];
        $total = 0;

        foreach ($this->rows($client, $league, $categories) as $row) {
            $buffer[] = $row;

            if (count($buffer) >= self::BATCH_SIZE) {
                $this->flush($buffer);
                $total += count($buffer);
                $buffer = [];
            }
        }

        if ($buffer !== []) {
            $this->flush($buffer);
            $total += count($buffer);
        }

        $this->info("  {$total} prices cached for \"{$league}\".");
    }

    /**
     * Stream every priced item in a league as an {@see EconomyPrice} row: currency-family
     * stackables first, then uniques, across all their categories. Items with no usable
     * price are skipped.
     *
     * @param  array{unique: list<string>, currency: list<string>}  $categories
     * @return \Generator<int, array{league: string, kind: string, category: string, api_id: ?string, name: string, base_type: ?string, price: float, quantity: ?int, max_stack_size: ?int}>
     */
    private function rows(Poe2ScoutClient $client, string $league, array $categories): \Generator
    {
        foreach ($categories['currency'] as $category) {
            foreach ($client->currencies($league, $category) as $item) {
                $row = $this->row($league, 'currency', $category, $item);

                if ($row !== null) {
                    yield $row;
                }
            }
        }

        foreach ($categories['unique'] as $category) {
            foreach ($client->uniques($league, $category) as $item) {
                $row = $this->row($league, 'unique', $category, $item);

                if ($row !== null) {
                    yield $row;
                }
            }
        }
    }

    /**
     * Upsert one batch of rows, refreshing the mutable fields of any row already stored
     * for this (league, kind, category, name).
     *
     * @param  list<array{league: string, kind: string, category: string, api_id: ?string, name: string, base_type: ?string, price: float, quantity: ?int, max_stack_size: ?int}>  $rows
     */
    private function flush(array $rows): void
    {
        EconomyPrice::query()->upsert(
            $rows,
            ['league', 'kind', 'category', 'name'],
            ['api_id', 'base_type', 'price', 'quantity', 'max_stack_size'],
        );
    }

    /**
     * Map one raw poe2scout item to an {@see EconomyPrice} row, or null when it carries
     * no usable price. A currency keys on its own name; a unique on the base it drops on
     * (the filter can only match a unique by its base type, not its unique name).
     *
     * @param  array<string, mixed>  $item
     * @return array{league: string, kind: string, category: string, api_id: ?string, name: string, base_type: ?string, price: float, quantity: ?int, max_stack_size: ?int}|null
     */
    private function row(string $league, string $kind, string $category, array $item): ?array
    {
        $price = $item['CurrentPrice'] ?? null;
        $name = $item['Name'] ?? $item['Text'] ?? null;

        if (! is_numeric($price) || ! is_string($name) || $name === '') {
            return null;
        }

        $metadata = is_array($item['ItemMetadata'] ?? null) ? $item['ItemMetadata'] : [];
        $baseType = $item['Type'] ?? $metadata['base_type'] ?? $name;
        $apiId = $item['ApiId'] ?? $item['UniqueItemId'] ?? null;
        $quantity = $item['CurrentQuantity'] ?? null;
        $maxStack = $metadata['max_stack_size'] ?? null;

        return [
            'league' => $league,
            'kind' => $kind,
            'category' => $category,
            'api_id' => $apiId === null ? null : (string) $apiId,
            'name' => $name,
            'base_type' => is_string($baseType) && $baseType !== '' ? $baseType : $name,
            'price' => (float) $price,
            'quantity' => is_numeric($quantity) ? (int) $quantity : null,
            'max_stack_size' => is_numeric($maxStack) && (int) $maxStack > 1 ? (int) $maxStack : null,
        ];
    }
}

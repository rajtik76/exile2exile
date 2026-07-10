<?php

declare(strict_types=1);

namespace App\Models;

use App\Console\Commands\SyncEconomyPrices;
use Database\Factories\EconomyPriceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A single locally-cached poe2scout price: one priced item (currency or unique) in
 * one league. Refreshed in place by {@see SyncEconomyPrices}.
 * The loot-filter generator reads these rows instead of ever calling poe2scout live.
 *
 * @property string $league
 * @property string $kind
 * @property string $category
 * @property ?string $api_id
 * @property string $name
 * @property ?string $base_type
 * @property float $price
 * @property ?int $quantity
 * @property ?int $max_stack_size
 */
class EconomyPrice extends Model
{
    /** @use HasFactory<EconomyPriceFactory> */
    use HasFactory;

    /** @var list<string> */
    protected $fillable = [
        'league',
        'kind',
        'category',
        'api_id',
        'name',
        'base_type',
        'price',
        'quantity',
        'max_stack_size',
    ];

    /**
     * @return array<string, string>
     */
    #[\Override]
    protected function casts(): array
    {
        return [
            'price' => 'float',
            'quantity' => 'integer',
            'max_stack_size' => 'integer',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Console\Commands\SyncEconomyPrices;
use Carbon\CarbonImmutable;
use Database\Factories\EconomyPriceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A single locally-cached poe2scout price: one priced item (currency or unique) in
 * one league. Refreshed in place by {@see SyncEconomyPrices}.
 *
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
 * @property int $id
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 *
 * @method static \Database\Factories\EconomyPriceFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereApiId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereBaseType($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereCategory($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereKind($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereLeague($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereMaxStackSize($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereName($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice wherePrice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereQuantity($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|EconomyPrice whereUpdatedAt($value)
 *
 * @mixin \Eloquent
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

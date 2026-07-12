<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\PageViewFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $path
 * @property string|null $referrer
 * @property string $visitor
 * @property bool $inertia
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property string $device
 *
 * @method static \Database\Factories\PageViewFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView whereDevice($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView whereInertia($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView wherePath($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView whereReferrer($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PageView whereVisitor($value)
 *
 * @mixin \Eloquent
 */
class PageView extends Model
{
    /** @use HasFactory<PageViewFactory> */
    use HasFactory;

    /** @var list<string> */
    protected $fillable = ['path', 'referrer', 'visitor', 'inertia', 'device'];

    /** @return array<string, string> */
    #[\Override]
    protected function casts(): array
    {
        return [
            'inertia' => 'boolean',
        ];
    }
}

<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $version
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PatchRelease newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PatchRelease newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PatchRelease query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PatchRelease whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PatchRelease whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PatchRelease whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|PatchRelease whereVersion($value)
 *
 * @mixin \Eloquent
 */
class PatchRelease extends Model
{
    /** @var list<string> */
    protected $fillable = ['version'];
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Http\Controllers\SharedBuildController;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A passive-tree build shared by a guest through a public, unguessable link.
 *
 * We persist the rendered allocation (not a PoB code), so the viewer can draw it
 * without decoding and a hand-edited tree shares exactly like an imported one.
 * Guest shares are immutable and permanent by default - no owner, no edit, no
 * expiry (see {@see SharedBuildController}).
 *
 * @property string $slug
 * @property string|null $hash
 * @property array{className: string, ascendId: ?string, allocated: list<int>, attributeChoices?: array<int|string, string>, weaponSets?: array<int|string, int>, jewels?: array<int|string, mixed>, treeVersion?: ?string} $build
 * @property Carbon|null $last_viewed_at
 */
class SharedBuild extends Model
{
    /**
     * Resolve route-model bindings by the public slug, not the numeric id.
     */
    #[\Override]
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @var list<string>
     */
    protected $fillable = [
        'slug',
        'hash',
        'build',
        'last_viewed_at',
    ];

    /**
     * @return array<string, string>
     */
    #[\Override]
    protected function casts(): array
    {
        return [
            'build' => 'array',
            'last_viewed_at' => 'datetime',
        ];
    }
}

<?php

declare(strict_types=1);

namespace App\Models;

use App\Http\Controllers\SharedTreeController;
use App\Tree\TreeSnapshot;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Session\Session;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A passive-tree allocation shared by a guest through a public, unguessable link.
 *
 * We persist the rendered allocation (not a PoB code), so the viewer can draw it
 * without decoding and a hand-edited tree shares exactly like an imported one.
 * A tree is read through its public {@see $slug} and edited only with the secret
 * {@see $edit_token} minted at creation - the same account-less guest model as
 * {@see BuildPlan}. Rows shared before editing existed carry no token and stay
 * read-only (see {@see SharedTreeController}).
 *
 * @property string $slug
 * @property string|null $hash
 * @property string|null $edit_token
 * @property TreeSnapshot $build
 * @property Carbon|null $last_viewed_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree query()
 *
 * @property int $id
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree whereBuild($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree whereEditToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree whereHash($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree whereLastViewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|SharedTree whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
class SharedTree extends Model
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
        'edit_token',
        'build',
        'last_viewed_at',
    ];

    /**
     * Whether this build can be edited at all. Legacy shares minted before the
     * edit flow have no token, so no secret can ever unlock them.
     */
    public function isEditable(): bool
    {
        return $this->edit_token !== null;
    }

    /**
     * Whether the given secret grants edit rights to this build. Timing-safe so a
     * caller can't probe the token byte by byte; always false for legacy rows.
     */
    public function matchesEditToken(?string $token): bool
    {
        return $this->edit_token !== null
            && is_string($token) && $token !== ''
            && hash_equals($this->edit_token, $token);
    }

    /**
     * Session key under which a verified edit token is remembered, so the token is
     * entered once through the unlock form and never again travels in a URL or payload.
     */
    public function unlockSessionKey(): string
    {
        return "tree.unlocked.{$this->slug}";
    }

    /**
     * Whether this request's session has already unlocked this build for editing (the
     * remembered token still matches - a rotated token invalidates old unlocks).
     */
    public function isUnlockedIn(Session $session): bool
    {
        $token = $session->get($this->unlockSessionKey());

        return is_string($token) && $this->matchesEditToken($token);
    }

    /**
     * @return array<string, string>
     */
    #[\Override]
    protected function casts(): array
    {
        return [
            'build' => TreeSnapshot::class,
            'last_viewed_at' => 'datetime',
        ];
    }
}

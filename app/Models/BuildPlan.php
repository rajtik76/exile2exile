<?php

declare(strict_types=1);

namespace App\Models;

use App\Http\Controllers\PlannerController;
use App\Support\GameEra;
use App\Support\Planner\PlanSchema;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Session\Session;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A build guide authored and saved by a guest through a public link.
 *
 * The whole guide - description, per-phase items/gems/tree lists with priorities
 * and free-text notes - lives in the versioned {@see $data} JSON; {@see PlanSchema}
 * owns its shape. A plan is read through its public {@see $slug} and edited only
 * with the secret {@see $edit_token}: there are no accounts (see {@see PlannerController}).
 *
 * @property string $slug
 * @property string $game_patch
 * @property string $edit_token
 * @property string $title
 * @property int $schema_version
 * @property array<string, mixed> $data
 * @property Carbon|null $last_viewed_at
 * @property int $id
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereData($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereEditToken($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereLastViewedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereSchemaVersion($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|BuildPlan whereUpdatedAt($value)
 *
 * @mixin \Eloquent
 */
class BuildPlan extends Model
{
    /**
     * Stamp a new plan with the raw patch of the live game data it was made on,
     * read on the server, unless the caller set one explicitly. An edit re-stamps it
     * the same way (see the controller's update).
     */
    protected static function booted(): void
    {
        static::creating(function (self $plan): void {
            $plan->game_patch ??= app(GameEra::class)->livePatchOrFail();
        });
    }

    /**
     * The game era this plan belongs to, derived from its patch through poe.eras,
     * or null when the map no longer covers that patch.
     */
    public function gameEra(): ?string
    {
        return app(GameEra::class)->forPatch($this->game_patch);
    }

    /**
     * Whether this plan was made on the live era's data. One from an older (or an
     * unmapped) era is read-only: the live tree it would be drawn and edited over is
     * a different game.
     */
    public function isFromCurrentEra(): bool
    {
        return app(GameEra::class)->isLive($this->game_patch);
    }

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
        'game_patch',
        'edit_token',
        'title',
        'schema_version',
        'data',
        'last_viewed_at',
    ];

    /**
     * Whether the given secret grants edit rights to this plan. Timing-safe so a
     * caller can't probe the token byte by byte.
     */
    public function matchesEditToken(?string $token): bool
    {
        return is_string($token) && $token !== '' && hash_equals($this->edit_token, $token);
    }

    /**
     * Session key under which a verified edit token is remembered, so the token is
     * entered once through the unlock form and never again travels in a URL or payload.
     */
    public function unlockSessionKey(): string
    {
        return "planner.unlocked.{$this->slug}";
    }

    /**
     * Whether this request's session has already unlocked this plan for editing (the
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
            'data' => 'array',
            'last_viewed_at' => 'datetime',
        ];
    }
}

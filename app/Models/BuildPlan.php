<?php

declare(strict_types=1);

namespace App\Models;

use App\Http\Controllers\PlannerController;
use App\Support\Planner\PlanSchema;
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
 * @property string $edit_token
 * @property string $title
 * @property int $schema_version
 * @property array<string, mixed> $data
 * @property Carbon|null $last_viewed_at
 */
class BuildPlan extends Model
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

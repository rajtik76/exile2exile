<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\PatchSubscriberFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $url
 * @property string $secret
 * @property CarbonImmutable|null $verified_at
 * @property string|null $last_notified_version
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 * @property int $consecutive_failures
 *
 * @method static \Database\Factories\PatchSubscriberFactory factory($count = null, $state = [])
 * @method static Builder<static>|PatchSubscriber newModelQuery()
 * @method static Builder<static>|PatchSubscriber newQuery()
 * @method static Builder<static>|PatchSubscriber query()
 * @method static Builder<static>|PatchSubscriber verified()
 * @method static Builder<static>|PatchSubscriber whereConsecutiveFailures($value)
 * @method static Builder<static>|PatchSubscriber whereCreatedAt($value)
 * @method static Builder<static>|PatchSubscriber whereId($value)
 * @method static Builder<static>|PatchSubscriber whereLastNotifiedVersion($value)
 * @method static Builder<static>|PatchSubscriber whereSecret($value)
 * @method static Builder<static>|PatchSubscriber whereUpdatedAt($value)
 * @method static Builder<static>|PatchSubscriber whereUrl($value)
 * @method static Builder<static>|PatchSubscriber whereVerifiedAt($value)
 *
 * @mixin \Eloquent
 */
class PatchSubscriber extends Model
{
    /** @use HasFactory<PatchSubscriberFactory> */
    use HasFactory;

    /**
     * Consecutive failed deliveries that drop a verified subscriber. Each failure
     * is one fully-retried job (~21 min of attempts), so this tolerates short
     * outages: a single delivered patch resets the counter.
     */
    public const int MAX_CONSECUTIVE_FAILURES = 5;

    /**
     * verified_at and consecutive_failures are deliberately not fillable: they are
     * only ever set server-side (after a proven challenge / by the delivery job), so
     * no request payload can self-verify or reset the failure streak by mass assignment.
     *
     * @var list<string>
     */
    protected $fillable = ['url', 'secret', 'last_notified_version'];

    /** @var list<string> */
    protected $hidden = ['secret'];

    /** @return array<string, string> */
    #[\Override]
    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
            'consecutive_failures' => 'integer',
        ];
    }

    /**
     * Only subscribers that have proven they own their endpoint.
     *
     * @param  Builder<self>  $query
     */
    public function scopeVerified(Builder $query): void
    {
        $query->whereNotNull('verified_at');
    }
}

<?php

namespace App\Models;

use Database\Factories\PatchSubscriberFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

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

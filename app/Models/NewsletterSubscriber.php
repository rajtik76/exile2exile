<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\NewsletterSubscriberFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A newsletter recipient. Rows start unconfirmed; the double opt-in link in
 * the confirmation email stamps confirmed_at, and only confirmed rows receive
 * issues. Unsubscribing deletes the row outright.
 *
 * @method static Builder<static>|NewsletterSubscriber confirmed()
 * @method static \Database\Factories\NewsletterSubscriberFactory factory($count = null, $state = [])
 * @method static Builder<static>|NewsletterSubscriber newModelQuery()
 * @method static Builder<static>|NewsletterSubscriber newQuery()
 * @method static Builder<static>|NewsletterSubscriber query()
 * @method static Builder<static>|NewsletterSubscriber whereConfirmedAt($value)
 * @method static Builder<static>|NewsletterSubscriber whereCreatedAt($value)
 * @method static Builder<static>|NewsletterSubscriber whereEmail($value)
 * @method static Builder<static>|NewsletterSubscriber whereId($value)
 * @method static Builder<static>|NewsletterSubscriber whereUpdatedAt($value)
 *
 * @property string $email
 * @property CarbonImmutable|null $confirmed_at
 * @property int $id
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 *
 * @mixin \Eloquent
 */
class NewsletterSubscriber extends Model
{
    /** @use HasFactory<NewsletterSubscriberFactory> */
    use HasFactory;

    /**
     * confirmed_at is deliberately not fillable: it is only stamped server-side
     * when the signed confirmation link is opened, so no signup payload can
     * self-confirm by mass assignment.
     *
     * @var list<string>
     */
    protected $fillable = ['email'];

    /** @return array<string, string> */
    #[\Override]
    protected function casts(): array
    {
        return [
            'confirmed_at' => 'datetime',
        ];
    }

    /**
     * Only subscribers who completed the double opt-in.
     *
     * @param  Builder<self>  $query
     */
    public function scopeConfirmed(Builder $query): void
    {
        $query->whereNotNull('confirmed_at');
    }
}

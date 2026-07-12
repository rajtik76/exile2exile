<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\NewsletterSubscriberFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * A newsletter recipient. Rows start unconfirmed; the double opt-in link in
 * the confirmation email stamps confirmed_at, and only confirmed rows receive
 * issues. Unsubscribing deletes the row outright.
 *
 * Confirm and unsubscribe links carry the per-row {@see $token} (bound via
 * {subscriber:token} in the routes), not a signed URL: delivered mail must
 * stay valid across an APP_KEY rotation, and a 48-char random token is not
 * enumerable the way sequential ids are.
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
 * @property string $token
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
     * confirmed_at and token are deliberately not fillable: confirmed_at is
     * only stamped server-side when the confirmation link is used, and the
     * token is generated once on creation, so no signup payload can set them.
     *
     * @var list<string>
     */
    protected $fillable = ['email'];

    #[\Override]
    protected static function booted(): void
    {
        static::creating(function (self $subscriber): void {
            $subscriber->token ??= Str::random(48);
        });
    }

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

    /** The token-bound double opt-in link for this subscriber. */
    public function confirmUrl(): string
    {
        return route('newsletter.confirm', ['subscriber' => $this]);
    }

    /** The token-bound unsubscribe link embedded in every issue. */
    public function unsubscribeUrl(): string
    {
        return route('newsletter.unsubscribe', ['subscriber' => $this]);
    }
}

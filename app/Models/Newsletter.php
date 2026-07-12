<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\NewsletterFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One newsletter issue (markdown body), authored via the
 * poe2:newsletter:create command. Delivery is triggered explicitly by
 * dispatching NewsletterCreatedEvent from the CreateNewsletter action, never
 * by a model event, so factories and seeders can create issues freely.
 *
 * @method static \Database\Factories\NewsletterFactory factory($count = null, $state = [])
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Newsletter newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Newsletter newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Newsletter query()
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Newsletter whereBody($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Newsletter whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Newsletter whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Newsletter whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder<static>|Newsletter whereUpdatedAt($value)
 *
 * @property int $id
 * @property string $title
 * @property string $body
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 *
 * @mixin \Eloquent
 */
class Newsletter extends Model
{
    /** @use HasFactory<NewsletterFactory> */
    use HasFactory;

    /** @var list<string> */
    protected $fillable = [
        'title',
        'body',
    ];
}

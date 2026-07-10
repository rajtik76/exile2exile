<?php

namespace App\Models;

use Database\Factories\PageViewFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PageView extends Model
{
    /** @use HasFactory<PageViewFactory> */
    use HasFactory;

    /** @var list<string> */
    protected $fillable = ['path', 'referrer', 'visitor', 'inertia', 'device'];

    /** @return array<string, string> */
    #[\Override]
    protected function casts(): array
    {
        return [
            'inertia' => 'boolean',
        ];
    }
}

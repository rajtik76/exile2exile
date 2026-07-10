<?php

namespace Database\Factories;

use App\Models\PatchSubscriber;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PatchSubscriber>
 */
class PatchSubscriberFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'url' => 'https://hooks.example.com/'.fake()->unique()->slug(),
            'secret' => Str::random(48),
            'verified_at' => null,
            'last_notified_version' => null,
        ];
    }
}

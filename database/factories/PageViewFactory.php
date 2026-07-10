<?php

namespace Database\Factories;

use App\Models\PageView;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PageView>
 */
class PageViewFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'path' => $this->faker->randomElement(['/', 'tree', 'build', 'changelog']),
            'referrer' => $this->faker->optional()->url(),
            'visitor' => $this->faker->sha1(),
            'inertia' => $this->faker->boolean(),
            'device' => $this->faker->randomElement(['mobile', 'tablet', 'desktop']),
        ];
    }
}

<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Newsletter;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Newsletter>
 */
class NewsletterFactory extends Factory
{
    protected $model = Newsletter::class;

    public function definition(): array
    {
        return [
            'title' => $this->faker->sentence(4),
            'body' => "# {$this->faker->sentence(3)}\n\n{$this->faker->paragraph()}",
        ];
    }
}

<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\EconomyPrice;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EconomyPrice>
 */
class EconomyPriceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->words(2, true);

        return [
            'league' => 'Runes of Aldur',
            'kind' => 'currency',
            'category' => 'currency',
            'api_id' => $this->faker->slug(),
            'name' => $name,
            'base_type' => $name,
            'price' => $this->faker->randomFloat(2, 0.1, 5000),
            'quantity' => $this->faker->numberBetween(1, 1000),
            'max_stack_size' => null,
        ];
    }

    /** A unique item, priced against the base type it drops on. */
    public function unique(string $baseType): static
    {
        return $this->state(fn (): array => [
            'kind' => 'unique',
            'category' => 'weapon',
            'base_type' => $baseType,
        ]);
    }
}

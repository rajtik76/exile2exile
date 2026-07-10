<?php

declare(strict_types=1);

namespace App\Pob\Data;

/**
 * A single skill or support gem within a socket group.
 */
final readonly class Gem
{
    /**
     * @param  ?string  $icon  Web path to the gem icon, or null when art is unavailable.
     * @param  ?string  $color  Socket colour letter: b, g, r or w.
     * @param  ?string  $category  Human label for the gem kind (e.g. "Support Gem").
     * @param  ?string  $description  Readable gem description, or null when unavailable.
     * @param  list<string>  $tags  Gem tags (e.g. attack, melee, projectile).
     */
    public function __construct(
        public string $name,
        public ?string $skillId,
        public ?string $gemId,
        public int $level,
        public int $quality,
        public bool $isSupport,
        public ?string $icon = null,
        public ?string $color = null,
        public ?string $category = null,
        public ?string $description = null,
        public array $tags = [],
    ) {}

    /**
     * @return array{
     *     name: string,
     *     skillId: ?string,
     *     gemId: ?string,
     *     level: int,
     *     quality: int,
     *     isSupport: bool,
     *     icon: ?string,
     *     color: ?string,
     *     category: ?string,
     *     description: ?string,
     *     tags: list<string>,
     * }
     */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'skillId' => $this->skillId,
            'gemId' => $this->gemId,
            'level' => $this->level,
            'quality' => $this->quality,
            'isSupport' => $this->isSupport,
            'icon' => $this->icon,
            'color' => $this->color,
            'category' => $this->category,
            'description' => $this->description,
            'tags' => $this->tags,
        ];
    }
}

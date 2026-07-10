<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * One `Show` / `Hide` / `Minimal` block: an opening keyword, a set of ANDed conditions,
 * and the styling to apply to matching items. The game evaluates blocks top to bottom and
 * stops at the first match - unless {@see continueMatching()} is set, which lets later
 * blocks layer on more styling (the decorator pattern the tree/waystone tiers rely on).
 *
 * Built fluently: `FilterBlock::show('currency: top')->when(...)->style(...)`.
 */
final class FilterBlock
{
    /** @var list<Condition> */
    private array $conditions = [];

    /** @var list<Action> */
    private array $actions = [];

    private bool $continue = false;

    public function __construct(
        private readonly BlockKind $kind,
        private readonly ?string $comment = null,
    ) {}

    public static function show(?string $comment = null): self
    {
        return new self(BlockKind::Show, $comment);
    }

    public static function hide(?string $comment = null): self
    {
        return new self(BlockKind::Hide, $comment);
    }

    public static function minimal(?string $comment = null): self
    {
        return new self(BlockKind::Minimal, $comment);
    }

    public function when(Condition ...$conditions): self
    {
        $this->conditions = [...$this->conditions, ...array_values($conditions)];

        return $this;
    }

    public function style(Action ...$actions): self
    {
        $this->actions = [...$this->actions, ...array_values($actions)];

        return $this;
    }

    /** Keep evaluating later blocks after this one matches (the `Continue` keyword). */
    public function continueMatching(): self
    {
        $this->continue = true;

        return $this;
    }

    public function render(): string
    {
        $lines = [$this->comment === null ? $this->kind->value : "{$this->kind->value} # {$this->comment}"];

        foreach ($this->conditions as $condition) {
            $lines[] = "\t".$condition->render();
        }

        foreach ($this->actions as $action) {
            $lines[] = "\t".$action->render();
        }

        if ($this->continue) {
            $lines[] = "\tContinue";
        }

        return implode("\n", $lines);
    }
}

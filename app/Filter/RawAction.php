<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * A styling line carried verbatim, for reusing another filter's exact style. The NeverSink
 * overlay uses this to copy NeverSink's own `SetTextColor` / `PlayAlertSound` / ... lines onto
 * an override block, so an overridden drop looks 1:1 like NeverSink styled it.
 */
final readonly class RawAction implements Action
{
    public function __construct(private string $line) {}

    public function render(): string
    {
        return $this->line;
    }
}

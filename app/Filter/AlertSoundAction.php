<?php

declare(strict_types=1);

namespace App\Filter;

use InvalidArgumentException;

/**
 * A `PlayAlertSound` action: a built-in drop sound by id (1-16), with an optional volume
 * (0-300).
 */
final readonly class AlertSoundAction implements Action
{
    public function __construct(
        private int $id,
        private ?int $volume = null,
    ) {
        if ($id < 1 || $id > 16) {
            throw new InvalidArgumentException("Alert sound id must be 1-16, got {$id}.");
        }

        if ($volume !== null && ($volume < 0 || $volume > 300)) {
            throw new InvalidArgumentException("Alert sound volume must be 0-300, got {$volume}.");
        }
    }

    public function render(): string
    {
        return $this->volume === null
            ? "PlayAlertSound {$this->id}"
            : "PlayAlertSound {$this->id} {$this->volume}";
    }
}

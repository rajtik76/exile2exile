<?php

declare(strict_types=1);

namespace App\Pob\Source;

use App\Pob\Data\BuildSnapshot;
use InvalidArgumentException;

/**
 * Dispatches a pasted input to the first registered {@see BuildSource} that
 * claims it. Holds no source-specific logic of its own - order is decided where
 * the sources are registered (see AppServiceProvider).
 */
final readonly class BuildSourceRegistry
{
    /**
     * @param  list<BuildSource>  $sources  Ordered; the first match wins.
     */
    public function __construct(private array $sources) {}

    public function supports(string $input): bool
    {
        return array_any($this->sources, fn ($source) => $source->supports($input));
    }

    /**
     * @throws InvalidArgumentException when no source claims the input.
     */
    public function import(string $input): BuildSnapshot
    {
        return $this->sourceFor($input)->import($input);
    }

    /**
     * Resolve an input to its canonical PoB export code, without decoding it.
     *
     * @throws InvalidArgumentException when no source claims the input.
     */
    public function resolveCode(string $input): string
    {
        $source = $this->sourceFor($input);

        if (! $source instanceof PobCodeSource) {
            throw new InvalidArgumentException('This source does not yield a PoB code.');
        }

        return $source->resolveCode($input);
    }

    /**
     * The first source that claims the input.
     *
     * @throws InvalidArgumentException when no source claims the input.
     */
    private function sourceFor(string $input): BuildSource
    {
        foreach ($this->sources as $source) {
            if ($source->supports($input)) {
                return $source;
            }
        }

        throw new InvalidArgumentException('No build source recognises this input.');
    }
}

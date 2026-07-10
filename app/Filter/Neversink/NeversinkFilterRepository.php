<?php

declare(strict_types=1);

namespace App\Filter\Neversink;

use RuntimeException;

/**
 * Reads the vendored NeverSink filter files (resources/neversink/filters/<style>/<strictness>.filter).
 * These are NeverSink's own files, dropped in verbatim under the MIT License, and are the base
 * every generated filter starts from: with no app overrides on top, the download is byte-for-byte
 * a NeverSink filter.
 */
final readonly class NeversinkFilterRepository
{
    public function __construct(private string $basePath) {}

    public static function default(): self
    {
        return new self(dirname(__DIR__, 3).'/resources/neversink/filters');
    }

    /** The vendored NeverSink filter body for a style and strictness. */
    public function body(NeversinkStyle $style, NeversinkStrictness $strictness): string
    {
        $path = "{$this->basePath}/{$style->value}/{$strictness->value}.filter";

        if (! is_file($path)) {
            throw new RuntimeException("Vendored NeverSink filter is missing: {$path}");
        }

        return (string) file_get_contents($path);
    }

    /** Whether a style/strictness pair has a vendored file. */
    public function has(NeversinkStyle $style, NeversinkStrictness $strictness): bool
    {
        return is_file("{$this->basePath}/{$style->value}/{$strictness->value}.filter");
    }
}

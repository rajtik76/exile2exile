<?php

declare(strict_types=1);

namespace App\Pob\Source;

/**
 * A pasted Path of Building 2 export code, taken as-is.
 *
 * Registered last, it is the fallback for any non-empty input no other source
 * claims; whether the code actually decodes is left to {@see PobImport}.
 */
final class RawPobCodeSource extends PobCodeSource
{
    public function supports(string $input): bool
    {
        return trim($input) !== '';
    }

    protected function fetchCode(string $input): string
    {
        return trim($input);
    }
}

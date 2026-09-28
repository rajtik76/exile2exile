<?php

namespace App\Rules;

use App\Support\GameEra;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Accepts only a patch of the live game era. The editor sends the patch it loaded
 * with, so a tab opened before a data swap to a new era can't save an allocation
 * made on the old tree. The value is only ever compared, never stored: a build is
 * always stamped with the live patch read on the server. A hotfix within the same
 * era passes.
 */
class LiveGameEra implements ValidationRule
{
    /** Shown for any save made on data whose era is no longer the live one. */
    public const string MESSAGE = 'The game data moved to a new version since this page was opened. Reload the page to continue on the new data.';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! app(GameEra::class)->isLive(is_string($value) ? $value : null)) {
            $fail(self::MESSAGE);
        }
    }
}

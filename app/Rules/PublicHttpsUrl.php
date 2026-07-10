<?php

namespace App\Rules;

use App\Support\Http\PublicUrlGuard;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use InvalidArgumentException;

/**
 * Accepts only an https URL whose host resolves to a public address. Blocks
 * loopback, private and reserved ranges so a subscriber URL can't be aimed at
 * internal services (a basic SSRF guard). Delegates to {@see PublicUrlGuard} so
 * this signup-time check and the send-time check share one implementation.
 */
class PublicHttpsUrl implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        try {
            (new PublicUrlGuard)->assertPublic(is_string($value) ? $value : '');
        } catch (InvalidArgumentException) {
            $fail('The :attribute must be a public https URL.');
        }
    }
}

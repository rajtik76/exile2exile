<?php

namespace App\Support;

/**
 * Formats a raw GGG patch string into the version players actually see.
 */
final class Poe2Version
{
    /**
     * Turn a raw GGG patch string into the player-facing version.
     *
     * The patch server reports either five segments "A.B.C.D.E" (e.g. "4.5.3.1.7")
     * or four "A.B.C.E" (e.g. "4.5.4.1", since the 0.5.4 release). A is the product
     * (4 = PoE2), B.C the content release, the optional D an internal build branch
     * GGG never shows players, and E the hotfix. Players know it as "0.B.C.E" -
     * "0.5.3.7" / "0.5.4.1" - so we force the product to 0 and drop the build
     * branch when present. Any other shape is returned verbatim rather than mangled.
     */
    public static function display(string $raw): string
    {
        $parts = explode('.', $raw);

        if (count($parts) === 5) {
            [, $major, $minor, , $hotfix] = $parts;

            return "0.{$major}.{$minor}.{$hotfix}";
        }

        if (count($parts) === 4) {
            [, $major, $minor, $hotfix] = $parts;

            return "0.{$major}.{$minor}.{$hotfix}";
        }

        return $raw;
    }
}

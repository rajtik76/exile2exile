<?php

namespace App\Support;

/**
 * The PoE2 patch the app's committed game data was built from - what the planner
 * and comparison actually render, distinct from the latest version GGG has
 * released. Sourced solely from the data's own stamp
 * ({@see public/tree/current/version.json}, written by the extraction CI from the
 * version the app passed it): the data is its own single source of truth, not the
 * extractor config.
 *
 * Reads the file directly (not the `game-data` disk) because {@see stamp} runs at
 * config-load time from config/poe.php, before the Storage facade has a root.
 */
class TreeDataVersion
{
    /**
     * The player-facing version of the published data, or null when the stamp
     * is absent or unreadable.
     */
    public function current(): ?string
    {
        $raw = $this->readPatch(public_path('tree/current/version.json'));

        return $raw !== null ? Poe2Version::display($raw) : null;
    }

    /**
     * Cache-key stamp for the committed game data: the patch the whole extraction
     * built against, joined with the tree content hash, so it changes on any data
     * refresh - a new patch, or a re-publish of the same patch. Read straight from
     * the data's own stamp so the derived-data caches version themselves; no hand-set
     * env, and thus no manual bump, is ever needed. Falls back to 'dev' when absent.
     */
    public static function stamp(?string $path = null): string
    {
        $path ??= public_path('tree/current/version.json');

        if (is_file($path)) {
            $decoded = json_decode((string) file_get_contents($path), true);

            if (is_array($decoded)) {
                $patch = is_string($decoded['patch'] ?? null) ? $decoded['patch'] : '';
                $hash = is_string($decoded['v'] ?? null) ? $decoded['v'] : '';
                $stamp = trim("{$patch}:{$hash}", ':');

                if ($stamp !== '') {
                    return $stamp;
                }
            }
        }

        return 'dev';
    }

    /** Read a `patch` string from a JSON file, or null when absent/unreadable. */
    private function readPatch(string $path): ?string
    {
        if (! is_file($path)) {
            return null;
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        if (is_array($decoded) && isset($decoded['patch']) && is_string($decoded['patch'])) {
            return $decoded['patch'];
        }

        return null;
    }
}

<?php

declare(strict_types=1);

namespace App\Support;

use RuntimeException;

/**
 * The player-facing game era (e.g. "0.5", "1.0") a piece of game data belongs to,
 * resolved through the hand-maintained patch-prefix map in `poe.eras`.
 *
 * Saved trees and plans store the raw patch of the live data they were last saved
 * on, never an era: the era is always derived here, so correcting the map re-files
 * every build at once, and a build from an older era is never silently drawn over
 * a newer tree.
 */
class GameEra
{
    public function __construct(private readonly TreeDataVersion $dataVersion) {}

    /**
     * The era a raw GGG patch belongs to: the longest configured prefix matching on
     * whole dot-separated segments ("4.5" covers "4.5.4.7", never "4.50.1"), or null
     * when no prefix matches.
     */
    public function forPatch(?string $patch): ?string
    {
        if ($patch === null || $patch === '') {
            return null;
        }

        $eras = $this->eras();
        $segments = explode('.', $patch);

        for ($length = count($segments); $length > 0; $length--) {
            $era = $eras[implode('.', array_slice($segments, 0, $length))] ?? null;

            if ($era !== null) {
                return $era;
            }
        }

        return null;
    }

    /**
     * The raw patch of the live game data, read on the server from the data's own
     * stamp. With no data installed at all (a fresh checkout, the data-less
     * Unit/Feature suites) it is the newest configured prefix, so a build saved there
     * still lands in the newest era.
     */
    public function livePatch(): ?string
    {
        $patch = $this->dataVersion->current();

        if ($patch !== null) {
            return $patch;
        }

        $eras = $this->eras();

        return $eras === [] ? null : (string) array_key_last($eras);
    }

    /**
     * The live patch, for stamping a build that is being saved.
     *
     * @throws RuntimeException when the live data belongs to no configured era.
     */
    public function livePatchOrFail(): string
    {
        $patch = $this->livePatch();

        if ($patch === null || $this->forPatch($patch) === null) {
            throw new RuntimeException('The live game data belongs to no configured era; map its patch prefix in poe.eras.');
        }

        return $patch;
    }

    /**
     * The era of the live game data, or null when its patch has no mapping - an era
     * is never guessed.
     */
    public function current(): ?string
    {
        return $this->forPatch($this->livePatch());
    }

    /**
     * Whether a stored patch belongs to the live era, i.e. the build it stamps can be
     * drawn and edited over the live data as is.
     */
    public function isLive(?string $patch): bool
    {
        $era = $this->forPatch($patch);

        return $era !== null && $era === $this->current();
    }

    /**
     * The name GGG gave an era (e.g. "Return of the Ancients"), when the map carries
     * one for it.
     */
    public function nameOf(?string $era): ?string
    {
        return $era === null ? null : ($this->names()[$era] ?? null);
    }

    /**
     * Whether an era label looks like a player-facing version ("0.5", "1.0").
     */
    public static function isValidEra(string $era): bool
    {
        return preg_match('/^\d+(\.\d+){0,3}$/', $era) === 1;
    }

    /**
     * Patch prefix => era label.
     *
     * @return array<string, string>
     */
    private function eras(): array
    {
        return array_map(fn (array $entry): string => $entry['era'], $this->entries());
    }

    /**
     * Era label => its name, for the eras the map names.
     *
     * @return array<string, string>
     */
    private function names(): array
    {
        $names = [];

        foreach ($this->entries() as $entry) {
            if ($entry['name'] !== null) {
                $names[$entry['era']] = $entry['name'];
            }
        }

        return $names;
    }

    /**
     * The configured map, normalised and validated on every read so a bad entry
     * fails loudly instead of silently mis-stamping builds. An entry is either the
     * bare era label or `['era' => ..., 'name' => ...]` with an optional name.
     *
     * @return array<string, array{era: string, name: ?string}>
     *
     * @throws RuntimeException when an entry is malformed.
     */
    private function entries(): array
    {
        $entries = [];
        $names = [];

        foreach (config()->array('poe.eras') as $prefix => $entry) {
            $prefix = (string) $prefix;

            // At least major.minor: a lone "4" would swallow every later 4.x
            // patch, so a new league could never trip the unmapped-era guard.
            if (preg_match('/^\d+(\.\d+){1,4}$/', $prefix) !== 1) {
                throw new RuntimeException("poe.eras prefix \"{$prefix}\" must be at least major.minor, e.g. \"4.5\".");
            }

            $era = is_array($entry) ? ($entry['era'] ?? null) : $entry;
            $name = is_array($entry) ? ($entry['name'] ?? null) : null;

            if (! is_string($era) || ! self::isValidEra($era)) {
                throw new RuntimeException("poe.eras entry \"{$prefix}\" must map to an era label like \"0.5\".");
            }

            if ($name !== null && (! is_string($name) || trim($name) === '')) {
                throw new RuntimeException("poe.eras entry \"{$prefix}\" has a name that is not a non-empty string.");
            }

            // Several prefixes may share an era, but it is one era with one name.
            if ($name !== null && isset($names[$era]) && $names[$era] !== $name) {
                throw new RuntimeException("poe.eras names era \"{$era}\" both \"{$names[$era]}\" and \"{$name}\".");
            }

            if ($name !== null) {
                $names[$era] = $name;
            }

            $entries[$prefix] = ['era' => $era, 'name' => $name];
        }

        return $entries;
    }
}

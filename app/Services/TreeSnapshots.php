<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\GameEra;
use Illuminate\Support\Facades\File;
use RuntimeException;

/**
 * Per-patch copies of the published passive tree under trees/<patch>, served as /tree/patches/<patch>.
 */
class TreeSnapshots
{
    public function __construct(
        private readonly GameEra $eras,
        private readonly GameDataDirectories $directories,
    ) {}

    public function root(): string
    {
        return rtrim(config()->string('poe.data.releases_root'), '/').'/trees';
    }

    public function path(string $patch): string
    {
        return $this->root()."/{$patch}";
    }

    /**
     * @return list<string> oldest first
     */
    public function patches(): array
    {
        $patches = array_map(basename(...), glob($this->root().'/*', GLOB_ONLYDIR) ?: []);
        $patches = array_values(array_filter($patches, $this->has(...)));

        sort($patches, SORT_NATURAL);

        return $patches;
    }

    public function has(string $patch): bool
    {
        return GameDataReleases::isValidVersion($patch)
            && is_file($this->path($patch).'/data.json')
            && ($this->directories->treeStamp($this->path($patch))['patch'] ?? null) === $patch;
    }

    /** Content hash of a snapshot, for cache-busting its URLs. */
    public function version(string $patch): string
    {
        return $this->directories->treeStamp($this->path($patch))['hash'] ?? '';
    }

    /**
     * A re-extraction of the same patch carries a new content hash and replaces the
     * snapshot, so an extractor fix reaches old trees too.
     *
     * @return string|null the captured patch, or null when the source carries no stamp
     *
     * @throws RuntimeException when the snapshot cannot be written
     */
    public function capture(string $treeDirectory): ?string
    {
        $stamp = $this->directories->treeStamp($treeDirectory);

        if ($stamp === null || ! GameDataReleases::isValidVersion($stamp['patch']) || ! is_file($treeDirectory.'/data.json')) {
            return null;
        }

        $patch = $stamp['patch'];

        if ($this->has($patch) && ($this->directories->treeStamp($this->path($patch))['hash'] ?? null) === $stamp['hash']) {
            return $patch;
        }

        $target = $this->path($patch);
        $staging = $target.'.staging';
        $previous = $this->newestOtherThan($patch);

        File::deleteDirectory($staging);
        $this->directories->mirror($treeDirectory, $staging, $previous === null ? null : $this->path($previous));
        File::deleteDirectory($target);

        if (! @rename($staging, $target)) {
            throw new RuntimeException("could not snapshot the passive tree of patch {$patch}");
        }

        return $patch;
    }

    /**
     * Builds saved before snapshots existed have no exact match and fall back to the
     * newest snapshot of their era.
     */
    public function forPatch(string $patch): ?string
    {
        if ($this->has($patch)) {
            return $patch;
        }

        $era = $this->eras->forPatch($patch);

        if ($era === null) {
            return null;
        }

        $sameEra = array_filter($this->patches(), fn (string $candidate): bool => $this->eras->forPatch($candidate) === $era);

        return $sameEra === [] ? null : end($sameEra);
    }

    private function newestOtherThan(string $patch): ?string
    {
        $others = array_values(array_filter($this->patches(), fn (string $candidate): bool => $candidate !== $patch));

        return $others === [] ? null : end($others);
    }
}

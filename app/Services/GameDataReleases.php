<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * The on-disk store of extracted game-data releases and the "current" pointer.
 *
 * Layout (under the configured root, storage/game-data by default):
 *
 *   releases/<version>/             one full extraction output, repo-relative
 *                                   layout inside (public/tree/current,
 *                                   public/icons/poe2, resources/poe2/ggpk)
 *   releases/<version>.tar.gz       the same release packed for CI to download
 *   current -> releases/<version>   the live release, swapped atomically
 *
 * The app's own public/tree/current, public/icons/poe2 and resources/poe2/ggpk
 * are static symlinks through `current`, so one rename() flips all three at
 * once and every request sees a fully old or fully new release, never a mix.
 */
class GameDataReleases
{
    /**
     * Accepts dotted patch versions like "4.5.4.3". Also the path-safety gate:
     * everything else (traversal attempts, ".staging" leftovers) is rejected
     * before a version ever becomes part of a filesystem path.
     */
    public static function isValidVersion(string $version): bool
    {
        return preg_match('/^\d+(\.\d+){1,8}$/', $version) === 1;
    }

    public function root(): string
    {
        return rtrim(config()->string('poe.data.releases_root'), '/');
    }

    public function releasePath(string $version): string
    {
        return $this->root()."/releases/{$version}";
    }

    /** Extraction builds here first; the dir is renamed to the release on success. */
    public function stagingPath(string $version): string
    {
        return $this->releasePath($version).'.staging';
    }

    public function tarballPath(string $version): string
    {
        return $this->releasePath($version).'.tar.gz';
    }

    public function checksumPath(string $version): string
    {
        return $this->tarballPath($version).'.sha256';
    }

    /** The version the live `current` release is stamped with, or null when nothing is live. */
    public function currentVersion(): ?string
    {
        return $this->stampedPatch($this->currentLink());
    }

    /** True when the release is fully staged: dir present and stamped with this version. */
    public function has(string $version): bool
    {
        return $this->stampedPatch($this->releasePath($version)) === $version;
    }

    /**
     * Atomically point `current` at the given release.
     *
     * Symlink-then-rename: the new link is created under a temporary name and
     * rename(2) replaces the old one in a single step, so there is never a
     * moment without a valid `current`.
     */
    public function activate(string $version): void
    {
        if (! $this->has($version)) {
            throw new RuntimeException("release {$version} is not staged");
        }

        $tmp = $this->currentLink().'.'.bin2hex(random_bytes(4));

        if (! @symlink("releases/{$version}", $tmp)) {
            throw new RuntimeException("could not create the swap symlink at {$tmp}");
        }

        if (! @rename($tmp, $this->currentLink())) {
            @unlink($tmp);

            throw new RuntimeException('could not swap the current symlink');
        }
    }

    /**
     * Pack a staged release into its tarball and write the sha256 sidecar.
     *
     * The archive keeps the repo-relative layout (public/..., resources/...),
     * so CI untars it straight into a checkout and the Contract suite finds the
     * data on its usual paths.
     *
     * @return string the tarball's sha256 checksum
     */
    public function pack(string $version): string
    {
        if (! $this->has($version)) {
            throw new RuntimeException("release {$version} is not staged");
        }

        Process::timeout(600)
            ->run(['tar', '-czf', $this->tarballPath($version), '-C', $this->releasePath($version), 'public', 'resources'])
            ->throw();

        $checksum = hash_file('sha256', $this->tarballPath($version));

        if ($checksum === false) {
            throw new RuntimeException("tarball missing after pack: {$this->tarballPath($version)}");
        }

        file_put_contents($this->checksumPath($version), $checksum."\n");

        return $checksum;
    }

    /** The stored checksum of a packed release, or null when it was never packed. */
    public function checksum(string $version): ?string
    {
        $raw = @file_get_contents($this->checksumPath($version));

        return $raw === false ? null : (trim($raw) ?: null);
    }

    /**
     * Delete stale releases, keeping the live one plus the $keep newest others
     * as rollback targets. A release's tarball and checksum go with it; the
     * live release's artifacts are never touched.
     *
     * @return list<string> the versions removed
     */
    public function prune(?int $keep = null): array
    {
        $keep ??= config()->integer('poe.data.keep_releases');
        $current = $this->currentVersion();

        $candidates = [];

        foreach (glob($this->root().'/releases/*', GLOB_ONLYDIR) ?: [] as $dir) {
            $version = basename($dir);

            if ($version === $current || ! self::isValidVersion($version)) {
                continue;
            }

            $candidates[$version] = filemtime($dir) ?: 0;
        }

        arsort($candidates);
        $removed = [];

        foreach (array_slice(array_keys($candidates), $keep) as $version) {
            File::deleteDirectory($this->releasePath($version));
            @unlink($this->tarballPath($version));
            @unlink($this->checksumPath($version));
            $removed[] = $version;
        }

        return $removed;
    }

    private function currentLink(): string
    {
        return $this->root().'/current';
    }

    /** The `patch` from a release's own version.json stamp, or null when absent. */
    private function stampedPatch(string $releasePath): ?string
    {
        $stamp = $releasePath.'/public/tree/current/version.json';

        if (! is_file($stamp)) {
            return null;
        }

        $decoded = json_decode((string) file_get_contents($stamp), true);
        $patch = is_array($decoded) ? ($decoded['patch'] ?? null) : null;

        return is_string($patch) && $patch !== '' ? $patch : null;
    }
}

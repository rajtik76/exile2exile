<?php

namespace App\Services;

use App\Pob\Uniques\PobUniqueStore;
use App\Support\GameEra;
use FilesystemIterator;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;

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
 *   archive/<version>/              the last live release of a finished game era,
 *                                   frozen (with the PoB unique mods) when a
 *                                   release of the next era is activated. Named
 *                                   by patch, so its era is derived like a
 *                                   build's; one archive per era, never pruned
 *
 * The app's own public/tree/current, public/icons/poe2 and resources/poe2/ggpk
 * are static symlinks through `current`, so one rename() flips all three at
 * once and every request sees a fully old or fully new release, never a mix.
 */
class GameDataReleases
{
    /** How long a staging directory may sit untouched before it counts as abandoned. */
    private const int STALE_STAGING_HOURS = 24;

    public function __construct(
        private readonly GameEra $eras,
        private readonly PobUniqueStore $uniques,
    ) {}

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

    /** Where the frozen release of a finished game era lives, named by its patch. */
    public function archivePath(string $version): string
    {
        return $this->root()."/archive/{$version}";
    }

    /**
     * The archived releases, as patch versions.
     *
     * @return list<string>
     */
    public function archivedVersions(): array
    {
        $versions = array_map(basename(...), glob($this->root().'/archive/*', GLOB_ONLYDIR) ?: []);

        return array_values(array_filter($versions, self::isValidVersion(...)));
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
     *
     * A release must belong to a configured game era (see `poe.eras`), since every
     * build saved on it is stamped with that era. When it starts a new era, the
     * outgoing release is frozen first, so the builds of the ending era keep their data.
     */
    public function activate(string $version): void
    {
        if (! $this->has($version)) {
            throw new RuntimeException("release {$version} is not staged");
        }

        $era = $this->eras->forPatch($version);

        if ($era === null) {
            throw new RuntimeException("release {$version} belongs to no configured game era");
        }

        $this->freezeOutgoingEra($era);

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
     * Two kinds of leftover are swept alongside them, because neither is
     * reachable by version name and nothing else would ever remove them: the
     * staging dir of an extraction that died before its rename, and a tarball
     * whose release directory is already gone.
     *
     * @return array{releases: list<string>, staging: list<string>, artifacts: list<string>}
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

        return [
            'releases' => $removed,
            'staging' => $this->pruneStaleStaging(),
            'artifacts' => $this->pruneOrphanedArtifacts(),
        ];
    }

    /**
     * Drop staging directories no extraction is writing to any more. A live run
     * touches its own for the few minutes it takes, so the age cutoff is what
     * separates a dead one from a run in flight.
     *
     * @return list<string>
     */
    private function pruneStaleStaging(): array
    {
        $cutoff = now()->subHours(self::STALE_STAGING_HOURS)->getTimestamp();
        $removed = [];

        foreach (glob($this->root().'/releases/*.staging', GLOB_ONLYDIR) ?: [] as $dir) {
            if ((filemtime($dir) ?: 0) > $cutoff) {
                continue;
            }

            File::deleteDirectory($dir);
            $removed[] = basename($dir);
        }

        return $removed;
    }

    /**
     * Drop tarballs whose release directory is gone. Nothing serves them: the
     * download endpoint only answers for a version that is still staged.
     *
     * @return list<string>
     */
    private function pruneOrphanedArtifacts(): array
    {
        $removed = [];

        foreach (glob($this->root().'/releases/*.tar.gz') ?: [] as $tarball) {
            if (is_dir($this->releasePath(basename($tarball, '.tar.gz')))) {
                continue;
            }

            @unlink($tarball);
            @unlink($tarball.'.sha256');
            $removed[] = basename($tarball);
        }

        return $removed;
    }

    /**
     * Freeze the live release under archive/<version> when the release about to go
     * live belongs to a different era. The copy is hard-linked, so it costs next to
     * no disk while the release itself is still kept, and it survives the release
     * being pruned later. The PoB unique mods ride along, since they sit outside
     * releases.
     *
     * One archive per era: any other archive whose patch belongs to the same era is
     * removed once the new one is in place, so the store never piles up archives and
     * an era always keeps the last release that was live in it - even after a
     * rollback across eras.
     */
    private function freezeOutgoingEra(string $incomingEra): void
    {
        $current = $this->currentVersion();
        $outgoingEra = $this->eras->forPatch($current);

        if ($current === null || $outgoingEra === null || $outgoingEra === $incomingEra) {
            return;
        }

        $target = $this->archivePath($current);
        $staging = $target.'.staging';

        File::deleteDirectory($staging);
        $this->linkTree($this->releasePath($current), $staging);

        if (is_file($this->uniques->path())) {
            File::ensureDirectoryExists($staging.'/pob-uniques');
            File::copy($this->uniques->path(), $staging.'/pob-uniques/current.json');
        }

        File::deleteDirectory($target);

        if (! @rename($staging, $target)) {
            throw new RuntimeException("could not freeze release {$current} of era {$outgoingEra}");
        }

        foreach ($this->archivedVersions() as $version) {
            if ($version !== $current && $this->eras->forPatch($version) === $outgoingEra) {
                File::deleteDirectory($this->archivePath($version));
            }
        }
    }

    /**
     * Mirror a directory tree with hard links, falling back to a copy for a file
     * that cannot be linked (e.g. a different filesystem).
     */
    private function linkTree(string $source, string $target): void
    {
        File::ensureDirectoryExists($target);

        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST,
        );

        /** @var SplFileInfo $item */
        foreach ($items as $item) {
            $destination = $target.'/'.substr($item->getPathname(), strlen($source) + 1);

            if ($item->isDir()) {
                File::ensureDirectoryExists($destination);
            } elseif (! @link($item->getPathname(), $destination) && ! @copy($item->getPathname(), $destination)) {
                throw new RuntimeException("could not freeze {$item->getPathname()}");
            }
        }
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

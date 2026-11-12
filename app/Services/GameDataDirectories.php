<?php

declare(strict_types=1);

namespace App\Services;

use FilesystemIterator;
use Illuminate\Support\Facades\File;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use SplFileInfo;

/**
 * File operations shared by the game-data release store and the passive tree snapshots.
 */
class GameDataDirectories
{
    /**
     * Mirror `$source` into `$target` with hard links, falling back to a copy. A file
     * whose bytes match its twin under `$dedupeFrom` is linked to that twin instead,
     * so an unchanged file shares one inode across snapshots.
     *
     * @throws RuntimeException when a file can be neither linked nor copied
     */
    public function mirror(string $source, string $target, ?string $dedupeFrom = null): void
    {
        File::ensureDirectoryExists($target);

        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS | FilesystemIterator::FOLLOW_SYMLINKS),
            RecursiveIteratorIterator::SELF_FIRST,
        );

        /** @var SplFileInfo $item */
        foreach ($items as $item) {
            $relative = substr($item->getPathname(), strlen($source) + 1);
            $destination = $target.'/'.$relative;

            if ($item->isDir()) {
                File::ensureDirectoryExists($destination);

                continue;
            }

            $twin = $dedupeFrom === null ? null : $dedupeFrom.'/'.$relative;
            $origin = $twin !== null && $this->sameBytes($item->getPathname(), $twin) ? $twin : $item->getPathname();

            if (! @link($origin, $destination) && ! @copy($origin, $destination)) {
                throw new RuntimeException("could not mirror {$item->getPathname()}");
            }
        }
    }

    /**
     * The stamp a published tree directory carries in its version.json.
     *
     * @return array{patch: string, hash: string}|null
     */
    public function treeStamp(string $treeDirectory): ?array
    {
        $file = $treeDirectory.'/version.json';

        if (! is_file($file)) {
            return null;
        }

        $decoded = json_decode((string) file_get_contents($file), true);
        $patch = is_array($decoded) ? ($decoded['patch'] ?? null) : null;

        if (! is_string($patch) || $patch === '') {
            return null;
        }

        $hash = $decoded['v'] ?? null;

        return ['patch' => $patch, 'hash' => is_string($hash) ? $hash : ''];
    }

    private function sameBytes(string $file, string $other): bool
    {
        return is_file($other)
            && filesize($file) === filesize($other)
            && hash_file('xxh128', $file) === hash_file('xxh128', $other);
    }
}

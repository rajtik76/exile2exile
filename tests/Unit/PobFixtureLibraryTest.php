<?php

declare(strict_types=1);

use App\Pob\Data\Ascendancy;
use App\Pob\Data\CharacterClass;
use App\Pob\PobImport;

/**
 * The build library under resources/pob/poe2 holds one PoB export per class and
 * ascendancy. The directory layout encodes the expected data:
 *
 *   <Class>/lvl-<level>-<class>.txt                       - base class, no ascendancy
 *   <Class>/<Ascendancy>/lvl-<level>-<class>-<asc>.txt    - ascended build
 *
 * where <Class> is the exact CharacterClass value and <Ascendancy> is the
 * Ascendancy value with spaces written as hyphens. Each fixture must decode and
 * report a class, ascendancy and level matching its path.
 *
 * @return iterable<string, array{string, CharacterClass, ?Ascendancy, int}>
 */
function structuredBuildFixtures(): iterable
{
    $root = dirname(__DIR__, 2).'/resources/pob/poe2';
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
    );

    foreach ($iterator as $file) {
        if ($file->getExtension() !== 'txt') {
            continue;
        }

        $relative = substr((string) $file->getPathname(), strlen($root) + 1);
        $segments = explode(DIRECTORY_SEPARATOR, $relative);

        // Only the per-class library follows the convention; loose fixtures at
        // the root (covered by PobImportTest) are skipped.
        if (count($segments) < 2) {
            continue;
        }

        $class = CharacterClass::from($segments[0]);
        $ascendancy = count($segments) === 3
            ? Ascendancy::from(str_replace('-', ' ', $segments[1]))
            : null;

        preg_match('/lvl-(\d+)/', (string) $file->getFilename(), $match);
        $level = (int) ($match[1] ?? 0);

        yield $relative => [$relative, $class, $ascendancy, $level];
    }
}

dataset('structured builds', structuredBuildFixtures());

it('decodes every class and ascendancy fixture to its declared identity', function (
    string $relative,
    CharacterClass $class,
    ?Ascendancy $ascendancy,
    int $level,
) {
    $build = (new PobImport)->import(
        file_get_contents(dirname(__DIR__, 2)."/resources/pob/poe2/{$relative}"),
    );

    expect($build->class)->toBe($class)
        ->and($build->ascendancy)->toBe($ascendancy)
        ->and($build->level)->toBe($level)
        ->and($build->level)->toBeGreaterThan(0);

    if ($ascendancy !== null) {
        expect($ascendancy->characterClass())->toBe($class);
    }
})->with('structured builds');

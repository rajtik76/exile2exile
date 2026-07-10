<?php

declare(strict_types=1);

use Rector\Config\RectorConfig;

return RectorConfig::configure()
    ->withPaths([
        __DIR__.'/app',
        __DIR__.'/config',
        __DIR__.'/database',
        __DIR__.'/routes',
        __DIR__.'/tests',
    ])
    // Modernise syntax up to the PHP version pinned in composer.json (8.4).
    // This is what enforces typed class constants, among other upgrades.
    ->withPhpSets();

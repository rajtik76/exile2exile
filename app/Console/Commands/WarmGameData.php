<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\WarmGameDataCache;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Builds every derived game-data index into the cache for the live data version, so no
 * web request ever builds one: splitting the gem scaling index per gem decodes the whole
 * multi-MB file once, too close to the web workers' memory limit. Run at container start
 * and after a release goes live ({@see WarmGameDataCache}); a no-op once the cache is warm.
 */
#[Signature('poe2:warm-game-data')]
#[Description('Build the derived game-data indices into the cache')]
class WarmGameData extends Command
{
    /** Headroom for decoding the largest data file, well above the web workers' limit. */
    private const string MEMORY_LIMIT = '1G';

    public function handle(IconResolver $icons, ModCatalogue $mods): int
    {
        ini_set('memory_limit', self::MEMORY_LIMIT);

        $icons->warm();
        $mods->warm();

        $this->info(sprintf('Game-data caches warm for %s.', config()->string('poe.data_version')));

        return self::SUCCESS;
    }
}

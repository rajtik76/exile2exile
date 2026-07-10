<?php

namespace App\Providers;

use App\Build\CachedTreeIndex;
use App\Build\TreeIndex;
use App\Filter\Economy\EconomyFilterBuilder;
use App\Filter\Economy\PriceTierPolicy;
use App\Filter\Neversink\NeversinkFilterRepository;
use App\Pob\Decoding\BuildDecoder;
use App\Pob\Decoding\CachingBuildDecoder;
use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Pob\PobImport;
use App\Pob\Reference\BuildReference;
use App\Pob\Reference\LeagueReference;
use App\Pob\Source\BuildSourceRegistry;
use App\Pob\Source\PobbinSource;
use App\Pob\Source\RawPobCodeSource;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    #[\Override]
    public function register(): void
    {
        // Reference/icon and mod catalogues parse multi-MB GGPK JSON. Give each the
        // cache + data version so the derived indices are built once (rememberForever,
        // versioned key) instead of re-parsed on every reference/mod search request.
        $this->app->singleton(IconResolver::class, fn ($app): IconResolver => new IconResolver(
            $app->make(Cache::class),
            config()->string('poe.data_version'),
        ));

        $this->app->singleton(ModCatalogue::class, fn ($app): ModCatalogue => new ModCatalogue(
            $app->make(Cache::class),
            config()->string('poe.data_version'),
        ));

        // The loot-filter generator with its default price ladder and Exile to Exile
        // theme. Stateless, so a singleton is fine; the price data it reads comes from
        // the cached snapshot at build time, not from here.
        $this->app->singleton(EconomyFilterBuilder::class, fn ($app): EconomyFilterBuilder => new EconomyFilterBuilder(
            PriceTierPolicy::default(),
            $app->make(IconResolver::class),
        ));

        // The vendored NeverSink filter set is the base every generated filter starts from.
        $this->app->singleton(NeversinkFilterRepository::class, fn (): NeversinkFilterRepository => NeversinkFilterRepository::default());

        // Decoding code -> snapshot is a pure function, so cache it by content +
        // data version, which a data refresh bumps automatically to bust the cache.
        $this->app->singleton(BuildDecoder::class, fn ($app): BuildDecoder => new CachingBuildDecoder(
            $app->make(PobImport::class),
            $app->make(Cache::class),
            config()->string('poe.data_version'),
        ));

        // Slim node/gem id sets for the current league, derived from the bundled
        // game data and cached (never the multi-MB source files themselves).
        $this->app->singleton(BuildReference::class, fn ($app): BuildReference => new LeagueReference(
            $app->make(Cache::class),
            config()->string('poe.data_version'),
            public_path('tree/current/data.json'),
            resource_path('poe2/ggpk/gems.json'),
        ));

        // Slim name/kind and class-override lookups for the current league, so a
        // shared allocation can be resolved to a named summary. Cached like the
        // reference sets above; never holds the multi-MB geometry.
        $this->app->singleton(TreeIndex::class, fn ($app): TreeIndex => new CachedTreeIndex(
            $app->make(Cache::class),
            config()->string('poe.data_version'),
            public_path('tree/current/data.json'),
        ));

        // Ordered: a pobb.in link is recognised before the raw-code fallback,
        // which claims any other non-empty input. New sources slot in here.
        $this->app->singleton(BuildSourceRegistry::class, fn ($app): BuildSourceRegistry => new BuildSourceRegistry([
            $app->make(PobbinSource::class),
            $app->make(RawPobCodeSource::class),
        ]));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // Cache-busting stamp for the version-less /tree/current assets. publish.mjs
        // writes it on every data refresh; the root view emits it as a <meta> tag the
        // frontend appends as ?v= to tree URLs, so a refresh busts the immutable cache.
        view()->share('treeAssetVersion', $this->treeAssetVersion());
    }

    /**
     * Content stamp for the published passive-tree assets. Prefers the committed
     * version.json (written by publish.mjs); falls back to a hash of data.json so
     * a fresh checkout that has not published yet still busts correctly.
     */
    protected function treeAssetVersion(): string
    {
        $stamp = public_path('tree/current/version.json');

        if (is_file($stamp)) {
            $decoded = json_decode((string) file_get_contents($stamp), true);

            if (is_array($decoded) && isset($decoded['v'])) {
                return (string) $decoded['v'];
            }
        }

        $data = public_path('tree/current/data.json');

        return is_file($data) ? substr((string) md5_file($data), 0, 12) : 'dev';
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );

        URL::forceHttps(app()->isProduction());
    }
}

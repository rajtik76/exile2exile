<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Economy\PriceBook;
use App\Filter\Build\BuildFilterBuilder;
use App\Filter\Custom\CustomFilterTransformer;
use App\Filter\Custom\FilterCategory;
use App\Filter\Economy\EconomyFilterBuilder;
use App\Filter\FilterBlock;
use App\Filter\Neversink\NeversinkFilterRepository;
use App\Filter\Neversink\NeversinkPreviewBuilder;
use App\Filter\Neversink\NeversinkStrictness;
use App\Filter\Neversink\NeversinkStyle;
use App\Filter\Neversink\NeversinkStyleExtractor;
use App\Filter\Neversink\NeversinkStyleTheme;
use App\Models\BuildPlan;
use App\Models\EconomyPrice;
use App\Support\Planner\PlanSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Serves generated in-game loot filters. Every filter starts from a vendored NeverSink filter
 * ({@see NeversinkFilterRepository}) - so with no app overrides it behaves exactly like
 * NeverSink's - and the app then prepends override blocks that edit only what to highlight,
 * driven by the cached poe2scout economy ({@see EconomyPrice}) and, for a build's own filter,
 * the saved build. The overrides win via the game's first-match-wins rule; the rest of the
 * NeverSink file is untouched and styled 1:1 in the chosen NeverSink theme.
 */
class FilterController extends Controller
{
    /** Currency price tier (1 = dearest) to the NeverSink currency markers to style it like. */
    private const array CURRENCY_LADDER = [
        ['$type->currency $tier->s', '$type->currency $tier->a'],
        ['$type->currency $tier->a', '$type->currency $tier->b'],
        ['$type->currency $tier->b', '$type->currency $tier->c'],
        ['$type->currency $tier->c', '$type->currency $tier->d'],
        ['$type->currency $tier->d', '$type->currency $tier->e', '$type->currency $tier->c'],
    ];

    /** Unique price tier (1 = dearest) to the NeverSink unique markers to style it like. */
    private const array UNIQUE_LADDER = [
        ['$type->uniques $tier->t1'],
        ['$type->uniques $tier->t2', '$type->uniques $tier->t1'],
        ['$type->uniques $tier->t3', '$type->uniques $tier->t2'],
        ['$type->uniques $tier->t3', '$type->uniques $tier->t2'],
        ['$type->uniques $tier->t3', '$type->uniques $tier->t2'],
    ];

    /** Build-overlay visual tiers: wanted mods loudest, base upgrades a notch below. */
    private const array BUILD_LADDER = [
        ['$type->currency $tier->s', '$type->uniques $tier->t1'],
        ['$type->uniques $tier->t2', '$type->currency $tier->b'],
    ];

    /**
     * Stream the economy-only filter for a league: a NeverSink filter with the app's live
     * poe2scout highlights prepended. The league defaults to the configured/most-stocked one;
     * an unknown `?league=` or an empty snapshot 404s.
     */
    public function economy(Request $request, NeversinkFilterRepository $repo, EconomyFilterBuilder $economy): Response
    {
        $league = $this->resolveLeague($request->query('league'));

        abort_if($league === null, 404, 'No economy data is available yet.');

        $style = $this->resolveStyle($request->query('theme'));
        $strictness = $this->resolveStrictness($request->query('strictness'));
        $disabled = $this->resolveDisabledCategories($request->query('off'));

        [$filter, $applied] = $this->compose($repo, $style, $strictness, $economy, $league, disabled: $disabled);

        return $this->download($filter, $this->filterName('Exile to Exile', null, $style, $strictness, $applied));
    }

    /**
     * Stream a build's own filter: the NeverSink base with the app's economy highlights and
     * the build-aware overlay (bases and mods the build wants) prepended.
     */
    public function build(Request $request, BuildPlan $plan, NeversinkFilterRepository $repo, EconomyFilterBuilder $economy, BuildFilterBuilder $buildAware): Response
    {
        $style = $this->resolveStyle($request->query('theme'));
        $strictness = $this->resolveStrictness($request->query('strictness'));
        $league = $this->resolveLeague($request->query('league'));
        $disabled = $this->resolveDisabledCategories($request->query('off'));

        $planData = PlanSchema::normalize($plan->data, $plan->schema_version);

        [$filter, $applied] = $this->compose($repo, $style, $strictness, $economy, $league, $buildAware, $planData, $plan->title, $disabled);

        return $this->download(
            $filter,
            $this->filterName($plan->title, $request->query('phase'), $style, $strictness, $applied),
        );
    }

    /**
     * Sample labels for the on-page preview of a theme and strictness, read from the vendored
     * NeverSink filter so the preview shows exactly how drops look under that pick. Custom
     * category picks (`?off=`) are applied to the body the same way the download does; the
     * economy/build override highlights layered on top of a download are not simulated here.
     */
    public function preview(Request $request, NeversinkFilterRepository $repo, NeversinkPreviewBuilder $preview): JsonResponse
    {
        $style = $this->resolveStyle($request->query('theme'));
        $strictness = $this->resolveStrictness($request->query('strictness'));
        $disabled = $this->resolveDisabledCategories($request->query('off'));

        $custom = (new CustomFilterTransformer)->apply($repo->body($style, $strictness), $disabled);

        return response()->json([
            'labels' => $preview->labels($custom->body),
        ]);
    }

    /**
     * Compose the final filter: the app's override blocks (economy, then the build overlay)
     * prepended above the verbatim NeverSink body. The overrides are styled 1:1 from the same
     * NeverSink file, so they read as NeverSink's own tiers. With Custom category picks the
     * body's blocks in disabled categories are flipped to Hide ({@see CustomFilterTransformer})
     * and the economy overlay skips their base types - a pick is the player's word, live
     * prices never re-show a hidden category. Only the build overlay always stays on top.
     *
     * Returns the filter text plus the picks that actually flipped something at this
     * strictness, so the banner and file name never claim a hide that did not happen.
     *
     * @param  array<string, mixed>|null  $planData
     * @param  list<FilterCategory>  $disabled
     * @return array{string, list<FilterCategory>}
     */
    private function compose(
        NeversinkFilterRepository $repo,
        NeversinkStyle $style,
        NeversinkStrictness $strictness,
        EconomyFilterBuilder $economy,
        ?string $league,
        ?BuildFilterBuilder $buildAware = null,
        ?array $planData = null,
        ?string $buildName = null,
        array $disabled = [],
    ): array {
        $body = $repo->body($style, $strictness);
        $extractor = new NeversinkStyleExtractor($body);

        $custom = (new CustomFilterTransformer)->apply($body, $disabled);
        $body = $custom->body;

        $currencyTheme = new NeversinkStyleTheme($extractor, self::CURRENCY_LADDER);
        $uniqueTheme = new NeversinkStyleTheme($extractor, self::UNIQUE_LADDER);
        $buildTheme = new NeversinkStyleTheme($extractor, self::BUILD_LADDER);

        /** @var list<FilterBlock> $overlay */
        $overlay = [];

        if ($buildAware !== null && $planData !== null) {
            $overlay = [
                ...$overlay,
                ...$buildAware->blocks($planData, $buildTheme, $this->buildFloor($strictness)),
            ];
        }

        if ($league !== null) {
            $overlay = [
                ...$overlay,
                ...$economy->blocks(PriceBook::forLeague($league), $currencyTheme, $uniqueTheme, $custom->hiddenBaseTypes),
            ];
        }

        $sections = [$this->overlayHeader($style, $strictness, $league, $buildName, $custom->applied)];

        foreach ($overlay as $block) {
            $sections[] = $block->render();
        }

        $sections[] = $body;

        return [implode("\n\n", $sections), $custom->applied];
    }

    /**
     * The banner that opens the app's override section, above NeverSink's own file. Carries the
     * project name and URL, the build it was made for and the generation date, and credits
     * NeverSink and its MIT licence, since the body below is theirs.
     *
     * @param  list<FilterCategory>  $disabled
     */
    private function overlayHeader(NeversinkStyle $style, NeversinkStrictness $strictness, ?string $league, ?string $buildName, array $disabled = []): string
    {
        $lines = [
            '#===============================================================================',
            '# '.config()->string('app.name').' - loot filter',
            '# '.config()->string('app.url'),
        ];

        if ($buildName !== null && trim($buildName) !== '') {
            $lines[] = '# Build: '.trim($buildName);
        }

        $lines[] = '# Generated: '.now()->format('Y-m-d H:i:s T');
        $lines[] = "# Theme: {$style->label()}  |  Strictness: {$strictness->label()}".($league === null ? '' : "  |  League: {$league}");

        if ($disabled !== []) {
            $lines[] = '# Hidden categories: '.implode(', ', array_map(
                static fn (FilterCategory $category): string => $category->label(),
                $disabled,
            ));
        }

        $lines[] = '#';
        $lines[] = '# Built on NeverSink\'s Indepth Loot Filter for Path of Exile 2, used under the MIT';
        $lines[] = '# License (Copyright (c) 2026 NeverSink). The blocks in this section override what';
        $lines[] = '# to highlight, from live poe2scout prices and your build; everything below is';
        $lines[] = '# NeverSink\'s filter, unchanged.';
        $lines[] = '# NeverSink: https://github.com/NeverSinkDev/NeverSink-Filter-for-PoE2';
        $lines[] = '#===============================================================================';

        return implode("\n", $lines);
    }

    /** A downloadable plain-text `.filter` response the player drops into their PoE2 config folder. */
    private function download(string $filter, string $basename): Response
    {
        return response($filter, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"{$basename}.filter\"",
        ]);
    }

    /**
     * A readable download basename. Path of Exile 2 shows the file name as the filter's name
     * in-game, so keep it human ("Cold Witch - Early Endgame (Cobalt, Strict)"); custom
     * category picks are flagged as "Strict custom".
     *
     * @param  list<FilterCategory>  $disabled
     */
    private function filterName(string $title, mixed $phase, NeversinkStyle $style, NeversinkStrictness $strictness, array $disabled = []): string
    {
        $name = trim($title) !== '' ? trim($title) : 'Exile to Exile';

        if (is_string($phase) && trim($phase) !== '') {
            $name .= ' - '.trim($phase);
        }

        $strictnessLabel = $strictness->label().($disabled === [] ? '' : ' custom');
        $name .= " ({$style->label()}, {$strictnessLabel})";

        return trim((string) preg_replace('#[/\\\\:*?"<>|]+#', ' ', $name));
    }

    private function resolveStyle(mixed $requested): NeversinkStyle
    {
        return is_string($requested) ? NeversinkStyle::tryFrom($requested) ?? NeversinkStyle::default() : NeversinkStyle::default();
    }

    private function resolveStrictness(mixed $requested): NeversinkStrictness
    {
        return is_string($requested) ? NeversinkStrictness::tryFrom($requested) ?? NeversinkStrictness::default() : NeversinkStrictness::default();
    }

    /**
     * The Custom picks: `?off=` is a comma-separated list of category slugs to hide on top of
     * the chosen strictness. Unknown slugs are ignored, so a stale bookmarked URL still works.
     *
     * @return list<FilterCategory>
     */
    private function resolveDisabledCategories(mixed $requested): array
    {
        if (! is_string($requested) || trim($requested) === '') {
            return [];
        }

        $categories = [];

        foreach (explode(',', $requested) as $slug) {
            $category = FilterCategory::tryFrom(trim($slug));

            if ($category !== null && ! in_array($category, $categories, true)) {
                $categories[] = $category;
            }
        }

        return $categories;
    }

    /** The UnidentifiedItemTier floor for the build's base-upgrade highlight, rising with strictness. */
    private function buildFloor(NeversinkStrictness $strictness): int
    {
        return match (true) {
            $strictness->level() >= 4 => 4,
            $strictness->level() >= 2 => 3,
            default => 2,
        };
    }

    /**
     * The league to build for: a valid explicit request wins; otherwise the first configured
     * league that has cached prices, falling back to the most-stocked league. Null when no
     * league has any prices yet.
     */
    private function resolveLeague(mixed $requested): ?string
    {
        /** @var list<string> $available */
        $available = EconomyPrice::query()->distinct()->pluck('league')->all();

        if ($available === []) {
            return null;
        }

        if (is_string($requested) && $requested !== '') {
            return in_array($requested, $available, true) ? $requested : null;
        }

        /** @var list<string> $configured */
        $configured = config()->array('poe.economy.leagues');

        foreach ($configured as $league) {
            if (in_array($league, $available, true)) {
                return $league;
            }
        }

        $mostStocked = EconomyPrice::query()
            ->getQuery()
            ->select('league')
            ->groupBy('league')
            ->orderByRaw('count(*) desc')
            ->value('league');

        return is_string($mostStocked) ? $mostStocked : null;
    }
}

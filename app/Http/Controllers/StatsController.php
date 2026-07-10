<?php

namespace App\Http\Controllers;

use App\Models\BuildPlan;
use App\Models\PageView;
use App\Models\PatchSubscriber;
use App\Models\SharedBuild;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class StatsController extends Controller
{
    /**
     * First-party analytics dashboard. Every number is aggregated from the
     * page_views table the TrackPageView middleware fills, plus the live
     * webhook subscriber counts. Guarded by StatsBasicAuth on the route.
     */
    public function index(): Response
    {
        $since = now()->subDays(29)->startOfDay();

        return Inertia::render('stats', [
            'totals' => [
                'views' => PageView::query()->count(),
                'visitors' => PageView::query()->distinct()->count('visitor'),
                'viewsLast30Days' => PageView::query()->where('created_at', '>=', $since)->count(),
                'webhooksTotal' => PatchSubscriber::query()->count(),
                'webhooksVerified' => PatchSubscriber::query()->verified()->count(),
                'buildsStored' => SharedBuild::query()->count(),
                'plansStored' => BuildPlan::query()->count(),
            ],
            'topPaths' => $this->topPaths(),
            'topReferrers' => $this->topReferrers(),
            'devices' => $this->devices(),
            'daily' => $this->daily($since),
        ]);
    }

    /**
     * View counts split by the device class the visitor came from, busiest
     * first. Buckets are mobile / tablet / desktop (see DeviceType).
     *
     * @return list<array{device: string, views: int, visitors: int}>
     */
    private function devices(): array
    {
        return array_values(
            PageView::query()
                ->selectRaw('device, count(*) as views, count(distinct visitor) as visitors')
                ->groupBy('device')
                ->orderByDesc('views')
                ->toBase()
                ->get()
                ->map(fn (object $row): array => [
                    'device' => (string) $row->device,
                    'views' => (int) $row->views,
                    'visitors' => (int) $row->visitors,
                ])
                ->all()
        );
    }

    /**
     * The most-visited paths, with their view and unique-visitor counts.
     *
     * @return list<array{path: string, views: int, visitors: int}>
     */
    private function topPaths(): array
    {
        return array_values(
            PageView::query()
                ->selectRaw('path, count(*) as views, count(distinct visitor) as visitors')
                ->groupBy('path')
                ->orderByDesc('views')
                ->limit(20)
                ->toBase()
                ->get()
                ->map(fn (object $row): array => [
                    'path' => (string) $row->path,
                    'views' => (int) $row->views,
                    'visitors' => (int) $row->visitors,
                ])
                ->all()
        );
    }

    /**
     * Top external referrers by view count. Internal navigations send no
     * Referer (or our own host), so they fall away as null.
     *
     * @return list<array{referrer: string, views: int}>
     */
    private function topReferrers(): array
    {
        return array_values(
            PageView::query()
                ->selectRaw('referrer, count(*) as views')
                ->whereNotNull('referrer')
                ->groupBy('referrer')
                ->orderByDesc('views')
                ->limit(15)
                ->toBase()
                ->get()
                ->map(fn (object $row): array => [
                    'referrer' => (string) $row->referrer,
                    'views' => (int) $row->views,
                ])
                ->all()
        );
    }

    /**
     * Daily views and unique visitors for the last 30 days, zero-filled so the
     * chart has a continuous x-axis even on days with no traffic.
     *
     * @return list<array{date: string, views: int, visitors: int}>
     */
    private function daily(CarbonInterface $since): array
    {
        /** @var Collection<string, array{views: int, visitors: int}> $rows */
        $rows = PageView::query()
            ->selectRaw('date(created_at) as day, count(*) as views, count(distinct visitor) as visitors')
            ->where('created_at', '>=', $since)
            ->groupBy('day')
            ->toBase()
            ->get()
            ->keyBy('day')
            ->map(fn (object $row): array => [
                'views' => (int) $row->views,
                'visitors' => (int) $row->visitors,
            ]);

        $days = [];

        for ($cursor = $since; $cursor->lte(now()); $cursor = $cursor->addDay()) {
            $key = $cursor->format('Y-m-d');
            $days[] = [
                'date' => $key,
                'views' => $rows[$key]['views'] ?? 0,
                'visitors' => $rows[$key]['visitors'] ?? 0,
            ];
        }

        return $days;
    }
}

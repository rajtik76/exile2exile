<?php

namespace App\Http\Middleware;

use App\Support\Poe2PatchStatus;
use App\Support\TreeDataVersion;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    #[\Override]
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    #[\Override]
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            // Latest PoE2 version + last poll + release time for the nav. Polled
            // client-side (see usePatchStatus), so this refreshes without a nav.
            'patch' => app(Poe2PatchStatus::class)->current(),
            // The patch the app's own committed data was built from. Request-only
            // (never polled): it only moves when a data refresh ships a new build.
            'dataVersion' => app(TreeDataVersion::class)->current(),
        ];
    }
}

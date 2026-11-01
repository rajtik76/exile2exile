<?php

namespace App\Http\Controllers;

use App\Models\BuildPlan;
use App\Models\NewsletterSubscriber;
use App\Models\PatchSubscriber;
use App\Models\SharedTree;
use Inertia\Inertia;
use Inertia\Response;

class StatsController extends Controller
{
    /**
     * Internal dashboard of stored record counts. Traffic lives in Umami.
     * Guarded by StatsBasicAuth on the route.
     */
    public function index(): Response
    {
        return Inertia::render('stats', [
            'totals' => [
                'webhooksTotal' => PatchSubscriber::query()->count(),
                'webhooksVerified' => PatchSubscriber::query()->verified()->count(),
                'newsletterTotal' => NewsletterSubscriber::query()->count(),
                'newsletterConfirmed' => NewsletterSubscriber::query()->confirmed()->count(),
                'treesStored' => SharedTree::query()->count(),
                'plansStored' => BuildPlan::query()->count(),
            ],
        ]);
    }
}

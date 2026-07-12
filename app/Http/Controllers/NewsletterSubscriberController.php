<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Action\CreateNewsletterSubscriber;
use App\Http\Requests\NewsletterSubscriberCreateRequest;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Public newsletter signup with double opt-in. Confirm and unsubscribe links
 * arrive by email as signed URLs (validated by the `signed` middleware on the
 * routes). Both links render an interstitial page on GET and only mutate on
 * POST: mail security scanners prefetch GET links from delivered mail, so a
 * bare GET must never confirm or delete a subscription. The only POST allowed
 * to skip the interstitial is the RFC 8058 one-click unsubscribe from a mail
 * provider (CSRF-exempt in bootstrap/app.php, still signature-checked).
 */
class NewsletterSubscriberController extends Controller
{
    public function create(): InertiaResponse
    {
        return Inertia::render('newsletter', [
            'status' => session('newsletter.status'),
        ]);
    }

    public function store(NewsletterSubscriberCreateRequest $request, CreateNewsletterSubscriber $createNewsletterSubscriber): RedirectResponse
    {
        $createNewsletterSubscriber($request->validated('email'));

        return redirect()->route('newsletter.create')->with('newsletter.status', 'pending');
    }

    public function confirm(Request $request, NewsletterSubscriber $subscriber): RedirectResponse|InertiaResponse
    {
        if ($request->isMethod('GET')) {
            return Inertia::render('newsletter', [
                'status' => 'confirm-pending',
                'actionUrl' => $request->fullUrl(),
            ]);
        }

        if ($subscriber->confirmed_at === null) {
            // confirmed_at is not mass-assignable (a signup payload must not
            // self-confirm), so it is set here via forceFill.
            $subscriber->forceFill(['confirmed_at' => now()])->save();
        }

        return redirect()->route('newsletter.create')->with('newsletter.status', 'confirmed');
    }

    public function unsubscribe(Request $request, NewsletterSubscriber $subscriber): RedirectResponse|InertiaResponse|Response
    {
        if ($request->isMethod('GET')) {
            return Inertia::render('newsletter', [
                'status' => 'unsubscribe-pending',
                'actionUrl' => $request->fullUrl(),
            ]);
        }

        $subscriber->delete();

        // RFC 8058 one-click unsubscribe: mail providers POST to the link and
        // only need a 2xx, while the interstitial's Inertia form expects the
        // usual redirect to the status page.
        if (! $request->inertia()) {
            return response()->noContent(200);
        }

        return redirect()->route('newsletter.create')->with('newsletter.status', 'unsubscribed');
    }
}

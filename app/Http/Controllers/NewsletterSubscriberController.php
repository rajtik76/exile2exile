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

/**
 * Public newsletter signup with double opt-in. Confirm and unsubscribe links
 * arrive by email as signed URLs (validated by the `signed` middleware on the
 * routes), so no secret column or login is needed to authorize them.
 */
class NewsletterSubscriberController extends Controller
{
    public function create(): \Inertia\Response
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

    public function confirm(NewsletterSubscriber $subscriber): RedirectResponse
    {
        if ($subscriber->confirmed_at === null) {
            // confirmed_at is not mass-assignable (a signup payload must not
            // self-confirm), so it is set here via forceFill.
            $subscriber->forceFill(['confirmed_at' => now()])->save();
        }

        return redirect()->route('newsletter.create')->with('newsletter.status', 'confirmed');
    }

    public function unsubscribe(Request $request, NewsletterSubscriber $subscriber): RedirectResponse|Response
    {
        $subscriber->delete();

        // RFC 8058 one-click unsubscribe: mail providers POST to the link and
        // only need a 2xx, while a human clicking it lands on the status page.
        if ($request->isMethod('POST')) {
            return response()->noContent(200);
        }

        return redirect()->route('newsletter.create')->with('newsletter.status', 'unsubscribed');
    }
}

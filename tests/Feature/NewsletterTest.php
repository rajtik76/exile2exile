<?php

declare(strict_types=1);

use App\Action\CreateNewsletter;
use App\Enums\Queue;
use App\Events\NewsletterCreatedEvent;
use App\Listeners\SendNewsletterListener;
use App\Mail\NewsletterConfirmationMail;
use App\Mail\NewsletterMail;
use App\Models\Newsletter;
use App\Models\NewsletterSubscriber;
use Captchaapi\Laravel\Facades\Captchaapi;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Mail\SendQueuedMailable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue as QueueFacade;
use Inertia\Testing\AssertableInertia;

it('renders the signup page with the flashed opt-in status', function () {
    $this->withSession(['newsletter.status' => 'pending'])
        ->get('/newsletter')
        ->assertSuccessful()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('newsletter')
            ->where('status', 'pending'));
});

it('shares whether captchaapi is enabled with the signup page', function () {
    config(['captchaapi.enabled' => true]);

    $this->get('/newsletter')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('captchaEnabled', true));

    config(['captchaapi.enabled' => false]);

    $this->get('/newsletter')
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('captchaEnabled', false));
});

it('rejects a signup missing captchaapi_response when captchaapi is enabled', function () {
    config(['captchaapi.enabled' => true]);
    Captchaapi::fake();
    Captchaapi::enforceSingleUse();
    Mail::fake();

    $this->from('/newsletter')
        ->post('/newsletter', ['email' => 'exile@example.com'])
        ->assertRedirect('/newsletter')
        ->assertSessionHasErrors('captchaapi_response');

    expect(NewsletterSubscriber::query()->count())->toBe(0);
    Mail::assertNothingQueued();
});

it('accepts a signup with a valid captchaapi_response when captchaapi is enabled', function () {
    config(['captchaapi.enabled' => true]);
    Captchaapi::fake();
    Captchaapi::enforceSingleUse();
    Mail::fake();

    $this->post('/newsletter', [
        'email' => 'exile@example.com',
        'captchaapi_response' => 'test-token',
    ])
        ->assertRedirect(route('newsletter.create'))
        ->assertSessionHasNoErrors();

    expect(NewsletterSubscriber::query()->count())->toBe(1);
    Mail::assertQueued(NewsletterConfirmationMail::class, 'exile@example.com');
});

it('renders the newsletter issue with markdown body, unsubscribe link and RFC 8058 headers', function () {
    $newsletter = Newsletter::factory()->create(['title' => 'July news', 'body' => "# Fresh loot\n\nHello exiles"]);
    $mail = new NewsletterMail($newsletter, 'https://example.com/unsubscribe/token-abc');

    $mail->assertHasSubject('July news');

    $html = $mail->render();
    expect($html)->toContain('Fresh loot')
        ->toContain('Hello exiles')
        ->toContain('https://example.com/unsubscribe/token-abc');

    $headers = $mail->headers()->text;
    expect($headers['List-Unsubscribe'])->toBe('<https://example.com/unsubscribe/token-abc>')
        ->and($headers['List-Unsubscribe-Post'])->toBe('List-Unsubscribe=One-Click');
});

it('renders the confirmation mail with the signed confirm link', function () {
    $mail = new NewsletterConfirmationMail('https://example.com/confirm?signature=abc');

    $mail->assertHasSubject('Confirm your '.config('app.name').' newsletter subscription');
    expect($mail->render())->toContain('https://example.com/confirm?signature=abc');
});

it('signs an email up unconfirmed and queues the confirmation mail', function () {
    Mail::fake();

    $this->post('/newsletter', ['email' => 'exile@example.com'])
        ->assertRedirect(route('newsletter.create'));

    $subscriber = NewsletterSubscriber::query()->firstOrFail();
    expect($subscriber->email)->toBe('exile@example.com')
        ->and($subscriber->confirmed_at)->toBeNull();

    Mail::assertQueued(NewsletterConfirmationMail::class, 'exile@example.com');
});

it('pushes newsletter emails onto the mail queue', function () {
    QueueFacade::fake();

    Mail::to('exile@example.com')->queue(new NewsletterConfirmationMail('https://example.com/confirm'));
    Mail::to('exile@example.com')->queue(new NewsletterMail(Newsletter::factory()->create(), 'https://example.com/unsubscribe'));

    QueueFacade::assertPushedOn(
        Queue::Mail->value,
        SendQueuedMailable::class,
        fn (SendQueuedMailable $job) => $job->mailable instanceof NewsletterConfirmationMail,
    );
    QueueFacade::assertPushedOn(
        Queue::Mail->value,
        SendQueuedMailable::class,
        fn (SendQueuedMailable $job) => $job->mailable instanceof NewsletterMail,
    );
});

it('rejects invalid signup emails', function (array $payload) {
    Mail::fake();

    $this->from('/newsletter')
        ->post('/newsletter', $payload)
        ->assertRedirect('/newsletter')
        ->assertSessionHasErrors('email');

    expect(NewsletterSubscriber::query()->count())->toBe(0);
    Mail::assertNothingQueued();
})->with([
    'not an email' => [['email' => 'not-an-email']],
    'missing' => [['email' => '']],
]);

it('resends the confirmation for an unconfirmed duplicate signup without revealing it exists', function () {
    Mail::fake();
    NewsletterSubscriber::factory()->create(['email' => 'lost-mail@example.com']);

    $this->post('/newsletter', ['email' => 'lost-mail@example.com'])
        ->assertRedirect(route('newsletter.create'))
        ->assertSessionHasNoErrors();

    expect(NewsletterSubscriber::query()->count())->toBe(1);
    Mail::assertQueued(NewsletterConfirmationMail::class, 'lost-mail@example.com');
});

it('leaves a confirmed duplicate signup untouched and sends nothing', function () {
    Mail::fake();
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create(['email' => 'onboard@example.com']);
    $confirmedAt = $subscriber->confirmed_at;

    $this->post('/newsletter', ['email' => 'onboard@example.com'])
        ->assertRedirect(route('newsletter.create'))
        ->assertSessionHasNoErrors();

    expect(NewsletterSubscriber::query()->count())->toBe(1)
        ->and($subscriber->fresh()->confirmed_at?->equalTo($confirmedAt))->toBeTrue();
    Mail::assertNothingQueued();
});

it('renders an interstitial on the confirm link without confirming', function () {
    $subscriber = NewsletterSubscriber::factory()->create();
    $link = $subscriber->confirmUrl();

    expect($link)->toContain($subscriber->token);

    $this->get($link)
        ->assertSuccessful()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('newsletter')
            ->where('status', 'confirm-pending')
            ->where('actionUrl', $link));

    expect($subscriber->fresh()->confirmed_at)->toBeNull();
});

it('confirms a subscriber through a POST to the confirm link', function () {
    $subscriber = NewsletterSubscriber::factory()->create();

    $this->post($subscriber->confirmUrl())
        ->assertRedirect(route('newsletter.create'));

    expect($subscriber->fresh()->confirmed_at)->not->toBeNull();
});

it('does nothing for confirm and unsubscribe links with an unknown token', function () {
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create();

    $this->get(route('newsletter.confirm', ['subscriber' => 'wrong-token']))
        ->assertRedirect(route('newsletter.create'));
    $this->post(route('newsletter.unsubscribe', ['subscriber' => 'wrong-token']), [], ['X-Inertia' => 'true'])
        ->assertRedirect(route('newsletter.create'));

    expect($subscriber->fresh())->not->toBeNull();
});

it('renders an interstitial on the unsubscribe link without deleting', function () {
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create();
    $link = $subscriber->unsubscribeUrl();

    $this->get($link)
        ->assertSuccessful()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('newsletter')
            ->where('status', 'unsubscribe-pending')
            ->where('actionUrl', $link));

    expect($subscriber->fresh())->not->toBeNull();
});

it('unsubscribes through the interstitial form POST', function () {
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create();

    $this->post($subscriber->unsubscribeUrl(), [], ['X-Inertia' => 'true'])
        ->assertRedirect(route('newsletter.create'));

    expect(NewsletterSubscriber::find($subscriber->id))->toBeNull();
});

it('handles RFC 8058 one-click unsubscribe with a plain 200, including retries on a deleted row', function () {
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create();
    $link = $subscriber->unsubscribeUrl();

    $this->post($link)->assertOk();
    expect(NewsletterSubscriber::find($subscriber->id))->toBeNull();

    // A provider retry after deletion must still get a bare 2xx, not a redirect.
    $this->post($link)->assertOk();
});

it('exempts the one-click unsubscribe route from CSRF validation', function () {
    // CSRF checks are skipped entirely in the test environment, so assert the
    // exemption registered in bootstrap/app.php directly: validateCsrfTokens()
    // merges it into PreventRequestForgery::$neverVerify. A refactor dropping
    // it would 419 every provider one-click POST in production.
    $neverVerify = new ReflectionProperty(
        PreventRequestForgery::class,
        'neverVerify',
    );

    expect($neverVerify->getValue())->toContain('newsletter/unsubscribe/*');
});

it('lands already-used unsubscribe and confirm links on the status page instead of a 404', function () {
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create();
    $unsubscribe = $subscriber->unsubscribeUrl();
    $confirm = $subscriber->confirmUrl();
    $subscriber->delete();

    $this->get($unsubscribe)->assertRedirect(route('newsletter.create'));
    $this->get($confirm)->assertRedirect(route('newsletter.create'));
});

it('sends a created issue to confirmed subscribers only', function () {
    Mail::fake();
    $confirmed = NewsletterSubscriber::factory()->confirmed()->count(2)->create();
    NewsletterSubscriber::factory()->create(['email' => 'unconfirmed@example.com']);

    app(CreateNewsletter::class)('Patch 0.4 tools', '# Whats new');

    Mail::assertQueued(NewsletterMail::class, 2);

    foreach ($confirmed as $subscriber) {
        Mail::assertQueued(NewsletterMail::class, fn (NewsletterMail $mail) => $mail->hasTo($subscriber->email)
            && $mail->newsletter->title === 'Patch 0.4 tools'
            && $mail->newsletter->body === '# Whats new'
            && str_contains($mail->unsubscribeUrl, $subscriber->token));
    }

    Mail::assertNotQueued(NewsletterMail::class, fn (NewsletterMail $mail) => $mail->hasTo('unconfirmed@example.com'));
});

it('resumes an interrupted fan-out after the dispatch cursor instead of double-sending', function () {
    Mail::fake();
    $subscribers = NewsletterSubscriber::factory()->confirmed()->count(3)->create()->sortBy('id')->values();
    $newsletter = Newsletter::factory()->create();

    // Simulate a job that crashed after handling the first two subscribers.
    $newsletter->forceFill(['dispatched_up_to_id' => $subscribers[1]->id])->save();

    new SendNewsletterListener()->handle(new NewsletterCreatedEvent($newsletter));

    Mail::assertQueued(NewsletterMail::class, 1);
    Mail::assertQueued(NewsletterMail::class, fn (NewsletterMail $mail) => $mail->hasTo($subscribers[2]->email));
    expect($newsletter->fresh()->dispatched_up_to_id)->toBe($subscribers[2]->id);
});

it('creates and sends an issue via the artisan command', function () {
    Mail::fake();
    NewsletterSubscriber::factory()->confirmed()->create();

    $bodyFile = tempnam(sys_get_temp_dir(), 'newsletter');
    file_put_contents($bodyFile, '# Hello exiles');

    $this->artisan('poe2:newsletter:create', ['title' => 'July news', '--body-file' => $bodyFile])
        ->expectsConfirmation('Send "July news" to 1 confirmed subscribers?', 'yes')
        ->assertSuccessful();

    unlink($bodyFile);

    expect(Newsletter::query()->count())->toBe(1);
    Mail::assertQueued(NewsletterMail::class, 1);
});

it('asks for the body when no file option is given', function () {
    Mail::fake();

    $this->artisan('poe2:newsletter:create', ['title' => 'Prompted issue'])
        ->expectsQuestion('Newsletter body (markdown)', '# Prompted body')
        ->expectsConfirmation('Send "Prompted issue" to 0 confirmed subscribers?', 'yes')
        ->assertSuccessful();

    expect(Newsletter::query()->sole()->body)->toBe('# Prompted body');
});

it('fails when the body file is not readable', function () {
    $this->artisan('poe2:newsletter:create', ['title' => 'X', '--body-file' => '/nonexistent/body.md'])
        ->assertFailed();

    expect(Newsletter::query()->count())->toBe(0);
});

it('fails when the body is blank', function () {
    $bodyFile = tempnam(sys_get_temp_dir(), 'newsletter');
    file_put_contents($bodyFile, "   \n");

    $this->artisan('poe2:newsletter:create', ['title' => 'X', '--body-file' => $bodyFile])
        ->assertFailed();

    unlink($bodyFile);

    expect(Newsletter::query()->count())->toBe(0);
});

it('creates nothing when the command confirmation is declined', function () {
    Mail::fake();

    $bodyFile = tempnam(sys_get_temp_dir(), 'newsletter');
    file_put_contents($bodyFile, '# Hello exiles');

    $this->artisan('poe2:newsletter:create', ['title' => 'July news', '--body-file' => $bodyFile])
        ->expectsConfirmation('Send "July news" to 0 confirmed subscribers?')
        ->assertSuccessful();

    unlink($bodyFile);

    expect(Newsletter::query()->count())->toBe(0);
    Mail::assertNothingQueued();
});

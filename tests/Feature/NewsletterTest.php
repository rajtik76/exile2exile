<?php

declare(strict_types=1);

use App\Action\CreateNewsletter;
use App\Enums\Queue;
use App\Mail\NewsletterConfirmationMail;
use App\Mail\NewsletterMail;
use App\Models\Newsletter;
use App\Models\NewsletterSubscriber;
use Illuminate\Mail\SendQueuedMailable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue as QueueFacade;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia;

it('renders the signup page with the flashed opt-in status', function () {
    $this->withSession(['newsletter.status' => 'pending'])
        ->get('/newsletter')
        ->assertSuccessful()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('newsletter')
            ->where('status', 'pending'));
});

it('renders the newsletter issue with markdown body, unsubscribe link and RFC 8058 headers', function () {
    $mail = new NewsletterMail('July news', "# Fresh loot\n\nHello exiles", 'https://example.com/unsubscribe?signature=abc');

    $mail->assertHasSubject('July news');

    $html = $mail->render();
    expect($html)->toContain('Fresh loot')
        ->toContain('Hello exiles')
        ->toContain('https://example.com/unsubscribe?signature=abc');

    $headers = $mail->headers()->text;
    expect($headers['List-Unsubscribe'])->toBe('<https://example.com/unsubscribe?signature=abc>')
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
    Mail::to('exile@example.com')->queue(new NewsletterMail('Title', 'Body', 'https://example.com/unsubscribe'));

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

it('rejects invalid or duplicate signup emails', function (array $payload) {
    Mail::fake();
    NewsletterSubscriber::factory()->create(['email' => 'taken@example.com']);

    $this->from('/newsletter')
        ->post('/newsletter', $payload)
        ->assertRedirect('/newsletter')
        ->assertSessionHasErrors('email');

    expect(NewsletterSubscriber::query()->count())->toBe(1);
    Mail::assertNothingQueued();
})->with([
    'not an email' => [['email' => 'not-an-email']],
    'missing' => [['email' => '']],
    'duplicate' => [['email' => 'taken@example.com']],
]);

it('confirms a subscriber through the signed link', function () {
    $subscriber = NewsletterSubscriber::factory()->create();

    $this->get(URL::signedRoute('newsletter.confirm', ['subscriber' => $subscriber]))
        ->assertRedirect(route('newsletter.create'));

    expect($subscriber->fresh()->confirmed_at)->not->toBeNull();
});

it('rejects confirm and unsubscribe links without a valid signature', function () {
    $subscriber = NewsletterSubscriber::factory()->create();

    $this->get(route('newsletter.confirm', ['subscriber' => $subscriber]))->assertForbidden();
    $this->get(route('newsletter.unsubscribe', ['subscriber' => $subscriber]))->assertForbidden();

    expect($subscriber->fresh())->not->toBeNull()
        ->and($subscriber->fresh()->confirmed_at)->toBeNull();
});

it('unsubscribes through the signed link and deletes the row', function () {
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create();

    $this->get(URL::signedRoute('newsletter.unsubscribe', ['subscriber' => $subscriber]))
        ->assertRedirect(route('newsletter.create'));

    expect(NewsletterSubscriber::find($subscriber->id))->toBeNull();
});

it('handles RFC 8058 one-click unsubscribe with a plain 200', function () {
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create();

    $this->post(URL::signedRoute('newsletter.unsubscribe', ['subscriber' => $subscriber]))
        ->assertOk();

    expect(NewsletterSubscriber::find($subscriber->id))->toBeNull();
});

it('lands an already-used unsubscribe link on the status page instead of a 404', function () {
    $subscriber = NewsletterSubscriber::factory()->confirmed()->create();
    $link = URL::signedRoute('newsletter.unsubscribe', ['subscriber' => $subscriber]);
    $subscriber->delete();

    $this->get($link)->assertRedirect(route('newsletter.create'));
});

it('sends a created issue to confirmed subscribers only', function () {
    Mail::fake();
    $confirmed = NewsletterSubscriber::factory()->confirmed()->count(2)->create();
    NewsletterSubscriber::factory()->create(['email' => 'unconfirmed@example.com']);

    app(CreateNewsletter::class)('Patch 0.4 tools', '# Whats new');

    Mail::assertQueued(NewsletterMail::class, 2);

    foreach ($confirmed as $subscriber) {
        Mail::assertQueued(NewsletterMail::class, fn (NewsletterMail $mail) => $mail->hasTo($subscriber->email)
            && $mail->title === 'Patch 0.4 tools'
            && $mail->body === '# Whats new'
            && str_contains($mail->unsubscribeUrl, 'signature='));
    }

    Mail::assertNotQueued(NewsletterMail::class, fn (NewsletterMail $mail) => $mail->hasTo('unconfirmed@example.com'));
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

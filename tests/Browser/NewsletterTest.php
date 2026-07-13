<?php

use App\Models\NewsletterSubscriber;
use Illuminate\Support\Facades\Mail;

test('signing up through the real form creates an unconfirmed subscriber', function () {
    // CAPTCHAAPI_ENABLED=false in .env.testing, so no live widget script is
    // loaded here and the useCaptcha() hook's solve() path is never taken -
    // this only proves the disabled-captcha wiring survives a real browser.
    Mail::fake();

    $page = visit(route('newsletter.create'));

    $page->assertNoJavaScriptErrors()
        ->assertNoConsoleLogs()
        ->fill('email', 'exile@example.com')
        ->click('newsletter-subscribe')
        ->assertSee('check your inbox');

    expect(NewsletterSubscriber::query()->where('email', 'exile@example.com')->exists())->toBeTrue();
});

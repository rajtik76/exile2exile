<?php

use App\Models\NewsletterSubscriber;

beforeEach(function () {
    config([
        'app.url' => 'https://poe.example.com',
        'analytics.umami_website_id' => 'site-123',
        'analytics.user' => 'admin',
        'analytics.password' => 'secret',
    ]);
});

test('pages load the proxied tracker for the app domain without query strings', function () {
    $this->get(route('changelog'))
        ->assertOk()
        ->assertSee('<script defer src="/p/s.js" data-website-id="site-123" data-domains="poe.example.com" data-exclude-search="true"></script>', false);
});

test('no tracker is rendered without a website id', function () {
    config(['analytics.umami_website_id' => '']);

    $this->get(route('changelog'))
        ->assertOk()
        ->assertDontSee('/p/s.js', false);
});

test('the stats dashboard does not load the tracker', function () {
    $this->withBasicAuth('admin', 'secret')
        ->get(route('stats'))
        ->assertOk()
        ->assertDontSee('/p/s.js', false);
});

test('newsletter pages with a token in the path do not load the tracker', function (string $urlMethod) {
    $subscriber = NewsletterSubscriber::factory()->create();

    $this->get($subscriber->{$urlMethod}())
        ->assertOk()
        ->assertDontSee('/p/s.js', false);
})->with(['confirmUrl', 'unsubscribeUrl']);

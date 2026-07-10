<?php

use App\Models\PageView;

test('a normal page visit is recorded', function () {
    $this->get(route('changelog'))->assertOk();

    expect(PageView::query()->count())->toBe(1);

    $view = PageView::query()->first();
    expect($view->path)->toBe('changelog')
        ->and($view->inertia)->toBeFalse()
        ->and($view->visitor)->not->toBeEmpty();
});

test('crawlers are not tracked', function () {
    $this->withHeader('User-Agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
        ->get(route('changelog'))
        ->assertOk();

    expect(PageView::query()->count())->toBe(0);
});

test('the stats dashboard itself is not tracked', function () {
    config(['analytics.user' => 'admin', 'analytics.password' => 'secret']);

    $this->withBasicAuth('admin', 'secret')->get(route('stats'))->assertOk();

    expect(PageView::query()->where('path', 'stats')->count())->toBe(0);
});

test('the raw ip is never stored', function () {
    $this->get(route('changelog'));

    $view = PageView::query()->first();
    expect($view?->visitor)->not->toContain('127.0.0.1');
});

test('the visitor device is recorded from the user agent', function (string $userAgent, string $device) {
    $this->withHeader('User-Agent', $userAgent)->get(route('changelog'))->assertOk();

    expect(PageView::query()->first()?->device)->toBe($device);
})->with([
    'iphone' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', 'mobile'],
    'android phone' => ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36', 'mobile'],
    'ipad' => ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', 'tablet'],
    'android tablet' => ['Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Safari/537.36', 'tablet'],
    'desktop' => ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Safari/537.36', 'desktop'],
]);

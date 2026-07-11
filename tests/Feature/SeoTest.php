<?php

test('robots.txt is served as plain text and carries the configured app url', function () {
    config()->set('app.url', 'https://exile.test');

    $response = $this->get('/robots.txt');

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('text/plain');
    $response->assertSee('https://exile.test', false);
    $response->assertSee('User-agent: *', false);
});

test('llms.txt lists the tools via route-derived urls and drops build-compare', function () {
    $response = $this->get('/llms.txt');

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('text/plain');
    // Internal links come from named routes, so they always carry the app's own host.
    $response->assertSee(route('planner.create'), false);
    $response->assertSee(route('tree'), false);
    $response->assertSee(route('patch-webhook'), false);
    // Both GitHub repos are listed: the app itself and the toolkit packages.
    $response->assertSee('https://github.com/rajtik76/exile2exile', false);
    // The @ in the toolkit link survives Blade escaping.
    $response->assertSee('@poe2-toolkit on GitHub', false);
    // The removed build-compare tool must not reappear.
    $response->assertDontSee('Build compare', false);
});

<?php

test('the landing signpost renders the kit and its tools', function () {
    $page = visit(route('home'));

    $page->assertNoJavaScriptErrors()
        ->assertNoConsoleLogs()
        // identity
        ->assertSee('Exile to Exile')
        // the gem waypoints, each its own tool
        ->assertSee('Tree planner')
        ->assertSee('Build planner')
        ->assertSee('Build filter')
        ->assertSee('Patch alerts')
        ->assertSee('Source')
        // shared footer with the trademark disclaimer
        ->assertSee('Not affiliated with Grinding Gear Games');
});

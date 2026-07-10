<?php

test('the landing signpost renders the kit and its tools', function () {
    $page = visit(route('home'));

    $page->assertNoJavaScriptErrors()
        ->assertNoConsoleLogs()
        // identity + the one-line "what / why"
        ->assertSee('Exile to Exile')
        ->assertSee('one player to another')
        // the gem waypoints, each its own tool
        ->assertSee('Tree planner')
        ->assertSee('Build planner')
        ->assertSee('Build filter')
        ->assertSee('Patch alerts')
        ->assertSee('Source')
        // built-for-the-community footer note
        ->assertSee('made over a cup of coffee');
});

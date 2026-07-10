<?php

namespace App\Http\Controllers;

use Illuminate\Http\Response;

/**
 * Serves the plain-text SEO descriptors (robots.txt, llms.txt) from Blade views so
 * every link is built from the app's own named routes and APP_URL - nothing is
 * hardcoded, so a fork or a preview deploy advertises its own host automatically.
 */
class SeoController extends Controller
{
    public function robots(): Response
    {
        return $this->text('seo.robots');
    }

    public function llms(): Response
    {
        return $this->text('seo.llms');
    }

    private function text(string $view): Response
    {
        return response()->view($view)->header('Content-Type', 'text/plain; charset=UTF-8');
    }
}

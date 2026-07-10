<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Inertia\Response;

class ChangelogController extends Controller
{
    /**
     * Render the changelog, parsed from the repo's CHANGELOG.md so the page and
     * the file never drift apart.
     */
    public function __invoke(): Response
    {
        return Inertia::render('changelog', [
            'entries' => $this->parse(),
        ]);
    }

    /**
     * Turn the markdown into release groups: each `## heading` starts a group,
     * each `- ` line below it is one entry.
     *
     * @return list<array{heading: string, items: list<string>}>
     */
    private function parse(): array
    {
        $path = base_path('CHANGELOG.md');

        if (! File::exists($path)) {
            return [];
        }

        $entries = [];
        $current = null;

        foreach (preg_split('/\R/', File::get($path)) ?: [] as $line) {
            if (str_starts_with($line, '## ')) {
                if ($current !== null) {
                    $entries[] = $current;
                }

                $current = ['heading' => trim(substr($line, 3)), 'items' => []];

                continue;
            }

            if ($current !== null && str_starts_with($line, '- ')) {
                $current['items'][] = trim(substr($line, 2));
            }
        }

        if ($current !== null) {
            $entries[] = $current;
        }

        return $entries;
    }
}

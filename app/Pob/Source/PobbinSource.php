<?php

declare(strict_types=1);

namespace App\Pob\Source;

use App\Pob\Decoding\BuildDecoder;
use App\Pob\PobImport;
use Illuminate\Http\Client\Factory as Http;
use InvalidArgumentException;

/**
 * A pobb.in share link. The paste id is fetched from pobb.in's `/raw` endpoint,
 * which serves the underlying PoB export code verbatim.
 */
final class PobbinSource extends PobCodeSource
{
    /**
     * Matches a pobb.in share link, capturing the paste id.
     */
    private const string PATTERN = '#^https?://(?:www\.)?pobb\.in/([\w-]+)/?$#i';

    public function __construct(BuildDecoder $decoder, private readonly Http $http)
    {
        parent::__construct($decoder);
    }

    public function supports(string $input): bool
    {
        return preg_match(self::PATTERN, trim($input)) === 1;
    }

    protected function fetchCode(string $input): string
    {
        if (preg_match(self::PATTERN, trim($input), $matches) !== 1) {
            throw new InvalidArgumentException('This is not a pobb.in link.');
        }

        // No redirect-following: pobb.in is the only host we ever talk to, and a 3xx must
        // not be able to bounce this fetch at an internal address (SSRF).
        $response = $this->http->acceptJson()
            ->timeout(10)
            ->withoutRedirecting()
            ->get("https://pobb.in/{$matches[1]}/raw");

        if (! $response->successful()) {
            throw new InvalidArgumentException('This pobb.in link could not be fetched.');
        }

        $code = trim($response->body());

        if ($code === '') {
            throw new InvalidArgumentException('This pobb.in link returned an empty build.');
        }

        if (strlen($code) > PobImport::MAX_CODE_BYTES) {
            throw new InvalidArgumentException('This pobb.in link returned an unexpectedly large build.');
        }

        return $code;
    }
}

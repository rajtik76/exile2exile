<?php

declare(strict_types=1);

namespace App\Pob\Validation;

use App\Pob\Data\BuildSnapshot;
use App\Pob\Decoding\BuildDecoder;
use App\Pob\Reference\BuildReference;
use Throwable;

/**
 * The validation layer above the source adapters: it decides whether a build can
 * be used for comparison. A build is valid when it decodes cleanly and every
 * passive node and skill/support gem it uses exists in the current league data.
 *
 * Decoding itself is part of validation - corrupt or unsupported data (a failed
 * decode) is just another way for a build to be invalid, never a 500.
 */
final readonly class BuildValidator
{
    public function __construct(
        private BuildDecoder $decoder,
        private BuildReference $reference,
    ) {}

    public function validate(string $code): BuildValidity
    {
        try {
            $snapshot = $this->decoder->import($code);
        } catch (Throwable) {
            return BuildValidity::invalid([
                'This build could not be read - its data is corrupt or unsupported.',
            ]);
        }

        $errors = [
            ...$this->passiveNodeErrors($snapshot),
            ...$this->gemErrors($snapshot),
        ];

        return $errors === []
            ? BuildValidity::valid($snapshot)
            : BuildValidity::invalid($errors);
    }

    /**
     * @return list<string>
     */
    private function passiveNodeErrors(BuildSnapshot $snapshot): array
    {
        $known = $this->reference->passiveNodeIds();

        $missing = array_values(array_filter(
            $snapshot->passiveNodes,
            static fn (int $id): bool => ! isset($known[$id]),
        ));

        if ($missing === []) {
            return [];
        }

        return [sprintf(
            'This build allocates %d passive node(s) that do not exist in the current passive tree.',
            count($missing),
        )];
    }

    /**
     * Only gems that carry a stable gem id are checked; entries without one
     * (granted skills, certain marks) cannot be matched and are not evidence of
     * incompatibility.
     *
     * @return list<string>
     */
    private function gemErrors(BuildSnapshot $snapshot): array
    {
        $known = $this->reference->gemIds();
        $unknown = [];

        foreach ($snapshot->skillGroups as $group) {
            foreach ($group->gems as $gem) {
                if ($gem->gemId !== null && ! isset($known[$gem->gemId])) {
                    $unknown[$gem->gemId] = $gem->name !== '' ? $gem->name : $gem->gemId;
                }
            }
        }

        if ($unknown === []) {
            return [];
        }

        return ['This build uses gems not in the current league: '.implode(', ', array_values($unknown)).'.'];
    }
}

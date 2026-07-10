<?php

declare(strict_types=1);

namespace App\Filter;

/**
 * A whole `.filter` file: an ordered list of {@see FilterBlock}s plus an optional header
 * comment. Order is significance - the game takes the first matching block - so blocks are
 * emitted in the exact sequence they are added. {@see render()} produces the file text
 * ready to write to disk or stream as a download.
 */
final class FilterDocument
{
    /** @var list<FilterBlock> */
    private array $blocks = [];

    public function __construct(private readonly ?string $header = null) {}

    public function add(FilterBlock ...$blocks): self
    {
        $this->blocks = [...$this->blocks, ...array_values($blocks)];

        return $this;
    }

    public function render(): string
    {
        $sections = [];

        if ($this->header !== null) {
            $sections[] = $this->renderHeader($this->header);
        }

        foreach ($this->blocks as $block) {
            $sections[] = $block->render();
        }

        // Blocks are separated by a blank line for readability; the file ends with a
        // trailing newline as tooling expects.
        return implode("\n\n", $sections)."\n";
    }

    /** Render a (possibly multi-line) header as a comment banner. */
    private function renderHeader(string $header): string
    {
        $lines = array_map(
            static fn (string $line): string => rtrim("# {$line}"),
            explode("\n", $header),
        );

        return implode("\n", $lines);
    }
}

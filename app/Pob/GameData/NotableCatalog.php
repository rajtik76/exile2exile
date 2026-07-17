<?php

declare(strict_types=1);

namespace App\Pob\GameData;

/**
 * Notable/keystone passives and their sprite-atlas icons, built from the GGPK-derived
 * passive tree the renderer draws from.
 */
final class NotableCatalog
{
    /**
     * @var array<string, array{stats: list<string>, ascendancy: bool, keystone: bool, icon: ?string}>|null
     *                                                                                                      Notable/keystone display name => its granted stat lines and atlas icon path.
     */
    private ?array $notableIndex = null;

    /**
     * @var array{frames: array<string, array{x: int, y: int, w: int, h: int}>, sheetW: int, sheetH: int}|null
     *                                                                                                         The skill-icon sprite atlas frame map + sheet pixel size.
     */
    private ?array $skillSprites = null;

    public function __construct(private readonly GameDataStore $store) {}

    /**
     * Notable passives keyed by display name, built from the GGPK-derived passive
     * tree ({@see public/tree/current/data.json}) the renderer draws from. Only the
     * notable nodes are kept, mapped to their granted stat lines; ascendancy notables
     * are flagged so the reference can label them apart from base-tree notables.
     *
     * @return array<string, array{stats: list<string>, ascendancy: bool, keystone: bool, icon: ?string}>
     */
    public function all(): array
    {
        return $this->notableIndex ??= $this->store->remembered('notables', function (): array {
            $index = [];
            $data = $this->store->loadJson('public/tree/current/data.json');

            foreach ($data['nodes'] ?? [] as $node) {
                // Notables and keystones are both cite-worthy "big" nodes; plain
                // passives (no name/effect worth a chip) are skipped.
                if (! is_array($node) || (empty($node['isNotable']) && empty($node['isKeystone']))) {
                    continue;
                }

                $name = (string) ($node['name'] ?? '');

                if ($name === '') {
                    continue;
                }

                $icon = $node['icon'] ?? null;

                $index[$name] = [
                    'stats' => is_array($node['stats'] ?? null)
                        ? array_values(array_filter($node['stats'], is_string(...)))
                        : [],
                    'ascendancy' => isset($node['ascendancyId']),
                    'keystone' => ! empty($node['isKeystone']),
                    'icon' => is_string($icon) && $icon !== '' ? $icon : null,
                ];
            }

            return $index;
        });
    }

    /**
     * The sprite-atlas rect for a notable's icon: its frame within the shared skill
     * atlas plus the sheet size, so a chip can crop it with CSS. Null when the icon is
     * unknown or absent from the atlas.
     *
     * @return array{url: string, x: int, y: int, w: int, h: int, sheetW: int, sheetH: int}|null
     */
    public function sprite(?string $icon, bool $keystone = false): ?array
    {
        if ($icon === null) {
            return null;
        }

        $atlas = $this->skillSprites();
        // Notables render from the "notableActive" atlas state, keystones from
        // "keystoneActive"; fall back to the other state if the expected one lacks the
        // icon, both keyed by the node's Art path.
        $frame = $keystone
            ? ($atlas['frames']['keystoneActive:'.$icon] ?? $atlas['frames']['notableActive:'.$icon] ?? null)
            : ($atlas['frames']['notableActive:'.$icon] ?? $atlas['frames']['keystoneActive:'.$icon] ?? null);

        if ($frame === null || $atlas['sheetW'] === 0) {
            return null;
        }

        return [
            'url' => '/tree/current/assets/skills.webp',
            'x' => $frame['x'],
            'y' => $frame['y'],
            'w' => $frame['w'],
            'h' => $frame['h'],
            'sheetW' => $atlas['sheetW'],
            'sheetH' => $atlas['sheetH'],
        ];
    }

    /**
     * The passive-tree skill-icon sprite atlas: each frame's pixel rect keyed by its
     * `<state>:<Art path>` id, plus the sheet's own pixel size (parsed from the WebP
     * header). Notable art has no single-file PNG - it is cropped from this atlas the
     * renderer already ships, so a notable reference can point a chip at its rect.
     *
     * @return array{frames: array<string, array{x: int, y: int, w: int, h: int}>, sheetW: int, sheetH: int}
     */
    private function skillSprites(): array
    {
        return $this->skillSprites ??= $this->store->remembered('skillSprites', function (): array {
            $frames = [];
            $sprites = $this->store->loadJson('public/tree/current/assets/skills.json');

            foreach ($sprites['frames'] ?? [] as $key => $entry) {
                $frame = is_array($entry) ? ($entry['frame'] ?? null) : null;

                if (is_string($key) && is_array($frame)) {
                    $frames[$key] = [
                        'x' => (int) ($frame['x'] ?? 0),
                        'y' => (int) ($frame['y'] ?? 0),
                        'w' => (int) ($frame['w'] ?? 0),
                        'h' => (int) ($frame['h'] ?? 0),
                    ];
                }
            }

            // The sheet's pixel size is carried in the frame map by publish.mjs, so no
            // binary atlas is read server-side (the JSON-only extraction ships no webp).
            $sheet = is_array($sprites['sheet'] ?? null) ? $sprites['sheet'] : [];

            return [
                'frames' => $frames,
                'sheetW' => (int) ($sheet['w'] ?? 0),
                'sheetH' => (int) ($sheet['h'] ?? 0),
            ];
        });
    }
}

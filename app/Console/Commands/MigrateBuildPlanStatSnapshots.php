<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\BuildPlan;
use App\Pob\ModCatalogue;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * One-off backfill: every stored plan's equipment `stats` entries move from the old
 * `{modId, values}` live-reference shape to the frozen snapshot shape (see
 * {@see ModCatalogue::modSnapshot}) - `text`, `name`, `type`, `family`, `tier` and
 * `rolls` copied out of the catalogue as it stands today, so an already-stored plan
 * never breaks against a future GGPK patch that renames or drops the id.
 *
 * A stat whose modId still resolves is frozen normally. One that no longer resolves
 * (the affix vanished from the catalogue since the plan was saved) falls back to a
 * plain-text stat instead of being dropped - there is no rolled text to recover, so
 * {@see ModCatalogue::modSnapshot} renders one from the mod's own template... except
 * the mod is gone, so nothing can be rendered at all: such a stat is dropped, since
 * there is genuinely nothing left to describe it by.
 *
 * Idempotent: a stat that already carries a `text` key is left untouched, so running
 * this twice (or over a database with a mix of old and already-migrated plans) is safe.
 *
 * Never run against production without approval - see the project's CLAUDE.md.
 */
#[Signature('planner:migrate-stat-snapshots {--dry-run : Report what would change without saving}')]
#[Description('Backfill stored plans\' equipment stats from {modId, values} to frozen snapshots')]
class MigrateBuildPlanStatSnapshots extends Command
{
    public function handle(ModCatalogue $catalogue): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $plansChanged = 0;
        $statsFrozen = 0;
        $statsDropped = 0;

        BuildPlan::query()->orderBy('id')->chunkById(50, function ($plans) use ($catalogue, $dryRun, &$plansChanged, &$statsFrozen, &$statsDropped): void {
            foreach ($plans as $plan) {
                /** @var BuildPlan $plan */
                $data = $plan->data;
                $sections = is_array($data['sections'] ?? null) ? $data['sections'] : [];
                $changed = false;

                foreach ($sections as $sectionKey => $section) {
                    $slots = is_array($section['items']['slots'] ?? null) ? $section['items']['slots'] : [];

                    foreach ($slots as $slotKey => $item) {
                        if (! is_array($item) || ! is_array($item['stats'] ?? null)) {
                            continue;
                        }

                        $result = $this->migrateStats(array_values($item['stats']), $catalogue);

                        if ($result['changed']) {
                            $changed = true;
                            $statsFrozen += $result['frozen'];
                            $statsDropped += $result['dropped'];
                            $data['sections'][$sectionKey]['items']['slots'][$slotKey]['stats'] = $result['stats'];
                        }
                    }
                }

                if (! $changed) {
                    continue;
                }

                $plansChanged++;

                if (! $dryRun) {
                    $plan->data = $data;
                    $plan->save();
                }
            }
        });

        $verb = $dryRun ? 'Would freeze' : 'Froze';
        $this->info("{$verb} stats on {$plansChanged} plan(s): {$statsFrozen} snapshot(s) written, {$statsDropped} unresolvable stat(s) dropped.");

        return self::SUCCESS;
    }

    /**
     * @param  list<mixed>  $rawStats
     * @return array{changed: bool, frozen: int, dropped: int, stats: list<array<string, mixed>>}
     */
    private function migrateStats(array $rawStats, ModCatalogue $catalogue): array
    {
        $changed = false;
        $frozen = 0;
        $dropped = 0;
        $stats = [];

        foreach ($rawStats as $stat) {
            if (! is_array($stat)) {
                continue;
            }

            // Already migrated (or a plain-text stat the new shape produces) - a `text`
            // key marks the new shape; leave it exactly as stored.
            if (array_key_exists('text', $stat)) {
                $stats[] = $stat;

                continue;
            }

            $modId = is_string($stat['modId'] ?? null) ? trim($stat['modId']) : '';
            $values = is_array($stat['values'] ?? null) ? array_values($stat['values']) : [];

            $changed = true;

            if ($modId === '' || $catalogue->resolve($modId) === null) {
                // Nothing to freeze and no rolled text was ever stored to fall back to -
                // the line itself is unrecoverable, so it is dropped rather than kept as
                // an empty, meaningless placeholder.
                $dropped++;

                continue;
            }

            $stats[] = $catalogue->modSnapshot($modId, $values, '');
            $frozen++;
        }

        return ['changed' => $changed, 'frozen' => $frozen, 'dropped' => $dropped, 'stats' => $stats];
    }
}

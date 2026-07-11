<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Support\Planner\PlanSchema;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Shared validation for creating and updating a build plan. Field shape lives in
 * {@see rules()}; the immutable-base-tabs integrity rule runs in {@see after()} so a
 * forged payload can't reorder or slip a tab between the six base phases. The
 * exposed {@see planData()} is the canonicalised JSON the controller persists.
 *
 * No auth: authoring a guide is a guest action, like the rest of the build tooling.
 */
abstract class PlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:20000'],
            'mode' => ['required', 'string', 'in:'.implode(',', PlanSchema::MODES)],

            // Build-level class + ascendancy (one per plan) for the visual tree.
            'build' => ['nullable', 'array'],
            'build.className' => ['nullable', 'string', 'max:50'],
            'build.ascendId' => ['nullable', 'string', 'max:50'],

            // Per-phase visual gem groups (only the gems group carries them).
            'sections.*.gems.groups' => ['nullable', 'array', 'max:24'],
            'sections.*.gems.groups.*.id' => ['nullable', 'string', 'max:60'],
            'sections.*.gems.groups.*.gems' => ['nullable', 'array', 'max:12'],
            'sections.*.gems.groups.*.gems.*.type' => ['required', 'string', 'in:gem'],
            'sections.*.gems.groups.*.gems.*.id' => ['required', 'string', 'max:120'],

            // Per-phase equipment slots: each is a full item (only the items group).
            'sections.*.items.slots' => ['nullable', 'array'],
            'sections.*.items.slots.*.rarity' => ['nullable', 'string', 'in:'.implode(',', PlanSchema::ITEM_RARITIES)],
            'sections.*.items.slots.*.base' => ['nullable', 'array'],
            'sections.*.items.slots.*.base.type' => ['nullable', 'string', 'in:base,unique'],
            'sections.*.items.slots.*.base.id' => ['nullable', 'string', 'max:120'],
            'sections.*.items.slots.*.req' => ['nullable', 'array'],
            'sections.*.items.slots.*.req.level' => ['nullable', 'integer', 'min:0', 'max:'.PlanSchema::MAX_ITEM_LEVEL],
            'sections.*.items.slots.*.req.str' => ['nullable', 'integer', 'min:0', 'max:2000'],
            'sections.*.items.slots.*.req.dex' => ['nullable', 'integer', 'min:0', 'max:2000'],
            'sections.*.items.slots.*.req.int' => ['nullable', 'integer', 'min:0', 'max:2000'],
            'sections.*.items.slots.*.stats' => ['nullable', 'array', 'max:20'],
            'sections.*.items.slots.*.stats.*.modId' => ['required', 'string', 'max:120'],
            'sections.*.items.slots.*.stats.*.values' => ['nullable', 'array', 'max:8'],
            'sections.*.items.slots.*.stats.*.values.*' => ['numeric'],
            'sections.*.items.slots.*.sockets' => ['nullable', 'array', 'max:4'],
            'sections.*.items.slots.*.sockets.*' => ['nullable', 'array'],
            'sections.*.items.slots.*.sockets.*.type' => ['nullable', 'string', 'in:rune'],
            'sections.*.items.slots.*.sockets.*.id' => ['nullable', 'string', 'max:120'],
            'sections.*.items.slots.*.priority' => ['nullable', 'integer', 'min:1', 'max:'.PlanSchema::MAX_PRIORITY],

            // Per-phase passive-tree allocation (only the tree group carries one).
            'sections.*.tree.allocation' => ['nullable', 'array'],
            'sections.*.tree.allocation.allocated' => ['nullable', 'array', 'max:600'],
            'sections.*.tree.allocation.allocated.*' => ['integer'],
            'sections.*.tree.notablePriority' => ['nullable', 'array', 'max:600'],
            'sections.*.tree.notablePriority.*' => ['integer'],
            'sections.*.tree.allocation.treeVersion' => ['nullable', 'string', 'max:20'],
            'sections.*.tree.allocation.attributeChoices' => ['nullable', 'array', 'max:600'],
            'sections.*.tree.allocation.weaponSets' => ['nullable', 'array', 'max:600'],
            'sections.*.tree.allocation.jewels' => ['nullable', 'array', 'max:600'],

            'tabs' => ['required', 'array', 'max:'.(count(PlanSchema::BASE_TABS) + PlanSchema::MAX_CUSTOM_TABS)],
            'tabs.*.id' => ['required', 'string', 'max:60'],
            'tabs.*.label' => ['required', 'string', 'max:60'],
            'tabs.*.kind' => ['required', 'string', 'in:base,custom'],

            'sections' => ['nullable', 'array'],
            'sections.*.items.notes' => ['nullable', 'string', 'max:20000'],
            'sections.*.gems.notes' => ['nullable', 'string', 'max:20000'],
            'sections.*.tree.notes' => ['nullable', 'string', 'max:20000'],
            'sections.*.items.entries' => ['nullable', 'array', 'max:200'],
            'sections.*.gems.entries' => ['nullable', 'array', 'max:200'],
            'sections.*.tree.entries' => ['nullable', 'array', 'max:200'],
            'sections.*.*.entries.*.name' => ['nullable', 'string', 'max:200'],
            'sections.*.*.entries.*.note' => ['nullable', 'string', 'max:2000'],
            'sections.*.gems.entries.*.kind' => ['nullable', 'string', 'in:'.implode(',', PlanSchema::GEM_KINDS)],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validation): void {
                if ($validation->errors()->isNotEmpty()) {
                    return;
                }

                $error = PlanSchema::tabsError($this->input('tabs'));

                if ($error !== null) {
                    $validation->errors()->add('tabs', $error);
                }

                $this->validateItems($validation);
            },
        ];
    }

    /**
     * Enforce the per-item rules the paper-doll UI also enforces, rejecting a forged
     * payload rather than silently normalising it away: the shape rules (socket ceilings,
     * uniques without author mods/requirements) from {@see PlanSchema::itemErrors}, and
     * the GGPK affix rules (per-rarity prefix/suffix counts, one mod per family, values in
     * range, base compatibility) from {@see ModCatalogue::modErrors}.
     */
    private function validateItems(Validator $validation): void
    {
        $sections = $this->input('sections');

        if (! is_array($sections)) {
            return;
        }

        $catalogue = app(ModCatalogue::class);
        $icons = app(IconResolver::class);

        foreach ($sections as $sectionKey => $section) {
            $slots = $section['items']['slots'] ?? null;

            if (! is_array($slots)) {
                continue;
            }

            // A gearing-priority number is unique across a phase's equipment.
            $seenPriorities = [];

            foreach ($slots as $slot => $item) {
                if (! is_array($item)) {
                    continue;
                }

                $rarity = is_string($item['rarity'] ?? null) ? $item['rarity'] : 'rare';
                $stats = is_array($item['stats'] ?? null) ? array_values($item['stats']) : [];

                $messages = [
                    ...PlanSchema::itemErrors((string) $slot, $item),
                    ...$catalogue->modErrors($rarity, $stats, self::baseModDomain($item, $icons), self::baseTags($item, $icons), self::baseItemClass($item, $icons)),
                ];

                $priority = $item['priority'] ?? null;

                if (is_numeric($priority)) {
                    if (in_array((int) $priority, $seenPriorities, true)) {
                        $messages[] = 'Each item needs its own priority number.';
                    } else {
                        $seenPriorities[] = (int) $priority;
                    }
                }

                foreach ($messages as $message) {
                    $validation->errors()->add("sections.{$sectionKey}.items.slots.{$slot}", $message);
                }
            }

            // A two-handed main weapon claims the off-hand, so the off-hand must be empty.
            if (self::slotIsTwoHanded($slots['weapon1'] ?? null, $icons) && self::slotHasBase($slots['weapon2'] ?? null)) {
                $validation->errors()->add(
                    "sections.{$sectionKey}.items.slots.weapon2",
                    'An off-hand cannot be used with a two-handed weapon.',
                );
            }
        }
    }

    /** Whether a slot holds a weapon whose base (or unique) is two-handed. */
    private static function slotIsTwoHanded(mixed $item, IconResolver $icons): bool
    {
        if (! is_array($item)) {
            return false;
        }

        $base = $item['base'] ?? null;

        return is_array($base)
            && is_string($base['id'] ?? null)
            && $icons->isTwoHanded($base['id']);
    }

    /** Whether a slot holds an item with a chosen base/unique. */
    private static function slotHasBase(mixed $item): bool
    {
        if (! is_array($item)) {
            return false;
        }

        $base = $item['base'] ?? null;

        return is_array($base) && is_string($base['id'] ?? null) && $base['id'] !== '';
    }

    /**
     * The mod-matching tags of an item's chosen base, or an empty list when it has no
     * base (or a unique, whose base type - and thus tags - is unknown), so mod
     * compatibility is only enforced once a real base is picked.
     *
     * @param  array<string, mixed>  $item
     * @return list<string>
     */
    private static function baseTags(array $item, IconResolver $icons): array
    {
        $base = $item['base'] ?? null;

        if (! is_array($base) || ($base['type'] ?? null) !== 'base' || ! is_string($base['id'] ?? null)) {
            return [];
        }

        return $icons->itemTags($base['id']);
    }

    /**
     * The GGPK mod domain of an item's chosen base, or null when it has no base (or a
     * unique). Joined domain-first with {@see baseTags} so a base only takes mods of its
     * own domain (gear "Item", flasks/charms "Flask").
     *
     * @param  array<string, mixed>  $item
     */
    private static function baseModDomain(array $item, IconResolver $icons): ?string
    {
        $base = $item['base'] ?? null;

        if (! is_array($base) || ($base['type'] ?? null) !== 'base' || ! is_string($base['id'] ?? null)) {
            return null;
        }

        return $icons->itemModDomain($base['id']);
    }

    /**
     * The GGPK item class of an item's chosen base, or null when it has no base (or a
     * unique). Gates essence-only mods, which target item classes instead of tags.
     *
     * @param  array<string, mixed>  $item
     */
    private static function baseItemClass(array $item, IconResolver $icons): ?string
    {
        $base = $item['base'] ?? null;

        if (! is_array($base) || ($base['type'] ?? null) !== 'base' || ! is_string($base['id'] ?? null)) {
            return null;
        }

        return $icons->itemClass($base['id']);
    }

    /**
     * The canonicalised plan JSON to persist: base-tab prefix enforced, orphan
     * sections dropped, every entry normalised and its priority reset to list order.
     *
     * @return array<string, mixed>
     */
    public function planData(): array
    {
        return PlanSchema::canonicalize([
            'description' => (string) $this->input('description', ''),
            'mode' => (string) $this->input('mode'),
            'build' => is_array($this->input('build')) ? $this->input('build') : [],
            'tabs' => is_array($this->input('tabs')) ? $this->input('tabs') : [],
            'sections' => is_array($this->input('sections')) ? $this->input('sections') : [],
        ]);
    }

    public function title(): string
    {
        return trim((string) $this->input('title'));
    }
}

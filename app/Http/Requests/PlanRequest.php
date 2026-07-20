<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Pob\IconResolver;
use App\Pob\ModCatalogue;
use App\Support\Planner\PlanItemSchema;
use App\Support\Planner\PlanSchema;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Shared validation for creating and updating a build plan. Field shape lives in
 * {@see rules()}; the tabs integrity rule runs in {@see after()} so a forged payload
 * can't invent an unknown base-phase id, let a custom tab squat on one, or exceed the
 * custom-tab cap. The exposed {@see planData()} is the canonicalised JSON the
 * controller persists.
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
            'sections.*.items.slots.*.name' => ['nullable', 'string', 'max:'.PlanSchema::MAX_ITEM_NAME_LENGTH],
            'sections.*.items.slots.*.corrupted' => ['nullable', 'boolean'],
            // A stat is a frozen snapshot, not a live catalogue reference (see
            // ModCatalogue::modSnapshot): `text` is the only field that must always be
            // present (the sole source of truth for display when `modId` is null, a
            // plain-text line nothing could be matched to); everything else is metadata
            // kept from the match, used only while `modId` still resolves.
            'sections.*.items.slots.*.stats' => ['nullable', 'array', 'max:20'],
            'sections.*.items.slots.*.stats.*.modId' => ['nullable', 'string', 'max:120'],
            'sections.*.items.slots.*.stats.*.text' => ['required', 'string', 'max:200'],
            'sections.*.items.slots.*.stats.*.name' => ['nullable', 'string', 'max:120'],
            'sections.*.items.slots.*.stats.*.type' => ['nullable', 'string', 'in:prefix,suffix'],
            'sections.*.items.slots.*.stats.*.family' => ['nullable', 'string', 'max:120'],
            'sections.*.items.slots.*.stats.*.tier' => ['nullable', 'integer'],
            'sections.*.items.slots.*.stats.*.rolls' => ['nullable', 'array', 'max:8'],
            'sections.*.items.slots.*.stats.*.rolls.*.stat' => ['nullable', 'string', 'max:120'],
            'sections.*.items.slots.*.stats.*.rolls.*.min' => ['nullable', 'numeric'],
            'sections.*.items.slots.*.stats.*.rolls.*.max' => ['nullable', 'numeric'],
            'sections.*.items.slots.*.stats.*.values' => ['nullable', 'array', 'max:8'],
            'sections.*.items.slots.*.stats.*.values.*' => ['numeric'],
            // A unique's own mods (rolled value per synced catalogue line, keyed by
            // UniqueModLine::$key) - distinct from `stats`, which is the author-picked
            // affixes only a base/rare/magic item carries. Decimals are real PoB rolls
            // (e.g. "11.9 Life Regeneration per second"), so values are plain `numeric`.
            'sections.*.items.slots.*.uniqueMods' => ['nullable', 'array', 'max:20'],
            'sections.*.items.slots.*.uniqueMods.*.key' => ['required', 'string', 'max:200'],
            'sections.*.items.slots.*.uniqueMods.*.values' => ['nullable', 'array', 'max:8'],
            'sections.*.items.slots.*.uniqueMods.*.values.*' => ['numeric'],
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

                $stats = is_array($item['stats'] ?? null) ? array_values($item['stats']) : [];
                // The author's own `rarity` input is never trusted for validation - see
                // {@see PlanItemSchema::rarityOf}.
                $rarity = PlanItemSchema::rarityOf(is_array($item['base'] ?? null) ? $item['base'] : null, $stats);

                $messages = [
                    ...PlanSchema::itemErrors((string) $slot, $item),
                    ...$catalogue->modErrors($rarity, $stats, self::baseModDomain($item, $icons), self::baseTags($item, $icons), self::baseItemClass($item, $icons)),
                    ...self::uniqueModErrors($item, $icons),
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

            // A two-handed main weapon claims the off-hand, so the off-hand must be empty -
            // checked for both the primary set and the swap set independently.
            if (self::slotIsTwoHanded($slots['weapon1'] ?? null, $icons) && self::slotHasBase($slots['weapon2'] ?? null)) {
                $validation->errors()->add(
                    "sections.{$sectionKey}.items.slots.weapon2",
                    'An off-hand cannot be used with a two-handed weapon.',
                );
            }

            if (self::slotIsTwoHanded($slots['weapon1swap'] ?? null, $icons) && self::slotHasBase($slots['weapon2swap'] ?? null)) {
                $validation->errors()->add(
                    "sections.{$sectionKey}.items.slots.weapon2swap",
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
     * A unique item's rolled mod values, checked against its synced catalogue lines - the
     * counterpart to {@see ModCatalogue::modErrors} for `stats`. Each `uniqueMods` entry's
     * `key` must name a real line on the unique ({@see IconResolver::uniqueModLines}), with
     * exactly one value per that line's rolls, each within its `[min, max]` (decimals
     * allowed - PoB's own data carries fractional rolls).
     *
     * @param  array<string, mixed>  $item
     * @return list<string>
     */
    private static function uniqueModErrors(array $item, IconResolver $icons): array
    {
        // Whether the item is unique is read straight from its base reference, same as
        // {@see PlanItemSchema::rarityOf} - the author's own `rarity` input is untrusted.
        $base = $item['base'] ?? null;

        if (! is_array($base) || ($base['type'] ?? null) !== 'unique' || ! is_string($base['id'] ?? null)) {
            return [];
        }

        $catalogue = $icons->uniqueModLines($base['id']);
        $byKey = [];

        foreach ([...$catalogue['implicits'], ...$catalogue['mods']] as $line) {
            $byKey[$line->key] = $line;
        }

        $errors = [];
        $uniqueMods = is_array($item['uniqueMods'] ?? null) ? array_values($item['uniqueMods']) : [];

        foreach ($uniqueMods as $stat) {
            if (! is_array($stat)) {
                continue;
            }

            $key = is_string($stat['key'] ?? null) ? $stat['key'] : '';
            $line = $byKey[$key] ?? null;

            if ($line === null) {
                $errors[] = 'A unique item modifier does not match one of its known mods.';

                continue;
            }

            $values = is_array($stat['values'] ?? null) ? array_values($stat['values']) : [];

            if (count($values) !== count($line->rolls)) {
                $errors[] = "A unique item modifier's value count does not match its roll.";

                continue;
            }

            foreach ($line->rolls as $index => $roll) {
                $value = $values[$index] ?? null;

                if (! is_numeric($value) || $value < $roll['min'] || $value > $roll['max']) {
                    $errors[] = "A unique item modifier's value is outside its rolled range.";

                    break;
                }
            }
        }

        return $errors;
    }

    /**
     * The canonicalised plan JSON to persist: base-tab prefix enforced, orphan
     * sections dropped, every entry normalised, its priority reset to list order, and
     * every item's defensive properties clamped against its resolved base's real GGPK
     * defensive stats.
     *
     * @return array<string, mixed>
     */
    public function planData(): array
    {
        $canonical = PlanSchema::canonicalize([
            'description' => (string) $this->input('description', ''),
            'mode' => (string) $this->input('mode'),
            'build' => is_array($this->input('build')) ? $this->input('build') : [],
            'tabs' => is_array($this->input('tabs')) ? $this->input('tabs') : [],
            'sections' => is_array($this->input('sections')) ? $this->input('sections') : [],
        ]);

        return self::clampDefenceProps($canonical, app(IconResolver::class));
    }

    /**
     * Clamp every item's armour/evasion/energy shield/block to 0 for a defence type its
     * resolved base (or, for a unique, its own synced base type - see
     * {@see IconResolver::uniqueBaseType}) doesn't actually have. This is a silent
     * correction, not a rejection: `props` was free-typed with no validation at all
     * before this base defensive data existed, so a stored plan can already carry a
     * value GGPK now says is impossible (a stale value left over from a base swap that
     * never reset it, a typo, ...). Rejecting the whole save on an untouched slot would
     * make an existing plan impossible to save again until the author found and fixed a
     * field the editor may not even show anymore; clamping it here instead makes every
     * save self-healing, with no dead end. Unresolved/unsynced items are left exactly
     * as submitted - there's nothing to clamp against yet.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private static function clampDefenceProps(array $data, IconResolver $icons): array
    {
        $sections = is_array($data['sections'] ?? null) ? $data['sections'] : [];

        foreach ($sections as $sectionKey => $section) {
            $slots = is_array($section['items']['slots'] ?? null) ? $section['items']['slots'] : [];

            foreach ($slots as $slotKey => $item) {
                if (! is_array($item)) {
                    continue;
                }

                $data['sections'][$sectionKey]['items']['slots'][$slotKey]['props']
                    = self::clampItemProps($item, $icons);
            }
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{quality: int, armour: int, evasion: int, energyShield: int, block: int}
     */
    private static function clampItemProps(array $item, IconResolver $icons): array
    {
        /** @var array{quality: int, armour: int, evasion: int, energyShield: int, block: int} $props */
        $props = is_array($item['props'] ?? null) ? $item['props'] : [];
        $base = $item['base'] ?? null;

        if (! is_array($base) || ! is_string($base['id'] ?? null)) {
            return $props;
        }

        $type = $base['type'] ?? null;

        $armour = match ($type) {
            'base' => $icons->itemArmour($base['id']),
            'unique' => $icons->itemArmour($icons->uniqueBaseType($base['id'])),
            default => null,
        };

        if ($armour === null) {
            return $props;
        }

        foreach (['armour', 'evasion', 'energyShield', 'block'] as $key) {
            if ($armour[$key] === 0) {
                $props[$key] = 0;
            }
        }

        return $props;
    }

    public function title(): string
    {
        return trim((string) $this->input('title'));
    }
}

import { arrayMove } from '@/lib/reorder';
import type { GemGroup, ItemSlot } from '@/types/planner';

/**
 * Pure transforms behind the gems panel: every edit of the `GemGroup[]` plan
 * shape lives here (set/remove a gem, reorder supports, the duplicate-gem
 * picker rules and the priority flattening), so the panel component only wires
 * events to these.
 */

/**
 * The groups with one gem slot set: replacing the gem at `gemIndex`, or
 * appending when the index is past the group's end (the "add support" case).
 */
export function withGemSet(
    groups: GemGroup[],
    groupIndex: number,
    gemIndex: number,
    slot: ItemSlot,
): GemGroup[] {
    return groups.map((group, index) =>
        index !== groupIndex
            ? group
            : {
                  ...group,
                  gems:
                      gemIndex < group.gems.length
                          ? group.gems.map((gem, position) =>
                                position === gemIndex ? slot : gem,
                            )
                          : [...group.gems, slot],
              },
    );
}

/** The groups with one gem removed (later gems close the gap). */
export function withGemRemoved(
    groups: GemGroup[],
    groupIndex: number,
    gemIndex: number,
): GemGroup[] {
    return groups.map((group, index) =>
        index !== groupIndex
            ? group
            : {
                  ...group,
                  gems: group.gems.filter(
                      (_, position) => position !== gemIndex,
                  ),
              },
    );
}

/**
 * The groups with a support gem drag applied. Keys are "<groupIndex>:<gemIndex>";
 * a drag is confined to one group (a cross-group drop changes nothing), and the
 * active skill (index 0) never moves - the panel never issues a key for it.
 */
export function withSupportMoved(
    groups: GemGroup[],
    fromKey: string,
    toKey: string,
): GemGroup[] {
    const [fromGroup, fromGem] = fromKey.split(':').map(Number);
    const [toGroup, toGem] = toKey.split(':').map(Number);

    if (fromGroup !== toGroup) {
        return groups;
    }

    return groups.map((group, index) =>
        index !== fromGroup
            ? group
            : { ...group, gems: arrayMove(group.gems, fromGem, toGem) },
    );
}

/**
 * Reference ids to hide from a slot's picker so a gem is never slotted twice:
 * a skill can lead only one group (every other group's active skill is barred),
 * and a support can't repeat within its own group (its siblings are barred).
 */
export function excludedGemIds(
    groups: GemGroup[],
    target: { group: number; gem: number },
): string[] {
    if (target.gem === 0) {
        return groups
            .filter((_, index) => index !== target.group)
            .map((group) => group.gems[0]?.id)
            .filter((id): id is string => Boolean(id));
    }

    return groups[target.group].gems
        .filter((_, position) => position >= 1 && position !== target.gem)
        .map((gem) => gem.id);
}

/**
 * Every gem flattened in priority order (each group top-to-bottom, skill then
 * its supports left-to-right), for the read-only summary row under the editor.
 */
export function gemsByPriority(
    groups: GemGroup[],
): { gem: ItemSlot; support: boolean; key: string }[] {
    return groups.flatMap((group) =>
        group.gems.map((gem, index) => ({
            gem,
            support: index > 0,
            key: `${group.id}:${index}`,
        })),
    );
}

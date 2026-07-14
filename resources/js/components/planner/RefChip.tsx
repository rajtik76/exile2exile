import { useState } from 'react';
import { ItemCard } from '@/components/build/ItemDisplay';
import { CursorTooltip, SpriteIcon } from '@/components/build/tooltip';
import { referenceToDisplayItem } from '@/components/planner/equipment/displayItem';
import { useReferences } from '@/components/planner/ReferencesContext';
import ReferenceTooltip, {
    accentColor,
} from '@/components/planner/ReferenceTooltip';
import { refKey } from '@/lib/planReferences';

/**
 * An inline reference chip from a `{{type:id|name}}` token: the GGPK icon + the
 * catalogue name in the entity's colour (no box). Hovering shows the shared build
 * tooltip. Falls back to the token's embedded name when the reference is unresolved.
 *
 * A unique is the one reference type that is also a full gear item, so its tooltip
 * body reuses {@link ItemCard} - the exact same card an equipped unique shows on the
 * paper-doll ({@link referenceToDisplayItem} adapts the bare reference, which carries
 * no props/sockets/corrupted/rolled-value context, to the same display shape) - rather
 * than the generic {@link ReferenceTooltip} gem/rune/notable share. It is positioned
 * with {@link CursorTooltip} (portalled to `document.body`), not the paper-doll's own
 * `HoverTooltip`: this chip renders inside `RichText`'s `.planner-md` prose wrapper
 * (`resources/css/app.css`), whose `ul`/`li`/`p` descendant selectors would otherwise
 * bleed bullet markers and its 1.6 line-height into the card, and `HoverTooltip`'s
 * `position: absolute` is anchored to this chip's own (inline) box, which clips against
 * the notes panel and sizes unreliably. Portalling sidesteps both - same as every other
 * reference type here already does. One unique, one *look*, wherever it's mentioned.
 */
export default function RefChip({
    node,
}: {
    node?: { properties?: Record<string, unknown> };
}) {
    const properties = node?.properties ?? {};
    const type = String(properties.reftype ?? '');
    const id = String(properties.refid ?? '');
    const fallbackName = String(properties.refname ?? '');

    const { map } = useReferences();
    const reference = map[refKey(type, id)];

    // Mirrors ReferenceTooltip's own cursor-tracking (see the class doc for why a
    // unique can't use HoverTooltip's in-place, non-portalled positioning here).
    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

    const name = reference?.name ?? fallbackName;
    const icon = reference?.icon ?? null;
    const sprite = reference?.sprite ?? null;
    const color = accentColor(type, reference?.color);

    // Gem art and notable/keystone atlas crops bleed to the frame edge, while item
    // textures (runes, uniques, bases) carry a built-in transparent border. Render the
    // former a touch smaller so every reference's visible art matches in size and lines
    // up with the text - otherwise gems/notables read as oversized and sit low.
    const bleeds = type === 'gem' || type === 'notable';

    // Plain inline so the name flows on the prose baseline; the icon is centred with
    // vertical-align:middle. Gem art and notable/keystone atlas crops bleed to the frame
    // edge (item textures carry a transparent border), so they read a touch low - nudge
    // just those up a couple px to line up with the text.
    const label = (
        <span style={{ color }}>
            {sprite ? (
                <SpriteIcon
                    sprite={sprite}
                    size="0.9em"
                    className="mr-1 -translate-y-[2px] rounded-[2px] align-middle"
                />
            ) : (
                icon && (
                    <img
                        src={icon}
                        alt=""
                        loading="lazy"
                        className={`mr-1 inline-block rounded-[2px] object-contain align-middle ${
                            bleeds
                                ? 'size-[0.9em] -translate-y-[2px]'
                                : 'size-[1.1em]'
                        }`}
                    />
                )
            )}
            {name}
        </span>
    );

    if (type === 'unique' && reference) {
        return (
            <span
                className="font-medium whitespace-nowrap"
                onMouseEnter={(event) =>
                    setCursor({ x: event.clientX, y: event.clientY })
                }
                onMouseMove={(event) =>
                    setCursor({ x: event.clientX, y: event.clientY })
                }
                onMouseLeave={() => setCursor(null)}
            >
                {label}

                {cursor && (
                    <CursorTooltip x={cursor.x} y={cursor.y}>
                        <ItemCard item={referenceToDisplayItem(reference)} />
                    </CursorTooltip>
                )}
            </span>
        );
    }

    return (
        <ReferenceTooltip
            reference={reference}
            className="font-medium whitespace-nowrap"
        >
            {label}
        </ReferenceTooltip>
    );
}

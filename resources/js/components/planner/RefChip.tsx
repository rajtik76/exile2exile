import { SpriteIcon } from '@/components/build/tooltip';
import { useReferences } from '@/components/planner/ReferencesContext';
import ReferenceTooltip, {
    accentColor,
} from '@/components/planner/ReferenceTooltip';
import { refKey } from '@/lib/planReferences';

/**
 * An inline reference chip from a `{{type:id|name}}` token: the GGPK icon + the
 * catalogue name in the entity's colour (no box). Hovering shows the shared build
 * tooltip. Falls back to the token's embedded name when the reference is unresolved.
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

    const name = reference?.name ?? fallbackName;
    const icon = reference?.icon ?? null;
    const sprite = reference?.sprite ?? null;
    const color = accentColor(type, reference?.color);

    // Gem art and notable/keystone atlas crops bleed to the frame edge, while item
    // textures (runes, uniques, bases) carry a built-in transparent border. Render the
    // former a touch smaller so every reference's visible art matches in size and lines
    // up with the text - otherwise gems/notables read as oversized and sit low.
    const bleeds = type === 'gem' || type === 'notable';

    return (
        <ReferenceTooltip
            reference={reference}
            className="font-medium whitespace-nowrap"
        >
            {/* Plain inline so the name flows on the prose baseline; the icon is centred
                with vertical-align:middle. Gem art and notable/keystone atlas crops bleed
                to the frame edge (item textures carry a transparent border), so they read
                a touch low - nudge just those up a couple px to line up with the text. */}
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
        </ReferenceTooltip>
    );
}

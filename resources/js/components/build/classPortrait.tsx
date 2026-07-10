import { treeAssetUrl } from '@/lib/tree-scene';

/*
 * Official GGG class/ascendancy portraits, extracted from the GGPK as individual
 * 1500² images (public/tree/current/assets/centre/portrait-<class>.webp and
 * ascendancy-<slug>.webp via the tools/poe-data-extract pipeline). This map is
 * the class→ascendancy-names catalog; the portrait file is derived from it.
 *
 * Only the real PoE2 classes are listed - GGPK still carries 4 PoE1 placeholder
 * classes (Marauder/Duelist/Shadow/Templar) with no released ascendancy.
 */

const FRAME = 1500;

/** Filename slug matching the extractor (build-centre.mjs): lower, non-alnum→'-'. */
function slug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

interface ClassSheet {
    /** Ascendancy names in frame order; '' marks a frame with no named ascendancy. */
    ascendancies: string[];
}

/** Keyed by lower-cased class name (matches BuildSnapshot.className lower-cased). */
const CLASS_SHEETS: Record<string, ClassSheet> = {
    warrior: {
        ascendancies: ['Titan', 'Warbringer', 'Smith of Kitava'],
    },
    witch: {
        ascendancies: ['Infernalist', 'Blood Mage', 'Lich', 'Abyssal Lich'],
    },
    ranger: { ascendancies: ['Deadeye', '', 'Pathfinder'] },
    sorceress: {
        ascendancies: ['Stormweaver', 'Chronomancer', 'Disciple of Varashta'],
    },
    huntress: {
        ascendancies: ['Amazon', 'Spirit Walker', 'Ritualist'],
    },
    mercenary: {
        ascendancies: ['Tactician', 'Witchhunter', 'Gemling Legionnaire'],
    },
    monk: {
        ascendancies: ['Martial Artist', 'Invoker', 'Acolyte of Chayula'],
    },
    druid: { ascendancies: ['Oracle', 'Shaman', ''] },
};

/** Loose match so "Blood Mage"/"Bloodmage" and casing differences still resolve. */
function normalize(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface ClassPortraitFrame {
    /** Sprite sheet URL. */
    src: string;
    /** The single 1500×1500 frame for this class/ascendancy within the sheet. */
    rect: Rect;
    /** Full sheet dimensions, for sizing the CSS crop. */
    sheet: { w: number; h: number };
}

/**
 * Resolve the official portrait for a class (and optional ascendancy) to its
 * individual image. Returns null for an unknown class. An unknown ascendancy
 * falls back to the base-class portrait. The rect is the whole image (the CSS
 * crop in {@link ClassPortrait} then becomes a no-op).
 */
export function classPortrait(
    className: string,
    ascendancy?: string | null,
): ClassPortraitFrame | null {
    const key = className.toLowerCase();
    const sheet = CLASS_SHEETS[key];

    if (!sheet) {
        return null;
    }

    let file = `portrait-${slug(className)}`;

    if (ascendancy) {
        const match = sheet.ascendancies.find(
            (a) => a !== '' && normalize(a) === normalize(ascendancy),
        );

        if (match) {
            file = `ascendancy-${slug(match)}`;
        }
    }

    return {
        src: treeAssetUrl(`centre/${file}`),
        rect: { x: 0, y: 0, w: FRAME, h: FRAME },
        sheet: { w: FRAME, h: FRAME },
    };
}

export interface CatalogEntry {
    /** Lower-cased class name, as keyed in CLASS_SHEETS. */
    className: string;
    /** Ascendancy name, or null for the base class frame. */
    ascendancy: string | null;
}

/**
 * Every resolvable class/ascendancy pair (base class + each named ascendancy),
 * in sheet order. Drives the test harness that snapshots every portrait.
 */
export function classPortraitCatalog(): CatalogEntry[] {
    const entries: CatalogEntry[] = [];

    for (const [className, sheet] of Object.entries(CLASS_SHEETS)) {
        entries.push({ className, ascendancy: null });

        for (const ascendancy of sheet.ascendancies) {
            if (ascendancy !== '') {
                entries.push({ className, ascendancy });
            }
        }
    }

    return entries;
}

/**
 * The official class/ascendancy portrait rendered as a CSS crop of its sprite
 * sheet - no per-portrait image files. Renders nothing for an unknown class, so
 * callers should provide their own fallback (initial, generated art, …). Wrap it
 * for sizing/shaping (the crop fills the given square edge).
 */
export function ClassPortrait({
    className,
    ascendancy = null,
    size,
}: {
    /** Class name, e.g. BuildSnapshot.className. */
    className: string;
    ascendancy?: string | null;
    /** Rendered square edge in px. */
    size: number;
}) {
    const portrait = classPortrait(className, ascendancy);

    if (!portrait) {
        return null;
    }

    const scale = size / portrait.rect.w;

    return (
        <div
            role="img"
            aria-label={ascendancy ? `${className} - ${ascendancy}` : className}
            style={{
                width: size,
                height: size,
                backgroundImage: `url(${portrait.src})`,
                backgroundSize: `${portrait.sheet.w * scale}px ${portrait.sheet.h * scale}px`,
                backgroundPosition: `-${portrait.rect.x * scale}px -${portrait.rect.y * scale}px`,
                backgroundRepeat: 'no-repeat',
            }}
        />
    );
}

import { Link, usePage } from '@inertiajs/react';

/*
 * Shared brand primitives for the public pages - "Exile to Exile".
 * Identity: a free, fan-made set of Path of Exile 2 tools, one player to
 * another. Cold blue-grey stone for surfaces, warm old pewter for lines, and a
 * rare ember orange for actions and selection. Fontin carries headings, prose
 * and labels, Archivo the small UI text - all self-hosted. The same values live
 * as Tailwind tokens in app.css (`bg-stone-900`, `text-paper`, ...).
 */

/**
 * The app name, from the server's `config('app.name')` shared on every Inertia
 * page. One source of truth (the `APP_NAME` env), read at runtime - no separate
 * build-time copy to keep in sync.
 */
export function useAppName(): string {
    return (usePage().props.name as string | undefined) || 'Exile to Exile';
}

/** Public contact address (privacy/terms). Set via VITE_CONTACT_EMAIL. */
export const CONTACT_EMAIL =
    import.meta.env.VITE_CONTACT_EMAIL || 'hello@example.com';

/* ----------------------------------------------------------------- palette */

/** The design tokens, mirrored from the `@theme` block in app.css. */
export const COLOR = {
    void: '#05080c',
    ink: '#080e14',
    stone900: '#0c131b',
    stone800: '#121b25',
    stone700: '#1a2531',
    line: '#263240',
    lineStrong: '#364454',
    pewter900: '#463e37',
    pewter700: '#665e56',
    pewter500: '#998371',
    pewter300: '#b1a497',
    paper: '#f3eadc',
    bone: '#d2c8bc',
    slate: '#b4c3d4',
    mist: '#8494a6',
    ember300: '#ffba86',
    ember400: '#ff9a4d',
    ember500: '#ff6a00',
    ember700: '#b34a00',
    ember900: '#491300',
    copper: '#a8430a',
    onEmber: '#fff4e3',
    blood: '#d2473c',
    bloodLit: '#ef7b6f',
    verdigris: '#5fae8b',
} as const;

/* ------------------------------------------------------------------- fonts */

/** Display face for headings (single regular weight carries every size). */
export const DISPLAY = { fontFamily: "'Fontin', Georgia, serif" } as const;
/** Section labels: the face's own small caps, never letter-spaced capitals. */
const LABEL = {
    fontFamily: "'Fontin SmallCaps', 'Fontin', Georgia, serif",
} as const;
/** Display face with a stone drop shadow, for hero headings. */
export const ENGRAVED = {
    ...DISPLAY,
    textShadow: '0 2px 1px rgba(0,0,0,0.85)',
} as const;

/** The base field shared by every public page. */
export const PAGE_BG = COLOR.ink;

/* -------------------------------------------------------------------- logo */

/** The short mark: "E2E" set in Fontin, the "2" in ember and tilted. */
export function Logo({
    className = '',
    style,
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <span
            className={className}
            style={{ ...DISPLAY, letterSpacing: '0.01em', ...style }}
        >
            E
            <span className="-mr-[0.06em] inline-block rotate-20 text-ember-500">
                2
            </span>
            E
        </span>
    );
}

/* ----------------------------------------------------------------- ornaments */

/** Ruled divider ornament - kept for the legal pages; pewter. */
export function Flourish({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 240 12"
            className={className}
            fill="none"
            aria-hidden
            preserveAspectRatio="xMidYMid meet"
        >
            <g stroke={COLOR.pewter500} strokeOpacity="0.55" strokeWidth="1">
                <path d="M12 6 H98" />
                <path d="M142 6 H228" />
                <path d="M98 6 q9 -6 16 0 q-9 6 -16 0" />
                <path d="M142 6 q-9 -6 -16 0 q9 6 16 0" />
            </g>
            <path
                d="M120 1.5 L125 6 L120 10.5 L115 6 Z"
                fill={COLOR.pewter500}
                fillOpacity="0.75"
            />
        </svg>
    );
}

/** Section label in the face's own small caps. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <p
            className="text-[15px] tracking-[0.06em] text-pewter-300"
            style={LABEL}
        >
            {children}
        </p>
    );
}

/**
 * Primary call-to-action: the copper button, one per screen. Renders a link
 * when given `href`, or a button when given `onClick` (e.g. a POST action).
 */
export function PrimaryCta({
    href,
    onClick,
    children,
}: {
    href?: string;
    onClick?: () => void;
    children: React.ReactNode;
}) {
    const className = 'btn btn-copper';

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={className}>
                {children}
            </button>
        );
    }

    return (
        <Link href={href ?? '#'} className={className}>
            {children}
        </Link>
    );
}

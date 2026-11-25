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

/** The pewter rule drawn under the masthead and above panels. */
export const RULE_PEWTER = 'var(--rule-pewter)';

/*
 * Older names, kept so existing call sites move to the new palette in one
 * step. New code should read COLOR instead.
 */
export const VOID = COLOR.ink;
export const INK = COLOR.paper;
export const INK_SOFT = COLOR.slate;
export const INK_FAINT = COLOR.mist;
export const HEAD = COLOR.paper;
export const GOLD = COLOR.pewter500;
export const GOLD_LIT = COLOR.pewter300;
export const SILVER = COLOR.slate;
export const SILVER_LIT = COLOR.paper;
export const EMBER = COLOR.ember500;
export const EMBER_DEEP = COLOR.copper;
export const EMBER_INK = COLOR.onEmber;
export const BLOOD = COLOR.blood;

/** Alias kept for call sites that import `TEAL` as "the accent". Now pewter. */
export const TEAL = GOLD;

/* ------------------------------------------------------------------- fonts */

/** Display face for headings (single regular weight carries every size). */
export const DISPLAY = { fontFamily: "'Fontin', Georgia, serif" } as const;
/** Section labels: the face's own small caps, never letter-spaced capitals. */
export const LABEL = {
    fontFamily: "'Fontin SmallCaps', 'Fontin', Georgia, serif",
} as const;
/** Clean grotesk for all small UI: nav, labels under 15px, stats, buttons. */
export const UI = {
    fontFamily: "'Archivo', ui-sans-serif, sans-serif",
} as const;
/** Body copy and prose. */
export const BODY = { fontFamily: "'Fontin', Georgia, serif" } as const;

/** Display face with a stone drop shadow, for hero headings. */
export const ENGRAVED = {
    ...DISPLAY,
    textShadow: '0 2px 1px rgba(0,0,0,0.85)',
} as const;

/** The base field shared by every public page. */
export const PAGE_BG = COLOR.ink;

/* --------------------------------------------------------------- gem socket */

/** The jewel tones - one per tool, so each reads as its own thing. */
export const GEM_TONES = {
    ruby: {
        from: '#ff9a8a',
        mid: '#c0392f',
        to: '#5e1714',
        glow: 'rgba(255,120,100,0.5)',
    },
    emerald: {
        from: '#92e6a6',
        mid: '#3f9457',
        to: '#173d24',
        glow: 'rgba(120,225,150,0.5)',
    },
    sapphire: {
        from: '#9cc2f5',
        mid: '#4172b8',
        to: '#172e55',
        glow: 'rgba(130,175,240,0.5)',
    },
    topaz: {
        from: '#ffe7b0',
        mid: '#c79a3a',
        to: '#6a4f19',
        glow: 'rgba(240,210,140,0.5)',
    },
    amethyst: {
        from: '#d5b0f5',
        mid: '#8b4fc0',
        to: '#3a1d5e',
        glow: 'rgba(190,140,240,0.5)',
    },
    // A clear, prismatic diamond - cool silver-white facets, colourless by design
    // so it reads apart from the five coloured stones.
    prismatic: {
        from: '#ffffff',
        mid: '#c3cede',
        to: '#6d7789',
        glow: 'rgba(205,222,255,0.55)',
    },
} as const;

export type GemTone = keyof typeof GEM_TONES;

/**
 * A cut, glassy gem - the recurring mark of the kit. Each tool is a skill gem
 * of its own colour: faceted body, table highlight, specular glint and a core
 * glow. The drop-shadow is driven by the tone so callers can brighten it on
 * hover from the parent.
 */
export function Gem({
    tone,
    className = '',
}: {
    tone: GemTone;
    className?: string;
}) {
    const c = GEM_TONES[tone];

    return (
        <svg
            viewBox="0 0 28 36"
            className={className}
            fill="none"
            aria-hidden
            style={{ filter: `drop-shadow(0 0 5px ${c.glow})` }}
        >
            <defs>
                <linearGradient id={`gem-${tone}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={c.from} />
                    <stop offset="0.5" stopColor={c.mid} />
                    <stop offset="1" stopColor={c.to} />
                </linearGradient>
                <radialGradient
                    id={`gemcore-${tone}`}
                    cx="44%"
                    cy="34%"
                    r="62%"
                >
                    <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
            </defs>
            {/* body */}
            <polygon
                points="14,1 26,11 21,34 7,34 2,11"
                fill={`url(#gem-${tone})`}
                stroke="#000"
                strokeOpacity="0.55"
                strokeWidth="0.8"
            />
            {/* facet shading */}
            <polygon
                points="14,1 2,11 7,34 14,34"
                fill="#000"
                fillOpacity="0.2"
            />
            <polygon
                points="14,1 26,11 21,34 14,34"
                fill="#fff"
                fillOpacity="0.05"
            />
            <polygon
                points="14,1 26,11 14,15 2,11"
                fill="#fff"
                fillOpacity="0.16"
            />
            <g
                fill="none"
                stroke="#fff"
                strokeOpacity="0.24"
                strokeWidth="0.55"
            >
                <path d="M2 11 14 15 26 11M14 15 14 34M14 15 7 34M14 15 21 34" />
            </g>
            <g fill="none" stroke="#000" strokeOpacity="0.24" strokeWidth="0.5">
                <path d="M14 1 2 11M14 1 26 11M14 1 14 15" />
            </g>
            {/* core glow + specular glint */}
            <ellipse
                cx="11"
                cy="9"
                rx="3.6"
                ry="5.2"
                fill={`url(#gemcore-${tone})`}
            />
            <circle cx="10" cy="7" r="1.3" fill="#fff" fillOpacity="0.85" />
            <polygon
                points="14,1 26,11 21,34 7,34 2,11"
                fill="none"
                stroke="#fff"
                strokeOpacity="0.22"
                strokeWidth="0.8"
            />
        </svg>
    );
}

/**
 * Legacy export. Older pages render `<Emblem/>` as the brand mark; it now draws
 * the kit's topaz gem. New code should prefer <Gem/> or <Wordmark/>.
 */
export function Emblem({ className = '' }: { className?: string }) {
    return <Gem tone="topaz" className={className} />;
}

/* ------------------------------------------------------------------ wordmark */

/** The short mark: "E2E" set in Fontin. */
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
            E2E
        </span>
    );
}

/** The full app name in Fontin, one colour. */
export function Wordmark({
    className = '',
    style,
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <span
            className={className}
            style={{ ...DISPLAY, color: COLOR.paper, ...style }}
        >
            {useAppName()}
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
            <g stroke={GOLD} strokeOpacity="0.55" strokeWidth="1">
                <path d="M12 6 H98" />
                <path d="M142 6 H228" />
                <path d="M98 6 q9 -6 16 0 q-9 6 -16 0" />
                <path d="M142 6 q-9 -6 -16 0 q9 6 16 0" />
            </g>
            <path
                d="M120 1.5 L125 6 L120 10.5 L115 6 Z"
                fill={GOLD}
                fillOpacity="0.75"
            />
        </svg>
    );
}

/** Pewter corner brackets - the framing motif used across the panels. */
export function Corners() {
    const base = 'pointer-events-none absolute size-3 border-pewter-500/45';

    return (
        <>
            <span className={`${base} top-0 left-0 border-t border-l`} />
            <span className={`${base} top-0 right-0 border-t border-r`} />
            <span className={`${base} bottom-0 left-0 border-b border-l`} />
            <span className={`${base} right-0 bottom-0 border-r border-b`} />
        </>
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

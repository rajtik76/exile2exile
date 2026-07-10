import { Link, usePage } from '@inertiajs/react';

/*
 * Shared brand primitives for the public pages - "Exile to Exile".
 * Identity: a free, fan-made set of Path of Exile 2 tools, one player to
 * another. Cold quicksilver + tarnished gold on a void-black field, with a
 * warm forged-ember call-to-action. Display face is Marcellus SC (inscriptional
 * Roman caps), UI is Archivo, body copy is Fraunces - all self-hosted.
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

export const VOID = '#08080b';
export const INK = '#d6dae2'; // readable text - high contrast
export const INK_SOFT = '#a7acb8'; // secondary, still legible
export const INK_FAINT = '#787d8a'; // captions only
export const HEAD = '#f1f3f8';
export const GOLD = '#c9a24a';
export const GOLD_LIT = '#ecd49a';
export const SILVER = '#b6bdcb';
export const SILVER_LIT = '#e6ecf6';
export const EMBER = '#c2762f';
export const EMBER_DEEP = '#85481c';
export const EMBER_INK = '#fbe7c4';
export const BLOOD = '#d2473c'; // PoE life/blood red - the second exile

/** Alias kept for call sites that import `TEAL` as "the accent". Now tarnished gold. */
export const TEAL = GOLD;

/* ------------------------------------------------------------------- fonts */

/** Inscriptional Roman display (single weight - never set 700 on it). */
export const DISPLAY = { fontFamily: "'Marcellus SC', serif" } as const;
/** Clean grotesk for all small UI: nav, labels, footer, stats, buttons. */
export const UI = {
    fontFamily: "'Archivo', ui-sans-serif, sans-serif",
} as const;
/** Legible body / flavour serif. */
export const BODY = { fontFamily: "'Fraunces', Georgia, serif" } as const;

/** Display face with a faint carved-gold glow, for hero headings. */
export const ENGRAVED = {
    ...DISPLAY,
    textShadow: '0 2px 1px rgba(0,0,0,0.85), 0 0 26px rgba(201,162,74,0.16)',
} as const;

/** The base radial field shared by every public page. */
export const PAGE_BG =
    'radial-gradient(58% 44% at 50% 0%, rgba(201,162,74,0.05), transparent 70%), radial-gradient(120% 80% at 50% -8%, #15151e 0%, #0c0c12 46%, #08080b 100%)';

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

/**
 * The wordmark - the whole identity. Inscriptional caps, no logo needed. The two
 * exiles take the game's own colours: the first carved in tarnished gold, the
 * second in life-blood red, with the connector dimmed - one player to another.
 */
export function Wordmark({
    className = '',
    style,
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    const words = String(useAppName()).split(' ');
    const last = words.length - 1;

    return (
        <span
            className={className}
            style={{ ...DISPLAY, letterSpacing: '0.04em', ...style }}
        >
            {words.map((word, i) => (
                <span
                    key={i}
                    style={{
                        color:
                            i === 0 ? GOLD_LIT : i === last ? BLOOD : INK_FAINT,
                    }}
                >
                    {word}
                    {i < last ? ' ' : ''}
                </span>
            ))}
        </span>
    );
}

/* ----------------------------------------------------------------- ornaments */

/** Ruled divider ornament - kept for the legal pages; tarnished gold. */
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

/** Gold corner brackets - the framing motif used across the panels. */
export function Corners() {
    const base = 'pointer-events-none absolute size-3 border-[#c9a24a]/45';

    return (
        <>
            <span className={`${base} top-0 left-0 border-t border-l`} />
            <span className={`${base} top-0 right-0 border-t border-r`} />
            <span className={`${base} bottom-0 left-0 border-b border-l`} />
            <span className={`${base} right-0 bottom-0 border-r border-b`} />
        </>
    );
}

/** Small uppercase eyebrow label. Archivo for legibility at this size. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <p
            className="text-xs font-semibold tracking-[0.1em] text-[#ecd49a] uppercase"
            style={UI}
        >
            {children}
        </p>
    );
}

/**
 * Primary call-to-action: warm forged ember against the cold field. Renders a
 * link when given `href`, or a button when given `onClick` (e.g. a POST action).
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
    const className =
        'inline-flex items-center gap-2 rounded-sm border border-[#c2762f]/65 bg-gradient-to-b from-[#c2762f] to-[#85481c] px-7 py-3 text-sm font-semibold tracking-[0.02em] text-[#fbe7c4] uppercase shadow-lg transition hover:brightness-115';

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={className}
                style={UI}
            >
                {children}
            </button>
        );
    }

    return (
        <Link href={href ?? '#'} className={className} style={UI}>
            {children}
        </Link>
    );
}

import { Head, Link } from '@inertiajs/react';
import {
    BLOOD,
    Corners,
    Gem,
    GEM_TONES,
    GOLD,
    GOLD_LIT,
    PrimaryCta,
} from '@/components/brand';
import type { GemTone } from '@/components/brand';
// Bundled by Vite (hashed asset). The Atlas star-chart with a severed pilgrimage
// path and a shattered waypoint - the visual metaphor for a page off the map.
import errorArt from '../../images/error/404.jpg';

/**
 * One Inertia page for every HTTP error the handler chooses to render. It reads
 * the error the way the Atlas would log it: a lost survey. The status is the big
 * engraved coordinate, the copy names the dead route in the game's own words, and
 * a severed surveyor's path draws itself toward a break - then hands the visitor
 * a set of real waypoints back into the working tools.
 */
type ErrorCopy = {
    /** Small tracked label above the number, in the map's vocabulary. */
    kind: string;
    /** Marcellus title - what happened, in-world but legible. */
    title: string;
    /** The one plain, useful sentence. Active voice, no apology. */
    lead: string;
    /** Unique-item flavour, always italic. Atmosphere, never information. */
    flavor: string;
};

const COPY: Record<number, ErrorCopy> = {
    403: {
        kind: 'Sealed',
        title: 'This waypoint is sealed',
        lead: "You don't have passage to this part of the Atlas. Head back to the map and take another route.",
        flavor: 'warded against those who carry no sigil',
    },
    404: {
        kind: 'Uncharted',
        title: 'This route was never charted',
        lead: 'The page you followed is not on the map. The link may be broken, or the tool has since moved.',
        flavor: 'the surveyors turned back before this waypoint was ever socketed',
    },
    419: {
        kind: 'Stale',
        title: 'The passage went stale',
        lead: 'Your session expired before the request landed. Head back and start again from a fresh page.',
        flavor: 'the ink faded before the seal was ever set',
    },
    500: {
        kind: 'Fractured',
        title: 'The map cracked underfoot',
        lead: "Something failed on our side while charting this page. It's been logged - give it a moment and try again.",
        flavor: 'even the cartographers lose a plate now and then',
    },
    503: {
        kind: 'Redrawn',
        title: 'The Atlas is being redrawn',
        lead: 'The tools are down for brief maintenance. The map will be back shortly.',
        flavor: 'hold fast - the ink is still wet',
    },
};

/** The charted routes still open - a lost visitor's way straight into a tool. */
const WAYPOINTS: { tone: GemTone; name: string; kind: string; href: string }[] =
    [
        {
            tone: 'emerald',
            name: 'Tree planner',
            kind: 'Passive tree',
            href: '/tree',
        },
        {
            tone: 'sapphire',
            name: 'Patch alerts',
            kind: 'New-patch webhook',
            href: '/patch-webhook',
        },
    ];

export default function ErrorPage({ status }: { status: number }) {
    const copy = COPY[status] ?? COPY[404];
    const code = COPY[status] ? status : 404;

    return (
        <>
            <Head title={`${copy.title} - Error ${code}`} />

            {/*
                Scoped keyframes for the one signature moment: the survey path
                drawing in, then a slow pulse at the break. Reduced-motion users
                get the finished, still state - no wipe, no pulse.
            */}
            <style>{`
                @keyframes atlasChartWipe {
                    from { clip-path: inset(0 100% 0 0); }
                    to   { clip-path: inset(0 0 0 0); }
                }
                @keyframes atlasBreakPulse {
                    0%, 100% { opacity: 0.6; transform: scale(1); }
                    50%      { opacity: 1;   transform: scale(1.14); }
                }
                .atlas-path-draw { animation: atlasChartWipe 1.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
                .atlas-break { transform-box: fill-box; transform-origin: center; animation: atlasBreakPulse 2.8s ease-in-out 1.5s infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .atlas-path-draw, .atlas-break { animation: none; }
                }
            `}</style>

            <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
                <div className="grid items-center gap-10 md:grid-cols-[1.15fr_1fr] md:gap-14">
                    {/* ── Map plate: the art framed as a cartographic engraving ── */}
                    <figure className="group relative overflow-hidden rounded-md border border-[#c9a24a]/25 bg-[#0c0c12] shadow-2xl shadow-black/70">
                        <div className="relative aspect-video w-full">
                            {/*
                                Art-agnostic: a hashed Vite asset. If it ever fails
                                to load, the panel's void background holds the frame
                                and the survey column still tells the whole story.
                            */}
                            <img
                                src={errorArt}
                                alt=""
                                aria-hidden
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                            {/* Feather the edges into the frame, don't wash the art. */}
                            <div
                                aria-hidden
                                className="absolute inset-0"
                                style={{
                                    background:
                                        'radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(8,8,11,0.55) 100%)',
                                }}
                            />
                        </div>

                        {/* Cartouche caption - reads like the label struck on a map plate. */}
                        <figcaption
                            className="flex items-center justify-between gap-3 border-t border-[#c9a24a]/15 bg-[#08080b]/85 px-4 py-2.5 text-[11px] tracking-[0.14em] text-[#787d8a] uppercase"
                            style={{ fontFamily: "'Archivo', sans-serif" }}
                        >
                            <span>Atlas survey · sector unknown</span>
                            <span className="text-[#d2473c]/80">
                                No waypoint
                            </span>
                        </figcaption>

                        <Corners />
                    </figure>

                    {/* ── Survey readout: the dead route, logged in the map's words ── */}
                    <div className="text-left">
                        <p
                            className="text-xs font-semibold tracking-[0.22em] text-[#ecd49a] uppercase"
                            style={{ fontFamily: "'Archivo', sans-serif" }}
                        >
                            {copy.kind} · Error {code}
                        </p>

                        <div
                            className="mt-3 text-[5.5rem] leading-[0.9] text-[#ecd49a] sm:text-[7rem]"
                            style={{
                                fontFamily: "'Marcellus SC', serif",
                                textShadow:
                                    '0 2px 1px rgba(0,0,0,0.85), 0 0 30px rgba(201,162,74,0.22)',
                            }}
                        >
                            {code}
                        </div>

                        <h1
                            className="mt-5 text-2xl text-[#f1f3f8] sm:text-[1.75rem]"
                            style={{ fontFamily: "'Marcellus SC', serif" }}
                        >
                            {copy.title}
                        </h1>

                        <p
                            className="mt-3 max-w-md text-[1.0625rem] leading-relaxed text-[#d6dae2]"
                            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                        >
                            {copy.lead}
                        </p>

                        <p
                            className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-[#787d8a] italic"
                            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                        >
                            - {copy.flavor}
                        </p>

                        <div className="mt-8">
                            <PrimaryCta href="/">Back to the Atlas</PrimaryCta>
                        </div>
                    </div>
                </div>

                {/* ── Signature: the severed surveyor's path ── */}
                <SeveredPath />

                {/* ── Empty state as invitation: routes still open ── */}
                <div className="mt-8">
                    <p
                        className="mb-5 text-center text-[11px] tracking-[0.2em] text-[#787d8a] uppercase"
                        style={{ fontFamily: "'Archivo', sans-serif" }}
                    >
                        Or pick a route that's still charted
                    </p>

                    <ul className="flex flex-wrap items-stretch justify-center gap-3">
                        {WAYPOINTS.map((waypoint) => (
                            <li key={waypoint.name}>
                                <WaypointLink {...waypoint} />
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </>
    );
}

/**
 * The one memorable device: a dotted golden pilgrimage path that draws itself in
 * on load, passes a few socketed waypoints, then breaks at a blood-red node - the
 * far stub frays and dissolves into the void. It restates the art's metaphor: the
 * trail simply stops here. Decorative, so hidden from assistive tech.
 */
function SeveredPath() {
    return (
        <div
            className="mx-auto mt-14 w-full max-w-3xl overflow-hidden"
            aria-hidden
        >
            <svg
                viewBox="0 0 1000 60"
                className="atlas-path-draw h-10 w-full"
                fill="none"
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Charted stretch - solid dotted gold with a few waypoint sockets. */}
                <g stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                    <path
                        d="M20 30 H455"
                        strokeDasharray="2 12"
                        strokeOpacity="0.85"
                    />
                </g>
                {[95, 200, 305, 410].map((cx) => (
                    <circle
                        key={cx}
                        cx={cx}
                        cy="30"
                        r="4.5"
                        fill="#0c0c12"
                        stroke={GOLD_LIT}
                        strokeWidth="1.5"
                        strokeOpacity="0.8"
                    />
                ))}

                {/* The break - a blood-red node where the path is severed. */}
                <g className="atlas-break">
                    <circle
                        cx="500"
                        cy="30"
                        r="9"
                        fill="none"
                        stroke={BLOOD}
                        strokeWidth="2"
                    />
                    <path
                        d="M494 24 L506 36 M506 24 L494 36"
                        stroke={BLOOD}
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </g>

                {/* The uncharted stub - frays and fades into nothing. */}
                <g stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                    <path
                        d="M545 30 H980"
                        strokeDasharray="2 14"
                        strokeOpacity="0.28"
                    />
                </g>
                <defs>
                    <linearGradient id="atlasFade" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#08080b" stopOpacity="0" />
                        <stop offset="1" stopColor="#08080b" stopOpacity="1" />
                    </linearGradient>
                </defs>
                <rect
                    x="720"
                    y="0"
                    width="280"
                    height="60"
                    fill="url(#atlasFade)"
                />
            </svg>
        </div>
    );
}

/**
 * A charted waypoint the visitor can still reach - a socketed gem in its tool's
 * own colour. The whole card is the link; on hover the socket gilds and the gem
 * lifts and glows, echoing the landing's Atlas.
 */
function WaypointLink({
    tone,
    name,
    kind,
    href,
}: {
    tone: GemTone;
    name: string;
    kind: string;
    href: string;
}) {
    const external = href.startsWith('http');
    const glow = GEM_TONES[tone].glow;

    const inner = (
        <>
            <span
                className="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-[#c9a24a]/25 bg-[#08080b] transition group-hover:border-[#ecd49a]/70"
                style={{ boxShadow: `inset 0 0 12px ${glow}` }}
            >
                <Gem
                    tone={tone}
                    className="h-6 w-6 transition group-hover:scale-110"
                />
            </span>
            <span className="flex flex-col">
                <span
                    className="text-[0.95rem] leading-tight text-[#f1f3f8]"
                    style={{ fontFamily: "'Marcellus SC', serif" }}
                >
                    {name}
                </span>
                <span
                    className="text-[11px] tracking-[0.08em] text-[#787d8a] uppercase"
                    style={{ fontFamily: "'Archivo', sans-serif" }}
                >
                    {kind}
                </span>
            </span>
        </>
    );

    const className =
        'group flex items-center gap-3 rounded-md border border-[#c9a24a]/15 bg-[#0c0c12]/60 px-4 py-3 transition hover:border-[#c9a24a]/40 hover:bg-[#13131b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ecd49a]';

    if (external) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className={className}
            >
                {inner}
            </a>
        );
    }

    return (
        <Link href={href} className={className}>
            {inner}
        </Link>
    );
}

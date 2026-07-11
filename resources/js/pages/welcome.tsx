import { Head, Link } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
    BLOOD,
    Eyebrow,
    Gem,
    GEM_TONES,
    GOLD_LIT,
    INK_FAINT,
} from '@/components/brand';
import type { GemTone } from '@/components/brand';
import planner from '@/routes/planner';
// Bundled by Vite (hashed asset). Star-chart filigree - kept as a faint texture
// behind the carousel so the cartography flavour of the old Atlas survives.
import atlasBg from '../../images/landing/atlas.jpg';

/**
 * The landing is a signpost, not a sales page. The kit's tools are skill gems,
 * so the hero inspects them one at a time in a socket - a self-advancing gem
 * carousel whose navigation dots ARE the gems, each in its own colour. A
 * short inscription underneath says what this is and why it exists. From one
 * exile to another.
 */
export default function Welcome() {
    return (
        <>
            <Head title="Exile to Exile - free Path of Exile 2 tools">
                <meta
                    name="description"
                    content="A free, fan-made set of Path of Exile 2 tools, one player to another: plan a passive tree, write a phased build guide, turn it into a loot filter, or get pinged when a new patch ships. No ads, no accounts."
                />
            </Head>

            <Hero />
        </>
    );
}

type Tool = {
    tone: GemTone;
    name: string;
    kind: string;
    body: string;
    cta: string;
    /** Live destination. Omitted on tools that aren't ready to open yet. */
    href?: string;
    /** Optional status pill beside the kind, e.g. a work-in-progress note. */
    tag?: string;
    /** Not finished - shows a muted "coming soon" marker instead of a live CTA. */
    comingSoon?: boolean;
};

const TOOLS: Tool[] = [
    {
        tone: 'emerald',
        name: 'Tree planner',
        kind: 'Passive tree',
        body: 'Plan a full passive tree in the browser. Imports straight from a Path of Building code.',
        cta: 'Plan a tree',
        href: '/tree',
    },
    {
        tone: 'amethyst',
        name: 'Build planner',
        kind: 'Guide builder',
        tag: 'New',
        body: 'Lay a whole build out as a phased guide - passive tree, gear, gems and notes - then share a read-only link.',
        cta: 'Plan a build',
        href: planner.create.url(),
    },
    {
        tone: 'prismatic',
        name: 'Build filter',
        kind: 'Build-based loot filter',
        tag: 'New',
        body: 'Turn your build into an in-game loot filter - highlight the bases and mods it actually wants, hide the rest.',
        cta: 'Build a filter',
        href: planner.create.url(),
    },
    {
        tone: 'sapphire',
        name: 'Patch alerts',
        kind: 'New-patch webhook',
        body: "Get pinged the moment a new patch ships, straight off GGG's servers.",
        cta: 'Wire a webhook',
        href: '/patch-webhook',
    },
];

/** How long each gem dwells before the carousel advances on its own. */
const DWELL_MS = 7000;

/** Live matchMedia flag for `prefers-reduced-motion`, SSR-safe. */
function usePrefersReducedMotion(): boolean {
    const query = '(prefers-reduced-motion: reduce)';
    const [reduced, setReduced] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(query).matches,
    );

    useEffect(() => {
        const media = window.matchMedia(query);
        const onChange = () => setReduced(media.matches);
        media.addEventListener('change', onChange);

        return () => media.removeEventListener('change', onChange);
    }, []);

    return reduced;
}

function Hero() {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const reduced = usePrefersReducedMotion();
    const touchStart = useRef<number | null>(null);
    const count = TOOLS.length;

    const goTo = useCallback((target: number) => {
        setIndex(((target % TOOLS.length) + TOOLS.length) % TOOLS.length);
    }, []);
    const next = useCallback(() => goTo(index + 1), [goTo, index]);
    const prev = useCallback(() => goTo(index - 1), [goTo, index]);

    // Auto-advance while unpaused. Keying the effect on `index` restarts the
    // dwell after any change - manual or automatic - so it never cuts a gem
    // short. Reduced motion opts out entirely.
    useEffect(() => {
        if (paused || reduced) {
            return;
        }

        const id = window.setTimeout(
            () => setIndex((current) => (current + 1) % TOOLS.length),
            DWELL_MS,
        );

        return () => window.clearTimeout(id);
    }, [index, paused, reduced]);

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowRight') {
            next();
        } else if (event.key === 'ArrowLeft') {
            prev();
        }
    };

    const active = TOOLS[index];

    return (
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            {/* thesis: what this is, in one breath */}
            <header className="mx-auto max-w-2xl text-center">
                <Eyebrow>Path of Exile 2 · fan-made toolkit</Eyebrow>
                <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-[0.02em] text-[#f1f3f8] sm:text-6xl">
                    Exile to Exile
                </h1>
                <p className="mx-auto mt-5 max-w-xl font-body text-[17px] leading-relaxed text-[#a7acb8]">
                    A handful of tools I made for Path of Exile&nbsp;2 and put
                    online for anyone to use. Each one is a gem - pick the one
                    you need.
                </p>
            </header>

            {/* the signature: a gem inspected in its socket, auto-cycling */}
            <div
                role="group"
                aria-roledescription="carousel"
                aria-label="Tools"
                tabIndex={0}
                onKeyDown={onKeyDown}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                onTouchStart={(event) => {
                    touchStart.current = event.touches[0].clientX;
                }}
                onTouchEnd={(event) => {
                    if (touchStart.current === null) {
                        return;
                    }

                    const delta =
                        event.changedTouches[0].clientX - touchStart.current;

                    if (delta > 48) {
                        prev();
                    } else if (delta < -48) {
                        next();
                    }

                    touchStart.current = null;
                }}
                className="relative mt-12 overflow-hidden rounded-lg border border-[#b6bdcb]/12 bg-[linear-gradient(160deg,#101019,#0a0a10)] outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a]/50"
            >
                {/* faint star-chart texture + centre vignette */}
                <img
                    src={atlasBg}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 size-full object-cover opacity-40"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_45%,rgba(8,8,11,0.9)_0%,transparent_70%)]"
                />
                {/* faint wash toward the active gem's tone, crossfading on change,
                    centred on the gem (upper-centre on mobile, left on desktop) */}
                <div
                    key={index}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_50%_28%,var(--tint),transparent_70%)] lg:bg-[radial-gradient(45%_75%_at_25%_50%,var(--tint),transparent_72%)]"
                    style={
                        {
                            '--tint': GEM_TONES[active.tone].glow,
                            opacity: 0.55,
                            animation: reduced
                                ? undefined
                                : 'ete-carousel-tint 700ms ease-out both',
                        } as CSSProperties
                    }
                />

                <div className="relative grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[minmax(0,300px)_1fr] lg:gap-14">
                    <GemSocket
                        tone={active.tone}
                        index={index}
                        paused={paused}
                        reduced={reduced}
                    />

                    {/* tool details - fade up on each swap unless reduced */}
                    <div
                        key={index}
                        className="text-center lg:text-left"
                        style={
                            reduced
                                ? undefined
                                : {
                                      animation:
                                          'ete-carousel-fade 420ms ease-out both',
                                  }
                        }
                    >
                        <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
                            <span className="font-ui text-[13px] font-semibold tracking-[0.14em] text-[#c9a24a] uppercase">
                                {active.kind}
                            </span>
                            {active.tag && (
                                <span className="rounded-full border border-[#c9a24a]/40 bg-[#c9a24a]/10 px-2 py-0.5 font-ui text-[10px] tracking-[0.08em] text-[#ecd49a]">
                                    {active.tag}
                                </span>
                            )}
                        </div>
                        <h2 className="mt-2 font-display text-4xl tracking-[0.02em] text-[#f1f3f8] sm:text-5xl">
                            {active.name}
                        </h2>
                        <p className="mx-auto mt-4 max-w-md font-body text-[16px] leading-relaxed text-[#a7acb8] lg:mx-0">
                            {active.body}
                        </p>
                        <ToolCta tool={active} />
                    </div>
                </div>

                {/* controls: arrows flank the gems that double as nav */}
                <div className="relative flex items-center justify-center gap-4 border-t border-[#b6bdcb]/10 bg-[#0a0a10]/70 px-6 py-4">
                    <Arrow direction="prev" onClick={prev} />
                    <div className="flex items-center gap-2 sm:gap-3">
                        {TOOLS.map((tool, dot) => (
                            <GemDot
                                key={tool.name}
                                tool={tool}
                                active={dot === index}
                                onClick={() => goTo(dot)}
                            />
                        ))}
                    </div>
                    <Arrow direction="next" onClick={next} />
                    <span className="sr-only" aria-live="polite">
                        {active.name}, {index + 1} of {count}
                    </span>
                </div>
            </div>

            <Inscription />
        </section>
    );
}

/** The active gem seated in an ornate socket, ringed by an autoplay progress arc. */
function GemSocket({
    tone,
    index,
    paused,
    reduced,
}: {
    tone: GemTone;
    index: number;
    paused: boolean;
    reduced: boolean;
}) {
    const glow = GEM_TONES[tone].glow;
    // Circumference of the r=70 progress ring, so the stroke sweep starts full
    // and empties to nothing across one dwell.
    const radius = 70;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="relative mx-auto size-[168px] shrink-0">
            {/* progress ring - restarts every dwell via the index key, hidden
                under reduced motion */}
            {!reduced && (
                <svg
                    key={index}
                    aria-hidden
                    viewBox="0 0 168 168"
                    className="absolute inset-0 size-full -rotate-90"
                >
                    <circle
                        cx="84"
                        cy="84"
                        r={radius}
                        fill="none"
                        stroke="#c9a24a"
                        strokeOpacity="0.85"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        style={
                            {
                                '--ring-len': `${circumference}px`,
                                animation: `ete-carousel-ring ${DWELL_MS}ms linear both`,
                                animationPlayState: paused
                                    ? 'paused'
                                    : 'running',
                            } as CSSProperties
                        }
                    />
                </svg>
            )}

            {/* socket rim */}
            <div className="absolute inset-[14px] rounded-full border border-[#c9a24a]/30" />

            {/* the gem, glowing in its tone */}
            <div
                className="absolute inset-[26px] flex items-center justify-center rounded-full border border-[#c9a24a]/45 bg-[radial-gradient(60%_60%_at_40%_30%,#23232f,#0c0c12)] shadow-[0_0_0_6px_#08080b,0_0_40px_-4px_var(--glow)]"
                style={{ '--glow': glow } as CSSProperties}
            >
                <Gem key={tone} tone={tone} className="size-16" />
            </div>
        </div>
    );
}

/** The tool's call-to-action - an ember link into the tool itself. */
function ToolCta({ tool }: { tool: Tool }) {
    // Not shipped yet: a muted, non-interactive marker in place of a live CTA.
    if (tool.comingSoon || !tool.href) {
        return (
            <span className="mt-6 inline-flex items-center gap-2 rounded-sm border border-[#787d8a]/35 px-6 py-2.5 font-ui text-[13px] font-semibold tracking-[0.1em] text-[#787d8a] uppercase">
                Coming soon
            </span>
        );
    }

    const className =
        'mt-6 inline-flex items-center gap-2 rounded-sm border border-[#c2762f]/70 bg-gradient-to-b from-[#8a4a1f] to-[#5e2f12] px-6 py-2.5 font-ui text-[13px] font-semibold tracking-[0.1em] text-[#fbe7c4] uppercase shadow-lg transition hover:border-[#ecd49a]/70 hover:brightness-110';

    return (
        <Link href={tool.href} className={className}>
            {tool.cta} →
        </Link>
    );
}

/** One of the gems, doubling as a carousel dot. Lit when its tool is active. */
function GemDot({
    tool,
    active,
    onClick,
}: {
    tool: Tool;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={tool.name}
            aria-current={active ? 'true' : undefined}
            className={`flex size-9 items-center justify-center rounded-full border transition ${
                active
                    ? 'border-[#c9a24a]/70 bg-[#c9a24a]/10'
                    : 'border-transparent opacity-45 hover:opacity-80'
            }`}
        >
            <Gem
                tone={tool.tone}
                className={active ? 'size-5' : 'size-[18px]'}
            />
        </button>
    );
}

/** A quiet chevron control on either side of the gem row. */
function Arrow({
    direction,
    onClick,
}: {
    direction: 'prev' | 'next';
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={direction === 'prev' ? 'Previous tool' : 'Next tool'}
            className="flex size-9 items-center justify-center rounded-full text-[#787d8a] transition hover:text-[#ecd49a]"
        >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
                <path
                    d={direction === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    );
}

/** The inscription: what this is, why it exists, and a plain-spoken WIP note. */
function Inscription() {
    return (
        <div
            id="why"
            className="mx-auto mt-14 max-w-2xl scroll-mt-24 rounded-md border border-[#c9a24a]/25 bg-gradient-to-br from-[#14141c]/95 to-[#0c0c12]/95 p-7 backdrop-blur-sm"
        >
            <Eyebrow>What is this</Eyebrow>
            <p className="mt-3 font-body text-[16px] leading-relaxed text-[#d6dae2]">
                A growing kit of Path of Exile&nbsp;2 tools, built one at a
                time: plan a passive tree, lay a whole build out as a phased
                guide, turn that build into an in-game loot filter, or get
                pinged the moment a new patch ships. Every tool reads straight
                from the official game files.
            </p>
            {/* the personal note, set apart as a pulled quote */}
            <blockquote className="relative mt-6 border-l-2 border-[#c9a24a]/45 pl-6">
                <span
                    aria-hidden
                    className="absolute -top-3 left-3 font-display text-5xl leading-none text-[#c9a24a]/35 select-none"
                >
                    &ldquo;
                </span>
                <p className="font-body text-[16px] leading-relaxed text-[#e4e8ef] italic">
                    No ads, no accounts, nothing to buy, and the whole thing is
                    open source. It started as a passive-tree planner I wanted
                    for myself, and grew from there.
                    <span
                        aria-hidden
                        className="relative inline-block w-0 select-none"
                    >
                        <span className="absolute bottom-[-0.15em] left-1 font-display text-5xl leading-none text-[#c9a24a]/35">
                            &bdquo;
                        </span>
                    </span>
                </p>
            </blockquote>
            {/* sign-off, echoing the wordmark: lead gold, "to" muted, close blood red */}
            <p className="mt-6 font-display text-2xl tracking-[0.02em] sm:text-[26px]">
                <span style={{ color: GOLD_LIT }}>From one exile</span>{' '}
                <span style={{ color: INK_FAINT }}>to</span>{' '}
                <span style={{ color: BLOOD }}>another.</span>
            </p>
        </div>
    );
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GEM_TONES, GOLD, GOLD_LIT } from '@/components/brand';

/** How far down the page the reader must scroll before the dial appears. */
const SHOW_AFTER_PX = 480;

/** How long the activation ring stays on screen after a click, in ms. */
const PING_DURATION_MS = 600;

const GLOW = GEM_TONES.topaz.glow;

/** The bronze socket's own palette - not sourced from brand.tsx since it's a one-off
 *  carved-stone look, not a reusable tone (see {@link GEM_TONES}). */
const SOCKET_BG =
    'radial-gradient(circle at 33% 28%, #352b1a 0%, #17130c 55%, #0a0906 100%)';
const SOCKET_SHADOW = [
    '0 0 0 1px rgba(0,0,0,0.7)',
    `0 0 0 3px ${GOLD}66`,
    'inset 0 2px 3px rgba(255,255,255,0.10)',
    'inset 0 -4px 9px rgba(0,0,0,0.7)',
    '0 10px 26px -8px rgba(0,0,0,0.85)',
].join(', ');

/**
 * A waypoint stone, fixed at the bottom-right corner, that carries the reader back to
 * the top of a long build guide - the site header no longer stays pinned, so this is
 * now the only quick way up short of the browser's own scrollbar.
 *
 * Styled after the game's own waypoints rather than the reading pane's flat "Slate"
 * tokens: a carved bronze socket, a topaz ember breathing behind it, gold reeded ticks
 * for a rim. Clicking it lights the stone - the ring flares once, echoing the pulse a
 * waypoint gives off when it activates - then the page glides to the top. Rendered
 * through a portal straight into `<body>` so its stacking order never depends on a
 * page ancestor (the site footer, painted later in the DOM, would otherwise sit above
 * it despite a higher z-index of its own).
 */
export default function ScrollToTop() {
    const [visible, setVisible] = useState(false);
    const [pinging, setPinging] = useState(false);
    const pingTimeout = useRef<number | undefined>(undefined);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);

        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Clear any pending ping timeout on unmount, so a click right before navigating
    // away never fires a state update on an unmounted component.
    useEffect(() => () => window.clearTimeout(pingTimeout.current), []);

    function activate(): void {
        const reduceMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;

        if (!reduceMotion) {
            window.clearTimeout(pingTimeout.current);
            setPinging(true);
            pingTimeout.current = window.setTimeout(
                () => setPinging(false),
                PING_DURATION_MS,
            );
        }

        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <button
            type="button"
            onClick={activate}
            title="Back to top"
            aria-label="Back to top"
            aria-hidden={!visible}
            tabIndex={visible ? 0 : -1}
            style={{
                background: SOCKET_BG,
                boxShadow: SOCKET_SHADOW,
            }}
            // Bespoke gold hover/focus ring (rgba(201,162,74,0.55) = GOLD at ~55%
            // opacity) rather than the reading pane's --pl-ring - this button follows
            // the waypoint/brand palette, not the cool slate one. Tailwind's arbitrary
            // values must stay string literals here (no JS interpolation), or the
            // build never generates the class.
            className={`group fixed right-4 bottom-4 z-[9999] inline-flex size-14 items-center justify-center rounded-full transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_22px_6px_rgba(201,162,74,0.4)] focus-visible:-translate-y-1 focus-visible:shadow-[0_0_22px_6px_rgba(201,162,74,0.4)] focus-visible:ring-2 focus-visible:ring-[rgba(201,162,74,0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080b] focus-visible:outline-none sm:right-6 sm:bottom-6 ${
                visible
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none translate-y-2 scale-90 opacity-0'
            }`}
        >
            {/* The ember breathing behind the stone - always faintly alive, brighter
                on hover, like a torch someone just walked past. */}
            <span
                aria-hidden
                className="pl-waypoint-glow pointer-events-none absolute inset-1.5 rounded-full transition-opacity duration-300 group-hover:opacity-100"
                style={{
                    background: `radial-gradient(circle, ${GLOW} 0%, transparent 72%)`,
                    filter: 'blur(3px)',
                }}
            />

            {/* The activation flare - one ring, expanding and fading once per click. */}
            {pinging && (
                <span
                    aria-hidden
                    className="pl-waypoint-ping pointer-events-none absolute inset-0 rounded-full border-2"
                    style={{ borderColor: GOLD_LIT }}
                />
            )}

            {/* Gold reeded rim, eight ticks like a waypoint dial - turns a quarter on
                hover/focus, the same gesture as setting one. */}
            <svg
                viewBox="0 0 40 40"
                aria-hidden
                className="pointer-events-none absolute size-[1.9em] transition-transform duration-500 ease-out group-hover:rotate-45 group-focus-visible:rotate-45 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-focus-visible:rotate-0"
            >
                <circle
                    cx="20"
                    cy="20"
                    r="14.5"
                    fill="none"
                    stroke={GOLD}
                    strokeWidth="1.25"
                    opacity="0.65"
                />
                {Array.from({ length: 8 }, (_, index) => (
                    <line
                        key={index}
                        x1="20"
                        y1="3"
                        x2="20"
                        y2="7"
                        stroke={GOLD}
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        transform={`rotate(${(index * 360) / 8} 20 20)`}
                    />
                ))}
            </svg>

            {/* The direction of travel - stays upright while the dial turns, lit like
                carved gold. */}
            <svg
                viewBox="0 0 16 16"
                aria-hidden
                fill="none"
                stroke={GOLD_LIT}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative size-[0.95em] drop-shadow-[0_0_5px_rgba(236,212,154,0.55)] transition-transform duration-300 group-hover:-translate-y-0.5"
            >
                <path d="M4 9.5 L8 5.5 L12 9.5" />
            </svg>
        </button>,
        document.body,
    );
}

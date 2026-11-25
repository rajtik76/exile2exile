import { useId, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';

/** 11:00 PST, matching the Early Access launch hour. GGG has only confirmed the date. */
export const LAUNCH_AT = Date.parse('2026-12-11T19:00:00Z');

/** Gamescom ONL reveal of the 1.0 date. */
export const ANNOUNCED_AT = Date.parse('2026-08-25T18:00:00Z');

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type Remaining = {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
};

export function splitRemaining(milliseconds: number): Remaining {
    const clamped = Math.max(0, milliseconds);

    return {
        days: Math.floor(clamped / DAY),
        hours: Math.floor((clamped % DAY) / HOUR),
        minutes: Math.floor((clamped % HOUR) / MINUTE),
        seconds: Math.floor((clamped % MINUTE) / SECOND),
    };
}

export function journeyProgress(now: number): number {
    const span = LAUNCH_AT - ANNOUNCED_AT;

    return Math.min(1, Math.max(0, (now - ANNOUNCED_AT) / span));
}

function subscribeToClock(onTick: () => void): () => void {
    const id = window.setInterval(onTick, SECOND / 4);

    return () => window.clearInterval(id);
}

function currentSecond(): number {
    return Math.floor(Date.now() / SECOND) * SECOND;
}

/** Null on the server and during hydration, so both renders agree. */
export function useNow(): number | null {
    return useSyncExternalStore(subscribeToClock, currentSecond, () => null);
}

const UNITS: { key: keyof Remaining; label: string }[] = [
    { key: 'days', label: 'Days' },
    { key: 'hours', label: 'Hours' },
    { key: 'minutes', label: 'Minutes' },
    { key: 'seconds', label: 'Seconds' },
];

const HIGHLIGHTS: { lead: string; rest: string }[] = [
    { lead: 'Acts 5 and 6', rest: 'finish the campaign' },
    { lead: 'The Shadow', rest: 'with stealth, traps and daggers' },
    { lead: 'The Duelist', rest: 'and the Knight ascendancy' },
    { lead: 'Conquerors of Rayclast', rest: 'league' },
    { lead: 'Reworked uniques', rest: 'with built-in skills' },
    { lead: 'New passive tree', rest: 'and rebalanced supports' },
];

/**
 * The launch countdown below the tools shelf: the date, four recessed stone
 * tablets, the journey from the reveal to the launch and what 1.0 brings.
 * Styled by landing.css. After launch the clock gives way to a short note.
 */
export default function ReleaseCountdown() {
    const now = useNow();
    const launched = now !== null && now >= LAUNCH_AT;
    const remaining = now === null ? null : splitRemaining(LAUNCH_AT - now);

    return (
        <section
            id="launch"
            className="launch"
            aria-label="Path of Exile 2 launch countdown"
        >
            <div className="launch-top">
                <div>
                    <p className="launch-label">
                        Path of Exile 2, version 1.0, free to play
                    </p>
                    <h2>
                        <time dateTime="2026-12-11">
                            December <Fangs />, 2026
                        </time>
                    </h2>
                </div>

                {launched ? (
                    <p className="opened">
                        Wraeclast is open. Path of Exile 2 is out of Early
                        Access and free to play. Good luck out there, exile.
                    </p>
                ) : (
                    <div
                        className="clock"
                        role="timer"
                        aria-live="off"
                        aria-label={
                            remaining
                                ? `${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes until launch`
                                : 'Time until launch'
                        }
                    >
                        {UNITS.map((unit, index) => (
                            <Unit
                                key={unit.key}
                                label={unit.label}
                                value={remaining?.[unit.key]}
                                days={index === 0}
                            />
                        ))}
                    </div>
                )}
            </div>

            {!launched && (
                <Journey progress={now === null ? 0 : journeyProgress(now)} />
            )}

            <p className="news-label">New in 1.0</p>
            <ul className="news">
                {HIGHLIGHTS.map((item) => (
                    <li key={item.lead}>
                        <b>{item.lead}</b> {item.rest}
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * The short countdown above the hero title, linking down to the full one.
 * Gone once the game has launched.
 */
export function HeroCountdown() {
    const now = useNow();

    if (now !== null && now >= LAUNCH_AT) {
        return null;
    }

    const remaining = now === null ? null : splitRemaining(LAUNCH_AT - now);

    return (
        <a
            className="eta"
            href="#launch"
            aria-label="Path of Exile 2 version 1.0 launch countdown"
        >
            <span className="eta-days">
                <Tablet value={remaining?.days} />
                days
            </span>
            <span className="eta-clock">
                <Tablet value={remaining?.hours} />
                <b />
                <Tablet value={remaining?.minutes} />
                <b />
                <Tablet value={remaining?.seconds} />
            </span>
            <span className="eta-note">
                until version 1.0
                <br />
                December <Fangs />
            </span>
        </a>
    );
}

function Unit({
    label,
    value,
    days,
}: {
    label: string;
    value?: number;
    days: boolean;
}) {
    return (
        <>
            {/* the hours, minutes and seconds sit apart from the days */}
            {label === 'Hours' && <i className="sep" aria-hidden />}
            <div className={days ? 'unit days' : 'unit'}>
                <Tablet value={value} />
                <b>{label}</b>
            </div>
        </>
    );
}

/** A recessed stone tablet holding two digits, dashes until the clock runs. */
function Tablet({ value }: { value?: number }) {
    const digits =
        value === undefined
            ? ['-', '-']
            : String(value).padStart(2, '0').split('');

    return (
        <span className="tablet">
            <span>
                {digits.map((digit, position) => (
                    <i key={position}>{digit}</i>
                ))}
            </span>
        </span>
    );
}

function Journey({ progress }: { progress: number }) {
    return (
        <div className="journey" aria-hidden>
            <div className="journey-track">
                <div
                    className="journey-fill"
                    style={
                        {
                            '--at': `${(progress * 100).toFixed(2)}%`,
                        } as CSSProperties
                    }
                />
            </div>
            <div className="journey-ends">
                <span>Revealed August 25</span>
                <span>Launch</span>
            </div>
        </div>
    );
}

const FANG_PATH =
    'M0 0 L100 0 Q72 16 70 96 L70 262 L50 330 L30 262 L30 96 Q28 16 0 0 Z';

const FANG_FACET_PATH = 'M0 0 L50 0 L50 330 L30 262 L30 96 Q28 16 0 0 Z';

const FANG_OFFSETS = [0, 124];

/** The "11" drawn as two blades, echoing the numeral in the game's logo, in the ember of the cube. */
function Fangs() {
    const gradient = `${useId()}-fang`;

    return (
        <>
            <span className="sr-only">11</span>
            <svg aria-hidden className="fangs" viewBox="0 0 224 330">
                <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0.05" stopColor="#ffba86" />
                        <stop offset="0.5" stopColor="#ff6a00" />
                        <stop offset="1" stopColor="#8f3606" />
                    </linearGradient>
                </defs>
                {FANG_OFFSETS.map((x) => (
                    <g key={x} transform={`translate(${x})`}>
                        <path d={FANG_PATH} fill={`url(#${gradient})`} />
                        <path d={FANG_FACET_PATH} fill="#000" opacity="0.2" />
                        <path
                            d="M50 24 L50 300"
                            stroke="#ffe8cf"
                            strokeOpacity="0.45"
                            strokeWidth="2.5"
                        />
                    </g>
                ))}
            </svg>
        </>
    );
}

import { useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import {
    BLOOD,
    Corners,
    Eyebrow,
    GOLD_LIT,
    INK_FAINT,
} from '@/components/brand';

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
function useNow(): number | null {
    return useSyncExternalStore(subscribeToClock, currentSecond, () => null);
}

const PANEL =
    'relative mx-auto mt-10 max-w-3xl overflow-hidden rounded-lg border border-[#c9a24a]/25 bg-[linear-gradient(170deg,#14141c,#0a0a10_70%)] px-5 py-8 sm:px-10 sm:py-10';

export default function ReleaseCountdown() {
    const now = useNow();
    const launched = now !== null && now >= LAUNCH_AT;

    return (
        <section
            aria-label="Path of Exile 2 launch countdown"
            className={PANEL}
        >
            <Corners />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(194,118,47,0.22),transparent_75%)]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#ecd49a]/60 to-transparent"
            />

            <div className="relative text-center">
                <Eyebrow>Path of Exile 2 · version 1.0</Eyebrow>
                {launched ? <Launched /> : <Counting now={now} />}
            </div>
        </section>
    );
}

function Counting({ now }: { now: number | null }) {
    const remaining = now === null ? null : splitRemaining(LAUNCH_AT - now);

    return (
        <>
            <h2 className="mt-3 font-display text-2xl tracking-[0.03em] text-balance text-[#f1f3f8] sm:text-3xl">
                The road out of Early Access
            </h2>

            <div
                role="timer"
                aria-live="off"
                aria-label={
                    remaining
                        ? `${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes until launch`
                        : 'Time until launch'
                }
                className="mt-7 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-7"
            >
                <DaysTile value={remaining?.days} />
                <Divider />
                <Clock remaining={remaining} />
            </div>

            <Journey progress={now === null ? 0 : journeyProgress(now)} />

            <p className="mt-6 font-body text-[15px] text-balance text-[#a7acb8]">
                <time dateTime="2026-12-11" className="whitespace-nowrap">
                    December 11, 2026
                </time>{' '}
                <span className="mx-1.5 text-[#c9a24a]/60">◆</span>{' '}
                <span className="whitespace-nowrap">Free to play</span>{' '}
                <span className="mx-1.5 text-[#c9a24a]/60">◆</span>{' '}
                <span className="whitespace-nowrap">
                    <span style={{ color: BLOOD }}>The Duelist</span> arrives
                </span>
            </p>
        </>
    );
}

function Launched() {
    return (
        <>
            <h2 className="mt-3 font-display text-3xl tracking-[0.03em] text-[#f1f3f8] sm:text-4xl">
                Wraeclast is open
            </h2>
            <p className="mx-auto mt-4 max-w-md font-body text-[16px] leading-relaxed text-[#a7acb8]">
                Path of Exile&nbsp;2 is out of Early Access and free to play.{' '}
                <span style={{ color: GOLD_LIT }}>
                    Good luck out there, exile.
                </span>
            </p>
        </>
    );
}

const DIGIT_STYLE: CSSProperties = {
    backgroundImage: 'linear-gradient(180deg,#fbeec8 10%,#d9b25e 55%,#8a6526)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    fontVariantNumeric: 'lining-nums tabular-nums',
};

const DIGIT_GLOW: CSSProperties = {
    filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.85)) drop-shadow(0 0 18px rgba(201,162,74,0.22))',
};

const TILE =
    'relative flex justify-center rounded-md border bg-[radial-gradient(80%_70%_at_50%_30%,#1c1c27,#0b0b11)]';

const LABEL =
    'font-ui text-[10px] font-semibold tracking-[0.22em] uppercase sm:text-[11px]';

function Digits({ value, className }: { value?: number; className: string }) {
    const digits =
        value === undefined
            ? ['-', '-']
            : String(value).padStart(2, '0').split('');

    return (
        <span className="relative flex" style={DIGIT_GLOW}>
            {digits.map((digit, position) => (
                <span
                    key={`${digits.length - position}-${digit}`}
                    aria-hidden
                    className={`ete-countdown-digit inline-block w-[0.62em] text-center font-body leading-none font-medium ${className}`}
                    style={DIGIT_STYLE}
                >
                    {digit}
                </span>
            ))}
        </span>
    );
}

function DaysTile({ value }: { value?: number }) {
    return (
        <div className="flex flex-col items-center">
            <div
                className={`${TILE} border-[#c2762f]/45 px-5 py-4 shadow-[0_0_40px_-8px_rgba(194,118,47,0.45),inset_0_1px_0_rgba(236,212,154,0.1),inset_0_-12px_24px_rgba(0,0,0,0.5)] sm:px-6 sm:py-5`}
            >
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-[#ecd49a]/70 to-transparent"
                />
                <Digits value={value} className="text-6xl sm:text-[5.5rem]" />
            </div>
            <span className={`${LABEL} mt-3`} style={{ color: GOLD_LIT }}>
                Days
            </span>
        </div>
    );
}

function Clock({ remaining }: { remaining: Remaining | null }) {
    const parts = [
        { value: remaining?.hours, label: 'Hrs' },
        { value: remaining?.minutes, label: 'Min' },
        { value: remaining?.seconds, label: 'Sec' },
    ];

    return (
        <div className="flex flex-col items-center">
            <div
                className={`${TILE} items-center border-[#c9a24a]/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(236,212,154,0.08),inset_0_-12px_24px_rgba(0,0,0,0.5)] sm:px-4 sm:py-3.5`}
            >
                {parts.map((part, index) => (
                    <span key={part.label} className="flex items-center">
                        {index > 0 && (
                            <span
                                aria-hidden
                                className="mx-1 font-body text-2xl leading-none text-[#c9a24a]/50 sm:mx-1.5 sm:text-4xl"
                            >
                                :
                            </span>
                        )}
                        <Digits
                            value={part.value}
                            className="text-3xl sm:text-[2.6rem]"
                        />
                    </span>
                ))}
            </div>
            <div
                className="mt-3 grid w-full grid-cols-3 px-3 sm:px-4"
                style={{ color: INK_FAINT }}
            >
                {parts.map((part) => (
                    <span key={part.label} className={LABEL}>
                        {part.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function Divider() {
    return (
        <span
            aria-hidden
            className="flex shrink-0 items-center gap-1.5 sm:-mt-7 sm:flex-col"
        >
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#c9a24a]/50 sm:h-12 sm:w-px sm:bg-gradient-to-b" />
            <span className="size-1.5 rotate-45 bg-[#c9a24a]/60 shadow-[0_0_10px_rgba(201,162,74,0.6)]" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#c9a24a]/50 sm:h-12 sm:w-px sm:bg-gradient-to-t" />
        </span>
    );
}

function Journey({ progress }: { progress: number }) {
    const percent = `${(progress * 100).toFixed(2)}%`;

    return (
        <div className="mx-auto mt-9 max-w-xl">
            <div className="relative h-[3px] rounded-full bg-[#b6bdcb]/10">
                <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#85481c] via-[#c2762f] to-[#ecd49a]"
                    style={{ width: percent }}
                />
                <span
                    aria-hidden
                    className="ete-countdown-ember absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fbe7c4] shadow-[0_0_6px_2px_rgba(236,212,154,0.9),0_0_18px_6px_rgba(194,118,47,0.55)]"
                    style={{ left: percent }}
                />
                <span
                    aria-hidden
                    className="absolute top-1/2 right-0 size-2 translate-x-1/2 -translate-y-1/2 rotate-45 border border-[#c9a24a]/70 bg-[#0a0a10]"
                />
            </div>
            <div className="mt-2.5 flex justify-between font-ui text-[10px] tracking-[0.16em] text-[#787d8a] uppercase">
                <span>Announced · Aug 25</span>
                <span>Launch · Dec 11</span>
            </div>
        </div>
    );
}

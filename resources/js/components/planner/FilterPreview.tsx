import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import ground from '../../../images/filter/ground.jpg';

type Rgb = [number, number, number];

type PreviewLabel = {
    name: string;
    hidden: boolean;
    fontSize: number;
    text: Rgb;
    border: Rgb | null;
    background: Rgb | null;
    beam: string | null;
};

const rgb = (channel: Rgb): string =>
    `rgb(${channel[0]} ${channel[1]} ${channel[2]})`;

// NeverSink's PlayEffect colour names to a light for the beam glow behind a loud drop.
const BEAM: Record<string, string> = {
    Red: '#ff4b3e',
    Green: '#57c06a',
    Blue: '#4f8bff',
    Brown: '#b5793f',
    White: '#f2f2f2',
    Yellow: '#ffd24a',
    Purple: '#b569f5',
    Cyan: '#3ee0ee',
    Grey: '#aab0b6',
    Orange: '#ff9b3d',
    Pink: '#ff79b8',
};

/** One faithful label: the plate, border and text colours and font size the filter sets,
 *  in a small-caps serif, with an optional beam of light behind it. No minimap glyph. */
function Label({ label }: { label: PreviewLabel }) {
    // FilterBlade renders SetFontSize N at N/24 rem (SetFontSize 45 -> 1.875rem), so match it.
    const fontSize = `${(label.fontSize / 24).toFixed(3)}rem`;
    const beam = label.hidden ? null : label.beam ? BEAM[label.beam] : null;

    const style: CSSProperties = {
        background: label.hidden
            ? 'rgba(0, 0, 0, 0.55)'
            : label.background
              ? rgb(label.background)
              : 'rgba(0, 0, 0, 0.82)',
        border: `1px solid ${label.border ? rgb(label.border) : 'rgba(255,255,255,0.12)'}`,
        color: label.hidden ? 'rgb(150 150 150)' : rgb(label.text),
        // Path of Exile draws loot labels in Fontin SmallCaps (self-hosted); the font renders
        // the small caps itself, so no text-transform. Marcellus is the fallback.
        fontFamily: "'Fontin SmallCaps', 'Marcellus', Georgia, serif",
        fontWeight: 400,
        fontSize,
        lineHeight: 1.2,
        padding: '0 8px',
        borderRadius: 1,
        textShadow: '0 1px 1px rgba(0,0,0,0.5)',
        textDecoration: label.hidden ? 'line-through' : 'none',
        opacity: label.hidden ? 0.5 : 1,
        whiteSpace: 'nowrap',
    };

    return (
        <span className="relative inline-flex">
            {beam && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2"
                    style={{
                        bottom: '-30%',
                        width: '55%',
                        height: '260%',
                        background: `linear-gradient(to top, ${beam}, transparent 72%)`,
                        opacity: 0.5,
                        filter: 'blur(6px)',
                    }}
                />
            )}
            <span className="relative" style={style}>
                {label.name}
            </span>
        </span>
    );
}

/**
 * A live preview of how drops look under a theme and strictness: labels read straight from the
 * vendored NeverSink filter, laid over an in-game backdrop. It reflects the real filter, so
 * switching theme or strictness shows exactly what changes.
 */
export default function FilterPreview({
    theme,
    strictness,
}: {
    theme: string;
    strictness: string;
}) {
    const [labels, setLabels] = useState<PreviewLabel[]>([]);

    useEffect(() => {
        const controller = new AbortController();

        fetch(
            `/filter/preview?theme=${encodeURIComponent(theme)}&strictness=${encodeURIComponent(strictness)}`,
            {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            },
        )
            .then((response) => response.json())
            .then((data: { labels?: PreviewLabel[] }) => {
                setLabels(data.labels ?? []);
            })
            .catch(() => {
                /* aborted or offline: keep the last labels */
            });

        return () => controller.abort();
    }, [theme, strictness]);

    return (
        <div
            className="relative overflow-hidden rounded-[var(--pl-radius)] border border-black/50"
            style={{
                backgroundImage: `url(${ground})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <div className="absolute inset-0 bg-black/35" />
            <div className="relative flex flex-wrap content-center items-center justify-center gap-x-2 gap-y-1.5 px-4 py-6">
                {labels.map((label, index) => (
                    <Label key={`${label.name}-${index}`} label={label} />
                ))}
            </div>
        </div>
    );
}

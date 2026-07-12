import { Head } from '@inertiajs/react';
import { ENGRAVED, Eyebrow, Flourish } from '@/components/brand';

type Totals = {
    views: number;
    visitors: number;
    viewsLast30Days: number;
    webhooksTotal: number;
    webhooksVerified: number;
    treesStored: number;
    plansStored: number;
};

type PathRow = { path: string; views: number; visitors: number };
type ReferrerRow = { referrer: string; views: number };
type DeviceRow = { device: string; views: number; visitors: number };
type DailyRow = { date: string; views: number; visitors: number };

type Props = {
    totals: Totals;
    topPaths: PathRow[];
    topReferrers: ReferrerRow[];
    devices: DeviceRow[];
    daily: DailyRow[];
};

const nf = new Intl.NumberFormat('en-US');

const DEVICE_LABELS: Record<string, string> = {
    mobile: 'Mobile',
    tablet: 'Tablet',
    desktop: 'Desktop',
};

/**
 * First-party analytics dashboard. Every figure is aggregated server-side from
 * the cookieless page_views table (bots excluded) plus live webhook subscriber
 * counts. Behind HTTP Basic Auth, so this page never renders for the public.
 */
export default function Stats({
    totals,
    topPaths,
    topReferrers,
    devices,
    daily,
}: Props) {
    return (
        <>
            <Head title="Stats" />

            <section className="mx-auto max-w-4xl px-4 py-16 sm:py-24">
                <header className="text-center">
                    <Eyebrow>Internal</Eyebrow>
                    <h1
                        className="mt-4 text-3xl text-[#f1f3f8] sm:text-4xl"
                        style={ENGRAVED}
                    >
                        Stats
                    </h1>
                    <Flourish className="mx-auto my-9 h-3 w-52 opacity-80" />
                </header>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Metric label="Page views" value={totals.views} />
                    <Metric label="Unique visitors" value={totals.visitors} />
                    <Metric
                        label="Views (30d)"
                        value={totals.viewsLast30Days}
                    />
                    <Metric
                        label="Webhooks"
                        value={totals.webhooksTotal}
                        hint={`${nf.format(totals.webhooksVerified)} verified`}
                    />
                    <Metric label="Trees stored" value={totals.treesStored} />
                    <Metric label="Plan builds" value={totals.plansStored} />
                </div>

                <DailyChart rows={daily} />

                <div className="mt-12 grid gap-8 md:grid-cols-2">
                    <Panel title="Top pages">
                        <Table
                            head={['Path', 'Views', 'Visitors']}
                            rows={topPaths.map((row) => [
                                row.path,
                                nf.format(row.views),
                                nf.format(row.visitors),
                            ])}
                            empty="No views yet."
                        />
                    </Panel>

                    <Panel title="Top referrers">
                        <Table
                            head={['Referrer', 'Views']}
                            rows={topReferrers.map((row) => [
                                row.referrer,
                                nf.format(row.views),
                            ])}
                            empty="No external referrers yet."
                        />
                    </Panel>

                    <Panel title="Devices">
                        <Table
                            head={['Device', 'Views', 'Visitors']}
                            rows={devices.map((row) => [
                                DEVICE_LABELS[row.device] ?? row.device,
                                nf.format(row.views),
                                nf.format(row.visitors),
                            ])}
                            empty="No views yet."
                        />
                    </Panel>
                </div>
            </section>
        </>
    );
}

function Metric({
    label,
    value,
    hint,
}: {
    label: string;
    value: number;
    hint?: string;
}) {
    return (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-5">
            <div className="font-ui text-xs tracking-[0.1em] text-[#787d8a] uppercase">
                {label}
            </div>
            <div className="mt-2 text-3xl text-[#f1f3f8]" style={ENGRAVED}>
                {nf.format(value)}
            </div>
            {hint && <div className="mt-1 text-xs text-[#787d8a]">{hint}</div>}
        </div>
    );
}

function Panel({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <h2 className="mb-3 font-ui text-xs tracking-[0.1em] text-[#a7acb8] uppercase">
                {title}
            </h2>
            {children}
        </div>
    );
}

function Table({
    head,
    rows,
    empty,
}: {
    head: string[];
    rows: string[][];
    empty: string;
}) {
    if (rows.length === 0) {
        return <p className="text-sm text-[#787d8a]">{empty}</p>;
    }

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-white/10 text-left text-[#787d8a]">
                    {head.map((cell, i) => (
                        <th
                            key={cell}
                            className={`pb-2 font-normal ${i === 0 ? '' : 'text-right'}`}
                        >
                            {cell}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, r) => (
                    <tr key={r} className="border-b border-white/5">
                        {row.map((cell, c) => (
                            <td
                                key={c}
                                className={`py-2 ${c === 0 ? 'max-w-[18rem] truncate pr-3 text-[#d6dae2]' : 'text-right text-[#a7acb8] tabular-nums'}`}
                            >
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/**
 * Minimal SVG sparkline of daily views over the window - no chart library, just
 * a polyline scaled to the busiest day so the trend reads at a glance.
 */
function DailyChart({ rows }: { rows: DailyRow[] }) {
    const width = 720;
    const height = 120;
    const max = Math.max(1, ...rows.map((row) => row.views));
    const step = rows.length > 1 ? width / (rows.length - 1) : 0;

    const points = rows
        .map((row, i) => {
            const x = i * step;
            const y = height - (row.views / max) * height;

            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return (
        <div className="mt-10">
            <h2 className="mb-3 font-ui text-xs tracking-[0.1em] text-[#a7acb8] uppercase">
                Views - last 30 days
            </h2>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-32 w-full"
                preserveAspectRatio="none"
            >
                <polyline
                    points={points}
                    fill="none"
                    stroke="#c9a24a"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
            <div className="mt-1 flex justify-between text-xs text-[#787d8a]">
                <span>{rows[0]?.date}</span>
                <span>{rows[rows.length - 1]?.date}</span>
            </div>
        </div>
    );
}

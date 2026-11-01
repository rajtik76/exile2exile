import { Head } from '@inertiajs/react';
import { ENGRAVED, Eyebrow, Flourish } from '@/components/brand';

type Totals = {
    webhooksTotal: number;
    webhooksVerified: number;
    newsletterTotal: number;
    newsletterConfirmed: number;
    treesStored: number;
    plansStored: number;
};

type Props = {
    totals: Totals;
};

const nf = new Intl.NumberFormat('en-US');

/**
 * Internal dashboard of stored record counts. Traffic lives in Umami. Behind
 * HTTP Basic Auth, so this page never renders for the public.
 */
export default function Stats({ totals }: Props) {
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
                    <Metric
                        label="Webhooks"
                        value={totals.webhooksTotal}
                        hint={`${nf.format(totals.webhooksVerified)} verified`}
                    />
                    <Metric
                        label="Newsletter"
                        value={totals.newsletterConfirmed}
                        hint={`${nf.format(totals.newsletterTotal)} signed up`}
                    />
                    <Metric label="Trees stored" value={totals.treesStored} />
                    <Metric label="Plan builds" value={totals.plansStored} />
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

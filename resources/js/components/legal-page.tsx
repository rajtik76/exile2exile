import { Head } from '@inertiajs/react';
import { ENGRAVED, Eyebrow, Flourish } from '@/components/brand';

/**
 * Shared chrome for the static document pages (privacy, terms, credits, the
 * patch-webhook dev docs) so they read as one set: same eyebrow, engraved
 * title, flourish, and prose rhythm. Sits on the layout's shared void field -
 * no local backdrop art. `eyebrow` defaults to "Legal"; `updated` is optional
 * (dev docs carry no revision date).
 */
export function LegalPage({
    title,
    eyebrow = 'Legal',
    updated,
    children,
}: {
    title: string;
    eyebrow?: string;
    updated?: string;
    children: React.ReactNode;
}) {
    return (
        <>
            <Head title={title} />

            <section className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
                <header className="text-center">
                    <Eyebrow>{eyebrow}</Eyebrow>
                    <h1
                        className="mt-4 text-3xl text-[#f1f3f8] sm:text-4xl"
                        style={ENGRAVED}
                    >
                        {title}
                    </h1>
                    {updated && (
                        <p className="mt-3 font-ui text-xs tracking-[0.1em] text-[#787d8a] uppercase">
                            Last updated {updated}
                        </p>
                    )}
                    <Flourish className="mx-auto my-9 h-3 w-52 opacity-80" />
                </header>

                <div className="flex flex-col gap-8">{children}</div>
            </section>
        </>
    );
}

/** One titled section of a legal document. */
export function LegalSection({
    heading,
    children,
}: {
    heading: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="font-ui text-sm font-semibold tracking-[0.14em] text-[#c9a24a] uppercase">
                {heading}
            </h2>
            <div className="flex flex-col gap-3 font-body text-[15px] leading-relaxed text-[#a7acb8]">
                {children}
            </div>
        </section>
    );
}

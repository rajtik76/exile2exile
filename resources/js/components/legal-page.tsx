import { Head } from '@inertiajs/react';
import { DISPLAY, Eyebrow, Flourish } from '@/components/brand';
import scriptorium from '../../images/legal/scriptorium.webp';

/**
 * Shared chrome for the static document pages (privacy, terms, credits, the
 * patch-webhook dev docs) so they read as one set: same small-caps label,
 * Fontin title, pewter flourish, and prose rhythm. `backdrop` lays a dark
 * painted scriptorium behind the text, kept still while the page scrolls on
 * desktop and fading out before the footer. `eyebrow` defaults to "Legal";
 * `updated` is optional (dev docs carry no revision date).
 */
export function LegalPage({
    title,
    eyebrow = 'Legal',
    updated,
    backdrop = false,
    children,
}: {
    title: string;
    eyebrow?: string;
    updated?: string;
    backdrop?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="relative isolate">
            <Head title={title} />

            {backdrop && (
                <div
                    aria-hidden
                    className="legal-backdrop"
                    style={
                        {
                            '--legal-art': `url('${scriptorium}')`,
                        } as React.CSSProperties
                    }
                />
            )}

            <section className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
                <header className="text-center">
                    <Eyebrow>{eyebrow}</Eyebrow>
                    <h1
                        className="mt-3 text-[34px] leading-[1.1] text-paper sm:text-[44px]"
                        style={DISPLAY}
                    >
                        {title}
                    </h1>
                    {updated && (
                        <p className="mt-3 font-ui text-[13px] font-medium text-mist">
                            Last updated {updated}
                        </p>
                    )}
                    <Flourish className="mx-auto my-9 h-3 w-52 opacity-80" />
                </header>

                <div className="flex flex-col gap-8">{children}</div>
            </section>
        </div>
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
            <h2 className="font-display text-[22px] leading-[1.2] text-paper">
                {heading}
            </h2>
            <div className="flex flex-col gap-3 font-body text-[17px] leading-[1.6] text-bone [&_strong]:font-normal [&_strong]:text-paper">
                {children}
            </div>
        </section>
    );
}

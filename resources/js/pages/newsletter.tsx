import { useCaptcha } from '@captchaapi/react';
import { Link, useForm } from '@inertiajs/react';
import { useAppName } from '@/components/brand';
import { LegalPage, LegalSection } from '@/components/legal-page';
import newsletter from '@/routes/newsletter';

type Status =
    | 'pending'
    | 'confirmed'
    | 'unsubscribed'
    | 'confirm-pending'
    | 'unsubscribe-pending'
    | null;

/**
 * Interstitial for the signed email links: GET renders this panel and the
 * actual confirm/unsubscribe happens on a POST back to the same signed URL,
 * so a mail scanner prefetching the link changes nothing.
 */
function ActionPanel({
    status,
    actionUrl,
}: {
    status: 'confirm-pending' | 'unsubscribe-pending';
    actionUrl: string;
}) {
    const form = useForm({});

    const copy =
        status === 'confirm-pending'
            ? {
                  title: 'Confirm your subscription',
                  body: 'Click the button below and newsletter issues will start arriving at your address.',
                  button: 'Confirm subscription',
              }
            : {
                  title: 'Unsubscribe from the newsletter',
                  body: 'Click the button below and your address is removed immediately. You can sign up again anytime.',
                  button: 'Unsubscribe',
              };

    return (
        <div className="rounded-sm border border-[#c9a24a]/25 bg-[#c9a24a]/10 p-4">
            <p className="font-ui text-xs font-semibold tracking-[0.14em] text-[#ecd49a] uppercase">
                {copy.title}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-[#a7acb8]">
                {copy.body}
            </p>
            <button
                type="button"
                disabled={form.processing}
                onClick={() => form.post(actionUrl)}
                className="mt-3 rounded-sm border border-[#c9a24a]/40 bg-[#c9a24a]/15 px-4 py-2 font-ui text-xs font-semibold tracking-[0.14em] text-[#ecd49a] uppercase transition hover:bg-[#c9a24a]/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {form.processing ? 'Working…' : copy.button}
            </button>
        </div>
    );
}

/** Flash banner for the double opt-in flow states. */
function StatusBanner({ status }: { status: Status }) {
    if (
        !status ||
        status === 'confirm-pending' ||
        status === 'unsubscribe-pending'
    ) {
        return null;
    }

    const copy: Record<
        Exclude<NonNullable<Status>, 'confirm-pending' | 'unsubscribe-pending'>,
        { title: string; body: string }
    > = {
        pending: {
            title: 'Almost there - check your inbox',
            body: 'We sent you a confirmation link. Click it and you are on the list; until then we will not send you anything.',
        },
        confirmed: {
            title: 'Subscription confirmed',
            body: 'You are on the list. The next newsletter will land in your inbox.',
        },
        unsubscribed: {
            title: 'You are unsubscribed',
            body: 'Your address has been removed and you will not receive any further newsletters. You can sign up again anytime.',
        },
    };

    return (
        <div
            role="status"
            className="rounded-sm border border-[#c9a24a]/25 bg-[#c9a24a]/10 p-4"
        >
            <p className="font-ui text-xs font-semibold tracking-[0.14em] text-[#ecd49a] uppercase">
                {copy[status].title}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-[#a7acb8]">
                {copy[status].body}
            </p>
        </div>
    );
}

/**
 * Public newsletter signup. Double opt-in: the form only creates an
 * unconfirmed subscriber and triggers a confirmation email; the signed links
 * in our emails bounce back to this page with a `status` flash prop.
 */
export default function Newsletter({
    status = null,
    actionUrl,
    captchaEnabled = false,
}: {
    status?: Status;
    actionUrl?: string;
    captchaEnabled?: boolean;
}) {
    const appName = useAppName();
    const form = useForm({ email: '', captchaapi_response: '' });
    const { solve, solving, error: captchaError } = useCaptcha();

    async function submit(event: React.FormEvent): Promise<void> {
        event.preventDefault();

        if (!captchaEnabled) {
            form.post(newsletter.store.url(), { preserveScroll: true });

            return;
        }

        let response: string;

        try {
            response = await solve();
        } catch {
            return; // captchaError is set by the hook and rendered below
        }

        // transform() injects the freshly solved response into this one
        // submission without waiting on a setData() re-render, since the
        // response is single-use and must not linger in persisted form state.
        form.transform((data) => ({ ...data, captchaapi_response: response }));
        form.post(newsletter.store.url(), { preserveScroll: true });
    }

    const pendingAction =
        (status === 'confirm-pending' || status === 'unsubscribe-pending') &&
        actionUrl
            ? status
            : null;

    return (
        <LegalPage title="Newsletter" eyebrow="Stay in the loop">
            {pendingAction && actionUrl ? (
                <ActionPanel status={pendingAction} actionUrl={actionUrl} />
            ) : (
                <StatusBanner status={status} />
            )}

            <LegalSection heading="What you get">
                <p>
                    An occasional email about what's new in {appName}: new
                    tools, data updates for fresh PoE2 patches, and notable
                    fixes. No spam, no schedule pressure - we only write when
                    there is something worth reading.
                </p>
                <p>
                    Every email includes a one-click unsubscribe link, and we
                    never share your address with anyone.
                </p>
            </LegalSection>

            <LegalSection heading="Subscribe">
                <form onSubmit={submit} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <label htmlFor="newsletter-email" className="sr-only">
                            Email address
                        </label>
                        <input
                            id="newsletter-email"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                            value={form.data.email}
                            onChange={(event) =>
                                form.setData('email', event.target.value)
                            }
                            placeholder="you@example.com"
                            className="w-full rounded-sm border border-[#c9a24a]/20 bg-[#0c0c12] px-3 py-2 text-sm text-[#e6ecf6] placeholder:text-[#787d8a] focus:border-[#c9a24a]/50 focus:outline-none"
                        />
                        <button
                            id="newsletter-subscribe"
                            type="submit"
                            disabled={
                                form.processing ||
                                solving ||
                                form.data.email.trim() === ''
                            }
                            className="shrink-0 rounded-sm border border-[#c9a24a]/40 bg-[#c9a24a]/15 px-4 py-2 font-ui text-xs font-semibold tracking-[0.14em] text-[#ecd49a] uppercase transition hover:bg-[#c9a24a]/25 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {form.processing
                                ? 'Subscribing…'
                                : solving
                                  ? 'Verifying…'
                                  : 'Subscribe'}
                        </button>
                    </div>

                    {form.errors.email && (
                        <p className="text-sm text-[#e0a04f]">
                            {form.errors.email}
                        </p>
                    )}

                    {(captchaError || form.errors.captchaapi_response) && (
                        <p className="text-sm text-[#e0a04f]">
                            {form.errors.captchaapi_response ??
                                'Captcha verification failed, please try again.'}
                        </p>
                    )}

                    <p className="text-xs leading-relaxed text-[#787d8a]">
                        Double opt-in: we first send you a confirmation link,
                        and nothing else until you click it. See our{' '}
                        <Link
                            href="/privacy"
                            className="text-[#a7acb8] underline decoration-dotted underline-offset-2 transition hover:text-[#ecd49a]"
                        >
                            privacy policy
                        </Link>{' '}
                        for how we handle your address.
                    </p>

                    {captchaEnabled && (
                        <a
                            href="https://captchaapi.eu"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs leading-relaxed text-[#787d8a] transition hover:text-[#ecd49a]"
                        >
                            <img
                                src="/captchaapi-logo.svg"
                                alt=""
                                className="h-4 w-4 shrink-0 rounded-[3px]"
                            />
                            This form is protected by{' '}
                            <span className="underline decoration-dotted underline-offset-2">
                                captchaapi.eu
                            </span>{' '}
                            proof-of-work captcha - no cookies, no tracking.
                        </a>
                    )}
                </form>
            </LegalSection>
        </LegalPage>
    );
}

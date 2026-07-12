import { CONTACT_EMAIL, useAppName } from '@/components/brand';
import { LegalPage, LegalSection } from '@/components/legal-page';

const UPDATED = 'July 12, 2026';

export default function Privacy() {
    const appName = useAppName();

    return (
        <LegalPage title="Privacy Policy" updated={UPDATED}>
            <LegalSection heading="The short version">
                <p>
                    {appName} is a free, fan-made tool. We collect as little as
                    possible, we don't sell your data, and we don't run ads or
                    third-party tracking - and our own analytics never
                    identifies you.
                </p>
            </LegalSection>

            <LegalSection heading="What we collect">
                <p>
                    <strong className="text-[#d6dae2]">
                        Builds you import.
                    </strong>{' '}
                    When you paste a Path of Building code or a build link, we
                    process it to generate the comparison. You don't need an
                    account to do this.
                </p>
                <p>
                    <strong className="text-[#d6dae2]">Account details.</strong>{' '}
                    If you choose to create an account, we store your email
                    address and a hashed password. That's it.
                </p>
                <p>
                    <strong className="text-[#d6dae2]">Basic logs.</strong> Our
                    server keeps standard request logs (such as your IP address
                    and browser) to keep the site secure and prevent abuse.
                </p>
                <p>
                    <strong className="text-[#d6dae2]">Newsletter.</strong> If
                    you subscribe to our newsletter, we store your email
                    address, and only after you confirm the subscription via the
                    link we email you (double opt-in). We use it solely to send
                    the newsletter - never for anything else, and we never share
                    it. Every email contains an unsubscribe link; unsubscribing
                    deletes your address immediately. Emails are delivered
                    through Resend, our email provider, which processes your
                    address on our behalf.
                </p>
            </LegalSection>

            <LegalSection heading="Cookies">
                <p>
                    We only use the cookies needed to run the site and keep you
                    signed in. No advertising or analytics cookies.
                    Specifically: a session cookie and a CSRF token to operate
                    the site securely, plus two small preference cookies that
                    remember your theme and sidebar choice.
                </p>
            </LegalSection>

            <LegalSection heading="Analytics">
                <p>
                    We run our own privacy-friendly analytics - no third party,
                    no cookies. We count page views and rough visitor numbers to
                    see what's used. We never store your IP address: it's turned
                    into a daily, salted hash we can't reverse, so visits can't
                    be traced back to you. We keep aggregate counts and prune
                    old rows periodically.
                </p>
            </LegalSection>

            <LegalSection heading="Who we share it with">
                <p>
                    We don't sell or rent your data. It's handled by the hosting
                    provider that runs the site on our behalf. When you import a
                    build from a link, we fetch that URL to read the build.
                </p>
            </LegalSection>

            <LegalSection heading="Legal basis">
                <p>
                    Where the GDPR applies, we rely on our legitimate interest
                    in keeping the site secure and understanding, in aggregate,
                    how it's used. We don't process any of this for advertising,
                    and we don't sell it.
                </p>
            </LegalSection>

            <LegalSection heading="Your rights">
                <p>
                    You can access, export, or delete your data at any time. If
                    you have an account, you can delete it from your settings.
                    For anything else, reach out and we'll take care of it.
                </p>
            </LegalSection>

            <LegalSection heading="Changes">
                <p>
                    If this policy changes, we'll update the date above.
                    Continued use of the tool means you're okay with the current
                    version.
                </p>
            </LegalSection>

            <LegalSection heading="Contact">
                <p>
                    Questions about your privacy? Email us at{' '}
                    <a
                        href={`mailto:${CONTACT_EMAIL}`}
                        className="text-[#d6dae2] underline decoration-dotted underline-offset-2 transition hover:text-[#ecd49a]"
                    >
                        {CONTACT_EMAIL}
                    </a>
                    .
                </p>
            </LegalSection>
        </LegalPage>
    );
}

import { CONTACT_EMAIL, useAppName } from '@/components/brand';
import { LegalPage, LegalSection } from '@/components/legal-page';

const UPDATED = 'June 19, 2026';

export default function Terms() {
    const appName = useAppName();

    return (
        <LegalPage title="Terms of Service" updated={UPDATED}>
            <LegalSection heading="The short version">
                <p>
                    {appName} is a free, fan-made tool offered as-is. Use it,
                    enjoy it, don't abuse it. By using it, you agree to the
                    terms below.
                </p>
            </LegalSection>

            <LegalSection heading="No warranty">
                <p>
                    The tool is provided "as is," without any warranty. We do
                    our best to keep it accurate and online, but we can't
                    guarantee it's error-free or always available, and we're not
                    liable for anything that comes from using it.
                </p>
            </LegalSection>

            <LegalSection heading="Not affiliated with Grinding Gear Games">
                <p>
                    {appName} is an independent community project. It is not
                    affiliated with, endorsed by, or sponsored by Grinding Gear
                    Games. Path of Exile 2 and all related assets are trademarks
                    of Grinding Gear Games, used here for identification only.
                </p>
            </LegalSection>

            <LegalSection heading="Fair use">
                <p>
                    Please don't try to break the site, overload it with
                    automated traffic, or use it for anything illegal. We may
                    suspend access if it's being abused.
                </p>
            </LegalSection>

            <LegalSection heading="Your account and content">
                <p>
                    If you create an account, you're responsible for keeping it
                    secure. The builds you import stay yours - you just give us
                    permission to process them so we can show you the
                    comparison.
                </p>
            </LegalSection>

            <LegalSection heading="Changes">
                <p>
                    These terms may change over time, and the tool itself may
                    change or shut down. We'll update the date above when the
                    terms change.
                </p>
            </LegalSection>

            <LegalSection heading="Governing law">
                <p>
                    These terms are governed by the laws of the Czech Republic.
                </p>
            </LegalSection>

            <LegalSection heading="Contact">
                <p>
                    Questions? Email us at{' '}
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

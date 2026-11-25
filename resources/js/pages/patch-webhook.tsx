import { LegalPage, LegalSection } from '@/components/legal-page';
import { PatchStatusPanel } from '@/components/patch-status';

/** Monospace request/response block. */
function Code({ children }: { children: React.ReactNode }) {
    return (
        <pre className="scroll-quiet overflow-x-auto rounded-[2px] border border-line bg-void p-4 font-mono text-[13px] leading-relaxed whitespace-pre text-bone">
            {children}
        </pre>
    );
}

/** Inline code token. */
function Mono({ children }: { children: React.ReactNode }) {
    return (
        <code className="font-mono text-[0.88em] text-paper">{children}</code>
    );
}

export default function PatchWebhook() {
    return (
        <LegalPage backdrop title="PoE2 patch webhook" eyebrow="Developers">
            <LegalSection heading="What it does">
                <p>
                    A public webhook that fires when a new Path of Exile 2 patch
                    goes live. Subscribe a URL, prove you control it, and you
                    receive a signed <Mono>POST</Mono> the moment a new client
                    version is detected on GGG's patch server - polled every
                    five minutes. No emails, no account, no polling on your
                    side.
                </p>
                <p>Every path below is relative to this site's origin.</p>
            </LegalSection>

            <LegalSection heading="Live status">
                <p>
                    What the watcher currently sees, and the patch this site's
                    own bundled game data is built from.
                </p>
                <PatchStatusPanel />
            </LegalSection>

            <LegalSection heading="How it works">
                <ol className="flex list-decimal flex-col gap-2 pl-5">
                    <li>
                        You <Mono>POST</Mono> your URL. We create a subscriber,
                        generate a 48-char secret, and immediately send a
                        verification ping to your URL.
                    </li>
                    <li>
                        Your endpoint proves ownership: it answers the ping with{' '}
                        <Mono>2xx</Mono> and includes the <Mono>challenge</Mono>{' '}
                        value in the response body (echoing the body works).
                    </li>
                    <li>
                        Once verified, every new patch triggers a signed{' '}
                        <Mono>patch.released</Mono> delivery to your URL.
                    </li>
                </ol>
                <p>
                    Both the verification ping and the release delivery are
                    signed with your secret (HMAC-SHA256), so you can confirm a
                    call is genuinely from us.
                </p>
            </LegalSection>

            <LegalSection heading="Subscribe">
                <p>
                    The <Mono>url</Mono> must be public HTTPS (private,
                    loopback, and reserved IPs are rejected), unique, and at
                    most 2048 characters. All endpoints share a limit of 20
                    requests per minute per IP.
                </p>
                <Code>{`curl -X POST https://<host>/api/patch/subscribers \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"https://example.com/poe2-hook"}'`}</Code>
                <p>
                    Response <Mono>201</Mono>:
                </p>
                <Code>{`{
  "id": 42,
  "url": "https://example.com/poe2-hook",
  "secret": "kPr…48 chars…",
  "verified": true,
  "message": "Subscribed. You will receive a signed POST when a new PoE2 patch releases."
}`}</Code>
                <p>
                    Store the <Mono>secret</Mono> - it is shown once. You need
                    it to verify signatures and to manage the subscription. If{' '}
                    <Mono>verified</Mono> is <Mono>false</Mono>, your endpoint
                    did not echo the challenge; fix it and call verify.
                </p>
            </LegalSection>

            <LegalSection heading="Verification ping">
                <p>Sent to your URL during subscribe and re-verify:</p>
                <Code>{`X-Poe2-Event: verification
X-Poe2-Signature: sha256=<hmac>
Content-Type: application/json

{ "event": "verification", "challenge": "<40-char token>" }`}</Code>
                <p>
                    Respond <Mono>2xx</Mono> and include the{' '}
                    <Mono>challenge</Mono> in the response body. The simplest
                    correct handler echoes the request body back verbatim.
                </p>
            </LegalSection>

            <LegalSection heading="Patch release">
                <p>
                    Sent to every verified subscriber when a new patch is
                    detected. Delivery retries up to 5 times with backoff (10s,
                    60s, 300s, 900s) until your endpoint answers{' '}
                    <Mono>2xx</Mono>.
                </p>
                <Code>{`X-Poe2-Event: patch.released
X-Poe2-Signature: sha256=<hmac>
Content-Type: application/json

{
  "event": "patch.released",
  "game": "poe2",
  "version": "4.5.3.1.7",
  "released_at": "2026-06-22T17:30:00+00:00"
}`}</Code>
            </LegalSection>

            <LegalSection heading="Delivery and cleanup">
                <p>
                    Each delivery is retried up to 5 times with backoff (10s,
                    60s, 300s, 900s) - about 21 minutes - before it counts as a
                    failed delivery. Dead entries are then removed
                    automatically:
                </p>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                    <li>
                        Unverified subscribers that never echo the challenge are
                        deleted 7 days after they were created. Re-subscribe
                        once your endpoint is ready.
                    </li>
                    <li>
                        Verified subscribers are dropped after 5 consecutive
                        failed deliveries. A short outage is fine - one
                        successful delivery resets the counter to zero - but
                        five patches missed back to back means the endpoint is
                        gone, so we stop sending to it.
                    </li>
                </ul>
                <p>If you are removed, just subscribe again.</p>
            </LegalSection>

            <LegalSection heading="Verifying the signature">
                <p>
                    Compute <Mono>HMAC-SHA256</Mono> over the raw request body
                    using your secret and compare it, in constant time, to the
                    value after <Mono>sha256=</Mono> in{' '}
                    <Mono>X-Poe2-Signature</Mono>. Always verify the exact bytes
                    you received, before JSON-parsing.
                </p>
                <Code>{`const expected =
  'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');

const ok = timingSafeEqual(
  Buffer.from(expected),
  Buffer.from(signatureHeader),
);`}</Code>
            </LegalSection>

            <LegalSection heading="Re-verify and unsubscribe">
                <p>
                    Both take your secret in the <Mono>X-Poe2-Secret</Mono>{' '}
                    header.
                </p>
                <Code>{`curl -X POST https://<host>/api/patch/subscribers/42/verify \\
  -H 'X-Poe2-Secret: <your-secret>'

curl -X DELETE https://<host>/api/patch/subscribers/42 \\
  -H 'X-Poe2-Secret: <your-secret>'`}</Code>
            </LegalSection>
        </LegalPage>
    );
}

import { LegalPage, LegalSection } from '@/components/legal-page';
import { usePatchStatus } from '@/lib/usePatchStatus';

/** Monospace request/response block, same incised slab as the credits license. */
function Code({ children }: { children: React.ReactNode }) {
    return (
        <pre className="overflow-x-auto rounded-sm border border-[#c9a24a]/15 bg-[#0c0c12] p-4 text-xs leading-relaxed whitespace-pre text-[#a7acb8]">
            {children}
        </pre>
    );
}

/** Inline code token. */
function Mono({ children }: { children: React.ReactNode }) {
    return <code className="text-[#d6dae2]">{children}</code>;
}

/** One cell of the live status strip: an eyebrow label over a value. */
function StatusCell({
    label,
    value,
    title,
    badge,
}: {
    label: React.ReactNode;
    value: string;
    title?: string;
    badge?: React.ReactNode;
}) {
    return (
        <div className="bg-[#0c0c12] p-4">
            <div className="flex items-center gap-1.5 font-ui text-[10px] font-semibold tracking-[0.16em] text-[#c9a24a] uppercase">
                {label}
            </div>
            <div
                className="mt-1.5 flex items-center gap-2 text-sm text-[#e6ecf6] tabular-nums"
                title={title}
            >
                <span>{value}</span>
                {badge}
            </div>
        </div>
    );
}

/**
 * The live patch read-out for this page: a four-cell strip pulling from the same
 * {@link usePatchStatus} hook as the footer, styled as the page's incised slab.
 * Latest version and the two relative times poll every 60s; the data version is
 * request-only.
 */
function PatchStatusPanel() {
    const status = usePatchStatus();

    if (!status) {
        return null;
    }

    return (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-[#c9a24a]/15 bg-[#c9a24a]/10 sm:grid-cols-4">
            <StatusCell
                label={
                    <>
                        <span className="relative flex size-1.5">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#74b079] opacity-70" />
                            <span className="relative inline-flex size-1.5 rounded-full bg-[#74b079]" />
                        </span>
                        Latest
                    </>
                }
                value={`PoE2 ${status.version}`}
            />
            <StatusCell
                label="Released"
                value={status.releasedAgo}
                title={new Date(status.releasedAt).toLocaleString()}
            />
            <StatusCell
                label="Checked"
                value={status.checkedAgo}
                title={new Date(status.checkedAt).toLocaleString()}
            />
            <StatusCell
                label="App data"
                value={status.dataVersion ?? '-'}
                badge={
                    status.dataVersion &&
                    (status.isDataCurrent ? (
                        <span className="rounded-full bg-[#74b079]/15 px-1.5 py-px font-ui text-[10px] font-medium text-[#8fc594]">
                            current
                        </span>
                    ) : (
                        <span className="rounded-full bg-[#e0a04f]/15 px-1.5 py-px font-ui text-[10px] font-medium text-[#e0b070]">
                            behind
                        </span>
                    ))
                }
            />
        </div>
    );
}

export default function PatchWebhook() {
    return (
        <LegalPage title="PoE2 patch webhook" eyebrow="Developers">
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

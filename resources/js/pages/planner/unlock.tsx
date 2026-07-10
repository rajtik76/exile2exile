import { Head, useForm } from '@inertiajs/react';
import Button from '@/components/planner/Button';
import { TextInput } from '@/components/planner/ui/Field';
import { Panel } from '@/components/planner/ui/Panel';
import { Eyebrow, Heading } from '@/components/planner/ui/Text';
import planner from '@/routes/planner';

/**
 * The gate in front of the editor: a build's secret edit token is entered here, in a POST
 * form, and verified server-side - so it never travels in a URL (and its logs, history or
 * referrers). On success the session is unlocked and the editor opens.
 */
export default function PlannerUnlock({
    slug,
    title,
}: {
    slug: string;
    title: string;
}) {
    const form = useForm({ token: '' });

    function submit(event: React.FormEvent): void {
        event.preventDefault();
        form.post(planner.unlock.url({ plan: slug }), { preserveScroll: true });
    }

    return (
        <div className="mx-auto max-w-lg px-4 pt-16 pb-28">
            <Head title={`Unlock - ${title}`} />

            <div className="planner-reading">
                <header className="mb-6">
                    <Eyebrow>Build planner</Eyebrow>
                    <Heading level={1} className="mt-2">
                        Unlock to edit
                    </Heading>
                    <p className="pl-text-sm mt-2 text-[var(--pl-muted)]">
                        “{title || 'Untitled build'}” is edit-protected. Paste
                        the edit token you saved when you created it.
                    </p>
                </header>

                <Panel title="Edit token">
                    <form onSubmit={submit} className="flex flex-col gap-3">
                        <TextInput
                            autoFocus
                            type="password"
                            value={form.data.token}
                            onChange={(event) =>
                                form.setData('token', event.target.value)
                            }
                            placeholder="Paste your edit token…"
                            className="w-full font-mono"
                        />

                        {form.errors.token && (
                            <p className="pl-text-sm text-[var(--pl-danger-lit)]">
                                {form.errors.token}
                            </p>
                        )}

                        <div>
                            <Button
                                type="submit"
                                variant="primary"
                                className="border-2"
                                disabled={
                                    form.processing ||
                                    form.data.token.trim() === ''
                                }
                            >
                                {form.processing ? 'Unlocking…' : 'Unlock'}
                            </Button>
                        </div>
                    </form>
                </Panel>
            </div>
        </div>
    );
}

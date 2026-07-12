import { Head, useForm } from '@inertiajs/react';
import { ENGRAVED } from '@/components/brand';
import { ClassPortrait, classPortrait } from '@/components/build/classPortrait';
import { INPUT_FONT, PANEL_FONT } from '@/components/passive-tree/chrome';
import shared from '@/routes/shared';

/**
 * The gate in front of a saved tree's editor: the build's secret edit token is
 * entered here, in a POST form, and verified server-side - so it never travels
 * in a URL (and its logs, history or referrers). On success the session is
 * unlocked and the editor opens. Wears the tree pages' engraved-bronze chrome.
 */
export default function TreeUnlock({
    slug,
    className,
}: {
    slug: string;
    className: string;
}) {
    const form = useForm({ token: '' });

    function submit(event: React.FormEvent): void {
        event.preventDefault();
        form.post(shared.unlock.url({ sharedTree: slug }), {
            preserveScroll: true,
        });
    }

    return (
        <div className="mx-auto max-w-lg px-4 pt-16 pb-28" style={PANEL_FONT}>
            <Head title="Unlock to edit" />

            <header className="mb-6 flex items-center gap-4">
                <span
                    className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full"
                    style={{
                        background:
                            'radial-gradient(circle at 50% 30%, #2a1d0c, #0b0805 80%)',
                        boxShadow:
                            'inset 0 0 0 2px rgba(199,154,63,0.7), 0 0 24px -8px rgba(240,200,105,0.45)',
                    }}
                >
                    {classPortrait(className, null) ? (
                        <ClassPortrait
                            className={className}
                            ascendancy={null}
                            size={56}
                        />
                    ) : (
                        <span className="text-xl text-[#e6d2a0]">
                            {className.charAt(0).toUpperCase()}
                        </span>
                    )}
                </span>
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.22em] text-[#b39a64] uppercase">
                        Passive tree
                    </p>
                    <h1
                        className="mt-1 text-2xl text-[#ffe6a8] sm:text-3xl"
                        style={ENGRAVED}
                    >
                        Unlock to edit
                    </h1>
                </div>
            </header>

            <div className="rounded-xl border border-[#6e5526] bg-gradient-to-b from-[#15100a] to-[#0b0805] p-4 shadow-lg shadow-black/45 sm:p-5">
                <p className="text-sm text-[#cdb784]">
                    This {className} tree is edit-protected. Paste the edit
                    token you saved when you created it.
                </p>

                <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
                    <input
                        autoFocus
                        type="password"
                        name="token"
                        autoComplete="off"
                        value={form.data.token}
                        onChange={(event) =>
                            form.setData('token', event.target.value)
                        }
                        placeholder="Paste your edit token…"
                        style={INPUT_FONT}
                        className="w-full rounded-full border border-[#6e5526] bg-[#0b0805] px-4 py-2.5 text-sm text-[#f5ecd8] outline-none placeholder:text-[#8a7850] focus:border-[#a9842f]"
                    />

                    {form.errors.token && (
                        <p className="text-sm text-[#e07a7a]">
                            {form.errors.token}
                        </p>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={
                                form.processing || form.data.token.trim() === ''
                            }
                            className="shrink-0 rounded-full border border-[#a9842f]/55 px-5 py-2 text-[11px] font-semibold tracking-[0.14em] text-[#ecc878] uppercase transition-colors hover:bg-[#f0c869]/22 hover:text-[#ffdf9a] focus-visible:bg-[#f0c869]/22 focus-visible:outline-none disabled:border-[#3a2f18] disabled:text-[#5a4d30] disabled:hover:bg-transparent"
                        >
                            {form.processing ? 'Unlocking…' : 'Unlock'}
                        </button>
                        <a
                            href={shared.show.url({ sharedTree: slug })}
                            className="text-sm text-[#8a7850] transition-colors hover:text-[#ecc878]"
                        >
                            Back to the build
                        </a>
                    </div>
                </form>
            </div>
        </div>
    );
}

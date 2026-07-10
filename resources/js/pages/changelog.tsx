import { LegalPage, LegalSection } from '@/components/legal-page';

type Entry = { heading: string; items: string[] };

/**
 * The changelog, rendered from CHANGELOG.md (parsed server-side in
 * ChangelogController). Each `## heading` becomes a dated section in the shared
 * document chrome; the bullets are its changes.
 */
export default function Changelog({ entries }: { entries: Entry[] }) {
    return (
        <LegalPage title="Changelog" eyebrow="Project">
            {entries.map((entry) => (
                <LegalSection key={entry.heading} heading={entry.heading}>
                    <ul className="flex list-disc flex-col gap-2 pl-5">
                        {entry.items.map((item, i) => (
                            <li key={i}>{item}</li>
                        ))}
                    </ul>
                </LegalSection>
            ))}
        </LegalPage>
    );
}

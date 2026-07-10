import { useAppName } from '@/components/brand';
import { LegalPage, LegalSection } from '@/components/legal-page';

const UPDATED = 'July 8, 2026';

const LINK =
    'text-[#c9a24a] underline decoration-[#c9a24a]/40 underline-offset-2 hover:text-[#ecd49a]';

export default function Credits() {
    const appName = useAppName();

    return (
        <LegalPage title="Credits & Licenses" updated={UPDATED}>
            <LegalSection heading="Thanks">
                <p>
                    {appName} stands on the work of the Path of Exile community.
                    The data, icons, and tools below make it possible - full
                    credit and license details follow.
                </p>
            </LegalSection>

            <LegalSection heading="Game content">
                <p>
                    Path of Exile 2, all game data, gem and item icons, and the
                    passive skill tree are © Grinding Gear Games. They are used
                    here for a free, non-commercial community tool, in line with
                    GGG's fan content terms. {appName} is not affiliated with,
                    endorsed by, or sponsored by Grinding Gear Games.
                </p>
            </LegalSection>

            <LegalSection heading="Data sources">
                <p>
                    Every piece of game data comes from Grinding Gear Games,
                    with no third-party data sources. Gem, base-item, rune, and
                    passive-tree data, the tree's sprite atlases, every gem and
                    item icon, and all skill and rune descriptions are extracted
                    directly from the game's own GGPK content files.
                </p>
                <p>
                    Gem requirement values use Path of Building's{' '}
                    <code>getGemStatRequirement</code> formula - a game-mechanic
                    algorithm - applied to GGG's own level curves.
                </p>
            </LegalSection>

            <LegalSection heading="Economy prices">
                <p>
                    Live market prices for the loot-filter generator come from{' '}
                    <a
                        href="https://poe2scout.com"
                        target="_blank"
                        rel="noreferrer"
                        className={LINK}
                    >
                        poe2scout.com
                    </a>
                    . These are player-market values, not game data, so they
                    don't come from GGG's files - GGG content stays the only
                    source for everything else.
                </p>
            </LegalSection>

            <LegalSection heading="Loot filter">
                <p>
                    The loot filter is built on{' '}
                    <a
                        href="https://github.com/NeverSinkDev/NeverSink-Filter-for-PoE2"
                        target="_blank"
                        rel="noreferrer"
                        className={LINK}
                    >
                        NeverSink's Indepth Loot Filter for Path of Exile 2
                    </a>
                    , used and redistributed under the MIT License. Its design,
                    colour themes and strictness levels are NeverSink's;{' '}
                    {appName} starts from an unmodified NeverSink filter - so
                    with no changes it behaves exactly like NeverSink's - and
                    then edits only what to highlight, based on live poe2scout
                    prices and your build.
                </p>
                <p>
                    Copyright &copy; 2026 NeverSink. NeverSink's filter is
                    licensed under the MIT License; the full licence text is
                    kept alongside the redistributed files and is available in{' '}
                    <a
                        href="https://github.com/NeverSinkDev/NeverSink-Filter-for-PoE2/blob/master/LICENSE"
                        target="_blank"
                        rel="noreferrer"
                        className={LINK}
                    >
                        the NeverSink repository
                    </a>
                    .
                </p>
            </LegalSection>
        </LegalPage>
    );
}

import { useAppName } from '@/components/brand';
import { LegalPage, LegalSection } from '@/components/legal-page';

const UPDATED = 'July 11, 2026';

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

            <LegalSection heading="Source code">
                <p>
                    {appName} is open source under the MIT License. The whole
                    site lives at{' '}
                    <a
                        href="https://github.com/rajtik76/exile2exile"
                        target="_blank"
                        rel="noreferrer"
                        className={LINK}
                    >
                        github.com/rajtik76/exile2exile
                    </a>
                    , and the passive-tree packages - GGPK extraction, the
                    geometry engine, and the WebGL renderer - at{' '}
                    <a
                        href="https://github.com/rajtik76/poe2-toolkit"
                        target="_blank"
                        rel="noreferrer"
                        className={LINK}
                    >
                        github.com/rajtik76/poe2-toolkit
                    </a>
                    .
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

            <LegalSection heading="Unique item mods">
                <p>
                    A unique item's explicit mods aren't in GGG's data files -
                    the game composes them at runtime, not from the .dat tables
                    everything else here is built from. The one exception to{' '}
                    {appName}'s GGPK-only rule: unique mod lines are read from{' '}
                    <a
                        href="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2"
                        target="_blank"
                        rel="noreferrer"
                        className={LINK}
                    >
                        Path of Building
                    </a>
                    's community-maintained data. Two things apply here: the{' '}
                    <code>.lua</code> files themselves are used under the MIT
                    License; the item data they contain - names, base types, mod
                    text - is Grinding Gear Games' own game content, same as
                    everything else on this page, not Path of Building's.
                </p>
                <p>
                    Copyright &copy; 2016 David Gowor / Path of Building
                    Community. Licensed under the MIT License; the full licence
                    text is kept alongside the vendored data in{' '}
                    <a
                        href="https://github.com/rajtik76/exile2exile/blob/main/resources/pob-uniques/LICENSE"
                        target="_blank"
                        rel="noreferrer"
                        className={LINK}
                    >
                        resources/pob-uniques/LICENSE
                    </a>
                    .
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

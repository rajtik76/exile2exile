# Changelog

Key changes, newest first. Built in the open; the full history lives in git.

## 2026-07-14
- Notable and keystone passive tooltips now show the game's own carved header banner (matching the passive tree screen itself) instead of the plain reference-picker header every other type used to share.
- Gem, rune and soul core tooltips now match the game's own layout: gems show the GGPK-decoded header art and per-level scaling (cost, cast time, crit chance, requirements, mod ranges), and runes/soul cores show their carved currency-item frame, type, level requirement and effect lines - both replace the old generic reference-picker tooltip they used to share with every other type. The shared tooltip card also grows to keep a title on one line where it fits, instead of a fixed width that forced wrapping.
- A unique item's mods are now visible and editable in the build planner: importing a Path of Building code carries over the exact rolled values (decimals included, e.g. "11.9 Life Regeneration per second"), and hand-editing a unique now shows a value box per modifier instead of just its range. A value outside the roll's range turns the box red, shows the allowed range next to it, and blocks the editor from letting you tab, click or save your way past it until it's fixed - nothing is ever silently clamped. A unique's tooltip also now shows its base item (e.g. "Viper Cap" under "Constricting Command"), matching the game's own tooltip.
- Unique item mods (e.g. "+(80-120) to maximum Life" on Constricting Command) now sync daily from Path of Building's community-maintained data - GGG's own files never carry them, since the game composes a unique's rolls at runtime rather than shipping them in the patch. This is the one documented exception to the app's GGPK-only data rule; credited on the [Credits & Licenses](credits) page.
- Fixed that daily sync failing in production: it was pointed at "main", but the upstream Path of Building repository's default branch is "dev".
- A unique item mentioned inline in a build's notes ({{unique:id|Name}}) now shows the exact same tooltip as the equipped unique on the paper-doll, instead of the plain reference tooltip gems/runes/notables share - and it's positioned next to the cursor like every other inline reference, instead of occasionally clipping against the notes panel.
- An item's defensive properties (Armour, Evasion, Energy Shield, Ward, Block) are now gated to what its real base actually has: a pure-evasion body armour no longer offers an Energy Shield field, and a unique gates the same way through its synced base. An older plan already carrying a mismatched value heals itself silently the moment it's saved, instead of getting stuck failing to save.
- Items in the build planner can now carry their own name, typed by hand or imported straight from a Path of Building code, so a rare or magic item's rolled name (like "Rift Pelt") shows above its base type instead of the two being indistinguishable. The item's base type line is gone from the tooltip body - it's redundant once the rarity frame and name already say what the piece is.
- An item can now be marked Corrupted - imported automatically from Path of Building or set by hand in the editor - and shows as a red line at the very bottom of its tooltip, under a divider, matching the game's own colour.
- The item level field is gone from the editor; it never tracked anything beyond a number the author typed in, and the name field replaces it as the one thing worth naming by hand.
- An item's basic stats (Quality, Armour, Evasion, Energy Shield, Block) now show their values in the same blue as the item's modifiers, matching the game's own tooltip colours; the Alt-held per-modifier tier breakdown was brought in line with the same font size, line spacing and colours too.
- The paper-doll's empty item slots, priority badge, clear button and the priority strip beneath the doll were all redesigned with a softer, rounded look; the priority strip now always shows every prioritised item in one row instead of hiding overflow.

## 2026-07-13
- The newsletter signup form is now protected by [captchaapi.eu](https://captchaapi.eu), a proof-of-work captcha that solves itself invisibly in the background while you fill in the form - no puzzles, no cookies, no tracking. It's off by default in local development, so cloning the repo needs no extra setup to try the app.

## 2026-07-12
- Saved passive trees are now editable, the same way build-planner guides are: saving a tree mints its public link and a secret edit token, and the tree can be reopened, changed and saved again at its own edit page, unlocked by the token. The token travels only in form bodies - never a URL - wrong tokens are rate-limited, and every save is its own build with its own link.
- The editor's new link panel lists the public link, the edit link and the token in one place, each with a copy button that gives clear feedback - this also fixes the share link's copy button, which did nothing in some browsers. The token stays masked until revealed, and the panel works comfortably on a phone.
- A saved tree can be deleted from its editor: the token is re-typed to confirm, and the build, its public page and its machine-readable document all go at once.
- On a shared tree's page, "Open in planner" is gone: editing starts from the edit link the author saved, never from the public page - the same model as a build-planner guide. Editing changes the build behind the existing link, so a shared route stays one link even as it evolves. Trees shared before today have no edit token, so they stay exactly as shared - read-only, at the same URLs.
- The passive tree now paints weapon sets in the game's own colours: weapon set I is red and weapon set II green, on the node frames, the lit rails, the point counters and the paint toggle alike. The delete preview - the path a click would remove - moves from red to magenta, so it can no longer be mistaken for a weapon set I path. The palette is also a public contract of the tree renderer now: any consumer of the toolkit can retint both sets and the removal preview.
- You can now subscribe to an occasional newsletter about new tools and data updates - the signup page is linked from the footer. Signing up is double opt-in: nothing is sent until the confirmation link in the first email is clicked. Every issue ends with an unsubscribe link that removes the address immediately, mail providers get the standard one-click unsubscribe headers, and the privacy policy now spells out how addresses are handled.
- Added a Newsletter figure to the internal stats dashboard.

## 2026-07-11
- Exile to Exile is now open source: a GitHub menu in the top navigation and links in the footer point to both public repositories (the app and the toolkit), and the credits page gained a Source code section. The repository ships a contributing guide, a public architecture overview, a security policy and issue templates, with questions routed to the Discord.
- Importing from Path of Building now resolves craft-only modifiers instead of dropping them: desecrated and essence-only affixes, boss-influence modifiers, the dedicated breach-desecration mods and tiers boosted past a slot's natural ceiling all land on the item as the real affix. Modifier lines the game shows added together are split back into the affixes behind them, catalyst quality folded into a jewellery modifier is matched through, and flask charges and regeneration shown per second import with the right numbers. Across 37 test builds, dropped lines fell from 184 to 48, and builds importing without losing a single line rose from 9 to 15.
- Item rules were relaxed to what the game really allows: a Vaal corruption can add an extra rune socket (up to four on uniques such as Greymake), bases with all three defences import, quality can stack up to 100, and "Corrupted" and "Mirrored" are read as item flags rather than modifiers.
- Fixed the modifier picker hiding every tier of a modifier found by an out-of-order search (searching "to attack" found "+# to Level of all Attack Skills" but then no tier of it); each step of the picker now starts with its own blank search box, and modifiers with no readable effect no longer appear as empty rows.
- A saved build can now be deleted from the editor. Deleting is deliberately strict: the editor must be unlocked and the secret edit token re-typed into the confirm, wrong tokens are rate-limited, and the token never appears in a URL. A successful delete also clears the local draft, so the dead build cannot resurface.
- The share panel was redesigned around it: one row each for the public and edit links, the edit token masked until revealed, copy buttons with clear feedback, and the delete behind a danger-zone footer.
- New logo: an E2E mark built from the wordmark's own letterforms now sits in the top navigation, the footer and the favicon.
- The editor now checks data crossing its boundaries: a stale local draft, a misshapen server reply or broken tree data is rejected at the source instead of crashing the page mid-render.
- For contributors: pull requests now run the full lint-and-test gate in CI, each quality check runs as its own step, every suite runs against a fresh database, and the default tree view is pinned to a visual snapshot so a renderer change that alters the drawn scene fails loudly.

## 2026-07-08
- The build planner reads better on phones: buttons, pickers, toggles and the phase bar now scale down to the screen, the phase bar is more compact, and the build-name placeholder stays legible over the moving backdrop.
- Changing an item modifier now opens straight on the current modifier's tiers, with a clear back button to every other affix; the picker is wider where there's room and shows each modifier in full instead of cutting it off.
- Generate an in-game loot filter straight from a build's page and download it into Path of Exile 2, no hand-editing required.
- The filter is built on NeverSink's Indepth Loot Filter: with no changes it behaves exactly like NeverSink's, and the app edits only what to highlight, so you get NeverSink's proven filter tuned to your build and live prices.
- Valuable currency and unique items are highlighted by live market prices, styled in NeverSink's own colours, sounds and beams.
- The filter follows your build: it highlights unidentified rares of the bases you wear and lights up any item carrying a modifier your build wants.
- Pick from NeverSink's colour themes (Default, Cobalt, Dark mode, Mythic, Vaal, Zen and Aura) and its seven strictness levels, from Soft up to Uber-plus strict.
- A live preview shows how drops look on the ground for the chosen theme and strictness, down to the in-game font, so you can see what each level highlights and hides before you download.
- Importing a build from Path of Building now carries each item's defences - quality, armour, evasion, energy shield, and a shield's block - and shows them on the item in place of its attribute requirements.
- Modifiers the game adds together into one line (two "increased Armour and Evasion" affixes shown as their sum, or a roll boosted by the item's quality) now import as the real affixes behind them, so nothing is lost and the totals match the game. Hold Alt (Option on a Mac) over an item to break each modifier out with its prefix/suffix tier and roll range.
- A modifier that can be either a prefix or a suffix (such as increased Rarity of Items) is now placed so the item stays legal - a crafted modifier is no longer dropped to make room for it.
- Life leech and hybrid modifiers now import correctly, and any line the import couldn't place is listed in a dismissible notice on the item so you can see exactly what was left off.
- Added a "Plan builds" figure to the internal stats dashboard.

## 2026-07-07
- Introduced the build planner: plan a whole build in one place - pick your class and ascendancy, allocate the passive tree, lay out your skill gems with their supports, and equip items with real game modifiers.
- Plan the build in phases, from Act I through early endgame, revealed one at a time with each phase inheriting the last - so a guide can show how the build comes together as you level.
- Start from scratch or import from Path of Building, and reference real gems, runes, uniques, bases and notable passives straight from the game data, each item modifier rolled to a value.
- Share a plan as a link that opens a read-only guide mirroring the editor; editing is unlocked with a private token you keep, never in the URL.
- The planner works on phones and narrow screens, and the passive tree stays smooth while you type.
- Redesigned the landing page as a self-advancing gem carousel, where each tool is a skill gem in a socket that doubles as colour-coded navigation.
- Build comparison isn't finished yet, so it's hidden for now - the landing points to the build planner instead, and the Kalandra tool is marked coming soon.

## 2026-07-01
- A shared build link now carries a machine-readable summary and a JSON version of the build - its class, ascendancy, notable passives and attribute split - so an automated reader or tool opening the link gets the build straight from the page instead of guessing at it.
- Fixed shared links saved before an earlier data update showing an internal code (such as "Monk1") in place of the ascendancy's name and portrait.

## 2026-06-28
- On touch screens, the first tap on a node shows what it does and previews the path to it; a second tap plans that path - so you can read any node, notables and keystones included, without committing the route.
- Pinch to zoom the passive tree on touch screens.
- On a phone the tree controls now fold behind a "Tools" button, leaving the tree the screen; the point counters moved into the Basic / Set I / Set II toggle, so each shows its own used/limit at a glance.
- Node tooltips now stay inside the screen on mobile instead of spilling off the edge.
- Ascendancy is now capped at its 8 points: a counter on the tree tracks them, and a notice appears if a path would spend past the cap.

## 2026-06-27
- Compare your passive tree against a reference build right on the tree: the shared route shows in gold, your own detours in red, and the reference's branches you're missing in violet.
- Re-themed the build pages around the Kalandra mirror.
- Item, gem and rune data and their icons now build straight from the official game files.

## 2026-06-26
- Plan both weapon sets on one tree: switch the paint mode between Basic, Weapon Set I and Weapon Set II, and each set's branch shows in its own colour with its own point counter. Set branches grow off the shared tree and can't cross into the other set, matching the game.
- The point budget is now read straight from the game data: 123 basic points plus 24 per weapon set.
- Clear the whole build in one click, straight from the tree.
- Hover-to-remove now highlights exactly the nodes a click deletes - the clicked node and everything that hung off it.
- Shared builds and Path of Building imports carry your weapon-set choices; links saved before this update keep working unchanged.
- Added a "Builds stored" figure to the internal stats dashboard.

## 2026-06-25
- Added our own privacy-friendly analytics: no cookies, no third party, and your IP is never stored - it's turned into a daily, irreversible hash so visits can't be traced back to you. The privacy policy now spells this out.

## 2026-06-24
- You can now share a passive tree as a link from the planner; opening it shows a read-only viewer with the class and ascendancy, and "Open in planner" loads it back for editing.
- Node search now rings its matches with a stronger, higher-contrast pulse, and searching an attribute finds the nodes set to it.
- The passive tree can no longer be dragged off-screen, and node search no longer rings hidden ascendancy nodes on the tree's edges.
- The patch read-out now shows how long ago the version released and which patch the app's own data is built from; the live times refresh every minute. It also appears on the patch-webhook page.
- Unallocated passive nodes now keep their colour, dimmed, instead of rendering grayscale (matching the game).
- Passive tree now renders with WebGL for smoother panning and zooming.
- Fixed connection arcs that curved the wrong way or showed as straight lines, including links between node clusters.
- Ascendancy clusters that unlock from a notable (such as the Druid's "The Unseen Path") now stay hidden until you take it, then appear.
- Nodes that grant a skill or a passive point now show their description.
- Inactive ascendancy links now render in black, and node highlights and removal previews line up correctly inside the ascendancy.
- Switching class or ascendancy now clears the points that no longer apply.

## 2026-06-23
- Rebranded to "Exile to Exile": a gold-and-quicksilver palette, new typography and a gem-per-tool look.
- Rebuilt the landing as an Atlas signpost with a star-chart backdrop.
- Added a looping forge backdrop to the build importer.
- Refreshed game data to patch 4.5.3.1.8.

## 2026-06-22
- The passive tree now renders straight from GGPK game data (dropped the GitHub export).
- Added passive-tree node search with highlight and pan-to-fit.
- Added the PoE2 patch-watch webhook service.

## 2026-06-21
- One reusable passive-tree view, shared by the planner and the build comparison.
- Full-page tree planner: click-to-allocate, socketed jewels, ascendancy editing and a point budget.
- All PoE2 data is now sourced from GGG.

## 2026-06-20
- Skill-gem diff against a reference build, on a side-by-side compare page.
- Official class and ascendancy portraits.
- Added the credits page.

## 2026-06-19
- Split the importer and the result viewer into separate pages.
- Interactive passive tree on the result view, with in-game-style node tooltips.
- Added the privacy and terms pages.

## 2026-06-18
- First Path of Exile 2 build viewer: Path of Building 2 import, in-game gear and gem icons, item tooltips.
- Initial landing page and brand identity.

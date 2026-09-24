# AGENTS.md — working memory for AI agents on this project

Read this first. It records what has been **verified against official sources** so
future sessions don't re-derive it. Update the worklog when you change something.

---

## 1. What this is

Static, build-free web app: an **Automa / AI-opponent manager for _Star Wars: Outer Rim_**
(base game + _Unfinished Business_ expansion). It replaces the physical AI card decks and
the player reference card. Served by nginx from the repo root (`docker-compose.yml`).

```
index.html             bootstrap; version string + feature flags live here
assets/js/main.js      ALL logic, one jQuery ready() closure (~1080 lines)
assets/css/main.css    dark theme, mobile-first (max-width 450px)
assets/cards/en.json   live card + help + phase text, EN    <- edit these
assets/cards/uk.json   live card + help + phase text, UK    <- edit these
assets/ref_docs/*.pdf  the four official rulebooks (see 2b)
assets/images/         scanned physical cards (see section 3)
```

Everything comes from `assets/cards/<locale>.json`. The legacy per-card files and the dead
`fetch` that read them are gone (C3/C4); recover them from history if ever needed.

---

## 2. Source of truth — in this order

1. **`assets/images/` scans of the physical cards.** Highest authority for *card* text.
   They are photographs of the real cards and they are fully legible (see 3).
2. **Official rulebooks** (see 2b) for *procedure* the cards don't state.
3. `assets/cards/*.json` — the app's transcription. **Has known errors.** Never treat it as
   the reference; it is the thing being corrected.

The scan-vs-JSON audit lives in [CARD_AUDIT.md](CARD_AUDIT.md).

Short keys used in citations below, all resolving into `assets/ref_docs/` (section 2b):
**LTP** = `swor-base.pdf` · **UB** = `swor-outerrim.pdf` ·
**RR** = `swor_living_rules_reference.pdf` · **UK-RB** = `swor-base-ukr.pdf`.

### 2b. Rulebooks — in the repo under `assets/ref_docs/`

All four are present locally. Identity and page counts verified by extraction, so cite
these paths rather than re-downloading.

| file | pp. | what it really is | key pages |
|---|---|---|---|
| `assets/ref_docs/swor-base.pdf` | 16 | Base **Learn to Play**, EN (`sw06_learn_to_play_v2`) | Single-Player Game pp. 14–15; Player Turn card p. 3 |
| `assets/ref_docs/swor-outerrim.pdf` | 12 | **Unfinished Business** expansion rulebook (`sw07_outerrim_rulebook_v2`) | Single-Player Rules pp. 8–11; **Using Multiple AI Opponents p. 11** |
| `assets/ref_docs/swor_living_rules_reference.pdf` | 28 | **Living Rules Reference v1.1 (06/10/2022) — authoritative** | **Appendix 3 Single-Player pp. 22–25**; Appendix 4 expansion clarifications p. 25 |
| `assets/ref_docs/swor-base-ukr.pdf` | 16 | Official **Ukrainian** base rulebook (desktopgames.com.ua) | terminology; "Хід ШтІнту" AI card p. 3 |

Every page citation above was checked by extracting that page. Original download URLs,
should a file ever need replacing:

```
https://images-cdn.fantasyflightgames.com/filer_public/fc/8a/fc8a7a1b-ee5d-4df9-8735-92a8c8f5f0f6/sw06_learn_to_play_v2-compressed.pdf
https://images-cdn.fantasyflightgames.com/filer_public/b8/a9/b8a953a5-26da-4f15-88a8-5eecc3eaa4df/sw07_outerrim_rulebook_v2-compressed.pdf
https://images-cdn.fantasyflightgames.com/filer_public/1f/7f/1f7f3850-9a91-4461-b43e-1b5352d67846/swor_living_rules_reference_1.pdf
https://desktopgames.com.ua/games/5275/pravila_nastlno_gri_star_wars.-zovnshne-klce-star-wars-outer-rim-ukranskou-movou-66179964.pdf
```

They are image-heavy; `pdftotext`/`pypdf` are NOT installed. Use ghostscript:

```bash
# page count
gs -q -dNODISPLAY -dNOSAFER -c "(assets/ref_docs/FILE.pdf) (r) file runpdfbegin pdfpagecount = quit"

# text of one page (do this per page - it keeps citations honest)
gs -q -dNOPAUSE -dBATCH -sDEVICE=txtwrite -dFirstPage=N -dLastPage=N -o out.txt in.pdf

# render a page
gs -q -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -dFirstPage=N -dLastPage=N -o page.png in.pdf
```
Two-column reflow interleaves the columns — **do not trust a sentence that spans a line
break** in the txtwrite output. Verify against the scan or a rendered page.

---

## 3. Reading the card scans

Scans are ~630x1010 px. Upscale before reading or the text is marginal:

```bash
convert assets/images/smuggler/1.png -resize 250% -unsharp 0x1+1+0 /tmp/out.png
```
At 250% every card is comfortably readable, icons included. Verified on
`smuggler/1`, `smuggler/10`, `smuggler/han`, `bounty/1`, `player/base a`.

**There are no `.docx` OCR files** anywhere on disk or in git history. Don't look for them.

### Re-cropping the character cards

If the character art ever needs re-cropping, restore the originals from git first
(`git show <rev>:assets/images/characters/<file>`) — the working copies are already
cropped. The cut is found programmatically, because the scans are not perfectly aligned:

1. Trim near-white rows off the top/bottom of each scan (manual-scan artifacts).
2. On the **silver** side, find the row with the highest fraction of orange pixels in the
   38–62% band — that is the card's orange rule. Detection is strong there (~0.85).
3. Apply that row **as a ratio of the trimmed height** to the gold side too. Do *not*
   detect on gold directly: its border is already orange, so the signal collapses (~0.08)
   and lands 4–9% off. Both sides are the same physical card, so the ratio transfers.
4. Trim any residual white left at the new edges, then eyeball all 32 — step 1 caught
   only `krrsantan_` (9 rows), but `hondo_` still needed the post-trim.

### Language of each scan set (they are mixed!)

| path | printing | language |
|---|---|---|
| `assets/images/smuggler/1..10.png` | base game | **Ukrainian** |
| `assets/images/bounty/1..5.png` | expansion | **English** |
| `assets/images/{smuggler,bounty}/<char>.png` | expansion | **English** |
| `assets/images/player/base {a,b}.png` | base | **Ukrainian** ("Хід гравця") |
| `assets/images/player/expansion {a,b}.png` | expansion | **English** ("Player Turn") — *corrected; this table previously called all four Ukrainian* |
| `assets/images/characters/<char>[_].png` | character cards, **cropped to art + name** — everything below the card's orange rule (setup, ability, personal goal, skills) is gone. `<char>.png` = **silver**, personal goal *not* achieved; `<char>_.png` = **gold**, achieved. The full-card originals were removed (owner has backups; also recoverable from git history before `1.43.0`). |
| `assets/images/assets/*.png` | icons, keyed by the 2nd CSS class of `span.icon` |

### Image -> data key mapping

`assets/images/<type>/<key>.png` <-> `assets/cards/<locale>.json -> <type> -> <key>`
where `<type>` is `smuggler|bounty` and `<key>` is `1..10` / `1..5` / a character id.
Character ids come from the `characters[]` table at `main.js:6`.

---

## 4. Verified rules facts

### Deck composition — app is CORRECT, don't "fix" it
- base smuggler = `1..10` (base box has exactly "10 AI Cards" / "10 Карт ШтІнту")
- expansion smuggler = `1, 2, 6, 7, 9` + that character's card (RR p. 22, verbatim)
- expansion bounty = `1..5` + that character's card
- **base bounty does not exist** — the bounty hunter AI deck ships only in the expansion.
  So `main.js:198` (hiding bounty hunters for base-mode AI) is right, and the
  `[1,2,3,4,5]` base-bounty branch in `shuffleAiDeck` (`main.js:828`) is dead code.

### Deck cycling — app is WRONG
RR p. 22 / LTP p. 14:
> After resolving the card, discard it **facedown to the bottom of the AI deck**.

The deck is a **fixed rotating queue**. It is shuffled once at setup and then keeps that
order forever. The app instead removes each drawn card and reshuffles a fresh random
order when the deck empties (`main.js:726`, `main.js:791`).

The one exception, **read off the physical cards**:
- `assets/images/smuggler/han.png` (EN): "Then, **shuffle this AI card back into the AI deck**."
- `assets/images/smuggler/10.png` (UK): "Потім **затасуй цю карту** в колоду ШтІнту."

So the special card is shuffled **back into the deck**, at a random position — the rest of
the deck order is untouched. `assets/cards/*.json` mistranscribes this as "Then shuffle this AI
deck" / "перетасуйте цю колоду ШІ" on all 17 cards that carry the line, and
Verified verbatim from a rendered page, not the reflowed text. Two consequences:

- **The deck can never be exhausted**, since every resolved card returns to the bottom.
  There is therefore no "reshuffle when the deck runs out" rule anywhere. Grepping all
  four PDFs for `reshuffl|exhaust|runs out|no cards left` near "AI"/"deck" finds nothing:
  the only AI-deck shuffle instructions in any rulebook are at **setup**.
- **The special card shuffles only itself.** The printed text is singular in both
  languages — `bounty/boba.png` "shuffle **this AI card** back into the AI deck",
  `smuggler/10.png` "затасуй **цю карту**".

### ⚠ The app deliberately diverges here — HOUSE RULE, do not "fix"

The owner's decision (2026-09-23), after being shown the above: the app reshuffles the
**whole deck** when the deck runs out or when the special card is drawn. The drawn card
leaves the deck rather than going to the bottom.

So `triggersReshuffle()` + the reshuffle in the draw block are **intentional**. Leave the
*card text* alone though — it is a faithful transcription of the printed card, and it is
the app's behaviour, not the transcription, that diverges.

`reshuffleMarks()` replays the history to decide which turns get the ↻ marker, so the
marker still needs no stored state (C5).

### Phase semantics — app is WRONG for AI cards
Physical cards, both languages:

| step | human card | **AI card** |
|---|---|---|
| Planning | Choose one / Вибери одне | **Do the first that applies** / зроби першу можливу дію |
| Action | Perform any or all / Виконай будь-що або все | **Do all that apply** / зроби все |
| Encounter | Choose one / Вибери одне | **Do the first that applies** / зроби першу можливу дію |
| Special | — | `SPECIAL` / `СПЕЦІАЛЬНА ДІЯ` |

**RR p. 22** defines the priority walk authoritatively:

> Some sections of AI cards read, "Do the first that applies." This means that the AI
> resolves the top bullet if possible. If that bullet would have no effect or cannot be
> resolved (for example, the AI player has no damage to recover), the AI resolves the
> next bullet instead. If the AI cannot resolve any of the bullets, they do nothing.

Note what that quote actually means: **exactly one bullet is resolved** in a "first that
applies" step. So crossing the others out once one is picked is correct — an earlier pass
in this session made those steps non-exclusive, which was an over-correction, now undone.

**Implemented (R2).** `phases` is AI-only (the human card carries its own hints inline),
so it was retranscribed from the scans. Selection is driven by `data-pick` on the
`.phaseItem`, set by `picksFor()`:

| step | `data-pick` | behaviour |
|---|---|---|
| planning, encounter | `1` | pick one, the rest cross out |
| action, special | `all` | independent toggles, nothing crosses out |
| **IG-88** planning | `2` | pick up to two, rest cross out at two |

IG-88 is the **only** exception, and this was checked card by card against the scans
rather than against the transcription: all 31 AI card images (16 character + 10 smuggler
+ 5 bounty) were cropped at their step headers and read. Every other one says plainly
"Do the first that applies:" / "зроби першу можливу дію:" in both the planning and the
encounter step. So `picksFor()` is deliberately a lookup, not a parse of the card text.

A card line beginning `!.` is a *condition*, not an action (only IG-88's "If IG-88 has at
least 1 droid crew, do the first 2 that apply instead"). It renders as `.phaseNote` —
visible, italic, not clickable — so it can't be selected or counted against the limit.

### Debug mode decks (`?debug`)

Not a rules matter — a review aid. `shuffleAiDeck(type, character)` branches on `debug`
and deals a fixed, unshuffled deck so every card can be read in order. `deckComposition()`
holds the real composition and is shared by both paths, so the game mode is still
respected; debug only changes the order and which slice a given AI gets.

| game mode | AI | debug deck, in order |
|---|---|---|
| base | any smuggler | `1 2 3 4 5 6 7 8 9 10` |
| base | any bounty hunter | **no deck exists** — confirmed even in debug |
| expansion | 1st smuggler | `1 2 6 7 9 special` |
| expansion | 1st bounty hunter | `1 2 3 4 5 special` |
| expansion | 2nd+ AI of that same type | `special` only |

Debug **never adds a card the game mode does not have** — it only fixes the order and
which slice a given AI gets. In particular the base deck is `1..10` and stops there: the
base box has no character cards (section 4, deck composition), so the first/later split
does not apply in base mode and every base smuggler AI runs the whole deck. An earlier
pass appended `special` to it; that was wrong and is gone.

"first" is seating order (`isFirstAiOfType`). The later AI of a type exist to page through
the remaining **character** cards; their numbered cards would only repeat what the first
AI already showed.

Base + bounty hunter is the one setup warning `addPlayerFromForm` still confirms under
`debug` (`noDeckExists`): the others are preferences, but this one has no cards at all. If
it is confirmed anyway it falls back to the expansion bounty deck — the pre-existing C8
behaviour for a deliberately impossible seat, not something debug introduced.

`triggersReshuffle()` returns `false` under `debug`, or card 10 would cut the base deck
short. A debug deck simply restarts, in the same order, once its last card is drawn.

**The debug draw ignores `aiDecks` and `aiHistory` entirely.** Both are restored from
`localStorage`, so continuing a save made by an ordinary (randomized) game would otherwise
keep replaying that game's history and shifting its shuffled deck — `?debug` looked like it
was still randomizing. Under `debug` the card is instead `seq[currentCardIndex % seq.length]`,
a pure function of the turn index: the same sequence on every reload, under Back/Forward,
and across a restored save. Both stores are still written so the ↻ marker and the save
stay coherent.

### Other verified points
- AI players **cannot complete personal goals or ship goals** (RR p. 22) — the
  personal-goal toggle rendered for AI turns at `main.js:813` shouldn't exist.
- Starting ships: smuggler AI = G9 Rigger, bounty AI = G-1A Starfighter. ✓ app correct.
- Favors are **expansion-only AND forbidden in single-player** *(rule verified; the app no longer prints it — see R4)* ("The favors optional rule
  cannot be used"). Help entry 7 is tagged `gameMode: []` (any) — wrong.
- Defeat penalty (lose 3,000, discard all secrets) happens **when you become defeated**,
  not when you recover. Recovery is **mandatory** on the next planning step and blocks
  move / gain credits / Planning ability. The human card states this wrong.
- Solo is capped at **two** AI opponents, and they must be of **different types**.
  App allows three, any mix (`index.html:16`). **UB p. 11 "Using Multiple AI Opponents"**,
  verbatim: setup is performed "for both a bounty hunter character (starts with databank
  card #90) and a non-bounty hunter character (starts with databank card #91 or #92)".
  Also from that page, none of which the app models yet:
  - AI turn order is **randomly determined**; the human is always the first player.
  - The first AI in turn order starts with **6,000**, the second with **8,000**.
  - After each human turn, resolve **one card from each** AI deck, in turn order.
- **AI players pay the defeat cost too.** RR p. 25 opens the clarifications with "The AI
  player must obey all rules that apply to normal players **unless specified otherwise in
  this appendix**", and the only defeat-specific AI rule there is that they stop resolving
  further bullets ("If the AI player is defeated during their turn, they do not resolve any
  subsequent bullets on their AI card… and then their turn ends"). Nothing exempts them from
  RR p. 9's cost, and p. 22 says to "keep track of each AI player's fame, credits, and cards
  as if they were a normal player" — so an AI loses **3,000** on becoming defeated. The
  secrets half is moot: AI players never resolve encounter cards (RR p. 22), so they never
  hold secrets.
- A **bounty target** is "a character, crew, or contact that matches one of the AI player's
  bounties"; when a bounty matches no character, crew or **faceup** contact anywhere on the
  map, "the nearest **facedown** contact token that matches that bounty's class … is
  considered to match that bounty" (**RR p. 22**). The ranking is character → crew → faceup
  contact of the lowest class → facedown contact of the lowest class (**RR p. 23**); ties go
  to the nearest, then at random. This one definition serves **both** the planning
  "move toward" bullet and the encounter bullet — the encounter step is **not** limited to
  faceup contacts: "The AI player can encounter facedown and faceup contact tokens. When
  encountering a facedown contact token, they flip that token faceup" (**RR p. 24**).
- Smuggler card 1 "If there are no free **cargo** slots, buy a job card" is **correct** —
  confirmed on the scan ("Якщо немає вільних слотів для вантажу"). An earlier reading of
  the reflowed PDF suggested "job slots"; that was a column-interleaving artifact.

---

## 5. Official Ukrainian terminology

`assets/cards/uk.json` does not use it. Official column is from **UK-RB** and the UK
reference/AI cards; counts are occurrences in that rulebook.

| concept | official UK | app currently uses |
|---|---|---|
| space (map location) | **терен** (38) | простір (official: 0) |
| AI player | **ШтІнт** (51) | ШІ |
| defeated | **(тебе) спіткала невдача** (16) | переможений (official: 0) |
| goal token | **жетон мети** (5) | жетон цілі (official: 0) |
| job | **халтурка** (35) | завдання in cards, халтурка in help |
| trade | **уклади угоду** | обміняйся картами |
| discard top market card | **прокрути колоду** | скинь карту |
| illegal | **протизаконний** | незаконний |
| buy / place / pay / gain | **купи / поклади / заплати / здобудь** (ти-form) | mixed ти- and ви-forms |
| phase names | **ФАЗА ПЛАНУВАННЯ / ФАЗА ДІЙ / ФАЗА ЗУСТРІЧЕЙ** | 3 inconsistent variants |

`assets/cards/uk.json` contradicts itself on phase names: `phases` says "Фаза Планування / Фаза
Дії / Фаза Зустрічі", the player cards say "Фаза планування / Фаза дії / Фаза зустрічей".

`assets/cards/en.json` `help[5]` and `help[6]` are **still in Ukrainian** — the EN locale shows
Ukrainian text for skill tests and fame sources.

---

## 6. Worklog

Status: `open` / `done` / `wontfix`. Keep newest decisions at the bottom of a row's notes.

| # | finding | where | status |
|---|---|---|---|
| R1 | AI deck cycling | `main.js` draw block + all 17 "shuffle" card texts | **done, as a house rule.** Research stands (LTP p. 14 says bottom-of-deck; the special shuffles only itself) but the owner chose the **full reshuffle on special-or-empty** behaviour instead — see the ⚠ box in section 4. The 17 card *texts* were still corrected to the printed wording in both locales, and the baseless `lastCard === "special"` guard is gone. Do not revert the behaviour to the printed rule without asking. |
| R2 | AI phase hints say "choose one"; must be "do the first that applies" / "do all that apply" | `main.js` `describeCard` + `attachPhaseElementListeners`, `phases` in both JSONs | **done** — `phases` retranscribed from the scans. Selection now runs off `data-pick` via `picksFor()`: `1` for planning/encounter, `all` for action/special, `2` for IG-88's planning only. "Do the first that applies" resolves exactly one bullet, so those steps are click-exclusive again. All 31 AI card scans were read to confirm IG-88 is the sole exception. `!.` lines render as non-selectable `.phaseNote`. |
| R3 | Personal-goal toggle shown on AI turns | `main.js` AI branch | **done** — toggle + "Personal Goal Achieved" line removed from AI turns; character card renders unflipped. Human branch untouched. |
| R4 | Favors help entry tagged any-mode; expansion-only + banned in solo; Shortcut text has copy-paste tail | `help[7]` both JSONs | **done** — retagged `gameMode: ["expansion"]` and the entry now says plainly it cannot be used solo (**RR**: "The optional favor rules cannot be used for a single-player game"; **UB p. 8**: "Favors: The favors optional rule cannot be used"). All four favors retranscribed from RR/UB. Beyond the known copy-paste tail, Shortcut had a second error: it granted **+1 speed** where both rulebooks say **+1 hyperdrive** — see D3. Added the limits RR states (any number requested, only 1 received, never from yourself, not after dice are rolled). ⚠ **Owner removed the solo-ban line on 2026-09-24** ("Rulebook: optional expansion rule, and it cannot be used in a single-player game." / "Правила: необов’язкове правило доповнення…"), in both locales. The rule itself still stands and is unchanged — see the bullet in section 4 — it is simply no longer printed on the favors help entry. Do not re-add it without asking. |
| R5 | Human card: defeat cost attached to Recover; missing "mandatory if defeated" | `player.*.planning` both JSONs | **done** — confirmed from both player scans, which print one line: "Recover all damage from character and ship **(required if you are defeated)**" / "Зніми усі пошкодження **(обов'язково, якщо тебе спіткала невдача)**". The Pay 3,000 / Lose-secrets sub-bullets were on neither card and are gone. |
| R6 | Movement text missing hyperdrive distance, 1-fewer-space tiebreak, equidistant-path preferences | `help[11]` | **done** — rewritten from **RR p. 23** (rendered, not reflowed text). Adds the `hyperdrive` move distance, the "never takes a longer path to avoid a patrol" rule, the must-stop-without-positive-reputation rule, the one-or-two-fewer-spaces navpoint rule *and* its one-fewer tiebreak, and the equidistant-path preference (no-patrol path, then planet, then random). Also corrected "Do not stop on Maelstrom" — the rule is that an AI moves **through** the Maelstrom *as if it were a navpoint*. |
| R7 | Player bounty reward missing "must choose a faction the AI does not have positive rep with, if possible" | `help[4]` | **done** — added, but as a marked `appNote`, not as card text: `help[4]` transcribes `player/expansion b.png` and **matches its scan**, while this clause is an AI-only rule from **RR p. 24**. Also repaired a garbled find/replace in the UK entry (`вирозшук` -> `винагороду`, title `Розшуку за Гравця`). |
| R8 | Unopposed bounty damage: character vs ship distinction lost | `help[1]` | **done** — **RR p. 24**, verbatim: damage lands **on the character** equal to the bounty card's `land attack`, **or on the ship** equal to its `ship attack`. Step b also now says **Elimination Reward** and mentions the card's "After you gain a reward" text. |
| R11 | 31 AI cards + 4 player cards audited against the scans — see [CARD_AUDIT.md](CARD_AUDIT.md). Card-specific transcription errors fixed (group b); the app's own rules reminders kept but marked `appNote`/`.phaseNote` (group a). | both JSONs, `main.css` | **done** |
| R9 | UK terminology pass (section 5) | `assets/cards/uk.json` | **done** — ~740 replacements. Official terms from **UK-RB** + the UK scans now used throughout: `терен`, `ШтІнт`, `спіткала невдача`, `жетон мети`, `халтурка`, `протизаконний`, `слот`, `ґатунок`, `уклади угоду`, `прокрути колоду`, `гіперпривід`. All 111 ви-form verbs converted to the cards' ти-form, Latin `a.b.c.` lettering replaced with Cyrillic `а.б.в.г.д.`, and mid-sentence capitals lowered. The repeated bullets were then aligned **verbatim to the scans** — on `smuggler/1` all 9 bullets now match the card word for word. Residual sweep for every non-official form returns **0**. |
| R10 | EN locale has Ukrainian help[5], help[6] | `assets/cards/en.json` | **done** — both translated; `en.json` now contains **zero** Cyrillic characters. They transcribe `player/base b.png` (a UK scan), so they were translated rather than re-transcribed. The UK originals were also reordered to the scan's own form (**Падаван:** ⟨crit⟩ *(навички немає)*, not "0 навичок: ⟨crit⟩ (Падаван)"). |
| D3 | The app called the ship movement stat **speed**; the rulebooks call it **hyperdrive** throughout (base LTP 7x, RR 9x, UB 1x — "speed" appears once in the base book, in a Han Solo flavour quote). Official UK is **гіперпривід** (8x in UK-RB); `uk.json` said `швидкість`, which UK-RB never uses. | `assets/images/assets/speed.png`, 4 `span.icon speed` per locale | **done** — icon renamed to `hyperdrive.png` and every reference and label updated in both locales (player planning step, `bounty/dengar` planning, favors Shortcut, help[8]). |
| D4 | UK `help[8]` had one extra `</div>`, closing its `phaseItem` early so `help[10]`'s closer over-closed. Broke the help panel for **AI** player types in both game modes; EN was correct. | `help[8]` `uk.json` | **done** — removed. The `help` array is *fragments* that concatenate under `gameMode`/`characterType` filtering, so per-entry balance means nothing: **check the 12 (locale x mode x playerType) combinations instead.** All 12 now balance. Also widened help[8]'s ability list to the rulebook's own ("combat values, health, hull, or hyperdrive"). |
| C1 | `initCards()` is `async` but never awaits `$.getJSON`; `restoreGame`/`startGame` call `showTurn()` immediately -> `cardsData` can be null | `main.js` | **done** — `initCards()` returns the jqXHR and both callers `await` it. It also ignores a response whose locale is no longer selected: the startup warm-up load races the one `startGame()` issues after the locale is picked, and could clobber the right data with `uk`. |
| C2 | `assets/cards/uk.json` working-tree diff is pure CRLF noise (851 lines, byte-identical after `\r` strip); add `.gitattributes` `*.json text eol=lf` | — | **done** — HEAD was already LF and the worktree had drifted to CRLF, so stripping `\r` made the diff vanish. `.gitattributes` now pins `* text=auto eol=lf`. |
| C3 | `cards/cards.json` + 31 `cards/{bounty,smuggler}/*.json` are dead duplicates of en.json *(paths as they were before the move to `assets/cards/`)* | — | **done** — deleted (recoverable from history). Verified unreferenced by any source file, and every one of the 31 differed from `en.json` only by this session's own fixes, so they were stale copies with strictly worse text. `assets/cards/` is now just `en.json` + `uk.json`. |
| C4 | ~250 lines dead code: `main.js:373-571` (old help), `846-896` (old human card) | — | **done** — both commented-out blocks removed (exactly 250 lines), plus the dead `fetch` remnant in `describeCard`. `main.js` 1059 -> 805 lines, 49 KB -> 33 KB. |
| C5 | `justShuffled` is an array property -> dropped by JSON.stringify; ↻ marker never survives reload | `main.js` | **done** — fell out of R1. There is no mid-game reshuffle left to flag, so ↻ now means "this card shuffles back into the deck" and is derived from the card id via `shufflesBackIn()` — no stored state, so it survives reload by construction. |
| C6 | `aiDecks`/`aiHistory` keyed by nickname; duplicate nicknames share a deck | `main.js` | **done** — both are keyed by `character.id`, which `usedCharacters` already keeps unique within a game. `migrateAiKeys()` remaps nickname-keyed saves on restore, so existing games survive. |
| D1 | Two orphan `</strong>` tags in EN `bounty/ig88` (planning[3], action[1]) injected raw into the DOM | `assets/cards/en.json` | **done** — removed; a tag-balance sweep over all 31 cards x 2 locales now reports zero unbalanced `strong`/`em`/`div`/`span`, and every `span.icon` name resolves to a file in `assets/images/assets/`. |
| D2 | Human card: `action` step was missing one `</div>`, so the **encounter** step's `phaseItem` nested *inside* the action step — steps 2 and 3 rendered as one block, the step counter skipped a number, and clicking an encounter action crossed out the action step's bullets (`closest('.phaseItem')` walked up to the wrong step). Present in all 4 variants (both locales x both modes). | `player.*.action` both JSONs | **done** — closed the tag; also swapped the dead `multiplePhaseElements` class for `data-pick="all"`, which R2's handler actually reads, restoring "perform any or all" on the human action step. The earlier D1 tag sweep only covered `smuggler`/`bounty` — **always include `player` when checking markup.** |
| C7 | `replaceIconsWithImages` re-matches its own `img.icon` output and wipes `alt` | `main.js` | **done** — selector narrowed to `span.icon`. It runs twice per render, and an `<img>` has no `textContent`, so the second pass was rewriting every `alt` to `""`. |
| C8 | Solo cap is 2 AI of different types; app allows 3, any mix | `main.js` `addPlayerFromForm` / `populateCharacterDropdown` | **superseded by owner decision (v1.50).** These were hard limits; they are now **confirmations**. The dropdown offers every unused character, and `addPlayerFromForm` warns (then proceeds on OK) for: an expansion character in a base game, a base-mode bounty AI, a 3rd+ AI, and two AI of the same type. The only hard cap left is `maxPlayers` (4). Character uniqueness stays hard - `character.id` keys the decks, histories and selections. |
| — | base-bounty deck branch in `shuffleAiDeck` is unreachable dead code (rules-correct) | `main.js` | **done** — deleted as part of R1. |
| D5 | No way to review every card without playing dozens of games; the `(sm)`/`(bh)` suffix in the character dropdown duplicated its own optgroup heading | `index.html`, `main.js` | **done** — `debug` now comes from `?debug` on the query string instead of a source edit. It lifts the cap to 16 (the whole roster), drops the advisory confirmations in `addPlayerFromForm` so an all-AI table can be seated without nagging, and deals deterministic decks (section 4) — strictly the mode's own composition, never a card the mode does not have. Deck composition was split out into `deckComposition()` so the debug and live paths cannot drift on what a mode's deck contains, and the debug draw bypasses the restored `aiDecks`/`aiHistory` so a save from a randomized game cannot leak old cards into it. `debugSpecial` and the `debug` branch in `shuffleArray` are gone. The character dropdown labels are `Name [base|exp] (sm|bh)`, built by one `label()` helper — the deck marker repeats its optgroup heading deliberately, since the heading scrolls away in a long list and a closed selector shows only the chosen option. Under `debug` the character selector also preselects the topmost remaining option rather than the disabled `-- Select Character --` placeholder, so Add Another can be pressed straight down the roster. |
| D6 | No way to proofread 31 cards x 2 locales against the scans without playing; the unbalanced-tag bug class (D1/D2/D4) was only ever caught by hand | `index.html`, `main.js`, `main.css` | **done** — four debug features, all listed in section 8: (a) `use{Human,Ai}CharacterImages` now follow `debug`, so the photographed card renders beside the transcription — the code already built the `<img>` and threw it away; (b) `validateCardData()` sweeps markup balance, missing entries and icon files on every locale load; (c) `?debug=whole-deck` proof sheet, scan + EN + UK per card; (d) `?debug&ai=…&human=…&mode=…&locale=…` deep links straight into a seated table. Two extractions keep the new paths honest: `cardSectionsHtml()` (shared by the live turn and the sheet) and `deckComposition(type, mode)` + `dealtIn(type, key, mode)`, the latter encoding the verified rule that a base game deals no bounty hunter deck and no character cards. `NAMED_COLORS`/`seatColor()` replaced the random-colour generation so deep links are reproducible. |
| D7 | Phone dims mid-game; a companion app sits untouched for minutes per turn | `index.html`, `main.js`, `main.css` | **done** — opt-in Screen Wake Lock toggle in `#helpControls`, remembered in `localStorage`. Re-acquired on `visibilitychange` (the lock is always dropped when the page hides) and lit from the live lock rather than the preference. Hides itself outside a secure context — **over the current plain-http compose setup it will not appear at all**; needs https to be usable on a phone. |
| R12 | Bounty-hunter encounter bullet narrowed bounty targets to a **face-up** contact, while the planning bullet allowed face-up/face-down; `CARD_AUDIT.md` §2.4 called the defeat cost "invented" | `bounty.*.planning` / `bounty.*.encounter` both JSONs, `CARD_AUDIT.md` | **done** — two corrections, both from the rulebooks. (1) The encounter step no longer limits bounty targets to a face-up contact. **RR p. 24** is explicit: "The AI player **can encounter facedown and faceup** contact tokens. When encountering a facedown contact token, they flip that token faceup … Otherwise, the encounter ends." **RR p. 22** gives one shared definition of a bounty target for both steps, and **RR p. 23** ranks facedown contacts as a real target (4th). The scan of `bounty/1` prints the same parenthetical in step 1b and step 3b — *"(character, crew, or contact)"* — so there was never any card basis for the asymmetry. Final shape (owner's call): the parenthetical is **dropped from the bullet in both steps**; the bullet instead reads "**the lowest-class** bounty target" (UK: "цілі розшуку **найнижчого ґатунку**", keeping the locale's natural postposed form), and all 22 bullets per locale carry one `appNote` with the p. 23 ranking — `character &rarr; crew &rarr; face-up &rarr; face-down contact` (UK: `персонаж &rarr; член екіпажу &rarr; відкритий &rarr; закритий контакт`). (2) §2.4's defeat cost is **not invented**: **RR p. 9** and **LTP p. 12** both state "lose 3,000 credits and discard all of your secrets". Only its *placement* was wrong — it is paid when you become defeated, never as a cost of recovering. The audit now says so, and the rule is back in the app: `player.*.planning` in both locales now reads "Recover all damage from character and ship." card-verbatim, with two `appNote` blocks under it — the mandatory-recovery clause (moved out of the bullet's `<em>` parenthetical) and the cost. Owner chose terse wording — `required **if defeated**` / `spend 3 000 **if defeated**` — which omits the secrets half of RR p. 9's cost and does not restate that the cost is paid on becoming defeated, not on recovering. Deliberate; don't "fix" it without asking. The UK bullet stays at the UK scan's shorter "Зніми усі пошкодження." |
| R13 | Card text had no consistent emphasis: game keywords were plain, icon counts were plain and sat a full space away from their icon, and the "lowest class contact token" sentence was worded five different ways | both JSONs, `main.css` | **done** — three uniformity passes, **both locales**, driven off one script each so EN and UK could not drift. (a) **Icon counts** — every number adjacent to a `span.icon` is wrapped in `<strong class="iconNum">` and the whitespace between number and icon is removed in the data; `.iconNum` is bold + `nowrap`, and `img.icon + .iconNum` / `.iconNum + img.icon` pull the icon's 2px margin back to 0 on the facing side so the pair reads as one token. 76 per locale. Numbers already inside a `<strong>` (the Shortcut favor's "+1 hyperdrive", IG-88's "at least 1 droid") are skipped by a tag-depth check, so nothing nests. (b) **Keywords bold** — `bounty cargo job patrol contact crew gear luxury secret ambition databank navpoint fame reputation` and their UK equivalents (`розшук вантаж халтурка патруль контакт екіпаж спорядження розкіш секрет амбіція банк даних навігаційна точка слава репутація`), bolded wherever they appear in *visible* text: the same depth check skips anything already bold, and an offset mask skips tag interiors and `span.icon` bodies — icon text is only ever the `alt`, so bolding it would show nothing. 352 per locale. `bounty hunter` and the verb `розшукується` are excluded. (c) **One phrasing** for the reveal-a-contact sentence — EN `the <strong>face-down</strong> contact token of the <strong>lowest class</strong> on this planet`, UK `<strong>закритий</strong> жетон контакту <strong>найнижчого ґатунку</strong> на цій планеті` — replacing "lowest-rank … that is face-down", "facedown … of the highest class", "on your planet", and the UK mix of `класу` / `ґатунку`. 9 bullets per locale. ⚠ This deliberately overrides the per-card scan wording in favour of one house phrasing; CARD_AUDIT.md §4.3's `chewbacca` row is the only place the scans actually differ in meaning (highest, not lowest), and that is preserved. Follow-up emphasis pass on the **human player card** (both locales, both modes): the discard count is bold (`up to **2** cards`), `encounter` and `contact` are bold on their own bullets, and the `Play any "…"` card-type lists (`On Player, Ship, Crew, Cargo, Gear, Mod, Secret, Ambition…`) were deliberately **un**-bolded — they name card types as a list, so per-word emphasis there is noise. That pass also repaired EN `player.base.encounter`, the only variant still carrying the inline form `Resolve a space encounter card (Planet, Maelstrom, Navpoint.` — an unclosed paren, and the only one of the four not using the `appNote` list. It now matches the other three. |
| D8 | The `focus` die icon read as roughly twice the size of every other icon | `main.css` | **done** — `focus.png` is 118x73, a 1.6:1 eye, where `crit`/`hit`/`hp` are about 1:1. `img.icon` sizes by `height: 1.2em; width: auto`, so the widest glyph in the set came out ~1.9em across. `img.icon.focus` now sizes by **width** (`1.35em`, `height: auto`) instead, matching the others' footprint. Any future icon wider than ~1.3:1 will need the same treatment — the height-based default only works for near-square glyphs. |
| D9 | The help panel showed three different rulesets (human player, smuggler AI, bounty hunter AI) with nothing on screen saying which one | `main.js`, `main.css`, both JSONs | **done** — new `helpTitle` key in each locale file (`human` / `smuggler` / `bounty`), rendered as a `.helpTitle` bar prepended to `#helpScreen` from the same `playerType` that already filters the fragments, so the header and the content can't disagree. EN "Player rules" / "AI rules — Smuggler" / "AI rules — Bounty Hunter"; UK uses the official terms, "Правила гравця" / "Правила ШтІнту — контрабандист" / "Правила ШтІнту — мисливець за головами". `validateCardData()` now fails a locale that is missing `helpTitle` or any of its three keys, the same way it already guards `phases`. |
| D10 | ⚠ **Regression shipped in `969ed2c`:** the keyword-bolding sweep walked *every* string in the locale file, including `help[].gameMode` / `help[].characterType`. The value `"bounty"` became `"<strong>bounty</strong>"` in **19 EN entries**, so every bounty-hunter help fragment silently stopped matching and disappeared from the panel | `assets/cards/en.json`, `main.js` | **done** — arrays repaired (EN and UK now both yield 2/9/8/8/17/20 fragments across the six mode x playerType combinations). UK was untouched only by luck: its keyword regex is Cyrillic-only, and the filter values are English. **The 12-combination help tripwire did not catch this** — dropping a whole fragment leaves the concatenation perfectly balanced. `validateCardData()` now checks the filter arrays directly: any `<`/`>` in a value, or a value outside `base`/`expansion` and `human`/`smuggler`/`bounty`, is reported. **Rule for any future bulk text pass: exclude `gameMode`/`characterType` — they are filter keys, not prose.** |
| D11 | Enumerations were bolded word-by-word, which read as emphasis on nothing | both JSONs | **done** — owner's rule: **no bold inside a list of things**. Applied to the encounter-card space list (`Planet, Maelstrom, Navpoint, Core Worlds.` / `Планета, Вирвище, Навігаційна точка, Центральні Світи.`), the `Play any "…"` card-type lists, the "Where to gain fame" bullets, and `help[18]`'s named-card list. 7 sites per locale. Emphasis is still used for *conditions* and *labels* (`If defeated`, `Master:`, `same or less`) — the rule is about enumerated items only. |
| R14 | AI cards never showed the defeat cost, although the rules charge AI players the same 3,000 | both JSONs | **done** — all **28** AI planning bullets per locale (`a. If defeated, recover all damage.` / `а. Якщо спіткала невдача, зніми усі пошкодження.`) now carry the same `appNote` the human card got in R12: `spend 3 000 if defeated` / `витрати 3 000 кредитів якщо спіткала невдача`. Sourced from RR p. 25's blanket "obey all rules that apply to normal players" clause — see the bullet in section 4. |

---

### Turn history (v1.49+)

`turnNo` / `turnNoMax` are a **global turn cursor**: turns always cycle through players in
order, so one number fixes both whose turn it is and which of their turns. `seekTurn(T)`
derives `currentPlayerIndex` and every player's `currentCardIndex` from it - player `j`
takes turns at `T = j, j+n, j+2n...`. Back/Forward/Fast-Forward all go through it, so the
two representations cannot drift.

`turnSel[characterId][turnIndex]` records which bullets were ticked, as `"item:bullet"`
keys. **Humans have this too** - it is what gives them a history to rewind through, since
their Player Turn card is otherwise identical every turn. A turn that already has a record
is repainted with `.replay` (blue) rather than the live green; clicking a bullet drops
`.replay` and re-records. Fast-Forward (`»`) appears whenever `turnNo < turnNoMax` and
jumps straight to `turnNoMax`; while it is visible Forward takes `.withFF` and narrows so
both fit the footer row.

---

## 7. Working agreements

- **This is a phone app first** (tablet second). Fitting a whole turn on **one screen
  without scrolling** is a top-priority design goal. Judge every layout change at phone
  width, not in a desktop window.
  - Reference device: `assets/ref_docs/swor_automa_phone_screen_reference.jpg`
    (810x1800 device px, ~338x638 CSS with browser chrome, ~338x750 in fullscreen).
  - **It fits in fullscreen, not in a browser tab** — that is what the header's
    fullscreen button is for. The densest view is the *human* Player Turn card
    (~700px); AI turns are shorter.
  - Space was reclaimed in v1.44-1.46 by: deleting `#cardDisplay { min-height: 80vh }`
    (it could only ever force scrolling), trimming `.cardFooter` to `5px 0 0` and its
    reserve to 45px, tightening `.phaseItem` padding and the bullet indents, shrinking
    `img.icon` to 1.2em, and demoting long qualifiers to `appNote` sub-lines.
  - **Tried and rejected:** collapsing the `appNote` sub-lines behind a tap. It fits in
    one screen (404px) but the owner preferred the detail always visible. Shrinking the
    type (16->14px) was considered and proved unnecessary once fullscreen was used.
- **Every content change lands in BOTH locales.** `assets/cards/en.json` and
  `assets/cards/uk.json` are two views of the same cards, so any edit to wording,
  emphasis, bullet structure, `appNote` blocks or markup must be applied to both in the
  same pass — never "EN now, UK later". The only legitimate divergences are the ones the
  *scans themselves* differ on (e.g. the UK player card prints "Зніми усі пошкодження."
  where the EN one prints "…from character and ship"), and those belong in CARD_AUDIT.md.
  After any such pass, re-run the two tripwires: per-string tag balance across
  `player`/`bounty`/`smuggler`, and `help` balance over the **12** locale x mode x
  playerType combinations (section 8, D4) — per-entry `help` balance is meaningless.
- **Never `git commit` (or push) without asking first.** Make the changes, show what
  changed, and wait for an explicit go-ahead. This holds even for changes the owner
  clearly asked for — the commit itself is a separate decision.
- **Commit messages: 12 words maximum**, whenever the change can be described that
  briefly. One line, no body, imperative mood. Detail belongs in this file, not in the
  log — the worklog in section 6 is where the reasoning and the sources go.
- **Never add a `Co-Authored-By` trailer**, or any other attribution/generated-by line.
- **Bump `version` in `index.html` on every change**, following semver:
  - **PATCH** (`1.36.0` -> `1.36.1`) — bug fix, card-text correction, dead-code removal,
    anything that doesn't change how the app behaves for a correct user.
  - **MINOR** (`1.36.0` -> `1.37.0`) — new or changed behaviour that existing saves
    survive: new validation, a changed AI rule, new help content.
  - **MAJOR** (`1.36.0` -> `2.0.0`) — a change existing saves *don't* survive, i.e. any
    change to the `gameSave` shape without a migration.

  This string is also the cache-buster appended to `main.js`, `main.css` and
  `assets/cards/*.json`, so it must change whenever any of those change or clients keep the
  stale file. Versions before `1.36.0` were bumped as plain `1.NN` and are not semver.
- The owner may override a rules finding with a house rule. When that happens, record it
  in section 4 with a ⚠ box and say so in the worklog row, so a later pass doesn't
  "correct" it back. See R1.

---

## 8. Code gotchas

- **Cache busting is manual.** Bump `version` in `index.html` after changing
  `main.js` / `main.css` / `assets/cards/*.json`, or clients keep the old files.
- **Debug mode is `?debug` on the URL** (`index.html?debug`), not a source edit. The old
  `debugSpecial` flag is gone; "character card every turn" is now what a second AI of a
  type does on its own. What `?debug` changes, all of it:

  | what | where |
  |---|---|
  | `maxPlayers` 4 → 16 (the whole roster) | `index.html` |
  | character selector preselects the topmost free option | `populateCharacterDropdown` |
  | setup confirmations skipped — except base+bounty (`noDeckExists`) | `addPlayerFromForm` |
  | red `DEBUG` badge by the version (setup screens only — `#mainTitle` hides in play) | end of `main.js` |
  | AI decks unshuffled and mode-exact | `shuffleAiDeck` (section 4) |
  | drawn card = pure function of the turn index, ignoring `aiDecks`/`aiHistory` | `showTurn` AI branch |
  | `triggersReshuffle()` disabled | `triggersReshuffle` |
  | card scan rendered beside the transcription | `use{Human,Ai}CharacterImages = debug` |
  | card data validated on every locale load | `validateCardData` |
  | cache-buster `&_=<random>` on js/css/json **and every image** | `index.html` |

  Two URL forms do more than toggle flags:
  - **`?debug=whole-deck`** — the proof sheet (below). Opens instead of a game: no setup
    screens, no saved-game prompt.
  - **`?debug&ai=han,boba&human=erso&mode=base&locale=en`** — `autoSetupFromQuery()` seats
    that exact table and starts it, skipping both setup screens and the saved-game prompt,
    so a finding is reproducible from a URL. `ai`/`human` take comma-separated
    **character ids** (the `characters[]` table at the top of `main.js`); unknown or
    already-seated ids are warned about and skipped, and if nothing usable is left it
    falls through to the normal setup screen. Colours come from `seatColor(i)`, which is
    deterministic so the same link always looks the same.

### Keeping the screen awake

`#keepAwakeToggle` in `#helpControls` takes a **Screen Wake Lock**, remembered in
`localStorage['keepAwake']`. It lives in that bar because the bar overlays the turn title
while help is open and so costs no vertical space (section 7).

Two things the code has to respect, both already handled:

- **It needs a secure context.** Over plain http — which `docker-compose.yml` serves
  (`VIRTUAL_PROTO: http`) — `navigator.wakeLock` is simply absent, so the button hides
  itself and logs why rather than presenting a dead control. **On the phone this feature
  only works if the vhost proxy is reached over https.**
- **The lock is always released when the page is hidden.** So it is re-acquired on every
  `visibilitychange` back to visible. The button is lit from `wakeLock`, not from the
  preference, so it never claims a lock the OS has dropped.

### `validateCardData()` — the D1/D2/D4 tripwire

Runs on every locale load under `?debug`, and again (for both locales) when the proof
sheet opens. It exists because three separate worklog rows were the same bug — an
unbalanced tag swallowing the rest of a panel — each found by hand after shipping. It
reports:

- **tag balance per authored string** for every card section and the human Player Turn
  card. `help` is *excluded* here, because its entries are fragments that only balance
  once concatenated…
- **…so `help` is checked per `(gameMode × characterType)` combination instead** — the six
  concatenations the panel actually renders. This is exactly the D4 shape: every
  individual entry looked fine and four combinations were broken.
- **missing entries** — every card `deckComposition()` can deal in either mode, plus every
  character card, plus the four `phases` keys.
- **icon files** — each distinct `span.icon` name is probed with an `Image()`. Loading the
  file is the only existence test available to the page, so these arrive *after* the
  synchronous report; `checkIcons(data, loc, onLate)` takes the handler. The proof sheet
  passes one that appends to its own `#proofLate` block, so the report can never say
  "clean" while an icon is missing.

Fault-injected against all five historical shapes (D1's orphan `</strong>`, D2's dropped
`</div>`, D4's extra `</div>`, a deleted card, a bogus icon name) — all caught, and both
shipped locales report clean with no false positives.

### `?debug=whole-deck` — the proof sheet

Every card in the data on one scrollable page: **scan, EN and UK side by side**, which is
the section-2 audit (scans are the source of truth, the JSON is the thing being corrected)
in the shape that audit actually wants. It is an *inventory*, not a deck — all 10 smuggler
numbers, all 5 bounty numbers and all 16 character cards are always listed, each badged
`in deck` / `not dealt in <mode>` via `dealtIn()`, with a button to flip the mode. Cards
the mode does not deal are dimmed rather than hidden, so nothing can be silently missing.

`cardSectionsHtml(data, cardFileName, phases)` was extracted out of `describeCard` for
this: the live turn and the sheet render a card through the same function, so they cannot
drift. It is a desktop view and deliberately steps outside the 450px phone frame (it still
collapses to one column under 800px).
- Card text is raw HTML injected via `innerHTML` / `insertAdjacentHTML`. Icons are
  `<span class="icon NAME">label</span>` and get swapped for `assets/images/assets/NAME.png`.
  The icon name must be the **second** class.
- Saved games live in `localStorage['gameSave']`; schema is whatever `saveGameState()`
  writes. Changing player/deck shape breaks restores — bump/guard if you do.
- There are no tests and no build step. Verify by loading `index.html` (or `./start.sh`).

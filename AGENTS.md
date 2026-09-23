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

### Other verified points
- AI players **cannot complete personal goals or ship goals** (RR p. 22) — the
  personal-goal toggle rendered for AI turns at `main.js:813` shouldn't exist.
- Starting ships: smuggler AI = G9 Rigger, bounty AI = G-1A Starfighter. ✓ app correct.
- Favors are **expansion-only AND forbidden in single-player** ("The favors optional rule
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
| R4 | Favors help entry tagged any-mode; expansion-only + banned in solo; Shortcut text has copy-paste tail | `help[7]` both JSONs | **done** — retagged `gameMode: ["expansion"]` and the entry now says plainly it cannot be used solo (**RR**: "The optional favor rules cannot be used for a single-player game"; **UB p. 8**: "Favors: The favors optional rule cannot be used"). All four favors retranscribed from RR/UB. Beyond the known copy-paste tail, Shortcut had a second error: it granted **+1 speed** where both rulebooks say **+1 hyperdrive** — see D3. Added the limits RR states (any number requested, only 1 received, never from yourself, not after dice are rolled). |
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
- `debug`/`debugSpecial` in `index.html` change deck behaviour: `shuffleArray` returns the
  array **unshuffled** when `debug` is true, and `['special']` when `debugSpecial` is true.
- Card text is raw HTML injected via `innerHTML` / `insertAdjacentHTML`. Icons are
  `<span class="icon NAME">label</span>` and get swapped for `assets/images/assets/NAME.png`.
  The icon name must be the **second** class.
- Saved games live in `localStorage['gameSave']`; schema is whatever `saveGameState()`
  writes. Changing player/deck shape breaks restores — bump/guard if you do.
- There are no tests and no build step. Verify by loading `index.html` (or `./start.sh`).

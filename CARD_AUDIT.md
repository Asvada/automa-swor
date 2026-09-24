# CARD_AUDIT.md — card text vs. the scans

Companion to [AGENTS.md](AGENTS.md). Audit of `assets/cards/{en,uk}.json` against the
card scans in `assets/images/`, per the source-of-truth order in AGENTS.md §2: **the
scans win over the rulebooks, and both win over the JSON.**

Status: **complete** — all 31 AI cards and all 4 player cards read against their scans.
**Group (b) fixes applied; group (a) marked as app notes (see §5).** Remaining: the
Ukrainian terminology pass in §3 (worklog R9).

---

## 1. Coverage — neither locale can be fully verified

The scans are a mix of printings and languages, so each locale is only partly checkable
word-for-word. The rest is a *translation* with no scan to check against.

| scan set | language | verifies | NOT verifiable from a scan |
|---|---|---|---|
| `smuggler/1..10` | UK | `uk.json` smuggler 1–10 | `en.json` smuggler 1–10 |
| `bounty/1..5` | EN | `en.json` bounty 1–5 | `uk.json` bounty 1–5 |
| `{smuggler,bounty}/<char>` (16) | EN | `en.json` character cards | `uk.json` character cards |
| `player/base {a,b}` | UK | `uk.json` player/base | `en.json` player/base |
| `player/expansion {a,b}` | EN | `en.json` player/expansion | `uk.json` player/expansion |

So: **21 of 31** AI cards verify EN directly, **10 of 31** verify UK directly; player
cards verify one locale each. Everything else is checkable only for internal consistency
and official terminology.

---

## 2. Systematic findings — apply to BOTH locales, nearly every card

### 2.1 Movement sub-rules are on no card at all
29 of 31 cards carry a `phaseSubElement` about navpoints, and **all 31** carry one about
the Maelstrom:

> "If you would stop at a navpoint and passed through a planet no more than 2 spaces
> away, return to that planet." / "Do not stop on Maelstrom."

No scan shows these. `smuggler/1` reads only **"б. Рухайся до найближчого жетона мети."**;
`bounty/boba` and `bounty/ig88` read only **"b. Move toward a bounty target (character,
crew, or contact)."** These are real rules (RR p. 23) that a transcriber attached to every
"move" bullet. They also duplicate `help[11]` (Movement). **Editorial addition, not card
text.**

### 2.2 The human card carries four bullets where the card prints three
Every step of the player card has an extra final bullet, on none of the scans:
`Play any "Planning"/"Action"/"Encounter" on Player, Ship, Crew, …`

### 2.3 Human encounter bullets are embellished
| scan (`player/expansion a`) | `en.json` |
|---|---|
| "Resolve an encounter card." | "Resolve a space encounter card (Planet, Maelstrom, Navpoint, Core Worlds)." |
| "Resolve a contact token." | "Encounter facedown contact (resolve a databank card) or fight bounty." |

### 2.4 Defeat cost is misplaced, not invented (worklog R5 — corrected 2026-09-24)
Both player scans print the recovery bullet as a single line with a **required** clause:

- EN: "Recover all damage from character and ship **(required if you are defeated)**."
- UK: "Зніми усі пошкодження **(обов'язково, якщо тебе спіткала невдача)**."

The JSON dropped "required" and instead attached two sub-bullets that appear on **neither**
card: "Pay 3,000 (if defeated)" and "Lose all secret cards (if defeated)".

⚠ **The cost itself is a real rule** — this section previously called it "invented", which
was wrong. Two sources state it:

> **RR p. 9, "Defeated":** "When a player becomes defeated: · The player loses 3,000 credits
> (or all of their credits if they have fewer than 3,000). · The player discards all of
> their secrets."

> **LTP p. 12, "Defeated":** "Tip your character standee over in your current space. Then
> lose 3,000 credits and discard all of your secrets (place the encounter cards on the
> bottom of their respective decks)."

What was wrong is the **timing and the placement**: the cost is paid **at the moment of
defeat**, as part of becoming defeated — not during the planning step, and not as a price
for recovering. Hanging it off the recovery bullet said the opposite. Recovery itself is
the only thing the planning step owns, and it is **mandatory** (RR p. 9, LTP p. 12).

So the sub-bullets were right to leave the recovery bullet, but the rule they carried is
group **(a)**, not group **(b)**: a correct rule in the wrong place.

**Reinstated 2026-09-24 (worklog R12).** The recovery bullet is now card-verbatim without
the parenthetical, and both facts hang off it as marked `appNote` blocks — the mandatory
clause first, then the cost, stated with the timing the rulebooks give:

> Recover all damage from character and ship.
> ℹ required **if defeated**
> ℹ spend 3 000 **if defeated**

⚠ Owner's wording, deliberately terse. Two things it does not say, both known and accepted:
the **secrets** half of the cost (RR p. 9: "discards all of their secrets") is not shown,
and the note sits under the recovery bullet, so it still reads as if the 3,000 were paid
during the planning step rather than at the moment of defeat. The timing is recorded here
and in section 4 of AGENTS.md instead.

---

## 3. Ukrainian — official wording

`uk.json` uses non-official terminology throughout. Counts are occurrences in `uk.json`;
the official column is what `swor-base-ukr.pdf` and the UK card scans actually use.

| concept | official (count in UK rulebook) | `uk.json` uses | hits |
|---|---|---|---|
| space | **терен** (68) | простір | 87 |
| AI player | **ШтІнт** (79) | ШІ | 13 |
| defeated | **спіткала невдача** (20) | переможений | 34 |
| goal token | **жетон мети** (10) | жетон цілі | 15 |
| job | **халтурка** (52) | завдання | 29 |
| illegal | **протизаконний** (15) | незаконний | 9 |
| trade | **уклади угоду** (7) | обміняйся картами | 2 |
| hyperdrive | **гіперпривід** (8) | швидкість | *fixed, D3* |

**Applied — all of it (worklog R9).** ~740 replacements; a residual sweep for every
non-official form now returns **0**. Two more style issues, also fixed:

- **111 bullets use ви-form** (`купіть`, `витратьте`, `помістіть`, `зіткніться`…). Every
  UK card scan uses **ти-form**: `купи`, `заплати`, `поклади`, `здобудь`, `зніми`.
- **Lettering is Latin `a. b. c. d.`**; the UK cards use Cyrillic **`а. б. в. г.`**.

---

## 4. Per-card findings

### 4.1 Player cards — all four read

`player/base a` (UK) vs `uk.json player/base`:

| scan | `uk.json` |
|---|---|
| "Порухайся в межах значення ⟨hyperdrive⟩ твого корабля" | "Рухайся в межах гіперприводу твого корабля." |
| "Зніми усі пошкодження (обов'язково, якщо тебе спіткала невдача)" | + invented Pay/Lose sub-bullets, "переможений" |
| "Достав вантаж і **втікачів**" | "Достав вантаж та розшуку" |
| "Можеш **прокрутити** колоду ринку" | "Можеш **скинути карту** з верху колоди ринку" |
| "**Уклади угоду** з гравцем у твоєму **терені**" | "**Обміняйся картами** з гравцем у твоєму **просторі**" |
| "Відкрий карту зустрічей" / "Відкрий контакт" | embellished, see §2.3 |

`player/expansion a` (EN) vs `en.json player/expansion`: matches except §2.2, §2.3, §2.4,
and the card labels the market sub-steps **"Step 1:" / "Step 2:"**, which the JSON drops.

`player/base b` (UK) is the source of `help[6]` (Де здобути славу) — **matches the scan
well** — and `help[5]` (Перевірка майстерності), which does not:

| scan | `help[5]` |
|---|---|
| "Подивись, скільки разів у тебе вказано навичку, яку перевіряєш." | "Порахуй кількість згадок навички… (у персонажа та у всіх членів екіпажу)." |
| "**Падаван:** ⟨crit⟩ (навички немає)" | "**0 навичок**: ⟨crit⟩ (Падаван)." — order inverted |
| — | **typo `Дпя` for `Для`**, in `en.json` only — *fixed* |

`player/expansion b` (EN) is the source of `help[4]` and `help[7]` — see §4.2.

### 4.2 ⚠ help[7] Favors — an error introduced by this audit, since reverted

The R4 pass rewrote the four favors using **Rules Reference** wording. That was wrong:
`player/expansion b.png` prints them, so the card wins. The original JSON was
**card-verbatim** and has been restored. Only three things were ever wrong with it:

1. Shortcut had a `"reputations until end of turn"` copy-paste tail — removed.
2. Its icon was labelled `speed`; the card prints the **hyperdrive** icon — fixed (D3).
3. `gameMode` was `[]`; favors are expansion-only — retagged.

The solo ban (RR: *"The optional favor rules cannot be used for a single-player game"*)
is a **rulebook** fact, not card text, so it is now a marked note rather than edited into
the card's wording.

`help[4]` Player Bounty Rewards **matches its scan**, with one typo fixed
(`repoutation` → `reputation`). Note R7's "must choose a faction the AI does not have
positive reputation with, if possible" is **not on this card** — it is an AI-only
clarification from RR p. 24 and belongs in AI help, not here.

### 4.3 AI cards — all 31 read

**Card-specific defects** (beyond the systematic ones in §2/§3). Everything below was
read off the scan, not inferred:

| card | defect | severity |
|---|---|---|
| `bounty/4` | **A whole encounter bullet is missing.** The card lists **five** (a–e); the JSON has four. Missing: *"Encounter a bounty target (character, crew, or contact) in this space."* — the card's bullet **c**. | **high** — in a "do the first that applies" walk, dropping a higher-priority bullet changes what the AI does |
| `bossk` | Card: *"Move toward nearest other undefeated **player**"*. JSON: *"nearest undefeated **character**"* | **high** — different target set |
| `maz` | Card **instructs** *"**Buy** ⟨luxury⟩. If Maz Kanata **buys** a card, she gains 1 fame."* JSON turns it into a condition — *"If Maz **can buy** a luxury card - she **additionally** gains 1 fame"* — and drops the buy instruction entirely | **high** — the purchase never happens |
| `dengar` | JSON invents *"— if reachable by Dengar's ship ⟨hyperdrive⟩"*. Card says *"Move **directly** to the space"*, with no reachability condition | **high** |
| `dengar` | JSON invents *"(across all of the world)"* on the reputation-loss bullet | medium |
| `bounty/3` | JSON invents *"anywhere in the world"* on the discard bullet | medium |
| `smuggler/4` | JSON appends *"Якщо вантаж незаконний, персонаж отримує 2 пошкодження."* — card's action bullet is only *"Якщо ти в пункті призначення вантажу, достав його."* | medium |
| `bossk` | Bullets lettered **a. b. b. d.** — duplicate `b.`, no `c.` | low |
| `hondo` | *"Move toward **closes** Player … reach their **space goal**"* — card: *"nearest other player … reach their **space**"* | low |
| `krrsantan` | *"Recover 2 damage."* — card: *"Recover 2 damage **from Black Krrsantan**."* | low |
| `afra` | `"Otherwise,buy"` — missing space | cosmetic |
| `han` | `"Buy a ship card ."` — stray space before the period | cosmetic |
| `bounty/1` | *"even if **in** navpoint"* — card: *"even if **at a** navpoint"* | cosmetic |
| `chewbacca` | *"highest-**rank** contact token … gain this contact as a crew member"* — card: *"highest **class** … gain **the crew on its card**"* | cosmetic |

**A further systematic embellishment on every bounty-hunter card:** the cards all say
plainly **"(character, crew, or contact)"**; the JSON expanded this inline to
*"(character, crew, face-up/face-down contact)"* in planning and narrowed it to
*"face-up contact"* in encounter.

⚠ **The encounter step used to narrow it further, to "face-up contact". That was wrong**
and is fixed (worklog R12, 2026-09-24). Three passages settle it:

- **RR p. 22, "Bounty Targets":** "A bounty target is a character, crew, or contact that
  matches one of the AI player's bounties. If the AI player has a bounty that does not
  match any character, crew, or faceup contact token on the map, the nearest facedown
  contact token that matches that bounty's class … is considered to match that bounty."
  One definition, serving both the move-toward and the encounter bullet.
- **RR p. 23, target priority:** 1. Character 2. Crew 3. Faceup contact of the lowest class
  4. **Facedown contact of the lowest class.**
- **RR p. 24, "Bounty Encounters" → Contact Tokens:** "The AI player **can encounter
  facedown and faceup** contact tokens. When encountering a facedown contact token, they
  flip that token faceup. If the contact matches one of their bounties, they resolve an
  unopposed bounty. Otherwise, the encounter ends."

The last one is decisive and is specifically about the encounter step: a facedown token is
encountered, flipped, and the encounter fizzles on a non-match.

**How it reads now (owner's call, 2026-09-24):** the parenthetical is gone from the bullet
in *both* steps. The bullet carries the p. 23 class qualifier — "Move toward **the lowest-class**
bounty target." / "Encounter **the lowest-class** bounty target in this space." (UK:
"…цілі розшуку **найнижчого ґатунку**") — and the target list lives entirely in one
`appNote` below it, as the ranking rather than a flat list:

> ℹ character → crew → face-up → face-down contact

Note the p. 22 condition still applies to both steps: a facedown token counts as a bounty
target only when nothing else on the map matches that bounty.

**Cards that match their scan** (systematic issues aside): `smuggler/3,5,6,7,8,9`,
`bounty/2,5`, `boba`, `ig88`, `bane`, `ketsu`, `enfys`, `erso`, `han`, `hera`, `lando`,
`chewbacca`, `afra`.

Also confirmed: `bounty/2` genuinely has its own **SPECIAL** section on the card (it is
not a character card) and it does **not** carry the self-shuffle line — so the app is
right not to treat card 2 as a reshuffle trigger.

---

## 5. Two kinds of "extra text" — a decision, not just a bug list

§2.1, §2.2, §2.3 and the "contact" expansions above are all the same shape: **text in the
JSON that is not on the card.** They split into two groups, and they want different
treatment:

**(a) Deliberate-looking play aids.** The `Play any "Planning"/"Action"/"Encounter" on
Player, Ship, Crew, …` bullets, the navpoint/Maelstrom movement reminders, the
Planet/Maelstrom/Navpoint/Core-Worlds list on the human encounter bullet. These are
*correct rules*, added as reminders. They duplicate `help[11]`, and they make the app's
cards longer than the physical ones — but removing them is a **product decision**, not a
correction.

**(b) Straight transcription errors.** Everything in the §4.3 table. These contradict the
card and should simply be fixed. §2.4's defeat cost was originally filed here; it belongs in
(a) — the rule is real (RR p. 9, LTP p. 12), only its placement was wrong.

**Both were applied** (owner's call, 2026-09-23):

- **(b) fixed outright.** Every row of the §4.3 table plus §2.4's misplaced defeat cost.
  `bounty/4` regained its missing encounter bullet and was re-lettered a–e; `bossk`'s
  duplicate `b.` became `c.`; `maz` regained the "Buy ⟨luxury⟩" instruction.
- **(a) kept, but marked.** The reminders stay for convenience and are tagged `appNote`
  so they render dimmed and ℹ-prefixed — visibly the app's notes, not card text.
  - *Movement reminders and encounter-type lists* are `phaseSubElement appNote`:
    annotations hanging off a bullet, not choices.
  - *The `Play any "Planning"/"Action"/"Encounter" …` bullets are full, selectable
    actions* (`phaseNElement phaseElement appNote`). Playing a timing card really is an
    alternative that consumes the step, so in the choose-1 Planning and Encounter steps
    picking it **must** cross out the others; in the any-or-all Action step it toggles
    independently. It renders with the **normal bullet**, identical to a printed one —
    the `appNote` class is kept only as a marker in the data.

Counts: 64 movement reminders and 12 "play any X" bullets tagged across both locales,
plus 7 encounter-type lists moved out of the bullet text and into notes.

**§3, the Ukrainian terminology pass, is also done** (R9). Beyond the term swaps, the
repeated bullets were aligned verbatim to the UK scans, so e.g. every one of
`smuggler/1`'s nine bullets now matches the printed card word for word.

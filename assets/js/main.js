$('document').ready(function () {
    let cardsData = null;

    let minPlayers = 1;
    const characters = [
        {name: "Cad Bane", origin: "expansion", type: "bounty", image: "bane.png", id: "bane"},
        {name: "Boba Fett", origin: "base", type: "bounty", image: "boba.png", id: "boba"},
        {name: "Bossk", origin: "base", type: "bounty", image: "bossk.png", id: "bossk"},
        {name: "Dengar", origin: "expansion", type: "bounty", image: "dengar.png", id: "dengar"},
        {name: "IG-88", origin: "base", type: "bounty", image: "ig88.png", id: "ig88"},
        {name: "Ketsu Onio", origin: "base", type: "bounty", image: "ketsu.png", id: "ketsu"},
        {name: "Black Krrsantan", origin: "expansion", type: "bounty", image: "krrsantan.png", id: "krrsantan"},
        {name: "Doctor Aphra", origin: "base", type: "smuggler", image: "afra.png", id: "afra"},
        {name: "Chewbacca", origin: "expansion", type: "smuggler", image: "chewbacca.png", id: "chewbacca"},
        {name: "Enfys Nest", origin: "expansion", type: "smuggler", image: "enfys.png", id: "enfys"},
        {name: "Jyn Erso", origin: "base", type: "smuggler", image: "erso.png", id: "erso"},
        {name: "Han Solo", origin: "base", type: "smuggler", image: "han.png", id: "han"},
        {name: "Hera Syndulla", origin: "expansion", type: "smuggler", image: "hera.png", id: "hera"},
        {name: "Hondo Ohnaka", origin: "expansion", type: "smuggler", image: "hondo.png", id: "hondo"},
        {name: "Lando Calrissian", origin: "base", type: "smuggler", image: "lando.png", id: "lando"},
        {name: "Maz Kanata", origin: "expansion", type: "smuggler", image: "maz.png", id: "maz"}
    ];

    let players = [];
    let usedCharacters = [];
    let currentPlayerIndex = 0;
    let playerCounter = 1;
    let gameMode = 'expansion';
    let locale = 'uk';
    let aiDecks = {};
    let aiHistory = {};
    // Which phase bullets were ticked, per player, per turn they have taken.
    // turnSel[characterId][turnIndex] = ["<phaseItemIdx>:<bulletIdx>", ...]
    // Its length is that player's turn count, for humans as well as AI - which is what
    // gives human players a history to rewind through.
    let turnSel = {};
    // Global turn cursor. Turns always cycle through players in order, so one number
    // fixes both whose turn it is and which of their turns - and lets Fast-Forward jump
    // straight to the frontier instead of stepping.
    let turnNo = 0;
    let turnNoMax = 0;

    initCards();

    const saved = loadGameState();

    if (debugWholeDeck) {
        // A card review, not a game: no setup screens and no saved-game prompt.
        document.getElementById('mainTitle').classList.add('hidden');
        openWholeDeckSheet();
    } else if (autoSetupFromQuery()) {
        // The URL described the table; it has already been seated and started.
    } else if (saved) {
        const date = new Date(saved.savedAt).toLocaleString();

        const $promptDiv = $('<div>', {
            css: {
                position: 'fixed',
                top: '80px',
                width: '85%',
                maxWidth: '400px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#eee',
                border: '2px solid #666',
                padding: '15px',
                zIndex: 1000,
                textAlign: 'center'
            },
            html: `
                <div style="color: #111111">
                    Continue saved game from <br><strong>${date}</strong> ?
                </div>
                <div style="margin-top:10px;">
                    <button id="continueGame">Continue</button>
                    <button id="newGame">New Game</button>
                    <button id="fullscreen">Go Fullscreen</button>
                </div>`
        });

        $('body').append($promptDiv);

        $('#fullscreen').on('click', enterFullscreen);

        $('#continueGame').on('click', function() {
            $promptDiv.remove();
            restoreGame(saved);
        });

        $('#newGame').on('click', function() {
            clearGameState();
            $promptDiv.remove();
            startNewGame();
        });

    } else {
        startNewGame();
    }


    function saveGameState() {
        const data = {
            players,
            usedCharacters,
            currentPlayerIndex,
            playerCounter,
            gameMode,
            aiDecks,
            aiHistory,
            turnSel,
            turnNo,
            turnNoMax,
            savedAt: new Date().toISOString(),
            locale
        };
        localStorage.setItem('gameSave', JSON.stringify(data));
    }

    function loadGameState() {
        const saved = localStorage.getItem('gameSave');
        return saved ? JSON.parse(saved) : null;
    }

    function clearGameState() {
        localStorage.removeItem('gameSave');
    }


    async function restoreGame(saved) {
        players = saved.players || [];
        usedCharacters = saved.usedCharacters || [];
        currentPlayerIndex = saved.currentPlayerIndex || 0;
        playerCounter = saved.playerCounter || 1;
        gameMode = saved.gameMode || 'expansion';
        locale = saved.locale || 'uk';
        aiDecks = saved.aiDecks || {};
        aiHistory = saved.aiHistory || {};
        turnSel = saved.turnSel || {};   // absent in saves made before selections existed
        // Saves from before the cursor existed: treat where they left off as the frontier.
        const n0 = (saved.players || []).length || 1;
        turnNo = (saved.turnNo !== undefined) ? saved.turnNo
            : Math.max(0, ...(saved.players || []).map(p => p.currentCardIndex || 0)) * n0
              + (saved.currentPlayerIndex || 0);
        turnNoMax = (saved.turnNoMax !== undefined) ? saved.turnNoMax : turnNo;
        migrateAiKeys();
        await initCards();

        document.getElementById('step1').classList.add("hidden");
        document.getElementById('step2').classList.add("hidden");
        document.getElementById('gameStep').classList.remove("hidden");
        document.getElementById('mainTitle').classList.add("hidden");
        showTurn();
    }

    // Saves written before AI state was keyed by character id are keyed by nickname.
    // Character ids are unique within a game, so the remap is unambiguous.
    function migrateAiKeys() {
        players.filter(p => p.type === "ai").forEach(p => {
            const id = p.character.id;
            if (aiDecks[id] === undefined && aiDecks[p.nickname] !== undefined) {
                aiDecks[id] = aiDecks[p.nickname];
                delete aiDecks[p.nickname];
            }
            if (aiHistory[id] === undefined && aiHistory[p.nickname] !== undefined) {
                aiHistory[id] = aiHistory[p.nickname];
                delete aiHistory[p.nickname];
            }
        });
    }

    // Returns the request so callers can await it: showTurn() reads cardsData, and
    // firing this without waiting left cardsData null on a fast restore. The guard
    // drops a response whose locale is no longer the selected one - the warm-up load
    // at startup races the one startGame() issues after the locale is picked.
    function initCards(){
        const requested = locale;
        return $.getJSON('./assets/cards/'+requested+'.json?'+version)
            .done(function (response) {
                if (requested !== locale) return;
                cardsData = response;
                if (debug) validateCardData(response, requested);
            })
            .fail(function () {
                console.error('Failed to load card data for locale: ' + requested);
            });
    }

    function startNewGame() {
        document.getElementById('step1').classList.remove("hidden");
        document.getElementById('step2').classList.add("hidden");
        document.getElementById('gameStep').classList.add("hidden");
    }

    const addAnotherBtn = document.getElementById("addAnother");
    const mainTitle = document.getElementById("mainTitle");
    const container = document.getElementById("container");

    document.getElementById("nextToPlayers").addEventListener("click", () => {
        gameMode = document.getElementById("gameMode").value;
        locale = document.getElementById("locale").value;
        populateCharacterDropdown();
        populateColorDropdown();
        document.getElementById("step1").classList.add("hidden");
        document.getElementById("step2").classList.remove("hidden");
        updatePlayerForm();
    });

    function populateCharacterDropdown() {

        $('#randomCharacter').off('click').on('click', function (e){
            e.preventDefault();
            const $select = $('#playerCharacter');
            let options = $select.find('option:not(:disabled)').toArray();

            // A second AI should be the other type (UB p. 11). Since the dropdown now
            // offers everything, steer the random pick rather than let it land on a
            // combination that would immediately ask for confirmation. It is only a
            // preference: if no character of the wanted type is free, fall back to all.
            if (document.getElementById("playerType").value === "ai") {
                const ais = players.filter(p => p.type === "ai");
                if (ais.length) {
                    const taken = new Set(ais.map(a => a.character.type));
                    const preferred = options.filter(o => {
                        const c = characters.find(ch => ch.name === o.value);
                        return c && !taken.has(c.type);
                    });
                    if (preferred.length) options = preferred;
                }
            }

            const pick = options[Math.floor(Math.random() * options.length)];
            if (pick) $select.val(pick.value).change();
        });

        const select = document.getElementById("playerCharacter");
        select.innerHTML = "";
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "-- Select Character --";
        emptyOption.disabled = true;
        emptyOption.selected = true;
        select.appendChild(emptyOption);

        // "Name [base] (sm)" - which box the character ships in, then which AI deck
        // they run. Brackets vs parens keep the two markers apart at a glance. The deck
        // marker repeats its optgroup heading on purpose: the heading scrolls out of
        // view in a long list, and the closed selector shows only the chosen option.
        const label = c => `${c.name} [${c.origin === "expansion" ? "exp" : "base"}] `
            + `(${c.type === "smuggler" ? "sm" : "bh"})`;

        const type = document.getElementById("playerType").value;
        // Every unused character is offered. The game-version and AI-count/type rules
        // are confirmations in addPlayerFromForm now, not filters - a character can only
        // be excluded here for being already taken, which is structural (ids key the
        // decks, histories and selections).
        const allowed = characters.filter(c => !usedCharacters.includes(c.name));
        const smugglers = allowed.filter(c => c.type === "smuggler").sort((a, b) => a.name.localeCompare(b.name));
        const bounty = allowed.filter(c => c.type === "bounty").sort((a, b) => a.name.localeCompare(b.name));

        if (smugglers.length > 0) {
            const group = document.createElement("optgroup");
            group.label = "Smugglers";
            smugglers.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.name;
                opt.textContent = label(c);
                group.appendChild(opt);
            });
            select.appendChild(group);
        }
        if (bounty.length > 0) {
            const group = document.createElement("optgroup");
            group.label = "Bounty Hunters";
            bounty.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.name;
                opt.textContent = label(c);
                group.appendChild(opt);
            });
            select.appendChild(group);
        }

        // Debug mode seats the whole roster, so the "-- Select Character --" step is
        // pure friction: preselect the topmost remaining character instead. The list is
        // rebuilt after every add (taken characters drop out), so repeatedly pressing
        // Add Another walks straight down it without touching the selector.
        if (debug) {
            const first = select.querySelector("option:not(:disabled)");
            if (first) select.value = first.value;
        }
    }

    const NAMED_COLORS = [
        {value: "#FF4C4C", name: "Red"},
        {value: "#4C9EFF", name: "Blue"},
        {value: "#4CFF4C", name: "Green"},
        {value: "#FFD74C", name: "Yellow"}
    ];

    // Colour for seat i. The four named ones first, then a deterministic hue walk -
    // deterministic so a debug deep link seats the same colours on every load.
    function seatColor(i) {
        return i < NAMED_COLORS.length
            ? NAMED_COLORS[i].value
            : `hsl(${(i * 47) % 360}, 70%, 62%)`;
    }

    function populateColorDropdown() {
        const colorSelect = document.getElementById("playerColor");
        colorSelect.innerHTML = "";
        const availableColors = NAMED_COLORS.slice();

        for (let i = availableColors.length; i < maxPlayers; i++) {
            availableColors.push({value: seatColor(i), name: `Color ${i + 1}`});
        }

        availableColors
            .filter(c => !players.map(p => p.color).includes(c.value))
            .forEach(c => {
                const opt = document.createElement("option");
                opt.value = c.value;
                opt.textContent = c.name;
                colorSelect.appendChild(opt);
            });
    }

    document.getElementById("playerType").addEventListener("change", updatePlayerForm);

    function updatePlayerForm() {
        const type = document.getElementById("playerType").value;
        const nickname = document.getElementById("playerNickname");
        nickname.placeholder = type === "ai" ? "AI " + playerCounter : "Player " + playerCounter;
        nickname.value = type === "ai" ? "" : "Player " + playerCounter;
        populateCharacterDropdown();
        populateColorDropdown();
        toggleAddButton();
        const playerNo = document.getElementById("playerNumber");
        playerNo.innerHTML = players.length + 1;
    }

    function toggleAddButton() {
        addAnotherBtn.style.display = players.length >= maxPlayers - 1 ? "none" : "inline-block";
    }

    addAnotherBtn.addEventListener("click", () => {
        if (players.length >= maxPlayers) return;
        if (!addPlayerFromForm()) return;
        playerCounter++;
        updatePlayerForm();
    });

    document.getElementById("goToGame").addEventListener("click", () => {
        if (!addPlayerFromForm()) return;
        if (!hasMinimumPlayers()) {
            showError("At least " + minPlayers + " players are required!");
            return;
        }
        startGame();
    });

    function addPlayerFromForm() {
        clearError();
        const type = document.getElementById("playerType").value;
        // Caps the nickname at a sane length. It can still be wider than the turn header
        // has room for next to a long character name - .turnHeaderHint ellipsises in that
        // case. maxlength on the input is the first guard; this catches paste/autofill.
        const NICKNAME_MAX = 16;
        const nicknameEl = document.getElementById("playerNickname");
        const nickname = (nicknameEl.value.trim() || nicknameEl.placeholder).slice(0, NICKNAME_MAX);
        const charName = document.getElementById("playerCharacter").value;
        const color = document.getElementById("playerColor").value;
        if (!charName) {
            showError("Please select a character!");
            return false;
        }
        if (!color) {
            showError("Please select a color!");
            return false;
        }

        const charObj = characters.find(c => c.name === charName);

        // The rules below are advisory: each is confirmed rather than refused, so any
        // combination can be set up deliberately. The only hard cap is maxPlayers.
        const warnings = [];
        // ...with one exception, flagged here: a base game has no bounty hunter AI deck
        // to deal at all, so that one is confirmed even in debug mode.
        let noDeckExists = false;
        if (gameMode === "base" && charObj.origin === "expansion") {
            warnings.push(`${charObj.name} is an Unfinished Business character, but this is a base game.`);
        }
        if (type === "ai") {
            const ais = players.filter(p => p.type === "ai");
            if (gameMode === "base" && charObj.type === "bounty") {
                warnings.push("The bounty hunter AI deck ships only in the expansion - a base game has no cards for this AI.");
                noDeckExists = true;
            }
            if (ais.length >= 2) {
                warnings.push("The rules set up at most 2 AI opponents (expansion rulebook p. 11).");
            }
            if (ais.some(a => a.character.type === charObj.type)) {
                warnings.push("The rules pair one bounty hunter with one non-bounty-hunter AI; this repeats a type.");
            }
        }
        // Debug mode seats whatever it is told to - every character at once, no human
        // among them - so the advisory rules get out of the way. `noDeckExists` is not
        // advisory, so it is still confirmed.
        if ((!debug || noDeckExists) && warnings.length && !confirm(warnings.join("\n\n") + "\n\nAdd them anyway?")) {
            return false;
        }

        usedCharacters.push(charObj.name);
        players.push({type, nickname, character: charObj, color, personalGoalAchieved: false, currentCardIndex: 0});

        if (type === "ai") {
            let deck = shuffleAiDeck(charObj.type, charObj);
            aiDecks[charObj.id] = deck;
            console.log(`AI ${nickname} initial deck:`, deck);
        }

        toggleAddButton();
        return true;
    }

    function hasMinimumPlayers() {
        return players.length >= minPlayers; // minimal requirement
    }

    document.getElementById("backPlayer").addEventListener("click", () => {
        if (players.length === 0) {
            document.getElementById("step2").classList.add("hidden");
            document.getElementById("step1").classList.remove("hidden");
            return;
        }
        const last = players.pop();
        usedCharacters = usedCharacters.filter(c => c !== last.character.name);
        playerCounter = players.length + 1;
        updatePlayerForm();
        toggleAddButton();
    });

    function showHelp() {
        const helpButton = $("#helpButton");
        helpButton.show();
        $('#fullscreenButton').show();


        helpButton.off('click').on("click", handleHelpClick);

        function handleHelpClick() {
            const hidePhaseContainer = false;
            const cardDisplay = $("#cardDisplay");
            const phaseContainer = $("#phaseContainer");
            const prevScreen = $("#helpScreen");
            let content = '';

            if ($(prevScreen).is(':visible')) {
                $(prevScreen).remove();
                hideHelpControls();
                if (hidePhaseContainer)
                {
                    $(phaseContainer).show();
                }

                return true;
            }
            if (hidePhaseContainer)
            {
                $(phaseContainer).hide();
            }
            const player = players[currentPlayerIndex];

            const promptDiv = document.createElement('div');
            promptDiv.id = 'helpScreen';
            promptDiv.className = 'helpScreen';
            // promptDiv.style.position = 'fixed';
            // promptDiv.style.top = '40px';
            // promptDiv.style.width = '100%';
            // promptDiv.style.maxWidth = '400px';
            // promptDiv.style.height = '100%';
            // promptDiv.style.left = '50%';
            // promptDiv.style.transform = 'translateX(-50%)';
            promptDiv.style.border = '2px solid #666';
            promptDiv.style.margin = '0px 0px 30px 0px';
            // promptDiv.style.zIndex = 1000;
            // promptDiv.style.textAlign = 'center';
            content = '';

            let playerType = player.type === "human" ?"human": player.character.type;

            // Which ruleset the panel is showing. The help fragments are filtered by
            // playerType below, so without this the three sets are indistinguishable.
            const helpTitle = (cardsData.helpTitle || {})[playerType];
            if (helpTitle) content += `<div class="helpTitle">${helpTitle}</div>`;

            $.each(cardsData.help, function(k,v){
                if (
                    ($.inArray(playerType, v.characterType)>-1 || v.characterType.length == 0)
                    && ($.inArray(gameMode, v.gameMode)>-1 || v.gameMode.length == 0)
                ){
                    content += v.content;
                } else {
                }
            });

            promptDiv.innerHTML += content;

            $(promptDiv).on("click", () => {
                $(promptDiv).remove();
                hideHelpControls();
                if (hidePhaseContainer)
                {
                    $(phaseContainer).show();
                }
            });

            cardDisplay.prepend(promptDiv);
            showHelpControls();
            replaceIconsWithImages();


        }

    }

    function fullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function enterFullscreen() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen(); // Safari/iOS
    }

    function toggleFullscreen() {
        if (fullscreenElement()) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } else {
            enterFullscreen();
        }
    }

    // \u26f6 enter / \u2715 exit. Kept in sync with the actual state, since fullscreen can
    // also be left with Esc or a system gesture without the button being touched.
    function syncFullscreenButton() {
        const on = !!fullscreenElement();
        $('#fullscreenButton')
            .html(on ? '\u2715' : '\u26f6')
            .attr('title', on ? 'Exit fullscreen' : 'Toggle fullscreen');
    }

    $(document).on('fullscreenchange webkitfullscreenchange', syncFullscreenButton);
    $('#fullscreenButton').off('click').on('click', toggleFullscreen);
    syncFullscreenButton();

    // The help controls overlay the turn title while help is open, so they cost no
    // extra vertical space - the app has to fit a phone screen.
    function showHelpControls() {
        $('#localeToggle').text(locale.toUpperCase());
        $('#refDocs').val('');
        $('#helpControls').removeClass('hidden');
    }

    function hideHelpControls() {
        $('#helpControls').addClass('hidden');
    }

    $('#localeToggle').on('click', async function () {
        locale = (locale === 'uk') ? 'en' : 'uk';
        $('#locale').val(locale);          // keep the setup screen in sync
        await initCards();                 // must finish before anything re-renders
        showTurn();                        // rebuilds the turn in the new language
        $('#helpButton').trigger('click'); // and reopens help, now translated
    });

    $('#refDocs').on('change', function () {
        const url = this.value;
        this.value = '';
        if (url) window.open(url + '?' + version, '_blank', 'noopener');
    });

    // Back only means something once the game has moved on. Test the AI's *pointer*
    // into its history, not the history length: Back rewinds currentCardIndex but never
    // truncates aiHistory, so length stays >0 forever once a card has been drawn and
    // would keep the button visible after rewinding all the way to turn 1.
    // Both values are already saved, so a restored mid-game save gets this right.
    function canGoBack() {
        return turnNo > 0;
    }

    // Recorded turns still lie ahead of where we are looking.
    // How many turns back from the frontier we are looking, e.g. "-1" one Back from the
    // live turn. Driven by the global cursor, so it means the same on a human turn as on
    // an AI one.
    // The footer is three fixed slots: [back] [forward] [advance/return]. A slot with no
    // action becomes an invisible placeholder of the same size, so buttons never move
    // under your thumb - repeatedly tapping one spot always does the same thing, or
    // nothing at all. visibility:hidden keeps the metrics but takes the click target away.
    function navPlaceholder(cls) {
        const b = document.createElement("button");
        b.className = cls + " navPlaceholder";
        b.tabIndex = -1;
        b.setAttribute("aria-hidden", "true");
        return b;
    }

    function buildFooter(row) {
        const depth = turnNoMax - turnNo;      // 0 = the live turn
        const fwdDepth = depth - 1;

        // slot 1 - step back
        if (canGoBack()) {
            const back = document.createElement("button");
            back.className = "backCard";
            back.innerHTML = "\u2039" + depthLabel(depth + 1);
            back.title = "Previous turn";
            back.onclick = () => { seekTurn(turnNo - 1); showTurn(); };
            row.appendChild(back);
        } else {
            row.appendChild(navPlaceholder("backCard"));
        }

        // slot 2 - step forward, but only while that lands somewhere still in history
        if (fwdDepth > 0) {
            const fwd = document.createElement("button");
            fwd.className = "nextCard withFF";
            fwd.innerHTML = depthLabel(fwdDepth, true) + "\u203a";
            fwd.title = "Next turn in history";
            fwd.onclick = () => { seekTurn(turnNo + 1); showTurn(); };
            row.appendChild(fwd);
        } else {
            row.appendChild(navPlaceholder("nextCard withFF"));
        }

        // slot 3 - advance the game, or leave history
        const main = document.createElement("button");
        main.className = "ffCard";
        if (depth > 0) {
            main.textContent = "Back to game";
            main.title = "Leave history and return to the current turn";
            main.onclick = () => { seekTurn(turnNoMax); showTurn(); };
        } else {
            main.className = "ffCard mainAction";   // the primary action during play
            main.textContent = "Next turn";
            main.title = "Next turn";
            main.onclick = () => { seekTurn(turnNo + 1); showTurn(); };
        }
        row.appendChild(main);
    }

    // Small grey "-N" on a nav button: the history depth that button would land on.
    // Omitted when the target is the live turn (depth 0).
    function depthLabel(depth, before) {
        if (depth <= 0) return '';
        const span = `<span class="btnDepth${before ? ' before' : ''}">-${depth}</span>`;
        return before ? span + ' ' : ' ' + span;
    }

    function historyDepthMarker() {
        const depth = turnNoMax - turnNo;
        return depth > 0
            ? ` <span class="turnHeaderHint" title="History depth">-${depth}</span>`
            : '';
    }

    // How many turns this player has already taken. Both humans and AI now keep a
    // record per turn, so both can be rewound.
    // Point the whole game at global turn T. Player j takes turns at T = j, j+n, j+2n...
    // so the player on screen is showing turn floor(T/n), and everyone else's pointer is
    // however many of their turns have already started.
    function seekTurn(T) {
        const n = players.length;
        turnNo = Math.max(0, T);
        if (turnNo > turnNoMax) turnNoMax = turnNo;
        currentPlayerIndex = turnNo % n;
        players.forEach((p, j) => {
            p.currentCardIndex = (j === currentPlayerIndex)
                ? Math.floor(turnNo / n)
                : (turnNo >= j ? Math.floor((turnNo - j) / n) + 1 : 0);
        });
    }

    function turnsTaken(player) {
        const t = turnSel[player.character.id];
        return t ? t.length : 0;
    }

    // This turn has been played before, so its ticked bullets are replayed (in blue).
    function hasRecord(player) {
        return player.currentCardIndex < turnsTaken(player);
    }

    function turnRecordFor(player) {
        const id = player.character.id;
        if (!turnSel[id]) turnSel[id] = [];
        const i = player.currentCardIndex;
        if (!turnSel[id][i]) turnSel[id][i] = [];
        return turnSel[id][i];
    }

    // Re-apply the cross-out rule for one step after its active set changed.
    function refreshCrossed(item) {
        const pick = item.dataset.pick || '1';
        const all = [...item.querySelectorAll('.phaseElement')];
        if (pick === 'all') {
            all.forEach(e => e.classList.remove('crossed'));
            return;
        }
        const max = parseInt(pick, 10) || 1;
        const active = all.filter(e => e.classList.contains('active'));
        all.forEach(e => e.classList.toggle('crossed',
            active.length === max && !e.classList.contains('active')));
    }

    // Persist the ticked bullets of the turn on screen.
    function recordSelections() {
        const player = players[currentPlayerIndex];
        if (!player) return;
        const keys = [];
        document.querySelectorAll('#phaseContainer .phaseItem').forEach((item, i) => {
            item.querySelectorAll('.phaseElement').forEach((el, j) => {
                if (el.classList.contains('active')) keys.push(i + ':' + j);
            });
        });
        turnSel[player.character.id][player.currentCardIndex] = keys;
        saveGameState();
    }

    // Paint a replayed turn's bullets. `replay` colours them blue so it is obvious you
    // are looking at what was done earlier rather than making a fresh choice.
    function applySelections(player, replay) {
        const keys = (turnSel[player.character.id] || [])[player.currentCardIndex] || [];
        const items = [...document.querySelectorAll('#phaseContainer .phaseItem')];
        keys.forEach(k => {
            const [i, j] = k.split(':').map(Number);
            const el = items[i] && items[i].querySelectorAll('.phaseElement')[j];
            if (!el) return;
            el.classList.add('active');
            if (replay) el.classList.add('replay');
        });
        items.forEach(refreshCrossed);
    }

    function hideHelpButton() {
        $('#helpButton').hide();
        $('#fullscreenButton').hide();
        hideHelpControls();
    }

    async function startGame() {
        await initCards();
        document.getElementById("step1").classList.add("hidden");
        document.getElementById("step2").classList.add("hidden");
        mainTitle.classList.add("hidden");
        container.style.padding = "5px";
        currentPlayerIndex = 0;
        turnNo = 0;
        turnNoMax = 0;
        turnSel = {};
        document.getElementById("gameStep").classList.remove("hidden");
        players.forEach(p => {
            p.currentCardIndex = 0;
            if (p.type === "ai") aiHistory[p.character.id] = [];
        });
        showTurn();
    }

    function showTurn() {
        const player = players[currentPlayerIndex];
        const header = document.getElementById("turnHeader");
        const cardDisplay = document.getElementById("cardDisplay");
        cardDisplay.innerHTML = "";
        let cardName = "";
        let cardType = "";

        if (player.type === "human") {
            cardType = 'human';


            if (useHumanCharacterImages) {
                const row1 = document.createElement("div");
                row1.style.display = "flex";
                row1.className = "phaseImage";
                row1.style.justifyContent = "center";
                row1.style.gap = "10px";
                const cardFile = gameMode === "base" ? "base a.png" : "expansion a.png";
                const img = document.createElement("img");
                img.src = `./assets/images/player/${cardFile}?${version}`;
                img.addEventListener("click", () => {
                    const filename = new URL(img.src).pathname.split('/').pop();
                    const prefix = filename.slice(0, -5);
                    const suffix = filename.match(/([a-zA-Z])\.png$/)?.[1];
                    img.src = `./assets/images/player/${prefix}${suffix == "a" ? "b" : "a"}.png?${version}`;
                });
                row1.appendChild(img);
                cardDisplay.appendChild(row1);
            }

            const row2 = document.createElement("div");
            row2.className = 'cardFooter';

            buildFooter(row2);
            cardDisplay.appendChild(row2);

            const row3 = document.createElement("div");
            row3.textContent = "Personal Goal Achieved: " + player.personalGoalAchieved;
            row3.className = "personalGoalText";
            row3.style.color = player.personalGoalAchieved ? '#4CFF4C' : 'white';

            // Character cards are cropped to the art + name (everything below the card's
            // orange rule is gone). Silver = goal not achieved, gold = achieved; clicking
            // the card toggles it. The label sits under the image.
            const row4 = document.createElement("div");
            const charImg = document.createElement("img");
            const [name, ext] = player.character.image.split(".");
            charImg.src = `./assets/images/characters/${name}${player.personalGoalAchieved ? "_" : ""}.${ext}?${version}`;
            charImg.addEventListener("click", () => {
                player.personalGoalAchieved = !player.personalGoalAchieved;
                charImg.src = `./assets/images/characters/${name}${player.personalGoalAchieved ? "_" : ""}.${ext}?${version}`;
                row3.textContent = "Personal Goal Achieved: " + player.personalGoalAchieved;
                row3.style.color = player.personalGoalAchieved ? '#4CFF4C' : 'white';
            });
            row4.appendChild(charImg);
            cardDisplay.appendChild(row4);
            cardDisplay.appendChild(row3);

            header.innerHTML = `<span class="turnHeaderHint">${player.nickname}</span>`
                + `<span class="turnHeaderName">${player.character.name}${historyDepthMarker()}</span>`;
            header.style.color = player.color;

        } else {
            cardType = player.character.type === "smuggler" ? "smuggler" : "bounty";
            // The AI deck is a fixed rotating queue: shuffled once at setup, then each
            // resolved card goes facedown to the bottom (Rules Reference p. 22). It is
            // never reshuffled mid-game.
            // Keyed by character id, not nickname: two players may share a nickname,
            // and sharing an AI deck between them corrupts both.
            const aiKey = player.character.id;
            let deck = aiDecks[aiKey];
            if (!deck || deck.length === 0) {
                aiDecks[aiKey] = deck = shuffleAiDeck(player.character.type, player.character);
            }
            if (!aiHistory[aiKey]) aiHistory[aiKey] = [];

            let card;
            if (debug) {
                // Debug is a card viewer, so the card is a pure function of the turn
                // index rather than of any stored state: the same sequence on every
                // reload, and identical whether you got here by playing forward, by
                // Back/Forward, or by continuing a save whose deck and history were
                // dealt by an earlier, randomized game.
                const seq = shuffleAiDeck(player.character.type, player.character);
                card = seq[player.currentCardIndex % seq.length];
                aiHistory[aiKey][player.currentCardIndex] = card;
                aiDecks[aiKey] = seq.slice((player.currentCardIndex % seq.length) + 1);
                console.log(`AI ${player.nickname} debug sequence:`, seq);
            } else if (player.currentCardIndex < aiHistory[aiKey].length) {
                console.log('using card from history');
                card = aiHistory[aiKey][player.currentCardIndex];
            } else {
                console.log('drawing new card from deck');

                // HOUSE RULE (see AGENTS.md R1): the drawn card leaves the deck, and
                // the deck is reshuffled whole once it runs out or once the special
                // card comes up. The printed rule is bottom-of-deck rotation with the
                // special reshuffling only itself; this is a deliberate divergence.
                card = deck.shift();
                aiHistory[aiKey].push(card);

                if (triggersReshuffle(card) || deck.length === 0) {
                    aiDecks[aiKey] = deck = shuffleAiDeck(player.character.type, player.character);
                    console.log(`AI ${player.nickname} reshuffled deck:`, deck);
                }
            }

            console.log(`AI ${player.nickname} played card: ${card}, remaining deck:`, deck);

            const cardImg = document.createElement("img");
            cardName = card;

            let headerMarker = "";
            const deckSize = shuffleAiDeck(player.character.type, player.character).length;
            if (reshuffleMarks(aiHistory[aiKey], deckSize)[player.currentCardIndex]) {
                headerMarker = ' <span class="turnHeaderHint" title="Deck reshuffled after this card">↻</span>';
            }
            headerMarker += historyDepthMarker();

            if (card === "special") {
                const dir = player.character.type === "smuggler" ? "smuggler" : "bounty";
                cardImg.src = `./assets/images/${dir}/${player.character.image}?${version}`;
                header.innerHTML = `<span class="turnHeaderHint">AI</span>`
                    + `<span class="turnHeaderName">${player.character.name} #special${headerMarker}</span>`;
            } else {
                const dir = player.character.type === "smuggler" ? "smuggler" : "bounty";
                cardImg.src = `./assets/images/${dir}/${card}.png?${version}`;
                header.innerHTML = `<span class="turnHeaderHint">AI</span>`
                    + `<span class="turnHeaderName">${player.character.name} #${card}${headerMarker}</span>`;
            }

            if (useAiCharacterImages) {
                const row0 = document.createElement("div");
                row0.className = "phaseImage";
                cardImg.style.maxHeight = "75vh";
                row0.appendChild(cardImg);
                cardDisplay.appendChild(row0);
            }

            const row2 = document.createElement("div");
            row2.className = 'cardFooter';

            buildFooter(row2);
            cardDisplay.appendChild(row2);

            // AI players can never complete personal goals or ship goals
            // (Rules Reference p. 22), so the character card is shown unflipped and
            // there is no goal toggle here.
            const row4 = document.createElement("div");
            const charImg2 = document.createElement("img");
            const [name, ext] = player.character.image.split(".");
            charImg2.src = `./assets/images/characters/${name}.${ext}?${version}`;
            row4.appendChild(charImg2);
            cardDisplay.appendChild(row4);

            header.style.color = player.color;
        }

        describeCard(cardName, cardType);
        saveGameState();
    }

    // How many bullets a step lets you select.
    //   'all' - "Do all that apply" (action, special): free toggle, nothing crossed out.
    //   '1'   - "Do the first that applies" (planning, encounter): picking one crosses
    //           out the rest.
    //   '2'   - IG-88 only. His planning step reads "If IG-88 has at least 1 droid crew,
    //           do the first 2 that apply instead". Verified against the scans that he is
    //           the sole exception across all 31 AI cards, so this stays a lookup rather
    //           than something parsed out of the card text.
    function picksFor(section, cardFileName) {
        if (section === 'action' || section === 'special') return 'all';
        if (cardFileName === 'ig88' && section === 'planning') return '2';
        return '1';
    }

    // Cards carrying "Then, shuffle this AI card back into the AI deck": every character
    // ("special") card, plus base smuggler card 10. Verified on the scans. Under the
    // house rule these reshuffle the whole deck rather than just themselves.
    function triggersReshuffle(card) {
        // A debug deck is meant to be read end to end, so nothing shortens it; it
        // simply restarts (in the same order) once the last card has been drawn.
        if (debug) return false;
        return card === "special" || card === 10;
    }

    // Which draws were followed by a reshuffle, replayed from history so the marker
    // needs no stored state and survives a reload (C5). A reshuffle happens when the
    // card triggers one, or when that draw emptied the deck.
    function reshuffleMarks(history, deckSize) {
        const marks = [];
        let drawn = 0;
        history.forEach(card => {
            drawn++;
            const did = triggersReshuffle(card) || drawn === deckSize;
            marks.push(did);
            if (did) drawn = 0;
        });
        return marks;
    }

    // The deck this type plays in this game mode. Base smuggler is the full 1..10
    // (the base box has exactly 10 AI cards and no character card); the expansion
    // decks are a subset plus that character's own card. The bounty hunter AI deck
    // exists only in the expansion (Rules Reference p. 22), so there is no base-mode
    // bounty branch.
    function deckComposition(characterType, mode = gameMode) {
        return characterType === "smuggler"
            ? (mode === "base" ? [...Array(10).keys()].map(n => n + 1) : [1, 2, 6, 7, 9, "special"])
            : [1, 2, 3, 4, 5, "special"];
    }

    // Whether `mode` actually deals this card. Not the same question as "is it in
    // deckComposition": the base box contains no bounty hunter AI deck at all
    // (UB p. 8 / RR p. 22), so nothing of that type is dealt in a base game.
    function dealtIn(characterType, key, mode) {
        if (characterType === "bounty" && mode === "base") return false;
        const deck = deckComposition(characterType, mode);
        return key === "special" ? deck.indexOf("special") > -1 : deck.indexOf(Number(key)) > -1;
    }

    // Shuffled once, at setup.
    //
    // Debug mode instead deals that same deck unshuffled, so every card can be read in
    // order. The *first* AI of each type runs the whole deck; every later AI of that
    // type gets only its own character card, since the numbered cards would just repeat
    // what the first AI already showed. Nothing is ever added to the deck: a base game
    // has no character cards, so a base AI simply runs 1..10 and the first/later split
    // does not apply there.
    // `character` is optional - the deckSize probe in showTurn() passes it too, so the
    // ↻ marker measures the same deck the player is actually holding.
    function shuffleAiDeck(characterType, character) {
        const deck = deckComposition(characterType);
        if (debug) {
            if (character && deck.includes("special") && !isFirstAiOfType(character)) {
                return ["special"];
            }
            return deck;
        }
        return shuffleArray(deck);
    }

    // First AI of this character's type in seating order. Used only by debug mode.
    function isFirstAiOfType(character) {
        const first = players.find(p => p.type === "ai" && p.character.type === character.type);
        return !first || first.character.id === character.id;
    }

    // One AI card's four steps as HTML. Shared by the live turn and the proof sheet so
    // the two cannot render the same card differently.
    function cardSectionsHtml(data, cardFileName, phases) {
        return ['planning', 'action', 'encounter', 'special'].map(section => {
            if (!data[section] || !data[section].length) return '';
            const pick = picksFor(section, cardFileName);
            const sectionTitle = phases[section].title;
            const sectionDescription = phases[section].hint;
            // A leading "!." marks a condition line rather than an action (IG-88's
            // "first 2" clause). It is shown but not selectable, so it cannot be
            // clicked or counted against the pick limit.
            const body = data[section].map(item => {
                const note = item.trim().startsWith('!.');
                if (note) return `<div class="phaseNote">${item.trim().slice(2).trim()}</div>`;
                return `<div class="phaseElement">${item}</div>`;
            }).join('');
            return `<div class="phaseItem" data-pick="${pick}">
                        <div class="phaseName">${sectionTitle} <div class="phaseHint">${sectionDescription}</div>` +
                `</div> ${body}
                    </div>`;
        }).join('');
    }

    async function describeCard(cardName, type) {
        hideHelpButton();
        const player = players[currentPlayerIndex];
        /** type: "human" | "bounty" | "smuggler" */
        const cardDisplay = document.querySelector('#cardDisplay');
        let html;

        if (type === "human") {
            // Preserve canonical human card content exactly
            html = Object.values(cardsData['player'][gameMode]).filter(v => v).join('');
        } else {
            // AI cards come from assets/cards/<locale>.json; a character card is stored under
            // the character's id rather than a number.
            try {
                const typeDir = type === 'smuggler' ? 'smuggler' : 'bounty';
                const cardFileName = cardName == 'special' ? player.character.id : cardName;
                html = cardSectionsHtml(cardsData[typeDir][cardFileName], cardFileName, cardsData.phases);
            } catch (err) {
                console.warn('Failed to load card JSON:', cardName, err);
                html = ['planning', 'action', 'encounter', 'special'].map(section =>
                    `<div class="phaseItem"><div class="phaseName">${section}</div><div class="phaseElement">[No data]</div></div>`
                ).join('');
            }
        }

        cardDisplay.insertAdjacentHTML('afterbegin', `<div id="phaseContainer" class="phaseContainer phaseContainer-${type}">${html}</div>`);
        attachPhaseElementListeners();
        if (player) {
            const replay = hasRecord(player);
            turnRecordFor(player);          // make sure this turn has a slot
            applySelections(player, replay);
        }
        showHelp();
        replaceIconsWithImages();

    }


    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function attachPhaseElementListeners() {
        document.querySelectorAll('.phaseItem .phaseElement').forEach(el => {
            const newEl = el.cloneNode(true);
            el.replaceWith(newEl);

            newEl.addEventListener('click', function () {
                const parentPhaseItem = newEl.closest('.phaseItem');
                const allElements = [...parentPhaseItem.querySelectorAll('.phaseElement')];
                const pick = parentPhaseItem.dataset.pick || '1';

                // "Do all that apply" - independent toggles, nothing is ruled out.
                if (pick === 'all') {
                    newEl.classList.toggle('active');
                    newEl.classList.remove('replay');   // it is a live choice now
                    recordSelections();
                    return;
                }

                // "Do the first N that apply" - once N are chosen the rest are crossed
                // out. N is 1 everywhere except IG-88's planning step.
                const max = parseInt(pick, 10) || 1;
                const chosen = allElements.filter(e => e.classList.contains('active'));

                if (newEl.classList.contains('active')) {
                    newEl.classList.remove('active');
                } else if (chosen.length < max) {
                    newEl.classList.add('active');
                } else {
                    return; // already at the limit; deselect one first
                }
                newEl.classList.remove('replay');       // it is a live choice now

                recordSelections();
                const active = allElements.filter(e => e.classList.contains('active'));
                allElements.forEach(e => {
                    const rule = active.length === max && !e.classList.contains('active');
                    e.classList.toggle('crossed', rule);
                });
            });
        });
    }

    // =====================================================================
    // Debug tooling (?debug). None of this runs in a normal game.
    // =====================================================================

    // Tags that never carry a closer, so they must not count towards balance.
    const VOID_TAGS = ["br", "img", "hr", "input", "meta", "link"];

    // Net open-minus-close count per tag, returning only the tags that do not
    // balance: positive = unclosed, negative = stray closer.
    function tagBalance(html) {
        const counts = {};
        const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
        let m;
        while ((m = re.exec(html))) {
            const tag = m[2].toLowerCase();
            if (VOID_TAGS.indexOf(tag) > -1 || m[3] === "/") continue;
            counts[tag] = (counts[tag] || 0) + (m[1] ? -1 : 1);
        }
        return Object.keys(counts).filter(t => counts[t] !== 0).map(t => [t, counts[t]]);
    }

    function balanceProblems(html) {
        return tagBalance(html).map(([tag, n]) =>
            n > 0 ? `${n} unclosed <${tag}>` : `${-n} stray </${tag}>`);
    }

    // Icon names used in a fragment. The name is the SECOND class of a span.icon and
    // must resolve to assets/images/assets/<name>.png (see AGENTS.md section 8).
    function iconNamesIn(html) {
        const names = [];
        const re = /<span[^>]*\bclass="icon\s+([^"\s]+)/gi;
        let m;
        while ((m = re.exec(html))) names.push(m[1]);
        return names;
    }

    // [path, html] for every authored string in a locale file.
    function cardStrings(data) {
        const out = [];
        ["smuggler", "bounty"].forEach(type => {
            Object.keys(data[type] || {}).forEach(key => {
                ["planning", "action", "encounter", "special"].forEach(section => {
                    (data[type][key][section] || []).forEach((line, i) =>
                        out.push([`${type}/${key} ${section}[${i}]`, line]));
                });
            });
        });
        Object.keys(data.player || {}).forEach(mode => {
            Object.keys(data.player[mode]).forEach(section =>
                out.push([`player/${mode} ${section}`, data.player[mode][section]]));
        });
        (data.help || []).forEach((entry, i) => out.push([`help[${i}]`, entry.content]));
        return out;
    }

    // The concatenation the help panel actually renders for one combination. `help` is
    // a list of fragments filtered by gameMode/characterType, so per-entry balance
    // means nothing - only these combinations do (AGENTS.md D4).
    function helpFor(data, mode, playerType) {
        return (data.help || []).filter(v =>
            (!v.characterType.length || v.characterType.indexOf(playerType) > -1) &&
            (!v.gameMode.length || v.gameMode.indexOf(mode) > -1)
        ).map(v => v.content).join("");
    }

    // Sweeps a loaded locale for the class of bug that keeps shipping: an unbalanced
    // tag swallowing the rest of a panel (D1, D2, D4), an icon name with no file (C7),
    // or a card the app can deal but the JSON has no entry for. Returns the problems
    // and logs them; icon checks resolve asynchronously and log on their own.
    // Icon files can only be tested by loading them, so these problems arrive after
    // validateCardData has already returned. `onLate` receives each one; the default
    // logs, and the whole-deck sheet appends them to its own report.
    function checkIcons(data, loc, onLate) {
        const icons = {};
        cardStrings(data).forEach(([, html]) => iconNamesIn(html).forEach(n => { icons[n] = true; }));
        Object.keys(icons).forEach(name => {
            const probe = new Image();
            probe.onerror = () => onLate(
                `${loc} · icon "${name}": no file at assets/images/assets/${name}.png`);
            probe.src = `./assets/images/assets/${name}.png?${version}`;
        });
        return Object.keys(icons).length;
    }

    function validateCardData(data, loc, onLate) {
        const problems = [];
        const say = (where, msg) => problems.push(`${loc} · ${where}: ${msg}`);

        cardStrings(data).forEach(([where, html]) => {
            if (where.indexOf("help[") === 0) return;   // fragments; checked below
            balanceProblems(html).forEach(msg => say(where, msg));
        });

        ["base", "expansion"].forEach(mode => {
            ["human", "smuggler", "bounty"].forEach(pt => {
                balanceProblems(helpFor(data, mode, pt))
                    .forEach(msg => say(`help (${mode}/${pt})`, msg));
            });
        });

        ["base", "expansion"].forEach(mode => {
            ["smuggler", "bounty"].forEach(type => {
                deckComposition(type, mode).forEach(card => {
                    if (card === "special") return;
                    if (!dealtIn(type, card, mode)) return;
                    if (!data[type] || !data[type][card]) {
                        say(`${type} deck (${mode})`, `card ${card} has no entry`);
                    }
                });
            });
        });
        characters.forEach(c => {
            if (!data[c.type] || !data[c.type][c.id]) {
                say(`${c.type}/${c.id}`, `${c.name}'s character card has no entry`);
            }
        });
        // A bulk text pass over the locale file must never touch these: they are
        // filter keys, not prose. When one did (a keyword-bolding sweep wrapped the
        // value "bounty" in <strong>), every bounty-hunter help fragment silently
        // stopped matching and vanished from the panel - with the markup still
        // balanced, so no other check noticed.
        (data.help || []).forEach((entry, i) => {
            ["gameMode", "characterType"].forEach(key => {
                (entry[key] || []).forEach(val => {
                    if (/[<>]/.test(val)) say(`help[${i}].${key}`, `markup in filter value "${val}"`);
                });
            });
            (entry.gameMode || []).forEach(v => {
                if (["base", "expansion"].indexOf(v) < 0) say(`help[${i}].gameMode`, `unknown value "${v}"`);
            });
            (entry.characterType || []).forEach(v => {
                if (["human", "smuggler", "bounty"].indexOf(v) < 0) say(`help[${i}].characterType`, `unknown value "${v}"`);
            });
        });

        if (!data.helpTitle) say("helpTitle", "missing");
        else ["human", "smuggler", "bounty"].forEach(pt => {
            if (!data.helpTitle[pt]) say(`helpTitle.${pt}`, "missing");
        });

        if (!data.phases) say("phases", "missing");
        else ["planning", "action", "encounter", "special"].forEach(s => {
            if (!data.phases[s]) say(`phases.${s}`, "missing");
        });

        const iconCount = checkIcons(data, loc, onLate || (msg => console.warn(
            `%c[card-data]%c ${msg}`, "color:#ff5555;font-weight:bold", "")));

        if (problems.length) {
            console.group(`%c[card-data ${loc}] ${problems.length} problem(s)`, "color:#ff5555;font-weight:bold");
            problems.forEach(p => console.warn(p));
            console.groupEnd();
        } else {
            console.log(`%c[card-data ${loc}] clean - ${iconCount} icons, markup balanced`,
                "color:#4CFF4C");
        }
        return problems;
    }

    // ?debug=whole-deck - every card in the data on one scrollable page, both locales
    // beside the scan. The scans are the source of truth and the JSON is the thing
    // being corrected (AGENTS.md section 2), so this is the shape that audit wants.
    function openWholeDeckSheet() {
        if (document.getElementById("proofSheet")) return;
        const sheet = document.createElement("div");
        sheet.id = "proofSheet";
        sheet.innerHTML = '<div class="proofBar"><strong>Whole deck</strong> loading…</div>';
        document.body.appendChild(sheet);

        $.when($.getJSON(`./assets/cards/en.json?${version}`),
               $.getJSON(`./assets/cards/uk.json?${version}`))
            .done((en, uk) => renderWholeDeckSheet(sheet, {en: en[0], uk: uk[0]}))
            .fail(() => {
                sheet.innerHTML = '<div class="proofBar">Failed to load card data.</div>';
            });
    }

    function renderWholeDeckSheet(sheet, data) {
        let mode = gameMode;
        // Late (asynchronous) icon problems land in their own block, so the report can
        // never claim "clean" while an icon is in fact missing its file.
        const late = [];
        const noteLate = msg => {
            late.push(msg);
            const box = document.getElementById("proofLate");
            if (box) {
                box.className = "proofProblems";
                box.innerHTML = `<strong>${late.length} missing icon file(s)</strong>`
                    + late.map(m => `<div>${m}</div>`).join("");
            }
        };
        const problems = validateCardData(data.en, "en", noteLate)
            .concat(validateCardData(data.uk, "uk", noteLate));

        function cardBlock(type, key, title) {
            const dealt = dealtIn(type, /^\d+$/.test(String(key)) ? key : "special", mode);
            const col = loc => {
                const card = (data[loc][type] || {})[key];
                const body = card
                    ? cardSectionsHtml(card, key, data[loc].phases)
                    : "<em class='proofMissing'>no entry</em>";
                return `<div class="proofCol"><div class="proofLoc">${loc.toUpperCase()}</div>${body}</div>`;
            };
            return `<div class="proofCard${dealt ? "" : " proofOut"}">
                <h3>${type}/${key}<span class="proofTag">${title}</span>
                    <span class="proofBadge">${dealt ? "in deck" : "not dealt in " + mode}</span></h3>
                <div class="proofCols">
                    <div class="proofCol proofScan">
                        <img src="./assets/images/${type}/${key}.png?${version}" alt="${type} ${key}">
                    </div>${col("en")}${col("uk")}
                </div></div>`;
        }

        function draw() {
            const parts = [];
            let count = 0;
            ["smuggler", "bounty"].forEach(type => {
                const label = type === "smuggler" ? "Smuggler" : "Bounty hunter";
                const numbered = Object.keys(data.en[type] || {})
                    .filter(k => /^\d+$/.test(k))
                    .sort((a, b) => Number(a) - Number(b));
                const chars = characters.filter(c => c.type === type)
                    .sort((a, b) => a.name.localeCompare(b.name));
                parts.push(`<h2 class="proofType">${label} AI cards</h2>`);
                numbered.forEach(k => { parts.push(cardBlock(type, k, `#${k}`)); count++; });
                parts.push(`<h2 class="proofType">${label} character cards</h2>`);
                chars.forEach(c => { parts.push(cardBlock(type, c.id, c.name)); count++; });
            });

            const report = problems.length
                ? `<details class="proofProblems open" open><summary>${problems.length} card-data problem(s)</summary>`
                  + problems.map(p => `<div>${p}</div>`).join("") + `</details>`
                : `<div class="proofProblems clean">Card data clean — markup balanced, every card present.</div>`;
            // Re-rendered on a mode flip, so replay whatever has already arrived.
            const lateBox = late.length
                ? `<div id="proofLate" class="proofProblems"><strong>${late.length} missing icon file(s)</strong>`
                  + late.map(m => `<div>${m}</div>`).join("") + `</div>`
                : `<div id="proofLate" class="proofHidden"></div>`;

            sheet.innerHTML = `<div class="proofBar">
                    <strong>Whole deck</strong>
                    <button id="proofToggleMode" title="Toggle mode">Mode: ${mode === "base" ? "Base game" : "Expansion"}</button>
                    <span class="proofCount">${count} cards · EN + UK</span>
                    <button id="proofClose">Close</button>
                </div>${report}${lateBox}${parts.join("")}`;

            document.getElementById("proofToggleMode").addEventListener("click", () => {
                mode = mode === "base" ? "expansion" : "base";
                draw();
                sheet.scrollTop = 0;
            });
            document.getElementById("proofClose").addEventListener("click", () => sheet.remove());
            replaceIconsWithImages();
        }

        draw();
    }

    // ?debug&human=erso&ai=han,boba[&mode=base][&locale=en] - seat an exact table and
    // go straight into it, skipping both setup screens and the saved-game prompt, so a
    // finding is reproducible from a URL.
    function autoSetupFromQuery() {
        if (!debug) return false;
        const q = new URLSearchParams(location.search);
        if (!q.has("ai") && !q.has("human")) return false;

        gameMode = q.get("mode") === "base" ? "base" : "expansion";
        locale = q.get("locale") === "en" ? "en" : "uk";
        document.getElementById("gameMode").value = gameMode;
        document.getElementById("locale").value = locale;

        players = [];
        usedCharacters = [];
        aiDecks = {};
        aiHistory = {};
        turnSel = {};

        const seat = (list, type) => (list || "").split(",").map(x => x.trim()).filter(Boolean)
            .forEach(id => {
                const c = characters.find(ch => ch.id === id);
                if (!c) return console.warn(`[debug] ?${type}: no character with id "${id}"`);
                if (usedCharacters.indexOf(c.name) > -1) {
                    return console.warn(`[debug] ?${type}: "${id}" is already seated`);
                }
                usedCharacters.push(c.name);
                players.push({
                    type,
                    nickname: (type === "ai" ? "AI " : "P") + (players.length + 1),
                    character: c,
                    color: seatColor(players.length),
                    personalGoalAchieved: false,
                    currentCardIndex: 0
                });
                // After the push: shuffleAiDeck asks isFirstAiOfType, which reads players.
                if (type === "ai") aiDecks[c.id] = shuffleAiDeck(c.type, c);
            });

        seat(q.get("human"), "human");
        seat(q.get("ai"), "ai");

        if (!players.length) {
            console.warn("[debug] deep link named no usable characters; falling back to setup");
            return false;
        }
        playerCounter = players.length + 1;
        console.log("[debug] seated from query:",
            players.map(p => `${p.type}:${p.character.id}`).join(", "),
            `(${gameMode}, ${locale})`);
        startGame();
        return true;
    }

    // =====================================================================
    // Keep the screen awake (Screen Wake Lock API).
    //
    // A board-game companion sits untouched for minutes at a time, so the phone
    // dims mid-turn. The lock is opt-in, remembered across sessions, and lives in
    // #helpControls - that bar overlays the turn title while help is open, so it
    // costs no vertical space, which section 7 of AGENTS.md rules out spending.
    //
    // REQUIRES A SECURE CONTEXT. Over plain http (what docker-compose serves today)
    // `navigator.wakeLock` is simply absent and the button hides itself, so the
    // control never pretends to work.
    // =====================================================================

    let wakeLock = null;
    let keepAwake = localStorage.getItem('keepAwake') === '1';

    function wakeLockSupported() {
        return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    }

    async function acquireWakeLock() {
        if (!keepAwake || !wakeLockSupported() || wakeLock) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            // The OS can drop it on its own (low battery, and always on tab hide).
            wakeLock.addEventListener('release', function () {
                wakeLock = null;
                syncKeepAwakeButton();
            });
        } catch (err) {
            // NotAllowedError covers an insecure context and an OS refusal alike.
            console.warn('Wake lock refused:', err.name, err.message);
            wakeLock = null;
        }
        syncKeepAwakeButton();
    }

    async function releaseWakeLock() {
        if (!wakeLock) return;
        try { await wakeLock.release(); } catch (err) { /* already gone */ }
        wakeLock = null;
        syncKeepAwakeButton();
    }

    function syncKeepAwakeButton() {
        $('#keepAwakeToggle')
            .toggleClass('on', !!wakeLock)
            .attr('title', keepAwake
                ? (wakeLock ? 'Screen kept awake - tap to allow sleep' : 'Keep screen awake (re-acquiring)')
                : 'Keep screen awake');
    }

    if (wakeLockSupported()) {
        $('#keepAwakeToggle').on('click', function () {
            keepAwake = !keepAwake;
            localStorage.setItem('keepAwake', keepAwake ? '1' : '0');
            if (keepAwake) acquireWakeLock(); else releaseWakeLock();
        });
        // A wake lock is always released when the page is hidden, so it has to be
        // taken again every time the tab comes back.
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') acquireWakeLock();
        });
        acquireWakeLock();
        syncKeepAwakeButton();
    } else {
        $('#keepAwakeToggle').hide();
        console.info('Screen Wake Lock unavailable: needs a secure context (https or localhost).');
    }

    function showError(message) {
        const errorDiv = document.getElementById("playerFormError");
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
    }

    function clearError() {
        const errorDiv = document.getElementById("playerFormError");
        errorDiv.textContent = "";
        errorDiv.style.display = "none";
    }

    function replaceIconsWithImages() {
        // span.icon only: this runs twice per render, and a bare '.icon' also matches
        // the <img class="icon ..."> produced by the first pass. An <img> has no
        // textContent, so the second pass would rewrite alt to "".
        document.querySelectorAll('span.icon').forEach(span => {
            const iconType = span.classList[1]; // e.g. "damage"
            if (!iconType) return; // skip if no second class

            const altText = span.textContent.trim();
            const img = document.createElement('img');
            img.src = `./assets/images/assets/${iconType}.png`;
            img.alt = altText;
            img.className = `icon ${iconType}`;

            span.replaceWith(img);
        });
    }


    document.title += ' v' + appVersion;
    document.getElementById("mainTitle").innerHTML += ' v' + appVersion + (debug ? ' <span style="color:red">DEBUG</span>' : '');
});
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

    if (saved) {
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
                opt.textContent = `${c.name} (${c.origin[0]}) (sm)`;
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
                opt.textContent = `${c.name} (${c.origin[0]}) (bh)`;
                group.appendChild(opt);
            });
            select.appendChild(group);
        }
    }

    function populateColorDropdown() {
        const colorSelect = document.getElementById("playerColor");
        colorSelect.innerHTML = "";
        const availableColors = [
            {value: "#FF4C4C", name: "Red"},
            {value: "#4C9EFF", name: "Blue"},
            {value: "#4CFF4C", name: "Green"},
            {value: "#FFD74C", name: "Yellow"}
        ];

        if (maxPlayers > availableColors.length) {
            const needed = maxPlayers - availableColors.length;

            for (let i = 0; i < needed; i++) {
                // generate a random hex color
                const randomColor = '#' + Math.floor(Math.random() * 0xFFFFFF)
                    .toString(16)
                    .padStart(6, '0')
                    .toUpperCase();

                // give it a simple name (e.g., "Color 5")
                availableColors.push({
                    value: randomColor,
                    name: `Color ${availableColors.length + 1}`
                });
            }
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
        if (gameMode === "base" && charObj.origin === "expansion") {
            warnings.push(`${charObj.name} is an Unfinished Business character, but this is a base game.`);
        }
        if (type === "ai") {
            const ais = players.filter(p => p.type === "ai");
            if (gameMode === "base" && charObj.type === "bounty") {
                warnings.push("The bounty hunter AI deck ships only in the expansion - a base game has no cards for this AI.");
            }
            if (ais.length >= 2) {
                warnings.push("The rules set up at most 2 AI opponents (expansion rulebook p. 11).");
            }
            if (ais.some(a => a.character.type === charObj.type)) {
                warnings.push("The rules pair one bounty hunter with one non-bounty-hunter AI; this repeats a type.");
            }
        }
        if (warnings.length && !confirm(warnings.join("\n\n") + "\n\nAdd them anyway?")) {
            return false;
        }

        usedCharacters.push(charObj.name);
        players.push({type, nickname, character: charObj, color, personalGoalAchieved: false, currentCardIndex: 0});

        if (type === "ai") {
            let deck = shuffleAiDeck(charObj.type);
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
                aiDecks[aiKey] = deck = shuffleAiDeck(player.character.type);
            }
            if (!aiHistory[aiKey]) aiHistory[aiKey] = [];

            let card;
            if (player.currentCardIndex < aiHistory[aiKey].length) {
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
                    aiDecks[aiKey] = deck = shuffleAiDeck(player.character.type);
                    console.log(`AI ${player.nickname} reshuffled deck:`, deck);
                }
            }

            console.log(`AI ${player.nickname} played card: ${card}, remaining deck:`, deck);

            const cardImg = document.createElement("img");
            cardName = card;

            let headerMarker = "";
            const deckSize = shuffleAiDeck(player.character.type).length;
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

    // Shuffled once, at setup. The bounty hunter AI deck exists only in the expansion
    // (Rules Reference p. 22), so there is no base-mode bounty branch.
    function shuffleAiDeck(characterType) {
        return characterType === "smuggler"
            ? (gameMode === "base" ? shuffleArray([...Array(10).keys()].map(n => n + 1)) : shuffleArray([1, 2, 6, 7, 9, "special"]))
            : shuffleArray([1, 2, 3, 4, 5, "special"]);
    }

    async function describeCard(cardName, type) {
        hideHelpButton();
        const player = players[currentPlayerIndex];
        /** type: "human" | "bounty" | "smuggler" */
        const cardDisplay = document.querySelector('#cardDisplay');
        let cardContent = {planning: '', action: '', encounter: '', special: ''};

        if (type === "human") {
            // Preserve canonical human card content exactly
            cardContent = cardsData['player'][gameMode];
        } else {
            // AI cards come from assets/cards/<locale>.json; a character card is stored under
            // the character's id rather than a number.
            try {
                const typeDir = type === 'smuggler' ? 'smuggler' : 'bounty';
                const cardFileName = cardName == 'special' ? player.character.id : cardName;
                const data = cardsData[typeDir][cardFileName];

                // Convert arrays to HTML for phaseElement divs
                ['planning', 'action', 'encounter', 'special'].forEach(section => {
                    if (data[section] && data[section].length) {
                        const pick = picksFor(section, cardFileName);
                        let sectionTitle = cardsData.phases[section].title;
                        let sectionDescription = cardsData.phases[section].hint;
                        // A leading "!." marks a condition line rather than an action
                        // (IG-88's "first 2" clause). It is shown but not selectable, so
                        // it cannot be clicked or counted against the pick limit.
                        const body = data[section].map(item => {
                            const note = item.trim().startsWith('!.');
                            if (note) return `<div class="phaseNote">${item.trim().slice(2).trim()}</div>`;
                            return `<div class="phaseElement">${item}</div>`;
                        }).join('');
                        cardContent[section] = `<div class="phaseItem" data-pick="${pick}">
                        <div class="phaseName">${sectionTitle} <div class="phaseHint">${sectionDescription}</div>` +
                        `</div> ${body}
                    </div>`;
                    }
                });
            } catch (err) {
                console.warn('Failed to load card JSON:', cardName, err);
                ['planning', 'action', 'encounter', 'special'].forEach(section => {
                    cardContent[section] = `<div class="phaseItem"><div class="phaseName">${section}</div><div class="phaseElement">[No data]</div></div>`;
                });
            }
        }

        // Insert HTML into cardDisplay
        const html = Object.values(cardContent).filter(v => v).join('');
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
        if (debug) {
            if (debugSpecial)
                return ['special'];
            return arr;
        }

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


    document.title += ' v' + version;
    document.getElementById("mainTitle").innerHTML += ' v' + version + (debug ? ' <span style="color:red">DEBUG</span>' : '');
});
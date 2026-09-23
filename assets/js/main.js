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

        $('#fullscreen').on('click', function() {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { // Safari/Chrome on iOS
                elem.webkitRequestFullscreen();
            }
        });

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
        return $.getJSON('./cards/'+requested+'.json?'+version)
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
            const options = $select.find('option:not(:disabled)');
            const randomIndex = Math.floor(Math.random() * options.length);
            $select.val(options.eq(randomIndex).val()).change();
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
        const allowed = characters.filter(c => !usedCharacters.includes(c.name) && (gameMode === "expansion" || c.origin === "base"));
        const smugglers = allowed.filter(c => c.type === "smuggler").sort((a, b) => a.name.localeCompare(b.name));
        const bounty = allowed.filter(c => c.type === "bounty").sort((a, b) => a.name.localeCompare(b.name));

        // A second AI must be the other type (UB p. 11), so drop the type already taken.
        // Both lists are narrowed here, before either optgroup is built.
        if (type === "ai") {
            if (gameMode === "base") bounty.length = 0;
            const ais = players.filter(p => p.type === "ai");
            if (ais.length === 1) {
                if (ais[0].character.type === "smuggler") smugglers.length = 0;
                else bounty.length = 0;
            }
        }

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
        const nickname = document.getElementById("playerNickname").value.trim() || document.getElementById("playerNickname").placeholder;
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

        // "Using Multiple AI Opponents" (UB p. 11) sets up one bounty hunter and one
        // non-bounty-hunter character, so two AI at most and never two of a kind.
        if (type === "ai") {
            const ais = players.filter(p => p.type === "ai");
            if (ais.length >= 2) {
                showError("At most 2 AI opponents are allowed.");
                return false;
            }
            if (ais.length === 1 && ais[0].character.type === charObj.type) {
                showError("The 2 AI opponents must be of different types - one smuggler and one bounty hunter.");
                return false;
            }
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


        helpButton.off('click').on("click", handleHelpClick);

        function handleHelpClick() {
            const hidePhaseContainer = false;
            const cardDisplay = $("#cardDisplay");
            const phaseContainer = $("#phaseContainer");
            const prevScreen = $("#helpScreen");
            let content = '';

            if ($(prevScreen).is(':visible')) {
                $(prevScreen).remove();
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
                if (hidePhaseContainer)
                {
                    $(phaseContainer).show();
                }
            });

            cardDisplay.prepend(promptDiv);
            replaceIconsWithImages();


        }

    }

    function hideHelpButton() {
        $('#helpButton').hide();
    }

    async function startGame() {
        await initCards();
        document.getElementById("step1").classList.add("hidden");
        document.getElementById("step2").classList.add("hidden");
        mainTitle.classList.add("hidden");
        container.style.padding = "5px";
        currentPlayerIndex = 0;
        document.getElementById("gameStep").classList.remove("hidden");
        players.forEach(p => {
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
                img.src = `./images/player/${cardFile}?${version}`;
                img.addEventListener("click", () => {
                    const filename = new URL(img.src).pathname.split('/').pop();
                    const prefix = filename.slice(0, -5);
                    const suffix = filename.match(/([a-zA-Z])\.png$/)?.[1];
                    img.src = `./images/player/${prefix}${suffix == "a" ? "b" : "a"}.png?${version}`;
                });
                row1.appendChild(img);
                cardDisplay.appendChild(row1);
            }

            const row2 = document.createElement("div");
            row2.className = 'cardFooter';

            const backBtn = document.createElement("button");
            backBtn.textContent = "Back";
            backBtn.className = "backCard";
            backBtn.onclick = () => {
                currentPlayerIndex = (currentPlayerIndex - 1 + players.length) % players.length;
                const player = players[currentPlayerIndex];
                if (player.type === "ai") {
                    player.currentCardIndex = Math.max(0, player.currentCardIndex - 1);
                }
                showTurn();
            }
            row2.appendChild(backBtn);
            const nextBtn = document.createElement("button");
            nextBtn.textContent = "Next Card";
            nextBtn.className = "nextCard";
            nextBtn.onclick = () => {
                currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
                showTurn();
            };
            row2.appendChild(nextBtn);
            cardDisplay.appendChild(row2);

            const row3 = document.createElement("div");
            row3.textContent = "Personal Goal Achieved: " + player.personalGoalAchieved;
            row3.className = "personalGoalText";
            row3.style.color = player.personalGoalAchieved ? '#4CFF4C' : 'white';
            cardDisplay.appendChild(row3);

            const row4 = document.createElement("div");
            const charImg = document.createElement("img");
            const [name, ext] = player.character.image.split(".");
            charImg.src = `./images/characters/${name}${player.personalGoalAchieved ? "_" : ""}.${ext}?${version}`;
            charImg.addEventListener("click", () => {
                player.personalGoalAchieved = !player.personalGoalAchieved;
                charImg.src = `./images/characters/${name}${player.personalGoalAchieved ? "_" : ""}.${ext}?${version}`;
                row3.textContent = "Personal Goal Achieved: " + player.personalGoalAchieved;
                row3.style.color = player.personalGoalAchieved ? '#4CFF4C' : 'white';
            });
            row4.appendChild(charImg);
            cardDisplay.appendChild(row4);

            header.innerHTML = `<span class="turnHeaderHint">${player.nickname}</span>&nbsp;${player.character.name}`;
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
            if (player.currentCardIndex < aiHistory[aiKey].length - 1) {
                const depth = aiHistory[aiKey].length - player.currentCardIndex - 1;
                headerMarker = ` <span class="turnHeaderHint" title="History depth">-${depth}</span>`;
            }

            if (card === "special") {
                const dir = player.character.type === "smuggler" ? "smuggler" : "bounty";
                cardImg.src = `./images/${dir}/${player.character.image}?${version}`;
                header.innerHTML = `<span class="turnHeaderHint">AI</span>&nbsp;${player.character.name} #special${headerMarker}`;
            } else {
                const dir = player.character.type === "smuggler" ? "smuggler" : "bounty";
                cardImg.src = `./images/${dir}/${card}.png?${version}`;
                header.innerHTML = `<span class="turnHeaderHint">AI</span>&nbsp;${player.character.name} #${card}${headerMarker}`;
            }

            if (useAiCharacterImages) {
                const row0 = document.createElement("div");
                cardImg.style.maxHeight = "75vh";
                row0.appendChild(cardImg);
                cardDisplay.appendChild(row0);
            }

            const row2 = document.createElement("div");
            row2.className = 'cardFooter';

            const backBtn = document.createElement("button");
            backBtn.textContent = "Back";
            backBtn.className = "backCard";
            backBtn.onclick = () => {
                currentPlayerIndex = (currentPlayerIndex - 1 + players.length) % players.length;
                const player = players[currentPlayerIndex];
                if (player.type === "ai") {
                    player.currentCardIndex = Math.max(0, player.currentCardIndex - 1);
                }
                showTurn();
            }

            row2.appendChild(backBtn);


            const nextBtn = document.createElement("button");
            nextBtn.textContent = "Next Card";
            nextBtn.className = "nextCard";
            nextBtn.onclick = () => {
                const player = players[currentPlayerIndex];
                if (player.type === "ai") {
                    player.currentCardIndex++;
                }
                currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
                showTurn();
            };
            row2.appendChild(nextBtn);
            cardDisplay.appendChild(row2);

            // AI players can never complete personal goals or ship goals
            // (Rules Reference p. 22), so the character card is shown unflipped and
            // there is no goal toggle here.
            const row4 = document.createElement("div");
            const charImg2 = document.createElement("img");
            const [name, ext] = player.character.image.split(".");
            charImg2.src = `./images/characters/${name}.${ext}?${version}`;
            row4.appendChild(charImg2);
            cardDisplay.appendChild(row4);

            header.style.color = player.color;
        }

        describeCard(cardName, cardType);
        saveGameState();
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
            // AI cards come from cards/<locale>.json; a character card is stored under
            // the character's id rather than a number.
            try {
                const typeDir = type === 'smuggler' ? 'smuggler' : 'bounty';
                const cardFileName = cardName == 'special' ? player.character.id : cardName;
                const data = cardsData[typeDir][cardFileName];

                // Convert arrays to HTML for phaseElement divs
                ['planning', 'action', 'encounter', 'special'].forEach(section => {
                    if (data[section] && data[section].length) {
                        // AI steps are never a free choice: planning/encounter are a
                        // priority walk ("do the first that applies"), action is "do all
                        // that apply". Either way, picking one bullet must not cross out
                        // the others, so AI cards are always non-exclusive.
                        const multiple = ' multiplePhaseElements';
                        let sectionTitle = cardsData.phases[section].title;
                        let sectionDescription = cardsData.phases[section].hint;
                        cardContent[section] = `<div class="phaseItem${multiple}">
                        <div class="phaseName">${sectionTitle} <div class="phaseHint">${sectionDescription}</div>` +
                        `</div> ${data[section].map(item => `<div class="phaseElement">${item}</div>`).join('')}
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
                const allElements = parentPhaseItem.querySelectorAll('.phaseElement');

                if (parentPhaseItem.classList.contains('multiplePhaseElements')) {
                    if (newEl.classList.contains('active')) {
                        newEl.classList.remove('active');
                    } else {
                        newEl.classList.add('active');
                    }
                } else {
                    const isActive = newEl.classList.contains('active');
                    allElements.forEach(e => e.classList.remove('active', 'crossed'));
                    if (!isActive) {
                        newEl.classList.add('active');
                        allElements.forEach(e => {
                            if (e !== newEl) e.classList.add('crossed');
                        });
                    }
                }
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
            img.src = `./images/assets/${iconType}.png`;
            img.alt = altText;
            img.className = `icon ${iconType}`;

            span.replaceWith(img);
        });
    }


    document.title += ' v' + version;
    document.getElementById("mainTitle").innerHTML += ' v' + version + (debug ? ' <span style="color:red">DEBUG</span>' : '');
});
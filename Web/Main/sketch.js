let cardSrc, cardBackRed, cardBackBlack;

let socket;
let rowdiesFont;

let allStates = { menu: 0, waiting: 1, game: 2 };
let currentState = allStates.menu;
let roundBeginningTime = 0;

let Username = undefined, TrueUsername = undefined, RoomID;

let IsPlayerBlack = false;

let OpponentUsername = null;

let currentPageURL = null;

let IsSpectator = false;

function createSocket() {
    socket = io.connect(currentPageURL);

    socket.on("RoomJoin", response => {
        if (!response.success) {
            menuGUI.JoinGameCode.style('border', '3px solid red');
            menuGUI.JoinGameCode.style('background-color', '#FFCCCC')
            menuGUI.JoinGameCode.input(() => {
                menuGUI.JoinGameCode.style('border', '2px solid black');
                menuGUI.JoinGameCode.style('background-color', 'white');
            });
            return;
        }

        removeMenuGUI();
        RoomID = response.RoomID;
        setupWaitingGUI();
        currentState = allStates.waiting;
    });

    socket.on("MatchStarting", response => {
        roundBeginningTime = response.timeRemaining;
        BlackDeck = response.BlackDeck;
        RedDeck = response.RedDeck;
        IsPlayerBlack = !response.IsPlayerRed;
        IsSpectator = response.IsSpectator;
        TrueUsername = Username;

        if (roundBeginningTime <= 0) {
            if (Username == response.AllPlayerUsernames[0]) OpponentUsername = response.AllPlayerUsernames[1];
            else OpponentUsername = response.AllPlayerUsernames[0];

            cards = [];
            setupGame();
        }
    });

    socket.on("StartMatch", response => {
        IsPlayerBlack = !response.IsPlayerRed;
        IsSpectator = response.IsSpectator;
        roundBeginningTime = -10;

        TrueUsername = Username;
        Username = response.AllPlayerUsernames[IsPlayerBlack ? 1 : 0];
        OpponentUsername = response.AllPlayerUsernames[IsPlayerBlack ? 0 : 1];

        BlackDeck = response.BlackDeck;
        RedDeck = response.RedDeck;
        cards = [];
        setupGame();

        // Setup Game Pops off cards from the deck; reset them. 
        BlackDeck = response.BlackDeck;
        RedDeck = response.RedDeck;

        for (let i = 0; i < 10; i++) {
            cards[i].Value = response.Cards[i].Value;
            cards[i].Colour = response.Cards[i].Colour;
        }
    });

    socket.on("UpdateTick", () => { });

    socket.on("CurrentDeck", callback => {
        callback({
            BlackDeck,
            RedDeck,
            Cards: cards.map(card => { return { Colour: card.Colour, Value: card.Value } })
        });
    });

    socket.on("PlacedCard", args => {
        if (IsPlayerBlack != args.IsPlayerBlack) {
            cards[args.CurrentMove.FromI + 4].Value = args.CurrentMove.FromValue;
            cards[args.CurrentMove.FromI + 4].Colour = args.CurrentMove.FromColour;

            cards[9 - args.CurrentMove.ToI].Value = args.CurrentMove.ToValue;
            cards[9 - args.CurrentMove.ToI].Colour = args.CurrentMove.ToColour;
        } else {
            cards[args.CurrentMove.FromI].Value = args.CurrentMove.FromValue;
            cards[args.CurrentMove.FromI].Colour = args.CurrentMove.FromColour;

            cards[8 + args.CurrentMove.ToI].Value = args.CurrentMove.ToValue;
            cards[8 + args.CurrentMove.ToI].Colour = args.CurrentMove.ToColour;
        }
    });

    socket.on("PoppedDeck", args => {
        if (IsPlayerBlack != args.IsPlayerBlack) {
            cards[args.NewCardIndex + 4].Value = args.NewCardValue;
            cards[args.NewCardIndex + 4].Colour = args.NewCardColour;
        } else {
            cards[args.NewCardIndex].Value = args.NewCardValue;
            cards[args.NewCardIndex].Colour = args.NewCardColour;
        }
    });

    socket.on("GameEnd", endGame);

    socket.on("NewRound", user_cards => {
        if (!IsSpectator)
            gameGUI.toggleEndRound.checked(false);

        BlackDeck.pop();
        RedDeck.pop();

        if (selected) {
            selected.Value = null;
            selected.isSelected = false;
        }

        selected = null;

        let opponentCardIndex = user_cards[OpponentUsername].CardChosenIndex;
        if (opponentCardIndex != null) cards[4 + opponentCardIndex].Value = null;

        let chosenCardA = user_cards[OpponentUsername].CardChosen, chosenCardB = user_cards[Username].CardChosen;
        cards[8].Colour = floor(chosenCardA / 13);
        cards[8].Value = chosenCardA % 13;

        cards[9].Colour = floor(chosenCardB / 13);
        cards[9].Value = chosenCardB % 13;

        setTimeout(checkWin, 500);
    });
}

function checkLose() {
    if (((IsPlayerBlack == false) ? BlackDeck[BlackDeck.length - 1] : RedDeck[RedDeck.length - 1]) > 0) return;
    for (let i = 0; i < 4; i++) {
        if (cards[4 + i].Value != null) return false;
    }
    
    return true;
}

function checkWin() {
    if (((IsPlayerBlack == true) ? BlackDeck[BlackDeck.length - 1] : RedDeck[RedDeck.length - 1]) > 0) return;
    for (let i = 0; i < 4; i++) {
        if (cards[i].Value != null) return false;
    }

    if (!checkLose()) endGame(emitSocketGameWin());
    else endGame({
        Win: 1/2,
        Reason: "You Emptied your Cards at the Same time as your Opponent!"
    });
    
    return true;
}

preload = () => {
    rowdiesFont = loadFont('GoogleFont-Rowdies.ttf');
    cardSrc = loadImage('Cards.png');
    cardBackRed = loadImage('CardBack.png');
    cardBackBlack = loadImage('CardBack.png', () => cardBackBlack.filter(GRAY));
    currentPageURL = getURL();
}

setup = () => {
    createSocket();
    createCanvas(windowWidth - 20, windowHeight - 20);
    createMenuGUI();
}

windowResized = () => {
    resizeCanvas(windowWidth - 20, windowHeight - 20);
    if (currentState == allStates.menu) {
        styleMenuGUI();
    } else if (currentState == allStates.waiting) {
        resizeWiaitingGUI();
    } else if (currentState == allStates.game) {
        resizeGame();
    }
}

let waitingRoomCode = null;

function setupWaitingGUI() {
    waitingRoomCode = createDiv(RoomID);

    resizeWiaitingGUI();
    waitingRoomCode.style('fontFamily', 'Courier New');
    waitingRoomCode.style("color", "#FF00FF");
}

function deleteWaitingGUI() {
    waitingRoomCode.remove();
    waitingRoomCode = null;
}

function resizeWiaitingGUI() {
    waitingRoomCode.style("position", "absolute");
    waitingRoomCode.style("top", (height / 2 + (width / 14)) + "px");
    waitingRoomCode.style("transform", "translateY(-50%)");
    waitingRoomCode.style("fontSize", (width / 7) + "px");
    waitingRoomCode.style("textAlign", "center");
    waitingRoomCode.style("width", "100%");
}

mousePressed = touchStarted = () => {
    if (currentState == allStates.game) {
        setTimeout(() => mousePressedGame(), 100);
    }
}

draw = () => {
    if (currentState == allStates.menu) {
        clear();
        renderMenu();
    } else if (currentState == allStates.waiting) {
        background(100);
        renderWaiting();
    } else if (currentState == allStates.game) {
        background(200);
        renderGame();
    }
}

function renderWaiting() {
    fill(0);
    noStroke();
    textSize(width / 7);
    textAlign(CENTER, CENTER);
    textFont(rowdiesFont);
    text('Join Code:', width / 2, height / 2 - (width / 14));

    if (roundBeginningTime > 0) {
        fill(0);
        textSize(width / 14);
        textAlign(CENTER, CENTER);
        textFont(rowdiesFont);
        text("Time Until Round Starts: " + roundBeginningTime, width / 2, height / 2 - 3 * (width / 14));
    }
}

function checkUsername(username) {
    const usernameError = (errorString) => {
        const errMsg = createP(errorString);
        const usernamePosition = menuGUI["Username"].position();
        errMsg.position(usernamePosition.x + 220, usernamePosition.y);
        errMsg.style('fontWeight', 'bold');
        errMsg.style('fontSize', '20px');
        errMsg.style('fontFamily', 'Courier New');
        errMsg.style('color', 'red');

        setTimeout(() => errMsg.remove(), 1000);
        return null;
    };

    if (username.length < 3) return usernameError("Username Too Short!");
    if (username.length > 13) return usernameError("Username Too Long!");

    if (username.match(/^[a-zA-Z0-9\ ]+$/) == null) return usernameError("Username Can Only Contain Letters and Numbers!");

    return username;
}

function hostGame() {
    Username = checkUsername(menuGUI["Username"].value());
    if (!Username) return;
    socket.emit('CreateRoom', { Username });
}

function joinGame() {
    Username = checkUsername(menuGUI["Username"].value());
    if (!Username) return;
    RoomID = menuGUI["JoinGameCode"].value().toUpperCase();
    socket.emit('JoinRoom', { Username, RoomID });
}

let menuGUI = {
    Username: null,
    HostGameBtn: null,
    JoinGameCode: null,
    JoinGameBtn: null, 
    InstructionsLink: null
};

function createMenuGUI() {
    // USERNAME - INPUT
    menuGUI['Username'] = createInput(TrueUsername ? TrueUsername : '');
    menuGUI['Username'].elt.placeholder = 'Enter Username';
    menuGUI['Username'].elt.setAttribute('maxlength', 13);

    // HOST GAME - BUTTON
    menuGUI['HostGameBtn'] = createButton('Host Game');
    menuGUI['HostGameBtn'].mousePressed(hostGame);

    // JOIN GAME CODE - INPUT
    menuGUI['JoinGameCode'] = createInput('');
    menuGUI['JoinGameCode'].elt.placeholder = 'Enter Join Code';
    menuGUI['JoinGameCode'].elt.setAttribute('maxlength', 8);
    menuGUI['JoinGameCode'].elt.style.textTransform = 'uppercase';

    menuGUI['JoinGameBtn'] = createButton('Join Game');
    menuGUI['JoinGameBtn'].mousePressed(joinGame);

    menuGUI['InstructionsLink'] = createA(`${currentPageURL}instructions/`, 'How to Play');
    menuGUI['InstructionsLink'].style('font-family', 'Cursive');

    styleMenuGUI();

    document.body.style.backgroundImage = 'url(Cards.png)';
    document.body.style.backgroundRepeat = 'repeat';
    document.body.style.backgroundBlendMode = 'lighten';
    document.body.style.backgroundColor = '#DDDDDD';
}

function styleMenuGUI() {
    const size = map(width, 300, 1500, 3, 7);
    const splitH = map(width, 300, 1500, 70, 120);
    const splitV = map(width, 300, 1500, 40, 80);

    setElementStyle(
        menuGUI["Username"],
        width / 2, height * 5 / 8,
        width / size, width / (4 * size), null,
        null, 'darkred'
    );

    setElementStyle(
        menuGUI["HostGameBtn"],
        width / 2, height * 5 / 8 + splitV,
        width / size, width / (4 * size), null,
        '#FFFFAA', '#C24E00'
    );

    setElementStyle(
        menuGUI["JoinGameCode"],
        width / 2 - splitH, height * 5 / 8 + 2 * splitV,
        width / size, width / (4 * size), width / (10 * size),
        null, 'darkred'
    );

    setElementStyle(
        menuGUI["JoinGameBtn"],
        width / 2 + splitH, height * 5 / 8 + 2 * splitV,
        width / size, width / (4 * size), width / (10 * size),
        '#5AAE40', 'white'
    );

    setElementStyle(
        menuGUI["InstructionsLink"],
        width / 2, height / 3 + width / 20,
        width / size, width / (4 * size), null,
        null, null
    );
}

function removeMenuGUI() {
    for (let key in menuGUI) {
        menuGUI[key].remove();
    }

    document.body.style.backgroundImage = '';
    document.body.style.backgroundRepeat = '';
    document.body.style.backgroundBlendMode = '';

    document.body.style.backgroundColor = '#AAAAAA';
}

function setElementStyle(elem, posx, posy, width, height, textSize, bgcolour, fntcolour) {
    elem.position(posx - width / 2, posy - height / 2);

    if (width) elem.style('width', `${width}px`);
    if (height) elem.style('height', `${height}px`);

    if (width && height) {
        elem.style('textAlign', 'center');
        elem.style('borderRadius', '8px');
    }

    if (textSize) elem.style('fontSize', `${textSize}px`);
    else elem.style('fontSize', `${height * 1 / 2}px`);

    elem.style('userSelect', 'none');

    if (bgcolour)
        elem.style('backgroundColor', bgcolour);
    if (fntcolour)
        elem.style('color', fntcolour);
}


function renderMenu() {
    textSize(width * 1 / 5);
    textAlign(CENTER, BASELINE);
    textFont(rowdiesFont);
    text("SPEED", width / 2, height * 1 / 3);

    textFont('Courier New');
    textSize(map(width, 300, 1500, width / 15, width / 25));
    const splitV = map(width, 300, 1500, 30, 50);
    text("Username", width / 2, height * 5 / 8 - splitV);
}

const min = (a, b) => (a < b ? a : b);

let BlackDeck = [];
let RedDeck = [];
let cards = [];
let gameGUI = {
    toggleEndRound: null
};

let gameEndedState = null;
let gameEndedCountDown = 0;

function endGame(state) {
    if (!IsSpectator)
        gameGUI.toggleEndRound.remove();

    gameEndedState = state;
    gameEndedCountDown = 10;
    const interval = setInterval(() => {
        gameEndedCountDown--;
        if (gameEndedCountDown <= 0) {
            currentState = allStates.menu;
            createMenuGUI();
            return clearInterval(interval);
        }
    }, 1000);
}

function emitSocketGameWin() {
    const state = {
        Username,
        RoomID,

        Win: true,
        Reason: "You Emptied Your Cards Before Your Opponent!"
    };

    socket.emit("GameWin", state);
    return state;
}

function emitSocketGameNewRound() {
    if (IsSpectator) return;

    let CardChosenIndex = null;
    let CardChosen = ((IsPlayerBlack == true) ? BlackDeck[BlackDeck.length - 1] : RedDeck[RedDeck.length - 1])
    if (CardChosen == null && gameGUI.toggleEndRound.checked()) {
        let count = 0;
        let first = null;
        for (let i = 0; i < 4; i++) {
            if (cards[i].Value != null) {
                count++;
                if (first == null) first = cards[i];
            }
        }

        if (count <= 0) return endGame(emitSocketGameWin());
        else if (count > 1) {
            if (!selected) {
                const cardWidth = min(max(width / 8, 150), height / 3.37) - 80;
                const errMsg = createElement('center', 'Deck Empty! Select a Card, Then re-press the Button!');
                errMsg.position(width / 2, height - (cardWidth * 14 / 9 + 20));
                errMsg.style('fontWeight', 'bold');
                errMsg.style('textAlign', 'center');
                errMsg.style('fontSize', '20px');
                errMsg.style('fontFamily', 'Courier New');
                errMsg.style('color', 'red');

                gameGUI.toggleEndRound.checked(false);

                setTimeout(() => errMsg.remove(), 2000);
                return;
            }

            CardChosen = selected.Value + 13 * selected.Colour;
            CardChosenIndex = selected.i;
        } else {
            CardChosen = first.Value + 13 * first.Colour;
            CardChosenIndex = first.i;
            selected = first;
        }
    }

    socket.emit("EndRound", {
        Username,
        RoomID,
            
        State: gameGUI.toggleEndRound.checked(),
        CardChosen: {
            CardChosen,
            CardChosenIndex
        }
    });
}

function setupGameGUI() {
    gameGUI.toggleEndRound = createCheckbox("End Round");
    setElementStyle(gameGUI.toggleEndRound, 175 / 2 + 10, height / 2, 175, 35, 25, '#BBFFFF', '#880000');
    gameGUI.toggleEndRound.input(emitSocketGameNewRound);
}

function setupGame() {
    deleteWaitingGUI();
    currentState = allStates.game;

    if (!IsSpectator)
        setupGameGUI();

    const total_space = min(max(width / 8, 150), height / 3.37) - 20;
    const cardWidth = total_space - 60;

    for (let i = 0; i < 4; i++) {
        const newCard = new Card(
            i,
            (width / 2) + total_space * (i - 1.5),
            height - (cardWidth * 7 / 9),
            cardWidth,
            cardWidth * 7 / 5
        );

        const chosen = (IsPlayerBlack == true) ? BlackDeck.pop() : RedDeck.pop();
        newCard.Colour = floor(chosen / 13);
        newCard.Value = chosen % 13;
        cards.push(newCard);
    }

    for (let i = 0; i < 4; i++) {
        const newCard = new Card(
            i,
            (width / 2) + total_space * (i - 1.5),
            cardWidth * 7 / 9,
            cardWidth,
            cardWidth * 7 / 5
        );

        const chosen = (IsPlayerBlack == false) ? BlackDeck.pop() : RedDeck.pop();
        newCard.Colour = floor(chosen / 13);
        newCard.Value = chosen % 13;
        cards.push(newCard);
    }

    const bigCardSpace = total_space + 90;
    const bigCardWidth = cardWidth + 90;
    for (let i = 0; i < 2; i++) {
        const newCard = new Card(
            i,
            (width / 2) + bigCardSpace * (i - 0.5),
            height / 2,
            bigCardWidth,
            bigCardWidth * 7 / 5
        );

        const chosen = (i == (IsPlayerBlack == true)) ? BlackDeck.pop() : RedDeck.pop();
        newCard.Colour = floor(chosen / 13);
        newCard.Value = chosen % 13;
        cards.push(newCard);
    }

    document.body.style.backgroundColor = '#CCCCCC';
    
    resizeGame();
}

let deckAttributes = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isSelected: false
}

function renderGame() {
    for (let card of cards) {
        card.render();
    }

    const cardBackImage = (IsPlayerBlack == true) ? cardBackBlack : cardBackRed;

    fill(255);
    stroke(deckAttributes.isSelected ? color(100, 100, 255) : 0);
    strokeWeight(5);
    rectMode(CENTER);
    imageMode(CENTER);

    rect(deckAttributes.x, deckAttributes.y, deckAttributes.width, deckAttributes.height);
    image(cardBackImage, deckAttributes.x, deckAttributes.y, deckAttributes.width, deckAttributes.height);

    if (gameEndedCountDown > 0) {
        noStroke();
        fill(255, 175, 130, 220);
        rectMode(CORNER);
        rect(0, 0, width, height);

        fill(0);
        noStroke();
        textSize(width / 10);
        textAlign(CENTER, CENTER);
        textFont(rowdiesFont);

        if (IsSpectator) text(gameEndedState.WinnerUser + ' Wins!', width / 2, height / 3);
        else if (gameEndedState.Win === true) text('You Win!', width / 2, height / 3);
        else if (gameEndedState.Win == 1/2) text('You Tied!', width / 2, height / 3);
        else text('You Lose!', width / 2, height / 3);

        stroke(0);
        strokeWeight(2);
        textFont('Courier New');
        textSize(25);
        text(gameEndedState.Reason, width / 2, height / 3 + 100);
    } else {
        textSize(30);
        strokeWeight(2);
        stroke(100, 100, 255);
        textFont('Comic Sans');
        textAlign(CENTER, TOP);
        const cardWidth = min(max(width / 8, 150), height / 3.37) - 80;
        text(OpponentUsername, width / 2, cardWidth * 14 / 9 + 10);

        if (IsSpectator || gameGUI.toggleEndRound.checked()) {
            noStroke();
            fill(255, 150);
            rectMode(CORNER);
            rect(0, 0, width, height);
        }
    }
}

function resizeGame() {
    const tsp = map(height, 200, 700, max(width / 8, 150) - 10, max(width / 8, 150));
    const total_space = map(width, 300, 1500, tsp * 0.5, tsp - 30);
    const cardWidth = tsp - 100;
    const offset = map(width, 300, 1500, 2, 1.5);

    for (let i = 0; i < 4; i++) {
        cards[i].x = (width / 2) + total_space * (i - offset);
        cards[i].y = height - (cardWidth * 7 / 9);
        cards[i].width = cardWidth;
        cards[i].height = cardWidth * 7 / 5;
    }

    for (let i = 0; i < 4; i++) {
        cards[i + 4].x = (width / 2) + total_space * (i - 1.5);
        cards[i + 4].y = cardWidth * 7 / 9;
        cards[i + 4].width = cardWidth;
        cards[i + 4].height = cardWidth * 7 / 5;
    }

    const bigCardSpace = total_space + 90;
    const bigCardWidth = cardWidth + 90;
    for (let i = 0; i < 2; i++) {
        cards[i + 8].x = (width / 2) + bigCardSpace * (i - 0.5);
        cards[i + 8].y = height / 2;
        cards[i + 8].width = bigCardWidth;
        cards[i + 8].height = bigCardWidth * 7 / 5;
    }

    const cardBackWidth = cardWidth + 20;
    deckAttributes.x = (width / 2) + total_space * map(width, 300, 1500, 2, 2.4);
    deckAttributes.y = height - (cardBackWidth * 7 / 8) - 10;
    deckAttributes.width = cardBackWidth;
    deckAttributes.height = cardBackWidth * 7 / 4;

    if (!IsSpectator)
        setElementStyle(gameGUI.toggleEndRound, 175 / 2 + 10, height / 2, 175, 35, 25, '#BBFFFF', '#880000');
}

let selected = null;

function emitSocketGameCardPlace(from, to) {
    socket.emit("CardPlace", {
        Username,
        RoomID,
        IsPlayerBlack,

        CurrentMove: {
            FromI: from.i, ToI: to.i,
            FromValue: from.Value, ToValue: to.Value,
            FromColour: from.Colour, ToColour: to.Colour
        }
    });
}

function emitSocketGameDeckRemove(cardIndex) {
    socket.emit("DeckPop", {
        Username,
        RoomID,
        IsPlayerBlack,

        NewCardValue: cards[cardIndex].Value,
        NewCardColour: cards[cardIndex].Colour,
        NewCardIndex: cardIndex
    });
}

function deckClicked() {
    if (((IsPlayerBlack == true) ? BlackDeck.length : RedDeck.length) <= 0) return;

    for (let i = 0; i < 4; i++) {
        if (cards[i].Value == null) {
            const chosen = (IsPlayerBlack == true) ? BlackDeck.pop() : RedDeck.pop();
            cards[i].Colour = floor(chosen / 13);
            cards[i].Value = chosen % 13;
            emitSocketGameDeckRemove(i);
            return;
        }
    }
}

function mousePressedGame() {
    if (abs(mouseX - (175 / 2 + 10)) <= (175 / 2) && abs(mouseY - height / 2) <= (35 / 2)) return;
    if (IsSpectator) return;
    if (gameGUI.toggleEndRound.checked()) return;

    const prev = selected;

    if (!prev) {
        for (let i = 0; i < 4; i++)
            if (cards[i].checkSelected()) { selected = cards[i]; return; }

        if (deckAttributes.isSelected = (
            (mouseX - deckAttributes.x < deckAttributes.width / 2) && (mouseX - deckAttributes.x > -deckAttributes.width / 2) &&
            (mouseY - deckAttributes.y < deckAttributes.height / 2) && (mouseY - deckAttributes.y > -deckAttributes.height / 2)
        )) {
            deckClicked();
            setTimeout(() => { deckAttributes.isSelected = false; }, 100);
        }
        return;
    }

    prev.isSelected = false;
    selected = null;

    for (let i = 8; i < 10; i++) {
        if (cards[i].checkSelected()) {
            cards[i].isSelected = false;

            if (abs(cards[i].Value - prev.Value) != 1) {
                if (!((cards[i].Value == 12 && prev.Value == 0) || (prev.Value == 12 && cards[i].Value == 0))) {
                    prev.isTinted = true;
                    setTimeout(() => { prev.isTinted = false; }, 1000);
                    return;
                }
            }

            cards[i].Colour = prev.Colour;
            cards[i].Value = prev.Value;
            prev.Colour = null;
            prev.Value = null;

            emitSocketGameCardPlace(prev, cards[i]);

            if (((IsPlayerBlack == true) ? BlackDeck.length : RedDeck.length) > 0) return;

            for (let i = 0; i < 4; i++) {
                if (cards[i].Value !== null) return;
            }

            return endGame(emitSocketGameWin());
        }
    }
}

class Card {
    constructor(i, x, y, width, height) {
        this.Colour = 0;
        this.Value = 0;

        this.SourceX = 0;
        this.SourceY = 0;
        this.SourceWidth = 0;
        this.SourceHeight = 0;

        this.i = i;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        this.isSelected = false;
        this.isTinted = false;
    }

    checkSelected() {
        return (
            this.isSelected = (
                (mouseX - this.x < this.width / 2) && (mouseX - this.x > -this.width / 2) &&
                (mouseY - this.y < this.height / 2) && (mouseY - this.y > -this.height / 2)
            )
        );
    }

    calculatePos() {
        const i = this.Value, j = this.Colour;

        this.SourceX = (67.2 * i + 1) + (2 * (i != 0));
        this.SourceY = 106 * j + (2 * (i != 0));

        this.SourceWidth = 64 - (4 * (i != 0));
        this.SourceHeight = 99 - (5 * (i != 0));
    }

    render() {
        this.calculatePos();

        rectMode(CENTER);

        if (this.isTinted) {
            fill(200, 150, 200);
            stroke(this.isSelected ? color(50, 50, 200) : color(150, 50, 150));
        } else {
            fill(255);
            stroke(this.isSelected ? color(100, 100, 255) : 0);
        }

        strokeWeight(5);
        rect(this.x, this.y, this.width + 10, this.height + 10);

        if (this.Value != null) {
            if (this.isTinted) tint(200, 150, 200);
            imageMode(CENTER);
            image(
                cardSrc,
                this.x, this.y, this.width, this.height,
                this.SourceX, this.SourceY, this.SourceWidth, this.SourceHeight
            );
            if (this.isTinted) tint(255);
        }
    }
}
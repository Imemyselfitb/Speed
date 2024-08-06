let i = 0, j = 0;
let cardSrc, cardBackRed, cardBackBlack;

let socket;
let rowdiesFont;

let allStates = { menu: 0, waiting: 1, game: 2 };
let currentState = allStates.menu;
let roundBeginningTime = null;

let Username, RoomID;

function createSocket() {
    socket = io.connect("http://localhost:3000");

    socket.on("RoomJoin", response => {
        if (!response.success) {
            console.error(response);
            return;
        }

        removeMenuGUI();
        RoomID = response.RoomID;
        currentState = allStates.waiting;
    });

    socket.on("MatchStarting", response => {
        roundBeginningTime = response.timeRemaining;
        BlackDeck = response.BlackDeck;
        RedDeck = response.RedDeck;
        IsPlayerBlack = !response.IsPlayerRed;
        roundBeginningTime = response.timeRemaining;

        console.log(response);
        if (roundBeginningTime < 0) {
            setupGame();
        }
    });

    socket.on("UpdateTick", () => { });

    socket.on("PlacedCard", args => {
        cards[args.CurrentMove.FromI + 4].Value = args.CurrentMove.FromValue;
        cards[args.CurrentMove.FromI + 4].Colour = args.CurrentMove.FromColour;

        cards[9 - args.CurrentMove.ToI].Value = args.CurrentMove.ToValue;
        cards[9 - args.CurrentMove.ToI].Colour = args.CurrentMove.ToColour;
    });

    socket.on("PoppedDeck", args => {
        cards[args.NewCardIndex + 4].Value = args.NewCardValue;
        cards[args.NewCardIndex + 4].Colour = args.NewCardColour;
    });
}

function preload() {
    rowdiesFont = loadFont('GoogleFont-Rowdies.ttf');
    cardSrc = loadImage('Cards.png');
    cardBackRed = loadImage('CardBack.png');
    cardBackBlack = loadImage('CardBack.png', () => cardBackBlack.filter(GRAY));
}

let cardTileX = 0, cardTileY = 0, cardTileWidth = 64, cardTileHeight = 99;
function setup() {
    createSocket();
    createCanvas(windowWidth - 20, windowHeight - 20);

    createMenuGUI();
}

function windowResized() {
    resizeCanvas(windowWidth - 20, windowHeight - 20);
    if (currentState == allStates.menu) {
        styleMenuGUI();
    } else if (currentState == allStates.game) {
        resizeGame();
    }
}

function mousePressed() {
    if (currentState == allStates.game) {
        mousePressedGame();
    }
}

function draw() {
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
    textSize(width / 7);
    textAlign(CENTER, CENTER);
    textFont(rowdiesFont);
    text('Join Code:', width / 2, height / 2 - (width / 14));

    fill(255, 0, 255);
    textSize(width / 7);
    textFont('Courier New');
    text(RoomID, width / 2, height / 2 + (width / 14));

    if (roundBeginningTime != null) {
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
    JoinGameBtn: null
};

function createMenuGUI() {
    // USERNAME - INPUT
    menuGUI["Username"] = createInput('');
    menuGUI["Username"].elt.placeholder = 'Enter Username';
    menuGUI["Username"].elt.setAttribute('maxlength', 13);

    // HOST GAME - BUTTON
    menuGUI["HostGameBtn"] = createButton('Host Game');
    menuGUI["HostGameBtn"].mousePressed(hostGame);

    // JOIN GAME CODE - INPUT
    menuGUI["JoinGameCode"] = createInput('');
    menuGUI["JoinGameCode"].elt.placeholder = 'Enter Join Code';
    menuGUI["JoinGameCode"].elt.setAttribute('maxlength', 8);
    menuGUI["JoinGameCode"].elt.style.textTransform = 'uppercase';

    menuGUI["JoinGameBtn"] = createButton('Join Game');
    menuGUI["JoinGameBtn"].mousePressed(joinGame);

    styleMenuGUI();

    document.body.style.backgroundImage = 'url(Cards.png)';
    document.body.style.backgroundRepeat = 'repeat';
    document.body.style.backgroundBlendMode = 'lighten';
    document.body.style.backgroundColor = '#DDDDDD';
}

function styleMenuGUI() {
    setMenuStyle(
        menuGUI["Username"],
        width / 2, height * 5 / 8,
        200, 50, null,
        null, 'darkred'
    );

    setMenuStyle(
        menuGUI["HostGameBtn"],
        width / 2, height * 5 / 8 + 80,
        200, 50, null,
        '#FFFFAA', '#C24E00'
    );

    setMenuStyle(
        menuGUI["JoinGameCode"],
        width / 2 - 120, height * 5 / 8 + 160,
        200, 50, 20,
        null, 'darkred'
    );

    setMenuStyle(
        menuGUI["JoinGameBtn"],
        width / 2 + 120, height * 5 / 8 + 161,
        200, 50, null,
        '#5AAE40', 'white'
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

function setMenuStyle(elem, posx, posy, width, height, textSize, bgcolour, fntcolour) {
    elem.position(posx - width / 2, posy - height / 2);

    if (width) elem.style('width', `${width}px`);
    if (height) elem.style('height', `${height}px`);

    if (width && height) {
        elem.style('textAlign', 'center');
        elem.style('borderRadius', '8px');
    }

    if (textSize) elem.style('fontSize', `${textSize}px`);
    else elem.style('fontSize', `${height * 1 / 2}px`);

    if (bgcolour)
        elem.style('backgroundColor', bgcolour);
    if (fntcolour)
        elem.style('color', fntcolour);
}


function renderMenu() {
    textSize(width * 1/5);
    textAlign(CENTER, BASELINE);
    textFont(rowdiesFont);
    text("SPEED", width / 2, height * 1 / 3);

    textFont('Courier New');
    textSize(height * 1 / 12);
    text("Username", width / 2, height * 5 / 8 - 50);
}

const min = (a, b) => (a < b ? a : b);

let BlackDeck = [];
let RedDeck = [];
let PlayerIsBlack = Math.random() > 0.5;

let cards = [];

function setupGame() {
    console.log("Player Is Black?", IsPlayerBlack);

    currentState = allStates.game;

    const total_space = min(max(width / 8, 150), height / 3.37) + 20;
    const cardWidth = total_space - 100;

    for (let i = 0; i < 4; i++) {
        const newCard = new Card(
            i,
            (width / 2) + total_space * (i - 1.5),
            height - (cardWidth * 7 / 9),
            cardWidth,
            cardWidth * 7 / 5
        );

        const chosen = (PlayerIsBlack == true) ? BlackDeck.pop() : RedDeck.pop();
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

        const chosen = (PlayerIsBlack == false) ? BlackDeck.pop() : RedDeck.pop();
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

        const chosen = (i == (PlayerIsBlack == true)) ? BlackDeck.pop() : RedDeck.pop();
        newCard.Colour = floor(chosen / 13);
        newCard.Value = chosen % 13;
        cards.push(newCard);
    }

    const cardBackWidth = total_space - 80;
    deckAttributes.x = (width / 2) + total_space * 2.25;
    deckAttributes.y = height - (cardBackWidth * 7 / 8) - 10;
    deckAttributes.width = cardBackWidth;
    deckAttributes.height = cardBackWidth * 7 / 4
    document.body.style.backgroundColor = '#CCCCCC';
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
    
    const cardBackImage = (PlayerIsBlack == true) ? cardBackBlack : cardBackRed;

    fill(255);
    stroke(deckAttributes.isSelected ? color(100, 100, 255) : 0);
    strokeWeight(5);
    rectMode(CENTER);
    imageMode(CENTER);

    rect(deckAttributes.x, deckAttributes.y, deckAttributes.width, deckAttributes.height);
    image(cardBackImage, deckAttributes.x, deckAttributes.y, deckAttributes.width, deckAttributes.height);
}

function resizeGame() {
    const total_space = min(max(width / 8, 150), height / 3.37) + 20;
    const cardWidth = total_space - 100;

    for (let i = 0; i < 4; i++) {
        cards[i].x = (width / 2) + total_space * (i - 1.5);
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

    const cardBackWidth = total_space - 80;
    deckAttributes.x = (width / 2) + total_space * 2.25;
    deckAttributes.y = height - (cardBackWidth * 7 / 8) - 10;
    deckAttributes.width = cardBackWidth;
    deckAttributes.height = cardBackWidth * 7 / 4
}

let selected = null;

function emitSocketGameCardPlace(from, to) {
    socket.emit("CardPlace", {
        Username,
        RoomID,

        // CurrentBoard: cards.map(card => card.Value + 4 * card.Colour),
        // CurrentDeck: (PlayerIsBlack == true) ? BlackDeck : RedDeck,
        // CurrentDeckColour: { Black: PlayerIsBlack, Red: !PlayerIsBlack },

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

        NewCardValue: cards[cardIndex].Value,
        NewCardColour: cards[cardIndex].Colour,
        NewCardIndex: cardIndex
    });
}

function deckClicked() {
    if (((PlayerIsBlack == true) ? BlackDeck.length : RedDeck.length) <= 0) return;

    for (let i = 0; i < 4; i++) {
        if (cards[i].Value == null) {
            const chosen = (PlayerIsBlack == true) ? BlackDeck.pop() : RedDeck.pop();
            cards[i].Colour = floor(chosen / 13);
            cards[i].Value = chosen % 13;
            emitSocketGameDeckRemove(i);
            return;
        }
    }
}

function mousePressedGame() {
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
                prev.isTinted = true;
                setTimeout(() => { prev.isTinted = false; }, 1000);
                return;
            }

            cards[i].Colour = prev.Colour;
            cards[i].Value = prev.Value;
            prev.Colour = null;
            prev.Value = null;

            emitSocketGameCardPlace(prev, cards[i]);
            return;
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
                (mouseX - this.x < this.width  / 2) && (mouseX - this.x > -this.width  / 2) &&
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

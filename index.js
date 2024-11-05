const express = require('express');
const run_socket_server = require("socket.io");

const app = express();
const port = process.env.PORT || 3000;

const server = app.listen(port);
app.use('/', express.static('Web/Main'));
app.use('/instructions/', express.static('Web/Instructions'));
console.log(`MY SOCKET SERVER IS RUNNING AT PORT ${port}`);

const io = run_socket_server(server);

const RoomID_lowerBound = parseInt("100000", 36);
const RoomID_upperBound = parseInt("ZZZZZZ", 36);

class Connection {
    constructor(sck) {
        this.socket = sck;
        this.socket_id = sck.id;

        this.is_host = false;
        this.username = null;
        this.room_id = null;

        this.ending_round = false;
        this.ending_card = null;

        this.is_red = true;

        this.is_spectator = false;
        this.initiated = false;
    }

    generateRoomID() {
        const randInt = Math.floor(RoomID_lowerBound + Math.random() * (RoomID_upperBound - RoomID_lowerBound));
        this.room_id = randInt.toString(36).toUpperCase();
    }
}

const shuffle = (array, b, c, d) => {
    c = array.length; while (c) b = Math.random() * c-- | 0, d = array[c], array[c] = array[b], array[b] = d; return array;
}

const rooms = {};
io.sockets.on('connection', socket => {
    const currentConnect = new Connection(socket);

    socket.on('CreateRoom', args => {
        currentConnect.is_spectator = false;
        currentConnect.username = args.Username;
        currentConnect.is_host = true;
        currentConnect.generateRoomID();
        rooms[currentConnect.room_id] = [currentConnect];
        socket.emit("RoomJoin", { success: true, Username: args.Username, RoomID: currentConnect.room_id });
    });

    socket.on('JoinRoom', args => {
        if (rooms[args.RoomID] == undefined) {
            socket.emit("RoomJoin", { success: false, Username: args.Username, RoomID: args.RoomID, reason: "Room Not Found!" });
            return;
        }

        if (rooms[args.RoomID].find(connect => connect.username == args.Username) != null) {
            socket.emit("RoomJoin", { success: false, Username: args.Username, RoomID: args.RoomID, reason: "Username Taken!" });
            return;
        }

        currentConnect.is_spectator = (rooms[args.RoomID].length >= 2);
        currentConnect.username = args.Username;
        currentConnect.room_id = args.RoomID;
        rooms[args.RoomID].push(currentConnect);
        socket.emit("RoomJoin", { success: true, Username: args.Username, RoomID: args.RoomID });

        if (rooms[args.RoomID].length == 2) {
            let timeRemaining = 5;

            const DeckSize = 13 * 2;
            const BlackDeck = shuffle(Array(DeckSize).fill(0).map((_elem, index) => ((index < 13) ? index : index + 13)));
            const RedDeck = shuffle(Array(DeckSize).fill(0).map((_elem, index) => 13 + ((index < 13) ? index : index + 13)));

            /*
            const redPlayerIndices = [];
            for (let i = 0; i < rooms[args.RoomID].length / 2; i++) {
                let index = Math.floor(Math.random() * rooms[args.RoomID].length);
                while (redPlayerIndices.includes(index))
                    index = Math.floor(Math.random() * rooms[args.RoomID].length);
                
                redPlayerIndices.push(index);
            }
            */
            const redPlayerIndices = [Math.floor(Math.random() * 2)];

            const AllPlayerUsernames = rooms[args.RoomID].map(connection => connection.username);
            const countDown = setInterval(() => {
                for (let i = 0; i < rooms[args.RoomID].length; i++) {
                    rooms[args.RoomID][i].socket.emit("MatchStarting", {
                        timeRemaining, BlackDeck, RedDeck,
                        IsPlayerRed: redPlayerIndices.includes(i),
                        IsSpectator: rooms[args.RoomID][i].is_spectator,
                        AllPlayerUsernames
                    });

                    rooms[args.RoomID][i].is_red = redPlayerIndices.includes(i);

                    if (timeRemaining <= 0)
                        rooms[args.RoomID][i].initiated = true;
                }

                if (timeRemaining <= 0) clearInterval(countDown);
                timeRemaining--;
            }, 1000);
        } else if (rooms[args.RoomID][0].initiated) {
            rooms[args.RoomID][0].socket.emit("CurrentDeck", ({ BlackDeck, RedDeck, Cards }) => {
                const AllPlayerUsernames = rooms[args.RoomID].map(connection => connection.username);
                socket.emit("StartMatch", {
                    BlackDeck, RedDeck,
                    IsPlayerRed: rooms[args.RoomID][0].is_red,
                    IsSpectator: true,
                    AllPlayerUsernames,
                    Cards
                });
            });
        }
    });

    socket.on("CardPlace", args => {
        for (let user of rooms[args.RoomID]) {
            if (args.Username == user.username) continue;
            user.socket.emit("PlacedCard", args);
        }
    });

    socket.on("DeckPop", args => {
        for (let user of rooms[args.RoomID]) {
            if (args.Username == user.username) continue;
            user.socket.emit("PoppedDeck", args);
        }
    });

    socket.on("EndRound", args => {
        let count = 0;

        for (let user of rooms[args.RoomID]) {
            if (args.Username == user.username) {
                user.ending_round = args.State;
                user.ending_card = args.CardChosen;
            }

            if (user.ending_round) count++;
        }

        if (count < 2) return;

        for (let user of rooms[args.RoomID]) {
            user.ending_round = false;
            let user_cards = {}; rooms[args.RoomID].forEach(connection => user_cards[connection.username] = connection.ending_card);
            user.socket.emit("NewRound", user_cards);
        }
    });

    socket.on("GameWin", args => {
	    if (rooms[args.RoomID] == null) return;
        for (let user of rooms[args.RoomID]) {
            if (args.Username != user.username)
                user.socket.emit(
                    "GameEnd",
                    { WinnerUser: currentConnect.username, Win: false, Reason: "Opponent Emptied Their Cards Before You!" }
                );

            user.room_id = null;
        }

        delete rooms[args.RoomID];
    });

    const tickUpdate = setInterval(() => {
        socket.emit("UpdateTick");
    }, 10000);

    socket.on('disconnect', () => {
        clearInterval(tickUpdate);

        if (currentConnect.room_id && rooms[currentConnect.room_id]) {
            for (let user = rooms[currentConnect.room_id].length - 1; user >= 0; user--) {
                if (rooms[currentConnect.room_id][user].username == currentConnect.username)
                    rooms[currentConnect.room_id].splice(user);
                else if (!currentConnect.is_spectator) {
                    rooms[currentConnect.room_id][user].socket.emit(
                        "GameEnd",
                        { WinnerUser: rooms[currentConnect.room_id][0].username, Win: true, Reason: "Opponent Disconnected!" }
                    );
                }
            }

            if (!currentConnect.is_spectator) {
                delete rooms[currentConnect.room_id];
            }
        }
    });
});

io.disconnectSockets();

const express = require('express');
const run_socket_server = require("socket.io");

const app = express();
const port = 3000;

const server = app.listen(port);
app.use(express.static("Web"));
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
const connections = {};
io.sockets.on('connection', socket => {
    const currentConnect = new Connection(socket);
    connections[socket.id] = currentConnect;

    socket.on('CreateRoom', args => {
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

        currentConnect.username = args.Username;
        currentConnect.room_id = args.RoomID;
        rooms[args.RoomID].push(currentConnect);
        socket.emit("RoomJoin", { success: true, Username: args.Username, RoomID: args.RoomID });

        if (rooms[args.RoomID].length >= 2) {
            let timeRemaining = 1;

            const DeckSize = 13 * 2;
            const BlackDeck = shuffle(Array(DeckSize).fill(0).map((_elem, index) => ((index < 13) ? index : index + 13)));
            const RedDeck = shuffle(Array(DeckSize).fill(0).map((_elem, index) => 13 + ((index < 13) ? index : index + 13)));

            const redPlayerIndices = [];
            for (let i = 0; i < rooms[args.RoomID].length / 2; i++) {
                let index = Math.floor(Math.random() * rooms[args.RoomID].length);
                while (redPlayerIndices.includes(index))
                    index = Math.floor(Math.random() * rooms[args.RoomID].length);
                
                redPlayerIndices.push(index);
            }

            const countDown = setInterval(() => {
                for (let i = 0; i < rooms[args.RoomID].length; i++) {
                    console.log(i, redPlayerIndices, redPlayerIndices.includes(i));
                    rooms[args.RoomID][i].socket.emit("MatchStarting", {
                        timeRemaining, BlackDeck, RedDeck,
                        IsPlayerRed: redPlayerIndices.includes(i)
                    });
                }

                if (timeRemaining < 0) clearInterval(countDown);
                timeRemaining--;
            }, 1000);
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

    const tickUpdate = setInterval(() => {
        socket.emit("UpdateTick");
    }, 10000);

    socket.on('disconnect', () => {
        clearInterval(tickUpdate);
        delete connections[currentConnect.socket_id];
    });
});

io.disconnectSockets();

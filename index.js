import Haxball from "node-haxball";
import offside from "./offside.js";

const { Room, Errors } = Haxball();

Room.create({
    name: "OFFSIDE HOST",
    maxPlayerCount: 30, // 1 - 30
    showInRoomList: true,
    noPlayer: true,
    token: "", // https://haxball.com/headlesstoken
    geo: null // { lat: number, lon: number, flag: string } - ej: { lat: -30.222, lon: -2.2222, "flag": "FR"}
}, {
    plugins: [
        new offside(API)
    ],
    onOpen: (room) => {
        room.onAfterRoomLink = function(link) {
          console.log(link);
        };

        room.onPlayerJoin = function(player) {
          room.sendChat(`Welcome ${player.name}`);
        };
    },
    onClose: (msg) => {
        if (msg.code === Errors.ErrorCodes.MissingRecaptchaCallbackError) {
            console.error("Invalid token");
        } else {
            console.error("Bot has left the room:", msg.code);
        }

        process.exit(0);
    }
});

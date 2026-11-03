const socket = io();

let currentRoom = "";

document.getElementById("join").onclick = () => {

    const room = document.getElementById("room").value;

    currentRoom = room;

    socket.emit("join-room", room);

};
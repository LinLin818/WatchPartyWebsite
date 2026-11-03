const socket = io();

let currentRoom = "";

document.getElementById("join").onclick = () => {

    const room = document.getElementById("room").value;

    currentRoom = room;

    socket.emit("join-room", room);

};


document.getElementById("send").onclick = () => {
    
    const message = document.getElementById("message").value;

    socket.emit("send-message", {
        room: currentRoom,
        message: message
    });

};


socket.on("receive-message", (message) => {
    const broad = document.createElement("broad");

    broad.textContent = message;

    document.getElementById("messages").appendChild(broad);
});
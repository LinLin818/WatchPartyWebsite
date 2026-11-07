const socket = io();

let currentRoom = "";
let currentVideo = null;  
let pendingVideo;  

//Extrall URL 
function extractVideoId(input) {
    input = input.trim();
    try {
        const url = new URL(input);
        if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
        if (url.searchParams.get("v")) return url.searchParams.get("v");
        const m = url.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
        if (m) return m[2];
    } catch (e) {
        // not a URL, fall through
    }
    return /^[\w-]{11}$/.test(input) ? input : null;
}

 
function loadVideo(id) {
    currentVideo = id;
    if (!player || !player.loadVideoById) {
        pendingVideo = id; // player not ready yet
        return;
    }
    if (id) {
        player.loadVideoById(id);
    } else {
        player.stopVideo();
    }
}


document.getElementById("join").onclick = () => {
    const room = document.getElementById("room").value.trim();
    if (!room) return;
    currentRoom = room;
    socket.emit("join-room", room);
};
 
document.getElementById("send").onclick = () => {
    const message = document.getElementById("message").value;
    if (!currentRoom || !message) return;
    socket.emit("send-message", {
        room: currentRoom,
        message: message
    });
};


socket.on("receive-message", (message) => {
    const li = document.createElement("li");
    li.textContent = message;
    document.getElementById("messages").appendChild(li);
});
 
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

window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player("player", {
        height: "390",
        width: "640",
        events: {
            onReady: () => {
                if (pendingVideo !== undefined) loadVideo(pendingVideo);
            },
            onStateChange: (e) => {
                // Video finished -> ask the server for the next one
                if (e.data === YT.PlayerState.ENDED && currentVideo) {
                    socket.emit("next-video", { room: currentRoom, from: currentVideo });
                }
            }
        }
    });
};



 

document.getElementById("join").onclick = () => {
    const room = document.getElementById("room").value.trim();
    if (!room) return;
    currentRoom = room;
    socket.emit("join-room", room);

    const messageBox = document.getElementById("message");
    messageBox.disabled = false;
    messageBox.placeholder = "Paste a YouTube link to broadcast";
    document.getElementById("send").disabled = false;
};
 
    document.getElementById("send").onclick = () => {
    const box = document.getElementById("message");
    const id = extractVideoId(box.value);
    if (!currentRoom) return;
    if (!id) return alert("Enter a valid YouTube link");
    // Play this video now for everyone in the room
    socket.emit("broadcast-video", { room: currentRoom, video: id });
    box.value = "";


};


socket.on("receive-message", (message) => {
    const li = document.createElement("li");
    li.textContent = message;
    document.getElementById("messages").appendChild(li);
});
 // Sends action the server side
document.getElementById("add-video").onclick = () => {
    const input = document.getElementById("video-url");
    const id = extractVideoId(input.value);
    if (!currentRoom) return alert("Join a room first");
    if (!id) return alert("Enter a valid YouTube link");
    socket.emit("add-to-queue", { room: currentRoom, video: id });
    input.value = "";
};
 
document.getElementById("skip").onclick = () => {
    if (!currentRoom) return;
    socket.emit("next-video", { room: currentRoom });
};
 
socket.on("play-video", (id) => {
    loadVideo(id);
});
 
socket.on("queue-updated", ({ current, queue }) => {
    document.getElementById("now-playing").textContent =
        current ? "Now playing: " + current : "Nothing playing";
 
    const list = document.getElementById("queue");
    list.innerHTML = "";
    queue.forEach((id) => {
        const li = document.createElement("li");
        li.textContent = id;
        list.appendChild(li);
    });
});
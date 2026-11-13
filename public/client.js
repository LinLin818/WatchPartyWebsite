const socket = io();

let currentRoom = "";
let currentVideo = null;   // YouTube video ID that is playing now
let player = null;         // YouTube player instance
let pendingVideo;          // video to load once the player is ready

// ---------- Helpers ----------
function extractVideoId(input) {
    input = input.trim();

    try {
        const url = new URL(input);

        if (input.includes("v=")) {
        return input.split("v=")[1].split("&")[0];
    }

    if (input.includes("youtu.be/")) {
        return input.split("youtu.be/")[1].split("?")[0];
    }
    } catch (e) {
        // Not a URL
    }

    if (input.length === 11) {
        return input;
    }

    return null;
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

// ---------- YouTube player ----------
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player("player", {
        height: "100%",
        width: "600",
        playerVars: {
            autoplay: 1
        },
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

// ---------- Rooms & chat ----------
document.getElementById("join").onclick = () => {
    const room = document.getElementById("room").value.trim();
    if (!room) return;
    currentRoom = room;
    socket.emit("join-room", room);

    // Joined: unlock chat
    const messageBox = document.getElementById("message");
    messageBox.disabled = false;
    messageBox.placeholder = "Enter message";
    document.getElementById("send").disabled = false;
};

// Chat: send a text message to everyone in the room
document.getElementById("send").onclick = () => {
    const box = document.getElementById("message");
    if (!currentRoom || !box.value) return;
    socket.emit("send-message", { room: currentRoom, message: box.value });
    box.value = "";
};

socket.on("receive-message", (message) => {
    const li = document.createElement("li");
    li.textContent = message;
    document.getElementById("messages").appendChild(li);
});

// ---------- Queue ----------
document.getElementById("add-video").onclick = () => {
    const input = document.getElementById("video-url");
    const id = extractVideoId(input.value);
    if (!currentRoom) return alert("Join a room first");
    if (!id) return alert("Enter a valid YouTube link");
    socket.emit("add-to-queue", { room: currentRoom, video: id });
    input.value = "";
};

// Play the pasted video right now for everyone in the room
document.getElementById("play-now").onclick = () => {
    const input = document.getElementById("video-url");
    const id = extractVideoId(input.value);
    if (!currentRoom) return alert("Join a room first");
    if (!id) return alert("Enter a valid YouTube link");
    socket.emit("broadcast-video", { room: currentRoom, video: id });
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
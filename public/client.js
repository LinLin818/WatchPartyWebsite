const socket = io();
const titleNameStorage = {};

let currentRoom = "";
let currentVideo = null;   // YouTube video ID that is playing now
let player = null;         // YouTube player instance
let pendingVideo;          // video to load once the player is ready

let applyingRemoteSync = false;

async function loadUsername() {
    try {
        const res = await fetch("/api/username");
        const data = await res.json();
        showUsername(data.username);
    } catch (e) {
        showUsername("Guest");
    }
}

function showUsername(name) {
    const el = document.getElementById("username");
    if (el) el.textContent = name;
}

const newNameBtn = document.getElementById("new-name");
if (newNameBtn) {
    newNameBtn.onclick = async () => {
        const res = await fetch("/api/username/regenerate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ socketId: socket.id }),
        });
        const data = await res.json();
        showUsername(data.username);
    };
}

loadUsername();

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
// fetching video name
async function fetchVideoTitle(id){
    if(!id)return '';
    if(titleNameStorage[id]) return titleNameStorage[id];
    try{
        const url = `https://youtube.com{id}&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        titleNameStorage[id] = data.title;
        return data.title;

    }catch(e){
        return id;  // Fallback to video ID if fetch fails
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
                    return;
                }
                //Don't resend changes from another user
                if (applyingRemoteSync) return;

                //User pressed play
                if (e.data === YT.PlayerState.PLAYING){
                    socket.emit("video-sync", {
                        room: currentRoom,
                        action: "play",
                        time: player.getCurrentTime()

                });
                if(e.data === YT.PlayerState.PLAYING && currentVideo){
                    const title = player.getVideoData?.()?.title;
                    if(title){
                         titleNameStorage[currentVideo] = title;
                         document.getElementById('now-playing').textContent = "Now playing: " + title;
                    }

                }
                
                }
                if (applyingRemoteSync) return;


                //User pressed pauge 
                   if (e.data === YT.PlayerState.PAUSED){
                    socket.emit("video-sync", {
                        room: currentRoom,
                        action: "pause",
                        time: player.getCurrentTime()

                });
                }

            }
        }
    });
};

// ---------- Rooms & chat ----------

//unlock chat
function enableRoom() {
    const messageBox = document.getElementById("message");

    messageBox.disabled = false;
    messageBox.placeholder = "Enter message";

    document.getElementById("send").disabled = false;
}

// Create a new room
document.getElementById("create-room").onclick = () => {
    socket.emit("create-room", (response) => {

        if (!response || !response.success) {
            alert("Could not create room");
            return;
        }
        
        currentRoom = response.roomID;

        // Update the URL
        history.pushState({}, "", `/room/${currentRoom}`);

        document.getElementById("room-info").textContent = "Room ID: " + currentRoom;
        enableRoom();

        console.log("Created room:", currentRoom);
    });
};

// Join an existing room using a room ID
document.getElementById("join-room").onclick = () => {
    const roomID = document.getElementById("room-id").value.trim();
    
    if (!roomID) {
        return alert("Please enter a room ID");
    }
    
    socket.emit("join-room", roomID, (response) => {
        if (!response || !response.success) {
            return alert("Room does not exist!");
        }

        
        currentRoom = roomID;

        // Update URL
        history.pushState({}, "", `/room/${currentRoom}`);

        document.getElementById("room-info").textContent = "Room ID: " + currentRoom;
         enableRoom();
        console.log("Successfully joined room:", currentRoom);
    });
};


    // Automatically join room if URL contains a room ID
const pathParts = window.location.pathname.split("/");
const roomFromURL = pathParts[2];

if (roomFromURL) {
    
    const joinRoomFromURL = () => {
        
        socket.emit("join-room", roomFromURL, (response) => {
            
            if (!response || !response.success) {
                alert("Room does not exist!");
                history.pushState({}, "", "/");
                return;
            }
            
            currentRoom = roomFromURL;

            document.getElementById("room-info").textContent = "Room ID: " + currentRoom;
            enableRoom();
            console.log("Joined room:", currentRoom);
        });

    };

    if (socket.connected) {
        joinRoomFromURL();
    } else {
        socket.once("connect", joinRoomFromURL);
    }
}

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


socket.on("video-sync", ({ action, time }) => {
    if (!player || !player.seekTo) return;

    applyingRemoteSync = true;

    // Sync timestamp
    if (typeof time === "number") {
        const localTime = player.getCurrentTime();

        if (Math.abs(localTime - time) > 0.5) {
            player.seekTo(time, true);
        }
    }

    // Sync play/pause
    if (action === "play") {
        player.playVideo();
    }

    if (action === "pause") {
        player.pauseVideo();
    }

    setTimeout(() => {
        applyingRemoteSync = false;
    }, 500);
});

socket.on("queue-updated", ({ current, queue }) => {

    const list = document.getElementById("queue");
    list.innerHTML = "";
    queue.forEach((video) => {
        const li = document.createElement("li");
        li.textContent = typeof video === "string"
            ? video
            : video.title;

        list.appendChild(li);
    });
});

// Existing user sends their current state to the new user
socket.on("get-sync", (newUserId) => {
    if (!player || !currentVideo) return;

    socket.emit("send-sync", {
        to: newUserId,
        video: currentVideo,
        seconds: player.getCurrentTime(),
        isPlaying: player.getPlayerState() === YT.PlayerState.PLAYING
    });
});

// New user receives the existing user's state
socket.on("sync-time", ({ video, seconds, isPlaying }) => {
    if (!player) return;

    currentVideo = video;
    applyingRemoteSync = true;

    player.loadVideoById({
        videoId: video,
        startSeconds: seconds
    });

    if (!isPlaying) {
        setTimeout(() => {
            player.pauseVideo();
            applyingRemoteSync = false;
        }, 500);
    } else {
        setTimeout(() => {
            applyingRemoteSync = false;
        }, 500);
    }
});
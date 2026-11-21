const express = require("express");
require("dotenv").config();  
const http = require("http");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");


const app = express();
const server = http.createServer(app);

const io = new Server(server);
const port = 3000;
const hostname = "localhost";

// ---------- Temporary usernames ----------
const COOKIE_NAME = "username";
const NAME_TTL_MS = 24 * 60 * 60 * 1000; 
const cookieSecret = process.env.COOKIE_SESSION || crypto.randomBytes(32).toString("hex");
app.use(express.static("public"));
const cookieMiddleware = cookieParser(process.env.COOKIE_SESSION)

app.use(cookieMiddleware);
app.use(assignNames);  
const ADJECTIVES = [
  "Happy", "Sleepy", "Brave", "Clever", "Sneaky", "Fuzzy", "Swift", "Quiet",
  "Lucky", "Cosmic", "Spicy", "Chill", "Bouncy", "Mighty", "Witty", "Shiny",
];
const ANIMALS = [
  "Panda", "Otter", "Fox", "Koala", "Falcon", "Tiger", "Penguin", "Llama",
  "Badger", "Dolphin", "Raccoon", "Owl", "Gecko", "Moose", "Hedgehog", "Wolf",
];

function generateUsername() {
  const adj = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)];
  const animal = ANIMALS[crypto.randomInt(ANIMALS.length)];
  const num = crypto.randomInt(100, 1000); // 3 digits
  return `${adj}${animal}${num}`;
}
function setUsernameCookie(res, name) {
  res.cookie(COOKIE_NAME, name, {
    signed: true,     
    httpOnly: true, 
    sameSite: "lax",
    maxAge: NAME_TTL_MS,
  });
}
function assignNames(req, res, next) {
  let name = req.signedCookies[COOKIE_NAME];
  if (!name) {
    name = generateUsername();
    setUsernameCookie(res, name);
  }
  req.username = name;
  next();
}


const rooms = {};
function assignNames(req, res, next){

}
function getRoom(name) {
  if (!rooms[name]) {
    rooms[name] = { queue: [], current: null };
  }
  return rooms[name];
}

//Controll the state of broadcasting so everyone is synced together
function broadcastState(name) {
  const room = getRoom(name);
  io.to(name).emit("queue-updated", {
    current: room.current,
    queue: room.queue,
  });
}

function playNext(name) {
  const room = getRoom(name);
  const next = room.queue.shift();
  room.current = next
        ? (typeof next === "string" ? next : next.id)
        : null;
  if (room.current) {
    io.to(name).emit("play-video", room.current);
  }
  broadcastState(name);
}

//getting a title from youtube url
async function youtubeTitleVideo(videoId){
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  try{
    const response = await fetch(oembedUrl)
    // Checks if the video is valid or not
    if(!response.ok) return videoId;
    const data = await response.json();
    return data.title;
  }catch(error){
    return videoId;
  }

}
io.on("connection", (socket) => {
  console.log("socket server on ong");

  socket.on("join-room", async (roomName) => {
    const existingUsers = await io.in(roomName).fetchSockets();
    socket.join(roomName);
    console.log(socket.id + " joined " + roomName);
 

    // Check the current state of the room. If the queue is not empty play the video
    const state = getRoom(roomName);
    socket.emit("queue-updated", { current: state.current, queue: state.queue });
    //Recording time stamps + syncing
    if (state.current){
      socket.emit("play-video", state.current);

      if(existingUsers.length > 0){
        //gets video timestamp from the user already in the room
        io.to(existingUsers[0].id).emit("get-sync", socket.id);
      } else {
        // or just play from start
        socket.emit("play-video", state.current);
      }
    }
  });

  // use exisitng user timestamp to catch new user up to speed
  socket.on("send-sync", (data) =>{
    io.to(data.to).emit("sync-time", {
      video: data.video,
      seconds: data.seconds,
      isPlaying: data.isPlaying
    });
  });

  // pass play/pause straight to everyone else in the room
 socket.on("video-sync", (data) => {
    socket.to(data.room).emit("video-sync", {
        action: data.action,
        time: data.time
    });
});

  socket.on("send-message", (data) => {
    io.to(data.room).emit("receive-message", data.message);
  });

  // Add a video to the end of the queue. data = { room, video }
  socket.on("add-to-queue", async(data) => {
    if (!data || !data.room || !data.video) return;
    const room = getRoom(data.room);
    const title = await youtubeTitleVideo(data.video);

    if (!room.current) {
      room.current = data.video;
      io.to(data.room).emit("play-video", data.video);
    } else {
      room.queue.push({ 
            id: data.video,
            title: title});
    } 
    broadcastState(data.room);
  });

  //Enable to the video up//
socket.on("broadcast-video", (data) =>{
  const room = getRoom(data.room)

  if (room.current) return;

  room.current = data.video;
  
  io.to(data.room).emit("play-video",room.current)
  broadcastState(data.room)
})

  // skip to the next video if someone clicked the button
  socket.on("next-video", (data) => {
   

    if (!data || !data.room) return;
    const room = getRoom(data.room);
    
    if (data.from && data.from !== room.current) return;
    playNext(data.room);
  });
});


server.listen(port, hostname, () => {
  console.log(`http://${hostname}:${port}`);
});
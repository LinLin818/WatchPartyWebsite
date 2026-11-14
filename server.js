const express = require("express");
const http = require("http");
const { Server } = require("socket.io");


const app = express();
const server = http.createServer(app);

const io = new Server(server);
const port = 3000;
const hostname = "localhost";

app.use(express.static("public"));
const rooms = {};

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
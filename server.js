//some prelim stuff
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);
const port = 3000;
const hostname = "localhost";

app.use(express.static("public"));
const rooms = {}
function getRoom(name){
  rooms[name] = {queue: [], current: null };
  return rooms[name]

}
//Controll the state of broadcasting so everyone is synced together

function broadcastState(name) {
  const room = getRoom(name);
  io.to(name).emit("queue-updated", {
    current: room.current,
    queue: room.queue,
  });
}
 

io.on("connection", (socket) => {
  console.log("socket server on ong");

  socket.on("join-room", (room) => {
    socket.join(room);
    console.log(socket.id + " joined " + room);
  });
  // Check the current state of the room. If the queue is not empty play the video
   const state = getRoom(room);
    socket.emit("queue-updated", { current: state.current, queue: state.queue });
    if (state.current) socket.emit("play-video", state.current);
  socket.on("send-message", (data) => {
    io.to(data.room).emit("receive-message", data.message);
   });


  // Add a video to the end of the queue. data = { room, video }
    socket.on("add-to-queue", (data) => {
    if (!data || !data.room || !data.video) return;
    const room = getRoom(data.room);
 
    if (!room.current) {
      room.current = data.video;
      io.to(data.room).emit("play-video", room.current);
    } else {
      room.queue.push(data.video);
    }
    broadcastState(data.room);
  });
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
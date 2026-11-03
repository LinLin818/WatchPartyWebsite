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


io.on("connection", (socket) => {
  console.log("socket server on ong");

  socket.on("join-room", (room) => {
    socket.join(room);
    console.log(socket.id + " joined " + room);
  });
  
  socket.on("send-message", (data) => {
    io.to(data.room).emit("receive-message", data.message);
   });
});


server.listen(port, hostname, () => {
  console.log(`http://${hostname}:${port}`);
});
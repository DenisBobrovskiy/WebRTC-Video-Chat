import express from "express";
import http from "http";
import {Server as SocketioServer, Socket} from "socket.io"


// Basic typing for types of webrtc signals
type WebRTCSignal = { type: "offer", sdp: any} | {type: "answer", sdp: any} | {type: "ice", candidate: any}

// Type out our client->server and server->client events
type C2S = {
  auth: (p: {userId: string}) => void;
  signal: (p: {to: string, data: WebRTCSignal}) => void;
}

type S2C = {
  signal: (p: {from: string, data: WebRTCSignal}) => void;
}

// Basic server setup
const app = express();
const server = http.createServer(app);

// Setup for socketio server with allow-all CORS
const ioServer = new SocketioServer<C2S, S2C>(server, {cors: {origin: "*"}})

// Each user will have a userId and we need to map their socket instances correspondingly
const userToSocket = new Map<string, string>();
const socketToUser = new Map<string, string>();


// Setup event handlers for the sockets
ioServer.on('connection', (socket: Socket<C2S, S2C>) => {
  console.log(`Socket: ${socket.id} connected.`);

  // Allows us to identify the user by their unique ID (provided by client)
  socket.on('auth', ({ userId }) => {
    userToSocket.set(userId, socket.id);
    socketToUser.set(socket.id, userId);
    console.log(`User: ${userId} connected.`)
  })

  // Handles forwarding of webrtc offers, answers and ice candidates
  socket.on("signal", ({to, data}) => {
    const senderUserId = socketToUser.get(socket.id);
    const targetSocketId = userToSocket.get(to);

    if (!senderUserId) {
      console.log("Signal from unauthenticated socket");
      return;
    }

    if (!targetSocketId) {
      console.log(`Target user not found: ${to}`);
      return;
    }
    
    // Relay the signal to target user
    ioServer.to(targetSocketId).emit("signal", { from: senderUserId, data });
  })

  socket.on("disconnect", () => {
    // Cleanup this user from the maps
    const userId = socketToUser.get(socket.id);
    if (userId) {
      userToSocket.delete(userId)
      socketToUser.delete(socket.id)
      console.log(`User disconnected, ID: ${userId}`)
    }
  })
})


// Run the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server launched on port: ${PORT}`)
})
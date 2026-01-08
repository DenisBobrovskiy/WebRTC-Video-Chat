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

  socket.on('auth', ({ userId }) => {
    // userToSocket.set
  })

})

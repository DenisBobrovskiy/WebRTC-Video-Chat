import { io, Socket } from "socket.io-client"
import { useEffect, useRef, useState } from "react"

// Copy the typing as it is defined in our signalling server (with some extra typing for WebRTC signal types)
type WebRTCSignal = { type: "offer", sdp: RTCSessionDescriptionInit } | { type: "answer", sdp: RTCSessionDescriptionInit } | { type: "ice", iceCandidate: RTCIceCandidateInit }

// Event shapes for client-to-server and server-to-client
type C2S = {
  auth: (p: { userId: string }) => void;
  signal: (p: { to: string, data: WebRTCSignal }) => void;
}

type S2C = {
  signal: (p: { from: string, data: WebRTCSignal }) => void;
}

// URL for our signalling server
const SIGNALLING_SERVER_URL = "http://localhost:3000";

// We will use google's public STUN servers
// Keep in mind we don't setup any TURN servers here for now but it is as easy as adding a new config line in this setup
const ICE_SERVER_CONFIG: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

export default function App() {

  const [localID, setLocalID] = useState<string>(crypto.randomUUID());
  const [peerIDInput, setPeerIDInput] = useState<string>("");
  const [connStatus, setConnStatus] = useState<"offline" | "online" | "connecting" | "connected">("offline");

  // Refs to track the video elements into which we will push video data (both local and remote tracks)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)

  // Socket / Peer Connection refs
  const localSockRef = useRef<Socket<S2C, C2S> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);



  // Socket connection to signalling server. Setup on coponent mount. Will wait until someone tries to call us by our userID
  useEffect(() => {

    // Create / connect socket to signalling server
    const socket: Socket<S2C, C2S> = io(SIGNALLING_SERVER_URL)
    localSockRef.current = socket

    // Emit auth evt so signalling server knows our userID
    socket.emit("auth", { userId: localID })

    // Event handlers
    socket.on("signal", async ({ from, data }) => {
      const pc = pcRef.current

      // Ignore all events unless we setup a peer connection
      if (!pc) {
        return
      }

      if (data.type == "offer") {
        // Handle an SDP offer from remote client
        await pc.setRemoteDescription(data.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Register an ice evt handler here (instead of the one in connect method)
        // This handler is used to reply with ice candidates to inbound connections
        pc.onicecandidate = (iceEvt) => {
          if (iceEvt.candidate) {
            socket.emit("signal", {
              to: from,
              data: { type: "ice", iceCandidate: iceEvt.candidate.toJSON() },
            });
          }
        };

        // Send answer to remote
        socket.emit("signal", { to: from, data: { type: "answer", sdp: answer } })

      } else if (data.type == "answer") {
        // Handle an SDP answer from remote client
        await pc.setRemoteDescription(data.sdp)

      } else if (data.type == "ice") {
        // Handle ICE candidates
        await pc.addIceCandidate(data.iceCandidate)

      }
    })

    // Close connection
    return () => { socket.disconnect() }

  }, [])

  async function createPeerConnection() {
    // Drop if socket or local id not set yet
    if (!localID || !localSockRef.current) {
      return
    }

    // Get local webcam video feed
    const localVideoFeed = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })

    // Feed that stream into our local video component
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localVideoFeed
    }

    // Setup PeerConnection
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVER_CONFIG })
    pcRef.current = pc

    // Feed our local media tracks into that peer connection
    localVideoFeed.getTracks().forEach(track => pc.addTrack(track, localVideoFeed))

    // Event handler to capture remote media tracks
    pc.ontrack = (trackEvt) => {
      if (remoteVideoRef.current) {
        // Just get the 1st stream that remote sends
        remoteVideoRef.current.srcObject = trackEvt.streams[0]
        setConnStatus("connected")
      }
    }

    setConnStatus("online")
  }


  async function initiateConnection(peerID: string) {

    setConnStatus("connecting")

    if (pcRef.current) {
      const pc = pcRef.current

      // Add an event handler to our pc to handle sending off ICE candidates to remote peer
      pc.onicecandidate = (iceEvt) => {
        if (iceEvt.candidate) {
          localSockRef.current.emit("signal", {
            to: peerID,
            data: { type: "ice", iceCandidate: iceEvt.candidate.toJSON() }
          })
        }
      }

      const sdpOffer = await pc.createOffer()
      await pc.setLocalDescription(sdpOffer)
      localSockRef.current.emit("signal", { to: peerID, data: { type: "offer", sdp: sdpOffer } })


    }
  }

  function disconnect() {
    // Reset peer connection obj
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    // Reset our local video stream
    if (localVideoRef.current) {
      const stream = localVideoRef.current.srcObject as MediaStream
      stream?.getTracks().forEach(track => track.stop())

      // Reset video component so we don't see a stale frame when offline
      localVideoRef.current.srcObject = null;
    }

    // Same for the remote video component
    if (remoteVideoRef.current){
      remoteVideoRef.current.srcObject = null;
    }

    setConnStatus("offline")
  }


  return (
    <div className="mt-5 mx-5">
      <div className="flex flex-row justify-center gap-25">
        <div className="flex flex-row w-fit border-1 p-1 bg-gray-200 rounded-md">
          <span className="font-bold mr-1">
            Your ID:
          </span>
          {localID}
        </div>
        <div className="flex flex-row gap-2 items-center">
          {connStatus == "online" &&
            <input
              placeholder="Enter peer's UserID"
              type="text"
              className="bg-gray-200 rounded-md h-[33px] border-1"
              value={peerIDInput}
              onChange={(ev) => { setPeerIDInput(ev.target.value) }}
            ></input>
          }
          {connStatus == "offline" &&
            <button
              className="bg-blue-300 rounded-md px-3 py-1 cursor-pointer hover:bg-blue-200 duration-75"
              onClick={() => { createPeerConnection() }}
            >Go Online</button>
          }
          {connStatus == "online" &&
            <button
              className="bg-blue-300 rounded-md px-3 py-1 cursor-pointer hover:bg-blue-200 duration-75"
              onClick={() => { initiateConnection(peerIDInput) }}
            >Connect</button>
          }
          {(connStatus != "offline") &&
            <button
              className="bg-red-300 rounded-md px-3 py-1 cursor-pointer hover:bg-red-200 duration-75"
              onClick={() => { disconnect() }}
            >Disconnect</button>
          }
        </div>
      </div>
      <div className="flex flex-row mt-20 w-[100%] h-[500px] gap-10 justify-center">
        <div>
          <p className="text-center mb-1">Your Video Feed</p>
          <video ref={localVideoRef} autoPlay muted className="w-[40vw] rounded-lg bg-black"></video>
        </div>
        <div>
          <p className="text-center mb-1">{connStatus == "connecting" ? "Attempting to connnect..." : connStatus == "connected" ? "Connected!" : "Remote Video Feed"}</p>
          <video ref={remoteVideoRef} autoPlay muted className="w-[40vw] rounded-lg bg-black"></video>
        </div>
      </div>
    </div>
  )
}
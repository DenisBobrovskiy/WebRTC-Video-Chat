import {io, Socket} from "socket.io-client"
import {useEffect, useRef, useState} from "react"

// Copy the typing as it is defined in our signalling server (with some extra typing for WebRTC signal types)
type WebRTCSignal = {type: "offer", sdp: RTCSessionDescriptionInit} | {type: "answer", sdp: RTCSessionDescriptionInit} | {type: "ice", iceCandidate: RTCIceCandidateInit}

// Event shapes for client-to-server and server-to-client
type C2S = {
  auth: (p: {userId: string}) => void;
  signal: (p: {to: string, data: WebRTCSignal}) => void;
}

type S2C = {
  signal: (p: {from: string, data: WebRTCSignal}) => void;
}

// URL for our signalling server
const SIGNALLING_SERVER_URL = "http://localhost:3000";

// We will use google's public STUN servers
// Keep in mind we don't setup any TURN servers here for now but it is as easy as adding a new config line in this setup
const ICE_SERVER_CONFIG: RTCIceServer[] = [{urls:"stun:stun.l.google.com:19302"}]

export default function App(){

  const [localID, setLocalID] = useState<string>(crypto.randomUUID());
  const [peerID, setPeerID] = useState<string>("");
  const [peerConnected, setPeerConnected] = useState<boolean>(false);

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

    // Event handlers
    socket.on("signal", async ({from, data}) => {
      const pc = pcRef.current

      // Ignore all events unless we setup a peer connection
      if (!pc){
        return
      }

      if (data.type == "offer"){
        // Handle an SDP offer from remote client

      }else if (data.type == "answer"){
        // Handle an SDP answer from remote client

      }else if (data.type == "ice"){
        // Handle ICE candidates

      }
    })
    
  }, [])

  async function connect(){
    // Drop if socket or local id not set yet
    if (!localID || !localSockRef.current){
      return
    }

    // Get local webcam video feed
    const localVideoFeed = await navigator.mediaDevices.getUserMedia({video:true, audio:true})

    // Feed that stream into our local video component
    if (localVideoRef){
      localVideoRef.current.srcObject = localVideoFeed
    }

    // Setup PeerConnection
    const pc = new RTCPeerConnection({iceServers: ICE_SERVER_CONFIG})
    pcRef.current = pc

    // Feed our local media tracks into that peer connection
    localVideoFeed.getTracks().forEach(track => pc.addTrack(track, localVideoFeed))

    // Add an event handler to our pc to handle sending off ICE candidates to remote peer
    pc.onicecandidate = (iceEvt) => {
      if (iceEvt.candidate && peerID) {
        localSockRef.current.emit("signal", {
          to: peerID,
          data: {type: "ice", iceCandidate: iceEvt.candidate.toJSON()}
        })
      }
    }

    // Event handler to capture remote media tracks
    pc.ontrack = (trackEvt) => {
      if (remoteVideoRef.current){
        // Just get the 1st stream that remote sends
        remoteVideoRef.current.srcObject = trackEvt.streams[0]
      }
    }

    // Create an SDP offer only if we are the ones initiating a connection
    if (peerID){
      const sdpOffer = await pc.createOffer()
      await pc.setLocalDescription(sdpOffer)
      localSockRef.current.emit("signal", {to: peerID, data: {type: "offer", sdp: sdpOffer}})
    }

    // Track local state that we have connected (connection may not be yet fully established though as we are waiting for exchange)
    // This is primarily a UI state
    setPeerConnected(true)
  }

  function disconnect(){
    // Reset peer connection obj
    if (pcRef.current){
      pcRef.current.close()
      pcRef.current = null
    }

    // Reset our local video stream
    if (localVideoRef.current){
      const stream = localVideoRef.current.srcObject as MediaStream
      stream?.getTracks().forEach(track => track.stop())
    }

    setPeerConnected(false)
  }

  return (
    <div className="mt-5 mx-5">
      <div className="flex flex-row w-fit border-1 p-1 bg-gray-200 rounded-md">
        <span className="font-bold mr-1">
          Your ID: 
        </span>
        {localID}
        </div>
    </div>
  )
}
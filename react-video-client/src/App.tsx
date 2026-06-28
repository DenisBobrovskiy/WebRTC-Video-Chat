import {io, Socket} from "socket.io-client"
import {useEffect, useRef, useState} from "react"

// Copy the typing as it is defined in our signalling server (with some extra typing for WebRTC signal types)
type WebRTCSignal = {type: "offer", sdp: RTCSessionDescriptionInit} | {type: "answer", sdp: RTCSessionDescriptionInit} | {type: "ice", sdp: RTCIceCandidateInit}

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
  const localStreamRef = useRef<MediaStream | null>(null);


  // Socket connection to signalling server. Setup on coponent mount. Will wait until someone tries to call us by our userID
  useEffect(() => {

  }, [])

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
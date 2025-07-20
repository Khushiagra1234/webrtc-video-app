import React, { useRef, useState, useEffect } from 'react';

import './App.css';

const SIGNALING_SERVER_URL = 'ws://localhost:3001';

export default function App() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [room, setRoom] = useState('');
  const [ws, setWs] = useState(null);
  const [peer, setPeer] = useState(null);
  const [status, setStatus] = useState('Disconnected');
  const [connected, setConnected] = useState(false);

  const initWebSocket = () => {
  const socket = new WebSocket(SIGNALING_SERVER_URL);

  socket.onopen = () => {
    console.log("WebSocket connected.");
    setStatus("Connected to signaling server");
    setWs(socket); // ✅ Save socket first
    setTimeout(() => {
      startConnection(socket); // ✅ Pass socket to startConnection
    }, 100); // small delay to make sure setWs updates in time
  };


  socket.onerror = (err) => {
    console.error("WebSocket error:", err);
    setStatus("WebSocket error");
  };

  socket.onclose = () => {
    console.log("WebSocket closed.");
    setStatus("Disconnected from signaling server");
  };
};


  const startConnection = async (socket) => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideoRef.current.srcObject = stream;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
  console.error("WebSocket not ready");
  return;
}


  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  pc.ontrack = (event) => {
    remoteVideoRef.current.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: 'signal', room, payload: { candidate: event.candidate } }));
    }
  };

  pc.oniceconnectionstatechange = () => {
    setStatus(`Connection: ${pc.iceConnectionState}`);
  };

  setPeer(pc);

  socket.send(JSON.stringify({ type: 'join', room }));
  setConnected(true);

  setTimeout(async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: 'signal', room, payload: { offer } }));
  }, 500);
};


  const handleJoin = () => {
  if (!room) return;
  
  initWebSocket(); // Connect to signaling server

  // Wait a moment before starting the peer connection
  
};



  const handleLeave = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'leave', room }));
      ws.close();
    }
    if (peer) {
      peer.close();
      setPeer(null);
    }
    localVideoRef.current.srcObject?.getTracks().forEach(track => track.stop());
    localVideoRef.current.srcObject = null;
    remoteVideoRef.current.srcObject = null;
    setRoom('');
    setConnected(false);
    setStatus('Disconnected');
  };
  useEffect(() => {
  if (!ws) return;
  

  ws.onmessage = async (msg) => {
    const { type, payload } = JSON.parse(msg.data);


    if (type === 'signal') {
      if (!peer) {
        console.warn("Peer not ready yet, skipping message.");
        return;
      }

      if (payload.offer) {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'signal', room, payload: { answer } }));
      } else if (payload.answer) {
        await peer.setRemoteDescription(new RTCSessionDescription(payload.answer));
      } else if (payload.candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.error("Failed to add ICE candidate", err);
        }
      }
    }

    if (type === 'leave') {
      remoteVideoRef.current.srcObject = null;
      setStatus("User left the room");
    }
  };
}, [ws, peer, room]);


  return (
    <div className="container">
      <h1>WebRTC Video Chat</h1>
      <div className="controls">
        <input
          type="text"
          value={room}
          placeholder="Enter Room ID"
          onChange={(e) => setRoom(e.target.value)}
          disabled={connected}
        />
        <button onClick={handleJoin} disabled={connected}>Join</button>
        <button onClick={handleLeave} disabled={!connected}>Leave</button>
        <p>{status}</p>
      </div>

      <div className="videos">
        <video ref={localVideoRef} autoPlay playsInline muted></video>
        <video ref={remoteVideoRef} autoPlay playsInline></video>
      </div>
    </div>
  );
}

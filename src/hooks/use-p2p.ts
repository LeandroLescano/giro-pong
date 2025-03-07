import {getDatabase} from "firebase/database";
import {useEffect, useRef, useMemo} from "react";
import Peer, {Instance, SignalData} from "simple-peer";

import {FirebaseSignaling} from "@/services/realtime/signaling";

export interface SignalingMessage {
  sender: string;
  target: string;
  signal: SignalData;
}

interface UseP2pProps {
  roomID: string;
  localUserID: string;
  onNewConnection?: (remoteID: string) => void;
}

// The hook is generic over the type T of your data (for example, PongData)
export function useP2p<T>({
  roomID,
  localUserID,
  onData,
  onNewConnection,
}: UseP2pProps & {onData?: (data: T, remoteID: string) => void}) {
  // Ref holding one Simple-Peer instance per remote user.
  const peerConnections = useRef<{[key: string]: Instance | undefined}>({});
  // Ref to store pushed signal keys (for removal later).
  const signalKeys = useRef<{[key: string]: string | null}>({});

  const rtdb = useMemo(() => getDatabase(), []);
  const signaling = useMemo(
    () => new FirebaseSignaling(roomID, localUserID, rtdb),
    [roomID, localUserID, rtdb]
  );

  // Function to create a connection to a remote peer.
  const connectToPeer = (remoteID: string) => {
    if (peerConnections.current[remoteID]) return;

    // Use a simple initiator rule (lexicographical comparison of IDs).
    const isInitiator = localUserID < remoteID;
    console.info(`Connecting to ${remoteID} (initiator: ${isInitiator})`);
    const peer = new Peer({initiator: isInitiator, trickle: false});
    peerConnections.current[remoteID] = peer;

    // When simple-peer generates signaling data, push it via Firebase.
    peer.on("signal", (data) => {
      console.info(`Local signal for ${remoteID}:`);
      signaling
        .sendSignal({
          sender: localUserID,
          target: remoteID,
          signal: data,
        })
        .then((pushedSignal) => {
          // Save the pushed signal key so that we can remove it later.
          signalKeys.current[localUserID + remoteID] = pushedSignal.key;
        });
    });

    // When the connection is established, remove the signaling message.
    peer.on("connect", () => {
      onNewConnection?.(remoteID);
      const key = signalKeys.current[localUserID + remoteID];
      if (key) {
        signaling.removeSignal(key);
      }
      // Optionally, you might send an initial handshake message here.
      //   peer.send(JSON.stringify({x: 0, y: 0, key: localUserID}));
    });

    // When data arrives from the remote peer, pass it along via the callback.
    peer.on("data", (data: string) => {
      try {
        const parsed: T = JSON.parse(data);
        if (onData) {
          onData(parsed, remoteID);
        }
      } catch (err) {
        console.error(`Error parsing data from ${remoteID}:`, err);
      }
    });

    peer.on("error", (err) => {
      console.error(`Connection error with ${remoteID}:`, err);
    });
  };

  // Listen for incoming signaling messages.
  useEffect(() => {
    signaling.onSignal((message: SignalingMessage) => {
      // Only process messages intended for this peer.
      if (message.target !== localUserID) return;
      const remoteID = message.sender;
      const signalData = message.signal;
      if (!peerConnections.current[remoteID]) {
        connectToPeer(remoteID);
      }
      try {
        peerConnections.current[remoteID]?.signal(signalData);
      } catch (err) {
        console.error(`Error processing signal from ${remoteID}:`, err);
      }
    });
    return () => {
      signaling.offSignal();
    };
  }, [localUserID, signaling]);

  // Helper to broadcast data to all connected peers.
  const sendDataToPeers = (data: T) => {
    const payload = JSON.stringify(data);
    Object.values(peerConnections.current).forEach((peer) => {
      try {
        peer?.send(payload);
      } catch (err) {
        console.warn("Error sending data to peer:", err);
      }
    });
  };

  const removePeerConnection = (remoteID: string) => {
    if (!peerConnections.current[remoteID]) return;

    peerConnections.current[remoteID].destroy();
    delete peerConnections.current[remoteID];
  };

  return {
    connectToPeer,
    removePeerConnection,
    sendDataToPeers,
    peerConnections: peerConnections.current,
  };
}

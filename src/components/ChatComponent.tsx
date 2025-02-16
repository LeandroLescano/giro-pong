"use client";
import React, {useEffect, useRef, useState} from "react";
import {Peer, DataConnection} from "peerjs";

import {MessageData} from "./types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Button} from "@/components/ui/button";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
  Unsubscribe,
} from "firebase/firestore";
import {useAuth} from "@/contexts/AuthContext";

const ChatComponent = ({
  roomID,
  username,
}: {
  roomID: string;
  username: string;
}) => {
  const [connectionID, setConnectionID] = useState("");
  const connections = useRef<{[key: string]: DataConnection}>({});
  const [peer, setPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [message, setMessage] = useState("");
  const {user, signInAnonymously} = useAuth();
  const db = getFirestore();

  const connectToPeer = (peerId: string, localPeer = peer) => {
    if (!localPeer) return;

    console.log(`connect to ${peerId}`);
    const conn = localPeer.connect(peerId);
    conn.on("open", () => {
      console.log(`open connection to ${peerId}`);
      connections.current[peerId] = conn;
      console.log({connections});
    });

    conn.on("data", (data: unknown) => {
      console.log(`onData ${peerId}`);
      setMessages((msgs) => [...msgs, data as MessageData]);
    });
  };

  useEffect(() => {
    if (!user?.uid) {
      console.log("not user id");
    } else {
      const newPeer = new Peer();
      const players = collection(db, "rooms", roomID, "players");
      const player = doc(db, "rooms", roomID, "players", user.uid);
      let unsubscribe: Unsubscribe;

      newPeer.on("open", (id) => {
        setConnectionID(id);
        updateDoc(player, {connectionID: id}).catch((e) => {
          if (e.code === "not-found") {
            setDoc(player, {
              username,
              type: "player",
              connectionID: id,
            });

            unsubscribe = onSnapshot(players, (snapshot) => {
              snapshot.docChanges().forEach((change) => {
                console.log(change);
                if (change.type === "added") {
                  console.log(
                    `New player ${change.doc.data().username} - ${
                      change.doc.id
                    }`
                  );
                  const connID = change.doc.data().connectionID;
                  const userID = change.doc.id;
                  if (userID !== user?.uid) {
                    connectToPeer(connID, newPeer);
                  }
                }
              });
            });
            return;
          }

          throw e;
        });
      });

      newPeer.on("connection", (conn) => {
        conn.on("data", (data) => {
          setMessages((prev) => [...prev, data as MessageData]);
        });
      });

      setPeer(newPeer);

      return () => {
        newPeer.destroy();
        unsubscribe();
      };
    }
  }, [db, roomID, user?.uid, signInAnonymously, username]);

  useEffect(() => {
    const onBeforeUnload = (
      ev: WindowEventHandlersEventMap["beforeunload"]
    ) => {
      if (user?.uid) {
        const player = doc(db, "rooms", roomID, "players", user?.uid);
        deleteDoc(player);
      }

      ev.returnValue = "Anything you wanna put here!";
      return "Anything here as well, doesn't matter!";
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [roomID, user?.uid, db]);

  const sendMessage = () => {
    const msg = {text: message, username};
    Object.values(connections.current).forEach((conn) => conn.send(msg));
    setMessages((prevMessages) => [...prevMessages, msg]);
    setMessage("");
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Chat Room</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          {connectionID && (
            <p className="text-sm text-muted-foreground">
              Connected as: {connectionID}
            </p>
          )}
        </div>
        <ScrollArea className="h-[300px] w-full rounded-md border p-4">
          {messages.map((msg, i) => (
            <div key={`${msg.username}-${i}`} className="mb-2">
              <span className="font-semibold">{msg.username}: </span>
              <span>{msg.text}</span>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex w-full gap-2"
        >
          <Input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-grow"
            onSubmitCapture={sendMessage}
          />
          <Button type="submit">Send</Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default ChatComponent;

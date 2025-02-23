"use client";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {useEffect, useState} from "react";

import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {ScrollArea} from "@/components/ui/scroll-area";
import {useAuth} from "@/contexts/AuthContext";
import {useP2p} from "@/hooks/use-p2p";
import {Player} from "@/types/Player";

import {MessageData} from "./types";

const ChatComponent = ({
  roomID,
  username,
}: {
  roomID: string;
  username: string;
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [message, setMessage] = useState("");
  const {user, signInAnonymously} = useAuth();
  const db = getFirestore();

  const onData = (data: MessageData, _: string) => {
    setMessages((prevMessages) => [...prevMessages, data]);
  };

  const onNewConnection = (_: string) => {
    const msg = {text: `Has entered the chat`, username} as MessageData;
    sendDataToPeers(msg);
  };

  const {connectToPeer, removePeerConnection, sendDataToPeers} =
    useP2p<MessageData>({
      roomID,
      localUserID: user?.uid || "Default",
      onData,
      onNewConnection,
    });

  useEffect(() => {
    if (!user?.uid) return;
    const playersRef = collection(db, "rooms", roomID, "players");
    const player = doc(db, "rooms", roomID, "players", user.uid);

    updateDoc(player, {enterTime: Date.now()}).catch((e) => {
      if (e.code === "not-found") {
        setDoc(player, {
          username,
          type: "player",
          enterTime: Date.now(),
        });

        return;
      }

      throw e;
    });
    const unsubscribe = onSnapshot(playersRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data: Player = change.doc.data() as Player;

        const userID = change.doc.id;
        if (change.type === "added") {
          if (userID !== user?.uid) {
            connectToPeer(userID);
          }
          if (!players.find((p) => p.key === userID)) {
            setPlayers((prev) => [...prev, {...data, key: userID}]);
          }
        } else if (change.type === "modified") {
          if (userID !== user?.uid) {
            connectToPeer(userID);
          }
          setPlayers((prev) =>
            prev.map((p) => (p.key === userID ? {...data, key: userID} : p))
          );
        } else {
          setPlayers((prev) => prev.filter((p) => p.key !== userID));
          removePeerConnection(userID);
        }
      });
    });

    return () => {
      unsubscribe();
    };
  }, [db, roomID, user?.uid, signInAnonymously, username]);

  useEffect(() => {
    const onBeforeUnload = (
      ev: WindowEventHandlersEventMap["beforeunload"]
    ) => {
      if (user?.uid) {
        const player = doc(db, "rooms", roomID, "players", user?.uid);
        deleteDoc(player);
        sendDataToPeers({text: `Has left the chat`, username});
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
    sendDataToPeers(msg);
    setMessages((prevMessages) => [...prevMessages, msg]);
    setMessage("");
  };

  return (
    <>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Chat Room</CardTitle>
        </CardHeader>
        <CardContent>
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
    </>
  );
};

export default ChatComponent;

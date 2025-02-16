"use client";
import React, {useEffect, useState} from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {useAuth} from "@/contexts/AuthContext";
import {Player} from "@/types/Player";

const ChatComponent = ({
  roomID,
  username,
}: {
  roomID: string;
  username: string;
}) => {
  const [connectionID, setConnectionID] = useState("");
  const [connections, setConnections] = useState<{
    [key: string]: {connection: DataConnection; userID: string} | undefined;
  }>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [message, setMessage] = useState("");
  const {user, signInAnonymously} = useAuth();
  const db = getFirestore();

  const connectToPeer = (peerId: string, userID: string, localPeer = peer) => {
    if (!localPeer) return;

    console.log(`connect to ${peerId}`);
    const conn = localPeer.connect(peerId);
    conn.on("open", () => {
      console.log(`open connection to ${peerId}`);
      const existingConnectionUser = Object.entries(connections).find(
        ([, conn]) => conn?.userID === userID
      )?.[0];
      const localConnections = connections;
      if (existingConnectionUser) {
        console.log("existing connection for the same user");
        localConnections[existingConnectionUser] = undefined;
        localConnections[peerId] = {connection: conn, userID};
      } else {
        localConnections[peerId] = {connection: conn, userID};
      }
      setConnections(localConnections);
      console.log({connections});
      conn.send({text: "Se ha conectado", username});
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
      const playersRef = collection(db, "rooms", roomID, "players");
      const player = doc(db, "rooms", roomID, "players", user.uid);

      newPeer.on("open", (id) => {
        setConnectionID(id);
        updateDoc(player, {connectionID: id}).catch((e) => {
          if (e.code === "not-found") {
            setDoc(player, {
              username,
              type: "player",
              connectionID: id,
            });

            return;
          }

          throw e;
        });
      });

      const unsubscribe = onSnapshot(playersRef, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          console.log(change);
          const data: Player = change.doc.data() as Player;
          if (!data.connectionID) return;

          const userID = change.doc.id;
          if (change.type === "added") {
            console.log(`New player ${data.username} - ${userID}`);
            if (userID !== user?.uid) {
              connectToPeer(data.connectionID, userID, newPeer);
            }
            if (!players.find((p) => p.key === userID)) {
              setPlayers((prev) => [...prev, {...data, key: userID}]);
            }
          } else if (change.type === "modified") {
            if (userID !== user?.uid) {
              connectToPeer(data.connectionID, userID, newPeer);
            }
            setPlayers((prev) =>
              prev.map((p) => (p.key === userID ? {...data, key: userID} : p))
            );
          } else {
            setPlayers((prev) => prev.filter((p) => p.key !== userID));
          }
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
    Object.values(connections).forEach((conn) => conn?.connection.send(msg));
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Connection</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>isConnectedTo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p) => (
            <TableRow key={p.username}>
              <TableCell>{p.username}</TableCell>
              <TableCell>{p.connectionID}</TableCell>
              <TableCell>{p.type}</TableCell>
              <TableCell>
                {p.key === user?.uid
                  ? "N/A"
                  : Object.values(connections).find((c) => c?.userID === p.key)
                  ? "✅"
                  : "❌"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
};

export default ChatComponent;

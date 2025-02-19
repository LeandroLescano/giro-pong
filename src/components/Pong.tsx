import {Fragment, useEffect, useMemo, useRef, useState} from "react";
import {useKeyHold} from "@/hooks/use-key-press";
import Konva from "konva";
import {Stage, Layer, Rect, Text} from "react-konva";
import {useAuth} from "@/contexts/AuthContext";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Peer, {DataConnection} from "peerjs";
import {Player} from "@/types/Player";
import {PongData} from "./types";

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

const Pong = ({roomID, username}: {roomID: string; username: string}) => {
  const [connections, setConnections] = useState<{
    [key: string]: {connection: DataConnection; userID: string} | undefined;
  }>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [peer, setPeer] = useState<Peer | null>(null);
  const {user, signInAnonymously} = useAuth();
  const db = getFirestore();

  const connectToPeer = (
    peerId: string,
    userID: string,
    localPeer = peer,
    attempt = 1
  ) => {
    if (!localPeer) return;
    console.log(`Attempt ${attempt}: Connecting to ${peerId}...`);

    const conn = localPeer.connect(peerId);

    const timeout = setTimeout(() => {
      if (!conn.open) {
        console.warn(`Attempt ${attempt} failed. Retrying...`);
        if (attempt < MAX_RETRIES) {
          connectToPeer(peerId, userID, localPeer, attempt + 1);
        } else {
          console.error(`Max retries reached. Could not connect to ${peerId}.`);
        }
      }
    }, RETRY_DELAY);

    conn.on("error", (err) => {
      console.error(`Connection to ${peerId} error:`, err);
    });

    conn.on("open", () => {
      clearTimeout(timeout);
      console.log(`Connected to ${peerId} on attempt ${attempt}`);

      const existingConnectionUser = Object.entries(connections).find(
        ([, conn]) => conn?.userID === userID
      )?.[0];

      const localConnections = {...connections};

      if (existingConnectionUser) {
        console.log(`Replacing existing connection for userID: ${userID}`);
        localConnections[existingConnectionUser] = undefined;
        localConnections[peerId] = {connection: conn, userID};
      } else {
        console.log(`New connection established for userID: ${userID}`);
        localConnections[peerId] = {connection: conn, userID};
      }

      setConnections(localConnections);
      conn.send({...coords, key: user?.uid} as PongData);
    });

    conn.on("data", (data: unknown) => {
      const pongData = data as PongData;
      setOtherPlayersCoords((d) => {
        const existingIndex = d.findIndex((opc) => opc.key === pongData.key);
        return existingIndex !== -1
          ? d.map((a) => (a.key === pongData.key ? pongData : a))
          : [...d, pongData];
      });
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
          const data: Player = change.doc.data() as Player;
          if (!data.connectionID) return;

          const userID = change.doc.id;
          if (change.type === "added") {
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
            setOtherPlayersCoords((prev) =>
              prev.filter((p) => p.key !== userID)
            );
          }
        });
      });

      newPeer.on("connection", (conn) => {
        conn.on("data", (data) => {
          const pongData = data as PongData;
          setOtherPlayersCoords((d) => {
            const existingIndex = d.findIndex(
              (opc) => opc.key === pongData.key
            );
            return existingIndex !== -1
              ? d.map((a) => (a.key === pongData.key ? pongData : a))
              : [...d, pongData];
          });
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

  //========================== ↑ PEERJS ↑ ====================
  const [coords, setCoords] = useState({x: 0, y: 0});
  const [otherPlayersCoords, setOtherPlayersCoords] = useState<PongData[]>([]);
  const stage = useRef<Konva.Stage>(null);
  const paddle = useRef<Konva.Rect>(null);

  const usernamesByKey = useMemo(() => {
    const obj: {[key: string]: string} = {};
    players.forEach((p) => {
      obj[p.key] = p.username;
    });
    return obj;
  }, [players]);

  const moveRight = () => {
    if (stage.current) {
      if (coords.x + 200 + 2 <= stage.current?.width())
        setCoords((prev) => {
          const updatedCoords = {...prev, x: prev.x + 2};
          Object.values(connections).forEach((conn) =>
            conn?.connection.send({...updatedCoords, key: user?.uid})
          );
          return updatedCoords;
        });
    }
  };

  const moveLeft = () => {
    if (stage.current) {
      if (coords.x - 2 >= 0)
        setCoords((prev) => {
          const updatedCoords = {...prev, x: prev.x - 2};
          Object.values(connections).forEach((conn) =>
            conn?.connection.send({...updatedCoords, key: user?.uid})
          );
          return updatedCoords;
        });
    }
  };

  useKeyHold({key: ["a", "ArrowLeft"]}, moveLeft);
  useKeyHold({key: ["d", "ArrowRight"]}, moveRight);

  return (
    <div className="overflow-hidden">
      <Stage width={window.innerWidth} height={window.innerHeight} ref={stage}>
        <Layer>
          <Rect
            {...coords}
            stroke="black"
            radius={20}
            width={200}
            height={50}
            fill="red"
            ref={paddle}
          />
          <Text
            x={coords.x}
            y={coords.y}
            verticalAlign="middle"
            align="center"
            text={username}
            fill="white"
            width={200}
            height={50}
          />
          {otherPlayersCoords.map(({key, ...pCoords}) => (
            <Fragment key={key}>
              <Rect
                {...pCoords}
                stroke="black"
                radius={20}
                width={200}
                height={50}
                fill="green"
              />
              <Text
                x={pCoords.x}
                y={pCoords.y}
                verticalAlign="middle"
                align="center"
                text={usernamesByKey[key]}
                fill="white"
                width={200}
                height={50}
              />
            </Fragment>
          ))}
        </Layer>
      </Stage>
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
    </div>
  );
};

export default Pong;

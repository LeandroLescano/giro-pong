import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import Konva from "konva";
import {Fragment, useEffect, useMemo, useRef, useState} from "react";
import {Stage, Layer, Rect, Text} from "react-konva";

import {useAuth} from "@/contexts/AuthContext";
import {useKeyHold} from "@/hooks/use-key-press";
import {useP2p} from "@/hooks/use-p2p";
import {Player} from "@/types/Player";

import {PongData} from "./types";

const Pong = ({roomID, username}: {roomID: string; username: string}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [coords, setCoords] = useState({x: 0, y: 0});
  const [otherPlayersCoords, setOtherPlayersCoords] = useState<PongData[]>([]);

  const localEnterTime = useRef<number>(0);

  const db = getFirestore();

  const {user, signInAnonymously} = useAuth();
  const localID = useMemo(() => user?.uid || "Default", [user?.uid]);

  const stage = useRef<Konva.Stage>(null);
  const paddle = useRef<Konva.Rect>(null);

  const onNewConnection = (_: string) => {
    sendDataToPeers({...coords, key: localID});
  };

  const onHandleData = (data: PongData, _: string) => {
    setOtherPlayersCoords((d) => {
      const existingIndex = d.findIndex((opc) => opc.key === data.key);
      return existingIndex !== -1
        ? d.map((a) => (a.key === data.key ? data : a))
        : [...d, data];
    });
  };

  const {connectToPeer, removePeerConnection, sendDataToPeers} =
    useP2p<PongData>({
      roomID,
      localUserID: localID,
      onData: onHandleData,
      onNewConnection,
    });

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
          sendDataToPeers({...updatedCoords, key: user?.uid || ""});
          return updatedCoords;
        });
    }
  };

  const moveLeft = () => {
    if (stage.current) {
      if (coords.x - 2 >= 0)
        setCoords((prev) => {
          const updatedCoords = {...prev, x: prev.x - 2};
          sendDataToPeers({...updatedCoords, key: user?.uid || ""});
          return updatedCoords;
        });
    }
  };

  useKeyHold({key: ["a", "ArrowLeft", "4"]}, moveLeft);
  useKeyHold({key: ["d", "ArrowRight", "6"]}, moveRight);

  useEffect(() => {
    if (!user?.uid) return;

    const playersRef = collection(db, "rooms", roomID, "players");
    const player = doc(db, "rooms", roomID, "players", user.uid);
    const now = Date.now();
    updateDoc(player, {username, enterTime: now})
      .catch((e) => {
        if (e.code === "not-found") {
          setDoc(player, {
            username,
            type: "player",
            enterTime: now,
          } as Player);

          return;
        }

        throw e;
      })
      .finally(() => {
        localEnterTime.current = now;
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
          setOtherPlayersCoords((prev) => prev.filter((p) => p.key !== userID));
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
      }

      ev.returnValue = "Anything you wanna put here!";
      return "Anything here as well, doesn't matter!";
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [roomID, user?.uid, db]);

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
    </div>
  );
};

export default Pong;

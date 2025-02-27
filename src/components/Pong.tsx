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
import {Stage, Layer, Rect, Text, Circle} from "react-konva";

import {useAuth} from "@/contexts/AuthContext";
import {useKeyHold} from "@/hooks/use-key-press";
import {useP2p} from "@/hooks/use-p2p";
import {haveIntersection, isInside} from "@/lib/utils";
import {Player} from "@/types/Player";

import {PongData} from "./types";

const BALL_RADIUS = 10;

const SPEED = 2;

type Directions =
  | "top"
  | "down"
  | "right"
  | "left"
  | "top-right"
  | "top-left"
  | "down-right"
  | "down-left";

const MOVE_DIRECTION: Record<Directions, {x: number; y: number}> = {
  top: {x: 0, y: -SPEED},
  right: {x: SPEED, y: 0},
  down: {x: 0, y: SPEED},
  left: {x: -SPEED, y: 0},
  "top-left": {x: -SPEED, y: -SPEED},
  "down-left": {x: -SPEED, y: SPEED},
  "down-right": {x: SPEED, y: SPEED},
  "top-right": {x: SPEED, y: -SPEED},
};

const OPPOSITE_DIRECTIONS: Record<Directions, Directions> = {
  top: "down",
  down: "top",
  right: "left",
  left: "right",
  "top-left": "down-right",
  "down-left": "top-right",
  "down-right": "top-left",
  "top-right": "down-left",
};

const Pong = ({roomID, username}: {roomID: string; username: string}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [coords, setCoords] = useState({x: 0, y: 0});
  const [ballCords, setBallCoords] = useState({x: 0, y: 0});
  const [otherPlayersCoords, setOtherPlayersCoords] = useState<PongData[]>([]);

  const db = getFirestore();

  const {user, signInAnonymously} = useAuth();
  const localID = useMemo(() => user?.uid || "Default", [user?.uid]);

  const stage = useRef<Konva.Stage>(null);
  const paddle = useRef<Konva.Rect>(null);
  const ball = useRef<Konva.Circle>(null);

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
      const {intersects, sides} = haveIntersection(
        ball.current?.getClientRect(),
        paddle.current?.getClientRect()
      );

      if (!intersects || !sides.includes("right")) {
        setCoords((prev) => {
          // if (prev.x + 200 + 2 <= stage.current!.width()) {
          const updatedCoords = {...prev, x: prev.x + SPEED};
          sendDataToPeers({...updatedCoords, key: user?.uid || ""});
          return updatedCoords;
          // }
          return prev;
        });
        paddle.current?.fill("red");
      }
    }
  };

  const moveLeft = () => {
    if (stage.current) {
      const {intersects, sides} = haveIntersection(
        ball.current?.getClientRect(),
        paddle.current?.getClientRect()
      );
      if (!intersects || !sides.includes("left")) {
        setCoords((prev) => {
          if (prev.x - SPEED >= 0) {
            const updatedCoords = {...prev, x: prev.x - SPEED};
            sendDataToPeers({...updatedCoords, key: user?.uid || ""});
            return updatedCoords;
          }
          return prev;
        });
        paddle.current?.fill("red");
      }
    }
  };

  const moveUp = () => {
    if (stage.current) {
      setCoords((prev) => {
        if (prev.y - SPEED >= 0) {
          const {intersects, sides} = haveIntersection(
            ball.current?.getClientRect(),
            paddle.current?.getClientRect()
          );
          if (!intersects || !sides.includes("top")) {
            const updatedCoords = {...prev, y: prev.y - SPEED};
            sendDataToPeers({...updatedCoords, key: user?.uid || ""});
            return updatedCoords;
          }
        }
        return prev;
      });
      paddle.current?.fill("red");
    }
  };

  const moveDown = () => {
    if (stage.current) {
      const {intersects, sides} = haveIntersection(
        ball.current?.getClientRect(),
        paddle.current?.getClientRect()
      );
      if (!intersects || !sides.includes("bottom")) {
        setCoords((prev) => {
          if (prev.y + SPEED >= 0) {
            const updatedCoords = {...prev, y: prev.y + SPEED};
            sendDataToPeers({...updatedCoords, key: user?.uid || ""});
            return updatedCoords;
          }
          return prev;
        });
        paddle.current?.fill("red");
      }
    }
  };

  useKeyHold({key: ["a", "ArrowLeft", "4"]}, moveLeft);
  useKeyHold({key: ["d", "ArrowRight", "6"]}, moveRight);
  useKeyHold({key: ["w", "ArrowUp", "8"]}, moveUp);
  useKeyHold({key: ["s", "ArrowDown", "2"]}, moveDown);

  useEffect(() => {
    if (!user?.uid) return;

    const playersRef = collection(db, "rooms", roomID, "players");
    const player = doc(db, "rooms", roomID, "players", user.uid);
    const now = Date.now();
    updateDoc(player, {username, enterTime: now}).catch((e) => {
      if (e.code === "not-found") {
        setDoc(player, {
          username,
          type: "player",
          enterTime: now,
        } as Player);

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

  const [ballDirection, setBallDirection] = useState<Directions>("down-right");

  const ballCoordsRef = useRef({x: 0, y: 0});

  const OFFSET = 10;

  useEffect(() => {
    const id = setInterval(() => {
      setBallCoords((prev) => {
        const newCoords = {
          x: prev.x + MOVE_DIRECTION[ballDirection].x,
          y: prev.y + MOVE_DIRECTION[ballDirection].y,
        };
        ballCoordsRef.current = newCoords;
        return newCoords;
      });
    }, 20);
    return () => clearInterval(id);
  }, [ballDirection]);

  useEffect(() => {
    const checkIntersection = () => {
      const ballRect = ball.current?.getClientRect();
      const paddleRect = paddle.current?.getClientRect();
      const stageRect = stage.current;

      if (!stageRect) return;

      if (haveIntersection(ballRect, paddleRect).intersects) {
        setBallDirection((prevDirection) => {
          const oppositeDirection = OPPOSITE_DIRECTIONS[prevDirection];
          const newCoords = {
            x:
              ballCoordsRef.current.x +
              MOVE_DIRECTION[oppositeDirection].x +
              OFFSET,
            y:
              ballCoordsRef.current.y +
              MOVE_DIRECTION[oppositeDirection].y +
              OFFSET,
          };
          setBallCoords(newCoords);
          ballCoordsRef.current = newCoords;
          return oppositeDirection;
        });
      } else if (!isInside(ballRect, stageRect)) {
        setBallDirection((prevDirection) => {
          const oppositeDirection = OPPOSITE_DIRECTIONS[prevDirection];
          const newCoords = {
            x: ballCoordsRef.current.x + MOVE_DIRECTION[oppositeDirection].x,
            y: ballCoordsRef.current.y + MOVE_DIRECTION[oppositeDirection].y,
          };

          // Adjust the ball's position if it goes outside the stage boundaries
          if (newCoords.x < 0) {
            newCoords.x = 0;
          } else if (newCoords.x + BALL_RADIUS * SPEED > stageRect.width()) {
            newCoords.x = stageRect.width() - BALL_RADIUS * SPEED;
          }

          if (newCoords.y < 0) {
            newCoords.y = 0;
          } else if (newCoords.y + BALL_RADIUS * SPEED > stageRect.height()) {
            newCoords.y = stageRect.height() - BALL_RADIUS * SPEED;
          }

          setBallCoords(newCoords);
          ballCoordsRef.current = newCoords;
          return oppositeDirection;
        });
      }
    };

    const id = setInterval(checkIntersection, 5);
    return () => clearInterval(id);
  }, [ballDirection]);

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
          <Circle
            x={ballCords.x + BALL_RADIUS + 300}
            y={ballCords.y + BALL_RADIUS /*+ 50*/}
            radius={BALL_RADIUS}
            fill="black"
            ref={ball}
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

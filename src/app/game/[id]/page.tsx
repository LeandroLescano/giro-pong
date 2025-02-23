"use client";
import dynamic from "next/dynamic";
const Pong = dynamic(() => import("@/components/Pong"), {
  ssr: false,
});
import {useParams, useSearchParams} from "next/navigation";

const Game = () => {
  const {id} = useParams();
  const params = useSearchParams();

  return (
    <Pong
      roomID={(id as string) || "Default"}
      username={params.get("username") || "Default"}
    />
  );
};

export default Game;

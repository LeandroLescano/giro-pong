"use client";

import dynamic from "next/dynamic";
import {useParams, useSearchParams} from "next/navigation";
const ChatComponent = dynamic(() => import("@/components/ChatComponent"), {
  ssr: false,
});

const Chat = () => {
  const {id} = useParams();
  const params = useSearchParams();

  return (
    <ChatComponent
      roomID={(id as string) || "Default"}
      username={params.get("username") || "Default"}
    />
  );
};

export default Chat;

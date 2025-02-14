"use client";

import dynamic from "next/dynamic";
const ChatComponent = dynamic(() => import("@/components/ChatComponent"), {
  ssr: false,
});

const Chat = () => {
  return <ChatComponent />;
};

export default Chat;

"use client";

import dynamic from "next/dynamic";

const JoinChatForm = dynamic(() => import("@/components/JoinForm"), {
  ssr: false,
});

export default function Home() {
  return <JoinChatForm />;
}

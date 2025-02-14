"use client";
import React, {useEffect, useState} from "react";

import webconnect from "webconnect";
import {MessageData, OnConnectAttribute} from "./types";
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

const connect = webconnect({});

const ChatComponent = () => {
  const [myConnectionID, setMyConnectionID] = useState("");

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    connect.onConnect((attribute: OnConnectAttribute) => {
      console.log({attribute});
      console.log(`${attribute.connectId} connected`);
      setMyConnectionID(attribute.connectId);
    });
  }, []);

  useEffect(() => {
    connect.onReceive((message: MessageData) => {
      console.log(`Received message: ${message}`);
      setMessages((prevMessages) => [...prevMessages, message]);
    });
  }, [messages]);

  const sendMessage = () => {
    const msg = {text: message, username};
    connect.Send(msg, {connectId: myConnectionID});
    setMessages((prevMessages) => [...prevMessages, msg]);
    setMessage("");
  };

  return (
    // <>
    //   <div>{myConnectionID && <p>My connection ID: {myConnectionID}</p>}</div>
    //   <input
    //     type="text"
    //     value={username}
    //     onChange={(e) => setUsername(e.target.value)}
    //   />
    //   <br />
    //   {messages.map((message, i) => (
    //     <div key={`${message.username}-${i}`}>
    //       <p>
    //         {message.username}: {message.text}
    //       </p>
    //     </div>
    //   ))}
    //   <input
    //     type="text"
    //     id="message"
    //     value={message}
    //     onChange={(e) => setMessage(e.target.value)}
    //   />
    //   <button onClick={sendMessage}>Send</button>
    // </>
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Chat Room</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className="mb-2"
          />
          {myConnectionID && (
            <p className="text-sm text-muted-foreground">
              Connected as: {myConnectionID}
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

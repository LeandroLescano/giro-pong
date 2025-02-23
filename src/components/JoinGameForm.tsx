"use client";

import {
  getFirestore,
  addDoc,
  collection,
  setDoc,
  doc,
} from "firebase/firestore";
import {useRouter} from "next/navigation";
import {useState} from "react";

import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useAuth} from "@/contexts/AuthContext";
import {toast} from "@/hooks/use-toast";

export default function JoinChatForm() {
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const router = useRouter();
  const db = getFirestore();
  const {user} = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    if (!user?.uid) return; //TODO: add some alert or error

    e.preventDefault();

    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username.",
        variant: "destructive",
      });
      return;
    }

    if (!roomName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room name.",
        variant: "destructive",
      });
      return;
    }

    // Here you would typically handle joining the room
    // For now, we'll just redirect to a chat page with the username and room as query params
    const rooms = collection(db, "rooms");
    const {id} = await addDoc(rooms, {
      name: roomName,
    });
    const player = doc(db, "rooms", id, "players", user.uid);
    setDoc(player, {
      username,
      type: "host",
    });
    router.push(`/game/${id}?username=${encodeURIComponent(username)}`);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Join Game Room</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roomName">Room Name</Label>
            <Input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">
            Join Game
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export interface Player {
  key: string;
  username: string;
  type: "host" | "player";
  enterTime: Timestamp;
}

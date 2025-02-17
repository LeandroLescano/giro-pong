export interface OnConnectAttribute {
  connectId: string;
}

export interface MessageData {
  text: string;
  username: string;
}

export interface PongData {
  key: string;
  x: number;
  y: number;
}

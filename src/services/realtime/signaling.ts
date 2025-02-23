import {
  Database,
  DatabaseReference,
  ThenableReference,
  off,
  onChildAdded,
  push,
  ref,
  remove,
} from "firebase/database";

export class FirebaseSignaling {
  private roomID: string;
  private localID: string;
  private dbRef: DatabaseReference;
  private db: Database;

  constructor(roomID: string, localID: string, database: Database) {
    this.roomID = roomID;
    this.localID = localID;
    this.dbRef = ref(database, `signaling/${roomID}`);
    this.db = database;
  }

  // Sends a signaling message; the message is augmented with a sender id.
  async sendSignal<T>(data: T): Promise<ThenableReference> {
    const message = {...data, sender: this.localID};
    return await push(this.dbRef, message);
  }

  async removeSignal(key: string): Promise<void> {
    const signalingRef = ref(this.db, `signaling/${this.roomID}/${key}`);
    return await remove(signalingRef);
  }

  // Registers a callback to handle incoming signaling messages.
  onSignal<T>(callback: (data: T) => void) {
    onChildAdded(this.dbRef, (snapshot) => {
      const data = snapshot.val();
      // Ignore our own messages.
      if (data.sender === this.localID) return;
      callback(data);
    });
  }

  // Turn off the listener when done.
  offSignal() {
    off(this.dbRef);
  }
}

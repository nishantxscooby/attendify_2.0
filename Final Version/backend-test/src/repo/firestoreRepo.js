import { firestore } from "../firebase.js";
import { FieldValue } from "firebase-admin/firestore";

const ATTENDANCE_COLLECTION = "attendance";
const USERS_COLLECTION = "users";

export class FirestoreRepo {
  constructor(client = firestore) {
    this.client = client;
  }

  async createAttendance(data) {
    const docRef = this.client.collection(ATTENDANCE_COLLECTION).doc();
    const payload = { ...data, capturedAt: FieldValue.serverTimestamp() };
    await docRef.set(payload);
    return docRef.id;
  }

  async listAttendanceBySession(sessionId, limit = 200) {
    const snapshot = await this.client
      .collection(ATTENDANCE_COLLECTION)
      .where("sessionId", "==", sessionId)
      .orderBy("capturedAt", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getUser(uid) {
    const doc = await this.client.collection(USERS_COLLECTION).doc(uid).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }
}

export default new FirestoreRepo();

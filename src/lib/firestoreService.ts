import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { SimulatedRecord } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const backupRecordToFirestore = async (record: SimulatedRecord) => {
  if (!auth.currentUser) return;
  const path = 'records';
  try {
    await setDoc(doc(db, path, record.id), record);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${record.id}`);
  }
};

export const backupDailySnapshot = async (records: SimulatedRecord[]) => {
  if (!auth.currentUser) return;
  const path = 'snapshots';
  const today = new Date().toISOString().split('T')[0];
  try {
    // Save snapshot with document ID as today's date
    await setDoc(doc(db, path, today), {
      date: today,
      records: records,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${today}`);
  }
};

export const addActivityLogToFirestore = async (log: any) => {
  if (!auth.currentUser) return;
  const path = 'activity_logs';
  try {
    // Convert id to string for document path or use addDoc
    await addDoc(collection(db, path), {
      ...log,
      createdAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const loadBackupRecords = async (): Promise<SimulatedRecord[]> => {
  if (!auth.currentUser) return [];
  const path = 'records';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(1000));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as SimulatedRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

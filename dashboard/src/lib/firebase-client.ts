import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from './firebase-init';

export const db = getFirestore(firebaseApp);

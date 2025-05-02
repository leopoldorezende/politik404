import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyC0xNofnFkOy1Ig5cc74kGzuM0WcHGdj88',
  authDomain: 'politik404-41c47.firebaseapp.com',
  projectId: 'politik404-41c47'
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const provider = new GoogleAuthProvider()

export const loginWithGoogle = () => signInWithPopup(auth, provider)
import type { User } from 'firebase/auth'

export type AppUser = {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

export function toAppUser(firebaseUser: User): AppUser {
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
  }
}

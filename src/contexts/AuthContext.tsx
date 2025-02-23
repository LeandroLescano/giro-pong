"use client";

import {
  getAnalytics,
  isSupported,
  setAnalyticsCollectionEnabled,
} from "firebase/analytics";
import {getApp, getApps, initializeApp} from "firebase/app";
import {
  User,
  getAuth,
  onAuthStateChanged,
  signOut as authSignOut,
  signInAnonymously as authSignInAnonymously,
  connectAuthEmulator,
} from "firebase/auth";
import {connectDatabaseEmulator, getDatabase} from "firebase/database";
import {connectFirestoreEmulator, getFirestore} from "firebase/firestore";
import React, {
  useState,
  useEffect,
  useContext,
  createContext,
  JSX,
  useCallback,
} from "react";

import {firebaseConfig} from "@/resources/config";

interface AuthContextState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: VoidFunction;
}

const AuthContext = createContext<AuthContextState>({
  user: null,
  loading: true,
  isAuthenticated: false,
  signInAnonymously: () => Promise.resolve(),
  signOut: () => ({}),
});

interface Props {
  children: JSX.Element;
}

if (process.env.NODE_ENV === "development") {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  try {
    connectAuthEmulator(getAuth(app), "http://localhost:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(getFirestore(app), "localhost", 8080);
    connectDatabaseEmulator(getDatabase(app), "localhost", 9000);

    isSupported().then(
      (supported) =>
        supported && setAnalyticsCollectionEnabled(getAnalytics(), false)
    );
  } catch (error) {
    console.log({error});
  }
}

export function AuthProvider({children}: Props) {
  const auth = useAuthProvider();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};

function useAuthProvider(): AuthContextState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);

  const signInAnonymously = useCallback(async () => {
    await authSignInAnonymously(auth).catch((e) => console.error(e));
  }, [auth]);

  const handleUser = useCallback(
    async (gUser: User | null) => {
      if (gUser) {
        setUser(gUser);

        setLoading(false);
        return gUser;
      } else {
        signInAnonymously();
        setLoading(false);
        setUser(null);
        return false;
      }
    },
    [signInAnonymously]
  );

  const signOut = async () => {
    if (user) {
      await authSignOut(auth);
      handleUser(null);
    }
  };

  const isAuthenticated: boolean = !!(user?.uid && !loading);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, handleUser);

    return () => unsubscribe();
  }, [auth, handleUser]);

  return {
    user,
    loading,
    isAuthenticated,
    signInAnonymously,
    signOut,
  };
}

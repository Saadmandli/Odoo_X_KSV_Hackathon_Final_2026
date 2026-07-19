import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { get, post, setToken, clearToken, getToken, TOKEN_KEY } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  // "loading" until we've resolved any stored token, so protected routes don't
  // bounce a signed-in user to /login on a hard refresh.
  const [status, setStatus] = useState("loading");

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setStatus("anon");
      return;
    }
    try {
      const { user, org } = await get("/auth/me");
      setUser(user);
      setOrg(org);
      setStatus("authed");
    } catch {
      clearToken();
      setStatus("anon");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Keeps every tab honest about who is signed in.
   *
   * The token lives in localStorage, which is shared by every tab on the
   * origin — so signing into a second account in another tab silently replaces
   * the first one's credentials. Without this listener that tab carried on
   * rendering the previous user's screens while its requests were being made
   * as somebody else: a driver still looking at "You are driving" whose calls
   * were arriving as a passenger. Being shown the wrong person's view is worse
   * than being asked to sign in again.
   *
   * The event only fires in *other* tabs, so this never reacts to its own
   * sign-in or sign-out.
   */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== null && e.key !== TOKEN_KEY) return;

      if (!getToken()) {
        setUser(null);
        setOrg(null);
        setStatus("anon");
        return;
      }
      // A different account took over: re-read who we now are.
      refresh();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const login = async (email, password) => {
    const { token, user } = await post("/auth/login", { email, password });
    setToken(token);
    setUser(user);
    setStatus("authed");
    await refresh();
    return user;
  };

  const signup = async (payload) => {
    const { token, user } = await post("/auth/signup", payload);
    setToken(token);
    setUser(user);
    setStatus("authed");
    await refresh();
    return user;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setOrg(null);
    setStatus("anon");
  };

  return (
    <AuthContext.Provider
      value={{ user, org, status, login, signup, logout, refresh, isAdmin: user?.role === "ADMIN" }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

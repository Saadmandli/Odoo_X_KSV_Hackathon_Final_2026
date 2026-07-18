import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { get, post, setToken, clearToken, getToken } from "./api";

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

import React, { createContext, useState, useEffect, useCallback } from "react";
import client from "../api/client";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user,    setUser]    = useState(null);
    const [loading, setLoading] = useState(true); // true while we verify a stored token

    useEffect(() => {
        const storedToken = localStorage.getItem("nexusfund_token");
        if (!storedToken) {
            setLoading(false);
            return;
        }
        // Verify the token is still valid — the user might have been gone for 7+ days
        client
            .get("/api/auth/me")
            .then((res) => setUser(res.data.user))
            .catch(() => {
                localStorage.removeItem("nexusfund_token");
                localStorage.removeItem("nexusfund_user");
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback((token, userData) => {
        localStorage.setItem("nexusfund_token", token);
        localStorage.setItem("nexusfund_user",  JSON.stringify(userData));
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("nexusfund_token");
        localStorage.removeItem("nexusfund_user");
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, loading, login, logout, isAuthenticated: !!user }}
        >
            {children}
        </AuthContext.Provider>
    );
}

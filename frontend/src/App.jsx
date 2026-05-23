import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthProvider } from "./context/AuthContext";
import Navbar          from "./components/Navbar";
import ProtectedRoute  from "./components/ProtectedRoute";
import Home            from "./pages/Home";
import CampaignDetail  from "./pages/CampaignDetail";
import CreateCampaign  from "./pages/CreateCampaign";
import Dashboard       from "./pages/Dashboard";
import Login           from "./pages/Login";
import Register        from "./pages/Register";
import Cashout         from "./pages/Cashout";

function DirectionSync() {
    const { i18n } = useTranslation();
    useEffect(() => {
        document.documentElement.dir  = i18n.language === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);
    return null;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <DirectionSync />
                <Navbar />
                <Routes>
                    <Route path="/"             element={<Home />} />
                    <Route path="/campaign/:id" element={<CampaignDetail />} />
                    <Route path="/login"        element={<Login />} />
                    <Route path="/register"     element={<Register />} />
                    <Route path="/cashout"      element={<Cashout />} />

                    <Route path="/create" element={
                        <ProtectedRoute>
                            <CreateCampaign />
                        </ProtectedRoute>
                    } />
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    } />

                    <Route path="*" element={
                        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
                            <h1 className="text-5xl font-bold text-gray-600">404</h1>
                            <p className="text-gray-400">Page not found.</p>
                            <a href="/" className="text-primary-400 hover:text-primary-300 underline text-sm">
                                Go home
                            </a>
                        </div>
                    } />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

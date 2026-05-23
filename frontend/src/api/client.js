import axios from "axios";

const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
    timeout: 15_000,
});

// Attach the JWT on every request so we don't repeat this in every page
client.interceptors.request.use((config) => {
    const token = localStorage.getItem("nexusfund_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// On 401: the token expired or was tampered. Clear it and send the user to login.
// This handles the case where a user leaves the tab open for 7+ days.
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("nexusfund_token");
            localStorage.removeItem("nexusfund_user");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default client;

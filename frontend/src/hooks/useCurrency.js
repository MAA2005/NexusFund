import { useState, useEffect, useMemo } from "react";
import { useAuth } from "./useAuth";
import { getCurrencyForCountry } from "../lib/currencies";

// Module-level cache — rates are fetched once per browser session, not per component mount.
// This prevents N components all firing the same network request simultaneously.
let cachedRates = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3_600_000; // 1 hour

const RATES_URL = "https://open.er-api.com/v6/latest/USD";

export function useCurrency() {
    const { user } = useAuth();
    const [rates,   setRates]   = useState(cachedRates);
    const [loading, setLoading] = useState(!cachedRates);

    // Map user's country string → { code, locale }
    const currencyInfo = useMemo(
        () => getCurrencyForCountry(user?.country),
        [user?.country]
    );

    useEffect(() => {
        // Skip fetch if cache is still fresh
        if (cachedRates && Date.now() - cacheTimestamp < CACHE_TTL) {
            setRates(cachedRates);
            setLoading(false);
            return;
        }

        // Skip fetch if currency is already USD — no conversion needed
        if (currencyInfo.code === "USD") {
            setLoading(false);
            return;
        }

        fetch(RATES_URL)
            .then((r) => {
                if (!r.ok) throw new Error("Rate fetch failed");
                return r.json();
            })
            .then((data) => {
                cachedRates    = data.rates;
                cacheTimestamp = Date.now();
                setRates(data.rates);
            })
            .catch(() => {
                // If the API is unreachable, silently degrade — USDC amounts still show
                cachedRates = null;
            })
            .finally(() => setLoading(false));
    }, [currencyInfo.code]);

    // Returns a formatted local-currency string for a USDC amount,
    // or null if no conversion is available/needed.
    function formatUSDC(usdcAmount) {
        const amount = Number(usdcAmount);
        if (!isFinite(amount) || !rates) return null;

        // No conversion needed when user is in a USD country
        if (currencyInfo.code === "USD") return null;

        const rate        = rates[currencyInfo.code];
        if (!rate) return null;

        const localAmount = amount * rate;

        try {
            return new Intl.NumberFormat(currencyInfo.locale, {
                style:                 "currency",
                currency:              currencyInfo.code,
                maximumFractionDigits: localAmount >= 1000 ? 0 : 2,
            }).format(localAmount);
        } catch {
            // Intl may not support every locale on every OS — fall back gracefully
            return `${currencyInfo.code} ${localAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }
    }

    return { formatUSDC, currencyCode: currencyInfo.code, loading };
}

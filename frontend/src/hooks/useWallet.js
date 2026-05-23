import { useState, useCallback, useEffect } from "react";
import { BrowserProvider } from "ethers";

const CHAIN_ID     = parseInt(import.meta.env.VITE_POLYGON_CHAIN_ID || "80002");
const CHAIN_ID_HEX = "0x" + CHAIN_ID.toString(16);

const AMOY_PARAMS = {
    chainId:          CHAIN_ID_HEX,
    chainName:        import.meta.env.VITE_POLYGON_CHAIN_NAME || "Polygon Amoy Testnet",
    nativeCurrency:   { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls:          [import.meta.env.VITE_POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology/"],
    blockExplorerUrls:[import.meta.env.VITE_POLYGON_BLOCK_EXPLORER || "https://amoy.polygonscan.com"],
};

export function useWallet() {
    const [account,    setAccount]    = useState(null);
    const [chainId,    setChainId]    = useState(null);
    const [provider,   setProvider]   = useState(null);
    const [connecting, setConnecting] = useState(false);
    const [error,      setError]      = useState(null);

    const isMetaMaskInstalled = typeof window !== "undefined" && !!window.ethereum?.isMetaMask;
    const isConnected         = !!account;
    const isCorrectNetwork    = chainId === CHAIN_ID;

    // Pick up an already-connected account from a previous session
    useEffect(() => {
        if (!isMetaMaskInstalled) return;

        const onAccountsChanged = (accounts) => setAccount(accounts[0] || null);
        const onChainChanged    = ()         => window.location.reload(); // MetaMask recommends reload

        window.ethereum.on("accountsChanged", onAccountsChanged);
        window.ethereum.on("chainChanged",    onChainChanged);

        window.ethereum
            .request({ method: "eth_accounts" })
            .then(async (accounts) => {
                if (accounts.length > 0) {
                    const p   = new BrowserProvider(window.ethereum);
                    const net = await p.getNetwork();
                    setProvider(p);
                    setAccount(accounts[0]);
                    setChainId(Number(net.chainId));
                }
            })
            .catch(() => {});

        return () => {
            window.ethereum.removeListener("accountsChanged", onAccountsChanged);
            window.ethereum.removeListener("chainChanged",    onChainChanged);
        };
    }, [isMetaMaskInstalled]);

    const connect = useCallback(async () => {
        if (!isMetaMaskInstalled) {
            setError("MetaMask is not installed. Visit metamask.io to install it.");
            return;
        }
        setConnecting(true);
        setError(null);
        try {
            const p        = new BrowserProvider(window.ethereum);
            const accounts = await p.send("eth_requestAccounts", []);
            const net      = await p.getNetwork();
            setProvider(p);
            setAccount(accounts[0]);
            setChainId(Number(net.chainId));
        } catch (err) {
            setError(
                err.code === 4001
                    ? "Connection cancelled. Please accept the MetaMask prompt."
                    : "Failed to connect. Please try again."
            );
        } finally {
            setConnecting(false);
        }
    }, [isMetaMaskInstalled]);

    const switchToAmoy = useCallback(async () => {
        if (!window.ethereum) return;
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: CHAIN_ID_HEX }],
            });
        } catch (err) {
            if (err.code === 4902) {
                // Chain not in MetaMask yet — add it
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [AMOY_PARAMS],
                });
            } else {
                throw err;
            }
        }
    }, []);

    // Short display version of the wallet address: "0x1234...abcd"
    const shortAccount = account
        ? `${account.slice(0, 6)}...${account.slice(-4)}`
        : null;

    return {
        account,
        shortAccount,
        provider,
        chainId,
        isMetaMaskInstalled,
        isConnected,
        isCorrectNetwork,
        connecting,
        error,
        connect,
        switchToAmoy,
    };
}

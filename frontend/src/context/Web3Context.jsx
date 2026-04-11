import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { usePrivy, useWallets } from "@privy-io/react-auth";

const Web3Context = createContext(null);

const BASE_SEPOLIA_CHAIN_ID = 84532;

export function Web3Provider({ children }) {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [walletSource, setWalletSource] = useState(null);
  const [userRole, setUserRole] = useState(() => {
    const stored = sessionStorage.getItem("invoflow_role");
    return stored === "sme" || stored === "investor" ? stored : null;
  });

  const { ready, authenticated, login, logout: privyLogout, user, createWallet } = usePrivy();
  const { wallets } = useWallets();

  const isConnected = Boolean(account);
  const isCorrectChain = chainId === BASE_SEPOLIA_CHAIN_ID;

  // ── Detect login type from Privy user ──────────────────────────
  // If user logged in via email/Google → they get an embedded wallet
  // If user logged in via wallet (MetaMask) → use that external wallet
  const loginType = (() => {
    if (!user) return null;
    const linked = user.linkedAccounts || [];
    // If user has email or google linked, they logged in via email/google
    const hasEmail = linked.some((a) => a.type === "email");
    const hasGoogle = linked.some((a) => a.type === "google_oauth");
    // If user ONLY has a wallet linked (no email/google), it's a MetaMask login
    const hasExternalWallet = linked.some(
      (a) => a.type === "wallet" && a.walletClientType !== "privy"
    );
    if (hasEmail || hasGoogle) return "embedded";
    if (hasExternalWallet) return "external";
    return "embedded"; // default to embedded
  })();

  // Find wallets by type
  const embeddedWallet = wallets.find(
    (w) => w.walletClientType === "privy" || w.connectorType === "embedded"
  );
  const externalWallet = wallets.find(
    (w) => w.walletClientType !== "privy" && w.connectorType !== "embedded"
  );

  // Loading: authenticated but the right wallet type hasn't appeared yet
  const walletLoading = authenticated && (
    loginType === "embedded" ? !embeddedWallet : !externalWallet
  );

  // ── Create embedded wallet for email/Google users if needed ────
  const creatingWalletRef = useRef(false);
  useEffect(() => {
    if (!ready || !authenticated || !user || loginType !== "embedded") return;
    if (creatingWalletRef.current) return;

    const hasEmbedded = user.linkedAccounts?.some(
      (a) => a.type === "wallet" && a.walletClientType === "privy"
    );
    const hasEmbeddedInHook = wallets.some(
      (w) => w.walletClientType === "privy" || w.connectorType === "embedded"
    );

    if (!hasEmbedded && !hasEmbeddedInHook) {
      creatingWalletRef.current = true;
      console.log("[Web3] Creating embedded wallet for", user.id);
      createWallet().then(() => {
        console.log("[Web3] Embedded wallet created");
      }).catch((err) => {
        console.warn("[Web3] createWallet:", err.message || err);
      }).finally(() => {
        creatingWalletRef.current = false;
      });
    }
  }, [ready, authenticated, user, wallets, createWallet, loginType]);

  // ── Privy wallet sync ──────────────────────────────────────────
  // Pick the right wallet based on login type
  useEffect(() => {
    if (!ready || !authenticated || !user) return;

    // Choose wallet based on login type
    let targetWallet;
    if (loginType === "external") {
      // MetaMask / external wallet login — use external wallet
      targetWallet = wallets.find(
        (w) => w.walletClientType !== "privy" && w.connectorType !== "embedded"
      );
    } else {
      // Email / Google login — use embedded wallet
      targetWallet = wallets.find(
        (w) => w.walletClientType === "privy" || w.connectorType === "embedded"
      );
    }

    if (!targetWallet) {
      console.log("[Web3] Waiting for", loginType, "wallet to appear...");
      return;
    }

    // Skip if we already set up this exact address
    if (account && account.toLowerCase() === targetWallet.address.toLowerCase()) return;

    // Clear stale state from previous login before setting new wallet
    setAccount("");
    setProvider(null);
    setSigner(null);

    const setupWallet = async () => {
      try {
        console.log("[Web3] Setting up", loginType, "wallet:", targetWallet.address, "for user:", user.id);

        await targetWallet.switchChain(BASE_SEPOLIA_CHAIN_ID);
        const eip1193Provider = await targetWallet.getEthereumProvider();
        const ethProvider = new ethers.BrowserProvider(eip1193Provider);
        const s = await ethProvider.getSigner();

        setAccount(targetWallet.address);
        setProvider(ethProvider);
        setSigner(s);
        setChainId(BASE_SEPOLIA_CHAIN_ID);
        setWalletSource(loginType === "external" ? "metamask" : "privy");
      } catch (err) {
        console.error("Wallet setup failed:", err);
      }
    };

    setupWallet();
  }, [ready, authenticated, user, wallets, account, loginType]);

  // ── Clear state when Privy logs out ────────────────────────────
  useEffect(() => {
    if (ready && !authenticated && walletSource === "privy") {
      setAccount("");
      setProvider(null);
      setSigner(null);
      setChainId(null);
      setWalletSource(null);
    }
  }, [ready, authenticated, walletSource]);

  // ── Connect: opens Privy modal ─────────────────────────────────
  const connectWallet = useCallback(() => {
    if (!ready) return;
    // If not authenticated, open the Privy login modal
    if (!authenticated) {
      login();
      return;
    }
    // If authenticated but wallet already set, nothing to do — it's connected
    // If authenticated but wallets still loading, the useEffect above handles it
  }, [ready, authenticated, login]);

  // ── Disconnect: full Privy logout ──────────────────────────────
  const disconnectWallet = useCallback(async () => {
    // Clear all local state first
    setAccount("");
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setWalletSource(null);
    setUserRole(null);
    sessionStorage.removeItem("invoflow_role");

    if (authenticated) {
      try {
        await privyLogout();
      } catch (err) {
        console.warn("Privy logout error:", err);
      }
    }
    // Force full page reload to clear all Privy cached state
    window.location.href = "/";
  }, [authenticated, privyLogout]);

  // ── Role selection ─────────────────────────────────────────────
  const selectRole = useCallback((role) => {
    setUserRole(role);
    if (role) {
      sessionStorage.setItem("invoflow_role", role);
    } else {
      sessionStorage.removeItem("invoflow_role");
    }
  }, []);

  return (
    <Web3Context.Provider value={{
      account,
      provider,
      signer,
      chainId,
      isConnected,
      isCorrectChain,
      connecting: walletLoading,
      connectWallet,
      disconnectWallet,
      walletSource,
      userRole,
      selectRole,
      privyUser: user,
      privyAuthenticated: authenticated,
      privyReady: ready,
      BASE_SEPOLIA_CHAIN_ID,
      _debugWallets: wallets,
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used within Web3Provider");
  return ctx;
}

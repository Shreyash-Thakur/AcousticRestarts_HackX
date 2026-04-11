import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";

const Web3Context = createContext(null);

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_SEPOLIA_HEX = "0x14A34";

export function Web3Provider({ children }) {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const isConnected = Boolean(account);
  const isCorrectChain = chainId === BASE_SEPOLIA_CHAIN_ID;

  const refreshSigner = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const bp = new ethers.BrowserProvider(window.ethereum);
      const s = await bp.getSigner();
      const net = await bp.getNetwork();
      setProvider(bp);
      setSigner(s);
      setChainId(Number(net.chainId));
    } catch {
      /* ignore */
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to connect your wallet.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await refreshSigner();

        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BASE_SEPOLIA_HEX }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: BASE_SEPOLIA_HEX,
                chainName: "Base Sepolia",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://sepolia.base.org"],
                blockExplorerUrls: ["https://sepolia.basescan.org"],
              }],
            });
          }
        }
        // Refresh after chain switch
        await refreshSigner();
      }
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setConnecting(false);
    }
  }, [refreshSigner]);

  const disconnectWallet = useCallback(() => {
    setAccount("");
    setProvider(null);
    setSigner(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
        refreshSigner();
      }
    };

    const handleChainChanged = () => {
      refreshSigner();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // Auto-reconnect
    window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        refreshSigner();
      }
    });

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnectWallet, refreshSigner]);

  return (
    <Web3Context.Provider value={{
      account,
      provider,
      signer,
      chainId,
      isConnected,
      isCorrectChain,
      connecting,
      connectWallet,
      disconnectWallet,
      BASE_SEPOLIA_CHAIN_ID,
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

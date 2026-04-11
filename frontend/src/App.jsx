import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import { Web3Provider, useWeb3 } from "./context/Web3Context";
import Navbar from "./components/Navbar";
import RoleSelector from "./components/RoleSelector";
import LandingPage from "./pages/LandingPage";
import UploadPage from "./pages/UploadPage";
import MarketplacePage from "./pages/MarketplacePage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import SMEDashboard from "./pages/SMEDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";

const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  network: "base-sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
  blockExplorers: { default: { name: "BaseScan", url: "https://sepolia.basescan.org" } },
  testnet: true,
};

const privyConfig = {
  loginMethods: ["email", "wallet", "google"],
  appearance: {
    theme: "light",
    accentColor: "#15803D",
    logo: "/favicon.svg",
  },
  embeddedWallets: {
    createOnLogin: "all-users",
  },
  defaultChain: baseSepolia,
  supportedChains: [baseSepolia],
};

function AppContent() {
  const { isConnected, userRole, account } = useWeb3();

  // Show role picker when logged in but no role selected
  if (isConnected && !userRole) {
    return <RoleSelector />;
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/"                   element={<LandingPage />} />
        <Route path="/marketplace"        element={<MarketplacePage />} />
        <Route path="/invoice/:id"        element={<InvoiceDetailPage />} />
        {/* SME-only routes — redirect investors away */}
        <Route path="/upload"             element={userRole === "investor" ? <Navigate to="/dashboard/investor" replace /> : <UploadPage />} />
        <Route path="/dashboard/sme"      element={userRole === "investor" ? <Navigate to="/dashboard/investor" replace /> : <SMEDashboard key={account} />} />
        {/* Investor-only routes — redirect SMEs away */}
        <Route path="/dashboard/investor" element={userRole === "sme" ? <Navigate to="/dashboard/sme" replace /> : <InvestorDashboard key={account} />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID} config={privyConfig}>
      <BrowserRouter>
        <Web3Provider>
          <AppContent />
        </Web3Provider>
      </BrowserRouter>
    </PrivyProvider>
  );
}

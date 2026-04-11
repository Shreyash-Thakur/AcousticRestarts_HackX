import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "./context/Web3Context";
import Navbar from "./components/Navbar";
import LandingPage from "./pages/LandingPage";
import UploadPage from "./pages/UploadPage";
import MarketplacePage from "./pages/MarketplacePage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import SMEDashboard from "./pages/SMEDashboard";
import InvestorDashboard from "./pages/InvestorDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Web3Provider>
        <Navbar />
        <Routes>
          <Route path="/"                   element={<LandingPage />} />
          <Route path="/upload"             element={<UploadPage />} />
          <Route path="/marketplace"        element={<MarketplacePage />} />
          <Route path="/invoice/:id"        element={<InvoiceDetailPage />} />
          <Route path="/dashboard/sme"      element={<SMEDashboard />} />
          <Route path="/dashboard/investor" element={<InvestorDashboard />} />
        </Routes>
      </Web3Provider>
    </BrowserRouter>
  );
}

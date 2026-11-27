import { useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider } from "./auth";
import { Layout } from "./components/Layout";
import { Bets } from "./pages/Bets";
import { DrawDetail } from "./pages/DrawDetail";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { Insights } from "./pages/Insights";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function UnauthorizedHandler() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = () => {
      queryClient.setQueryData(["me"], null);
      navigate("/login");
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, [navigate, queryClient]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <UnauthorizedHandler />
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="history" element={<History />} />
              <Route path="draws/:drawNo" element={<DrawDetail />} />
              <Route path="insights" element={<Insights />} />
              <Route path="bets" element={<Bets />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

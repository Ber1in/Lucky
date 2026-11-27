import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type User } from "./api";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.login(username, password),
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  });

  const registerMutation = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.register(username, password),
    onSuccess: (user) => queryClient.setQueryData(["me"], user),
  });

  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.setQueryData(["me"], null);
      queryClient.invalidateQueries();
    },
  });

  const value = useMemo<AuthState>(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      login: async (username, password) => {
        await loginMutation.mutateAsync({ username, password });
      },
      register: async (username, password) => {
        await registerMutation.mutateAsync({ username, password });
      },
      logout: async () => {
        await logoutMutation.mutateAsync();
      },
    }),
    [meQuery.data, meQuery.isLoading, loginMutation, registerMutation, logoutMutation],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return context;
}

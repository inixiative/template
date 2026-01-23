"use client";

import { authClient } from "@/lib/auth-client";
import type { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
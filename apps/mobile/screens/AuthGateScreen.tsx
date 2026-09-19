import { useState } from "react";
import { LoginScreen } from "./LoginScreen";
import { RegisterScreen } from "./RegisterScreen";

export function AuthGateScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return mode === "login" ? (
    <LoginScreen onSwitchToRegister={() => setMode("register")} />
  ) : (
    <RegisterScreen onSwitchToLogin={() => setMode("login")} />
  );
}

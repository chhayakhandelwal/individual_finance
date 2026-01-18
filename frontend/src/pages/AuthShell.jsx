import { useState } from "react";
import LoginPage from "./Login";
import RegisterPage from "./register";
import ForgotPage from "./forgot";

export default function AuthShell() {
  const [screen, setScreen] = useState("login"); // login | register | forgot

  if (screen === "register") {
    return (
      <div className="auth-shell">
        <RegisterPage onBack={() => setScreen("login")} />
      </div>
    );
  }

  if (screen === "forgot") {
    return (
      <div className="auth-shell">
        <ForgotPage onBack={() => setScreen("login")} />
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <LoginPage
        onOpenForgot={() => setScreen("forgot")}
        onOpenRegister={() => setScreen("register")}
        onLogin={() => {
          // Login.jsx already sets token & dispatches event
          // App.jsx listens and will open Overview automatically
        }}
      />
    </div>
  );
}
import { useEffect, useState } from "react";
import axios from "axios";
import "./login.css";

const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function LoginPage({ onLogin, onOpenForgot, onOpenRegister }) {
  const [username, setUsername] = useState("");   // ✅ INCLUDED
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [captcha, setCaptcha] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateCaptcha = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptcha(result);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const uid = userId.trim();
    const pwd = password;

    if (!uid || !pwd) {
      alert("ID and Password are required!");
      return;
    }

    if (captchaInput.trim().toUpperCase() !== captcha.toUpperCase()) {
      alert("Incorrect Captcha");
      generateCaptcha();
      setCaptchaInput("");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/login/`,
        {
          username: username.trim(),   // ✅ INCLUDED (optional)
          user_id: uid,                // ✅ PRIMARY AUTH FIELD
          password: pwd,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        }
      );

      const token = res.data?.token;
      if (!token) throw new Error("Token not received");

      localStorage.setItem("token", token);
      localStorage.setItem("username", res.data.user.name);

      onLogin(res.data.user.name);
      window.dispatchEvent(new Event("auth-token-changed"));

      alert("Login successful");
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      alert(
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Invalid ID or password"
      );
      generateCaptcha();
      setCaptchaInput("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <img
          src="https://upload.wikimedia.org/wikipedia/en/e/e9/Banasthali_Vidyapeeth_Logo.png"
          alt="Banasthali Vidyapith"
        />
        <h1>BANASTHALI VIDYAPITH</h1>
      </header>

      <div className="login-box">
        <h2>Login</h2>

        <form onSubmit={handleSubmit}>
          {/* ✅ USERNAME */}
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter Username"
          />

          {/* ✅ USER ID */}
          <label>ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter ID"
          />

          {/* ✅ PASSWORD */}
          <label>Password</label>
          <div className="password-container">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>

          {/* CAPTCHA */}
          <label>Captcha</label>
          <div className="captcha-box">
            <span>{captcha}</span>
            <button type="button" onClick={generateCaptcha}>🔄</button>
          </div>

          <input
            placeholder="Enter Captcha"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>

          <div className="login-links">
            <button type="button" onClick={onOpenForgot}>
              Forgot Password?
            </button>
            <button type="button" onClick={onOpenRegister}>
              Create Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
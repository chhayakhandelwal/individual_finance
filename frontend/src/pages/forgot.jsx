import React, { useState } from "react";
import "./forgot.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";

/**
 * Props expected from parent:
 * - onDone: call this when password reset is successful (go back to Login)
 * - onBackToLogin: optional "Back to Login" button
 */
const Forgot = ({ onDone, onBackToLogin }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorText, setErrorText] = useState("");

  const togglePassword = (type) => {
    if (type === "password") setShowPassword((s) => !s);
    else setShowConfirmPassword((s) => !s);
  };

  const validatePassword = () => {
    if (password.trim().length < 8) {
      setErrorText("Password must be at least 8 characters long!");
      return;
    }
    if (password !== confirmPassword) {
      setErrorText("Passwords do not match!");
      return;
    }

    setErrorText("");

    // ✅ Instead of window.location.href, tell parent to go back to Login
    onDone?.();
  };

  return (
    <div className="forgot-page">
      {/* Header */}
      <header className="header">
        <img
          src="https://upload.wikimedia.org/wikipedia/en/e/e9/Banasthali_Vidyapeeth_Logo.png"
          alt="Banasthali Logo"
        />
        <h1>BANASTHALI VIDYAPITH</h1>
      </header>

      {/* Form */}
      <main className="form-area">
        <h2>Forgot Password</h2>

        <div className="password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            placeholder="Re-enter Password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span
            className="eye-icon"
            id="togglePassword"
            onClick={() => togglePassword("password")}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div className="password-wrapper">
          <input
            type={showConfirmPassword ? "text" : "password"}
            id="confirmPassword"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <span
            className="eye-icon"
            id="toggleConfirmPassword"
            onClick={() => togglePassword("confirm")}
          >
            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <p className="error" id="errorText" style={{ display: errorText ? "block" : "none" }}>
          {errorText}
        </p>

        <div className="remember">
          <input type="checkbox" id="rememberMe" />
          <label htmlFor="rememberMe">Remember Me</label>
        </div>

        <button type="button" onClick={validatePassword}>
          Submit
        </button>

        {/* ✅ Optional Back button */}
        <button
          type="button"
          className="back-to-login"
          onClick={() => onBackToLogin?.()}
          style={{ marginTop: 10 }}
        >
          Back to Login
        </button>
      </main>
    </div>
  );
};

export default Forgot;
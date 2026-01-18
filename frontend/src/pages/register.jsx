 import React, { useState } from "react";
import "./register.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import axios from "axios";

const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const Register = ({ onRegistered, onBackToLogin }) => {
  const [formData, setFormData] = useState({
    username: "",
    id: "",
    phone: "",
    firstName: "",
    lastName: "",
    email: "",
    gender: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({ password: "", confirmPassword: "" });
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const togglePassword = (type) => {
    type === "password"
      ? setShowPassword((s) => !s)
      : setShowConfirmPassword((s) => !s);
  };

  const validate = () => {
    let tempErrors = { password: "", confirmPassword: "" };
    let isValid = true;

    if (formData.password.length < 8) {
      tempErrors.password = "Password must be at least 8 characters long.";
      isValid = false;
    }

    if (formData.password !== formData.confirmPassword) {
      tempErrors.confirmPassword = "Passwords do not match.";
      isValid = false;
    }

    setErrors(tempErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      // ✅ Backend expects ONLY these fields
      const payload = {
        username: formData.username.trim(),
        user_id: formData.id.trim(),
        password: formData.password,
      };

      await axios.post(`${API_BASE_URL}/api/register/`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });

      setSuccessMessage("Registration Successful! Redirecting to Login...");
      setTimeout(() => onRegistered?.(), 800);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Registration failed";

      console.error("REGISTER ERROR:", err);
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
  <div className="register-page">
    <header className="register-header">
      <img src="logo.png" alt="Banasthali Vidyapith Logo" />
      <h1>BANASTHALI VIDYAPITH</h1>
    </header>

    <div className="register-card">
      <div className="register-card-head">
        <h2 className="register-title">Create Account</h2>
        <p className="register-subtitle">
          Fill the details below to register. You can login immediately after registration.
        </p>
      </div>

      <div className="register-body">
        <form onSubmit={handleSubmit}>
          <div className="register-grid">
            <div className="field">
              <label>Username</label>
              <input
                className="input"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="e.g. testuser"
              />
            </div>

            <div className="field">
              <label>ID</label>
              <input
                className="input"
                type="text"
                name="id"
                value={formData.id}
                onChange={handleChange}
                required
                placeholder="e.g. BVU123"
              />
            </div>

            <div className="field">
              <label>Phone Number</label>
              <input
                className="input"
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="10-digit number"
              />
            </div>

            <div className="field">
              <label>Email</label>
              <input
                className="input"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="field">
              <label>First Name</label>
              <input
                className="input"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="First name"
              />
            </div>

            <div className="field">
              <label>Last Name</label>
              <input
                className="input"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Last name"
              />
            </div>

            <div className="field full">
              <label>Gender</label>
              <div className="gender-row">
                {["Male", "Female", "Other"].map((g) => (
                  <label key={g}>
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={formData.gender === g}
                      onChange={handleChange}
                      required
                    />
                    {g}
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Password</label>
              <div className="password-wrap">
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Minimum 8 characters"
                />
                <span className="eye-btn" onClick={() => togglePassword("password")}>
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
              {errors.password && <div className="helper-error">{errors.password}</div>}
            </div>

            <div className="field">
              <label>Confirm Password</label>
              <div className="password-wrap">
                <input
                  className="input"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Re-enter password"
                />
                <span className="eye-btn" onClick={() => togglePassword("confirm")}>
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </span>
              </div>
              {errors.confirmPassword && (
                <div className="helper-error">{errors.confirmPassword}</div>
              )}
            </div>
          </div>

          <div className="actions">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Registering..." : "Register"}
            </button>

            <button type="button" className="btn-secondary" onClick={() => onBackToLogin?.()}>
              Back to Login
            </button>
          </div>

          {successMessage && <div className="success">{successMessage}</div>}
        </form>
      </div>
    </div>
  </div>
);
};

export default Register;
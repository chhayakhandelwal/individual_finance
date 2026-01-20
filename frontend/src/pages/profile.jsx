import React, { useEffect, useState } from "react";
import axios from "axios";
import "./profile.css";

const TOKEN_KEYS = ["token", "accessToken", "authToken", "jwt"];
const readToken = () => {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
};

const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function Profile() {
  const token = readToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // ✅ Move this INSIDE component
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [user, setUser] = useState(null);
  const [draft, setDraft] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
  });

  // ✅ Change password states
  const [pw, setPw] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwOk, setPwOk] = useState("");

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const fetchProfile = async () => {
    if (!token) {
      setError("User not logged in");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`${API_BASE_URL}/api/profile/`, {
        headers: authHeaders,
        timeout: 15000,
      });

      setUser(res.data);
      setDraft({
        username: res.data.username || "",
        first_name: res.data.first_name || "",
        last_name: res.data.last_name || "",
        email: res.data.email || "",
      });
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.detail ||
          "Failed to load profile"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = async () => {
    if (!token) return;

    setSaving(true);
    setError("");
    setOk("");

    try {
      const res = await axios.patch(
        `${API_BASE_URL}/api/profile/`,
        {
          username: draft.username,
          first_name: draft.first_name,
          last_name: draft.last_name,
          email: draft.email,
        },
        { headers: authHeaders, timeout: 15000 }
      );

      setUser(res.data);
      localStorage.setItem("username", res.data.username || "");
      setEditing(false);
      setOk("Profile updated successfully");
    } catch (e) {
      const data = e?.response?.data;
      const msg =
        data?.message ||
        data?.detail ||
        (data ? JSON.stringify(data) : "Failed to update profile");
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ✅ Change password handler
  const changePassword = async () => {
    if (!token) return;

    setPwError("");
    setPwOk("");

    if (!pw.old_password || !pw.new_password || !pw.confirm_password) {
      setPwError("All password fields are required.");
      return;
    }
    if (pw.new_password !== pw.confirm_password) {
      setPwError("New password and confirm password do not match.");
      return;
    }

    setPwSaving(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/change-password/`,
        {
          old_password: pw.old_password,
          new_password: pw.new_password,
          confirm_password: pw.confirm_password,
        },
        { headers: authHeaders, timeout: 15000 }
      );

      setPwOk(res.data?.message || "Password changed successfully");
      setPw({ old_password: "", new_password: "", confirm_password: "" });

      // ✅ optional: close section after success
      setShowChangePassword(false);
    } catch (e) {
      const data = e?.response?.data;
      const msg =
        data?.message ||
        data?.detail ||
        (data ? JSON.stringify(data) : "Failed to change password");
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="profile-container">Loading profile…</div>;
  if (error && !user) return <div className="profile-container error">{error}</div>;

  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "-";

  return (
    <div className="profile-container">
      <h2>My Profile</h2>

      {error && <div className="profile-alert error">{error}</div>}
      {ok && <div className="profile-alert ok">{ok}</div>}

      {/* =======================
          Profile Details / Edit
         ======================= */}
      <div className="profile-card">
        <p>
          <strong>Member Since:</strong> {user?.joined || "-"}
        </p>

        {!editing ? (
          <>
            <p><strong>Username:</strong> {user?.username || "-"}</p>
            <p><strong>First Name:</strong> {user?.first_name || "-"}</p>
            <p><strong>Last Name:</strong> {user?.last_name || "-"}</p>
            <p><strong>Full Name:</strong> {fullName}</p>
            <p><strong>Email:</strong> {user?.email || "-"}</p>
          </>
        ) : (
          <>
            <div className="profile-field">
              <label>Username</label>
              <input
                value={draft.username}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, username: e.target.value }))
                }
                placeholder="Username"
              />
            </div>

            <div className="profile-field">
              <label>First Name</label>
              <input
                value={draft.first_name}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, first_name: e.target.value }))
                }
                placeholder="First name"
              />
            </div>

            <div className="profile-field">
              <label>Last Name</label>
              <input
                value={draft.last_name}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, last_name: e.target.value }))
                }
                placeholder="Last name"
              />
            </div>

            <div className="profile-field">
              <label>Email</label>
              <input
                value={draft.email}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="you@example.com"
              />
            </div>
          </>
        )}
      </div>

      <div className="profile-actions">
        {!editing ? (
          <button
            onClick={() => {
              setEditing(true);
              setOk("");
              setError("");
            }}
          >
            Edit Profile
          </button>
        ) : (
          <>
            <button onClick={saveProfile} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDraft({
                  username: user.username || "",
                  first_name: user.first_name || "",
                  last_name: user.last_name || "",
                  email: user.email || "",
                });
                setError("");
                setOk("");
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {/* =======================
          Change Password Toggle
         ======================= */}
      <div className="profile-actions" style={{ marginTop: 14 }}>
        <button
          className="btn-secondary"
          onClick={() => {
            setShowChangePassword((v) => !v);
            setPwError("");
            setPwOk("");
          }}
        >
          {showChangePassword ? "Close Change Password" : "Change Password"}
        </button>
      </div>

      {/* ✅ Only open when clicked */}
      {showChangePassword && (
        <div className="profile-card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Change Password</h3>

          {pwError && <div className="profile-alert error">{pwError}</div>}
          {pwOk && <div className="profile-alert ok">{pwOk}</div>}

          <div className="profile-field">
            <label>Old Password</label>
            <input
              type="password"
              value={pw.old_password}
              onChange={(e) =>
                setPw((p) => ({ ...p, old_password: e.target.value }))
              }
              placeholder="Enter old password"
            />
          </div>

          <div className="profile-field">
            <label>New Password</label>
            <input
              type="password"
              value={pw.new_password}
              onChange={(e) =>
                setPw((p) => ({ ...p, new_password: e.target.value }))
              }
              placeholder="Enter new password"
            />
          </div>

          <div className="profile-field">
            <label>Confirm New Password</label>
            <input
              type="password"
              value={pw.confirm_password}
              onChange={(e) =>
                setPw((p) => ({ ...p, confirm_password: e.target.value }))
              }
              placeholder="Confirm new password"
            />
          </div>

          <div className="profile-actions">
            <button onClick={changePassword} disabled={pwSaving}>
              {pwSaving ? "Changing..." : "Update Password"}
            </button>

            <button
              className="btn-secondary"
              onClick={() => {
                setShowChangePassword(false);
                setPw({ old_password: "", new_password: "", confirm_password: "" });
                setPwError("");
                setPwOk("");
              }}
              disabled={pwSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useEffect, useState } from "react";
import axios from "axios";
import "./profile.css";

/* ---------- TOKEN UTILS ---------- */
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
  const [user, setUser] = useState(null);
  const [draft, setDraft] = useState({ username: "", email: "" });
  const [editing, setEditing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const token = readToken();

  const fetchProfile = async () => {
    if (!token) {
      setError("User not logged in");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`${API_BASE_URL}/api/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUser(res.data);
      setDraft({
        username: res.data.username || "",
        email: res.data.email || "",
      });
    } catch (e) {
      setError("Failed to load profile");
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
        { username: draft.username, email: draft.email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUser(res.data);
      setEditing(false);
      setOk("Profile updated successfully");
    } catch (e) {
      const msg =
        e?.response?.data
          ? JSON.stringify(e.response.data)
          : "Failed to update profile";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="profile-container">Loading profile…</div>;
  if (error && !user) return <div className="profile-container error">{error}</div>;

  return (
    <div className="profile-container">
      <h2>My Profile</h2>

      {error && <div className="profile-alert error">{error}</div>}
      {ok && <div className="profile-alert ok">{ok}</div>}

      <div className="profile-card">
        <p><strong>User ID:</strong> {user?.user_id || "-"}</p>
        <p><strong>Member Since:</strong> {user?.joined || "-"}</p>

        {!editing ? (
          <>
            <p><strong>Name:</strong> {user?.username || "-"}</p>
            <p><strong>Email:</strong> {user?.email || "-"}</p>
          </>
        ) : (
          <>
            <div className="profile-field">
              <label>Name</label>
              <input
                value={draft.username}
                onChange={(e) => setDraft((p) => ({ ...p, username: e.target.value }))}
                placeholder="Your name"
              />
            </div>

            <div className="profile-field">
              <label>Email</label>
              <input
                value={draft.email}
                onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>
          </>
        )}
      </div>

      <div className="profile-actions">
        {!editing ? (
          <button onClick={() => { setEditing(true); setOk(""); setError(""); }}>
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
                setDraft({ username: user.username || "", email: user.email || "" });
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
    </div>
  );
}
import React from "react";
import "./profile.css";

export default function Profile() {
  const user = {
    name: "Niharika",
    email: "niharika@example.com",
    joined: "January 2023",
    phone: "+91 9876543210"
  };

  return (
    <div className="profile-container">
      <h2>My Profile</h2>

      <div className="profile-card">
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Phone:</strong> {user.phone}</p>
        <p><strong>Member Since:</strong> {user.joined}</p>
      </div>

      <div className="profile-actions">
        <button>Edit Profile</button>
        <button>Change Password</button>
      </div>
    </div>
  );
}
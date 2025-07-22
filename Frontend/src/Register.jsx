import { useState } from "react";
import "./Register.css";
import { Link, useNavigate } from "react-router-dom";
import defaultAvatar from "./Assets/default-avatar.png";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [preview, setPreview] = useState(defaultAvatar);
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const formData = new FormData();
    formData.append("full_name", name); // match Flask key
    formData.append("email", email);
    formData.append("password", password);
    formData.append("confirm_password", confirmPassword); // ✅ add this
    if (profileImage) {
      formData.append("profile_pic", profileImage); // match Flask key
    }

    try {
      const response = await fetch("http://localhost:5000/registration_api", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        alert("Registration successful!");
        navigate("/login");
      } else {
        alert(data.error || "Registration failed");
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  return (
    <div className="register-page">
      <div className="form-container">
        <h2>Create an Account</h2>

        <div className="avatar-upload">
          <label htmlFor="avatarInput">
            <div className="avatar-wrapper">
              <img src={preview} alt="avatar" className="avatar" />
              <div className="camera-icon">📷</div>
            </div>
          </label>
          <input
            type="file"
            id="avatarInput"
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              id="name"
              required
              placeholder=" "
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="name">Full Name</label>
          </div>

          <div className="input-group">
            <input
              type="email"
              id="email"
              required
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="email">Email Address</label>
          </div>

          <div className="input-group">
            <input
              type="password"
              id="password"
              required
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="password">Password</label>
          </div>

          <div className="input-group">
            <input
              type="password"
              id="confirmPassword"
              required
              placeholder=" "
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <label htmlFor="confirmPassword">Confirm Password</label>
          </div>

          <button type="submit">Register</button>
        </form>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

import "./Login3dcss.css";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Login3d() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
  try {
    const response = await fetch("https://samachar-chat-app-uo4y.onrender.com/login_api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Login successful!");

      // Store user data in localStorage
      localStorage.setItem("user", JSON.stringify(data));

      // Redirect to homepage
      navigate("/Homepage");
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    alert("Error: " + err.message);
  }
};


  return (
    <div className="split-screen">
      {/* Left: Login Form */}
      <div className="login-section">
        <div className="login-card">
          <h2>Samachar</h2>
          <input
            type="email"
            className="input-field"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            className="input-field"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="submit-button" onClick={handleLogin}>Login</button>
          <p className="register-text">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </div>
      </div>

      {/* Right: 3D Cube */}
      <div className="model-section">
        <div className="cube-wrapper">
          <div className="cube">
            <div className="face front">🔒</div>
            <div className="face back">🔮</div>
            <div className="face right">⚙️</div>
            <div className="face left">📂</div>
            <div className="face top">📡</div>
            <div className="face bottom">💾</div>
          </div>
        </div>
      </div>
    </div>
  );
}

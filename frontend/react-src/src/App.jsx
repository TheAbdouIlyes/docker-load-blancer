import { useState, useEffect } from "react";
import "./App.css";

const API = "/api";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [uid, setUid] = useState(null);
  const [choice, setChoice] = useState("");
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ 
    api: "unknown", 
    backend: "unknown",
    server: "Unknown",
    database: "Unknown"
  });

  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  const checkSystemStatus = async () => {
    try {
      // Add cache-busting to prevent stale responses
      const res = await fetch(`${API}/health?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSystemStatus({ 
          api: "online", 
          backend: "connected",
          server: data.server || "Unknown",
          database: data.database || "Unknown",
          db1Available: data.db1Available,
          db2Available: data.db2Available
        });
      } else {
        setSystemStatus({ api: "error", backend: "disconnected", server: "Unknown", database: "Unknown" });
      }
    } catch (error) {
      setSystemStatus({ api: "offline", backend: "error", server: "Unknown", database: "Unknown" });
    }
  };

  async function register() {
    if (!username || !password) {
      showMessage("Please enter username and password", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update system status with server/db info
        if (data.server) setSystemStatus(prev => ({ ...prev, server: data.server, database: data.database }));
        showMessage(`Registration successful! (${data.server || 'Server'} → ${data.database || 'DB'})`, "success");
        setUsername("");
        setPassword("");
        checkSystemStatus(); // Refresh status
      } else {
        showMessage(data.error || "Registration failed", "error");
      }
    } catch (error) {
      showMessage("Network error: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    if (!username || !password) {
      showMessage("Please enter username and password", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.id) {
        setUid(data.id);
        // Update system status with server/db info
        if (data.server) setSystemStatus(prev => ({ ...prev, server: data.server, database: data.database }));
        showMessage(`Welcome! Logged in as User ID: ${data.id} (${data.server || 'Server'} → ${data.database || 'DB'})`, "success");
        loadResults();
        checkSystemStatus(); // Refresh status
      } else {
        showMessage(data.error || "Login failed. Check your credentials.", "error");
      }
    } catch (error) {
      showMessage("Network error: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function submitVote() {
    if (!uid) {
      showMessage("Please login first", "error");
      return;
    }
    if (!choice) {
      showMessage("Please select an option", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, choice }),
      });
      const data = await res.json();
      if (res.status === 200) {
        // Update system status with server/db info
        if (data.server) setSystemStatus(prev => ({ ...prev, server: data.server, database: data.database }));
        showMessage(`Vote recorded! (${data.server || 'Server'} → ${data.database || 'DB'})`, "success");
        setChoice("");
        loadResults();
        checkSystemStatus(); // Refresh status
      } else if (res.status === 409) {
        showMessage("You have already voted!", "warning");
      } else {
        showMessage(data.error || "Vote failed", "error");
      }
    } catch (error) {
      showMessage("Network error: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadResults() {
    try {
      const res = await fetch(`${API}/results?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
      const data = await res.json();
      setResults(data.results || []);
      // Update system status with server/db info
      if (data.server) setSystemStatus(prev => ({ ...prev, server: data.server, database: data.database }));
    } catch (error) {
      showMessage("Failed to load results", "error");
    }
  }

  function logout() {
    setUid(null);
    setChoice("");
    setUsername("");
    setPassword("");
    showMessage("Logged out successfully", "info");
  }

  useEffect(() => {
    loadResults();
    checkSystemStatus();
    const interval = setInterval(() => {
      loadResults();
      checkSystemStatus();
    }, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const totalVotes = results.reduce((sum, r) => sum + parseInt(r.cnt), 0);

  return (
    <div className="app-container">
      <div className="header">
        <h1>🗳️ Distributed Voting System</h1>
        <div className="system-status">
          <div className={`status-indicator ${systemStatus.api === "online" ? "online" : "offline"}`}>
            <span className="status-dot"></span>
            API: {systemStatus.api}
          </div>
          <div className={`status-indicator ${systemStatus.backend === "connected" ? "online" : "offline"}`}>
            <span className="status-dot"></span>
            Backend: {systemStatus.backend}
          </div>
          <div className={`status-indicator server-indicator ${systemStatus.server !== "Unknown" ? "online" : "offline"}`}>
            <span className="status-dot"></span>
            <strong>{systemStatus.server}</strong>
          </div>
          <div className={`status-indicator db-indicator ${systemStatus.database !== "Unknown" ? (systemStatus.database === "db1" ? "db1" : "db2") : "offline"}`}>
            <span className="status-dot"></span>
            <strong>DB: {systemStatus.database.toUpperCase()}</strong>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
          <button className="message-close" onClick={() => setMessage({ text: "", type: "" })}>×</button>
        </div>
      )}

      <div className="main-content">
        {!uid ? (
          <div className="auth-section">
            <div className="card">
              <h2>Login / Register</h2>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && login()}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && login()}
                  disabled={loading}
                />
              </div>
              <div className="button-group">
                <button 
                  className="btn btn-primary" 
                  onClick={login} 
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Login"}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={register}
                  disabled={loading}
                >
                  Register
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="voting-section">
            <div className="card">
              <div className="user-info">
                <div className="user-badge">
                  👤 User ID: <strong>{uid}</strong>
                </div>
                <button className="btn btn-outline" onClick={logout}>
                  Logout
                </button>
              </div>

              <div className="voting-options">
                <h3>Select Your Choice</h3>
                <div className="radio-group">
                  <label className={`radio-option ${choice === "Option A" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="choice"
                      value="Option A"
                      checked={choice === "Option A"}
                      onChange={(e) => setChoice(e.target.value)}
                    />
                    <span className="radio-label">Option A</span>
                  </label>
                  <label className={`radio-option ${choice === "Option B" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="choice"
                      value="Option B"
                      checked={choice === "Option B"}
                      onChange={(e) => setChoice(e.target.value)}
                    />
                    <span className="radio-label">Option B</span>
                  </label>
                </div>
                <button 
                  className="btn btn-primary btn-large" 
                  onClick={submitVote}
                  disabled={loading || !choice}
                >
                  {loading ? "Submitting..." : "Submit Vote"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="results-section">
          <div className="card">
            <div className="results-header">
              <h2>📊 Voting Results</h2>
              <button className="btn btn-icon" onClick={loadResults} title="Refresh">
                🔄
              </button>
            </div>
            {results.length === 0 ? (
              <div className="no-results">No votes yet. Be the first to vote!</div>
            ) : (
              <>
                <div className="results-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Votes</span>
                    <span className="stat-value">{totalVotes}</span>
                  </div>
                </div>
                <div className="results-list">
                  {results.map((r) => {
                    const percentage = totalVotes > 0 ? ((r.cnt / totalVotes) * 100).toFixed(1) : 0;
                    return (
                      <div key={r.choice} className="result-item">
                        <div className="result-header">
                          <span className="result-choice">{r.choice}</span>
                          <span className="result-count">{r.cnt} votes ({percentage}%)</span>
                        </div>
                        <div className="result-bar-container">
                          <div 
                            className="result-bar" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="footer">
        <p>Distributed System Test - Load Balanced Backends with Master-Master Database Replication</p>
      </div>
    </div>
  );
}

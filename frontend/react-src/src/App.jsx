import { useState, useEffect } from "react";
import "./App.css";
import AdminDashboard from "./AdminDashboard";

const API = "/api";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [uid, setUid] = useState(null);
  const [choice, setChoice] = useState("");
  const [results, setResults] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminId, setAdminId] = useState(null);
  const [currentPage, setCurrentPage] = useState("login"); // "login", "register", "admin"
  const [hasVoted, setHasVoted] = useState(false);
  const [votedFor, setVotedFor] = useState("");
  const [systemStatus, setSystemStatus] = useState({ 
    api: "unknown", 
    backend: "unknown",
    server: "Unknown",
    database: "Unknown"
  });
  const [backupStatus, setBackupStatus] = useState(null);

  const navigateTo = (page) => {
    setCurrentPage(page);
    setUsername("");
    setPassword("");
    setNationalId("");
    setMessage({ text: "", type: "" });
  };

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

  const checkBackupStatus = async () => {
    try {
      const res = await fetch(`/backup-status?t=${Date.now()}`, {
        cache: 'no-cache'
      });
      if (res.ok) {
        const data = await res.json();
        setBackupStatus(data);
      }
    } catch (error) {
      setBackupStatus(null);
    }
  };

  async function register() {
    if (!username || !password || !nationalId) {
      showMessage("Please enter username, password, and national ID", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, national_id: nationalId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update system status with server/db info
        if (data.server) setSystemStatus(prev => ({ ...prev, server: data.server, database: data.database }));
        showMessage(`Registration successful! (${data.server || 'Server'} → ${data.database || 'DB'})`, "success");
        setUsername("");
        setPassword("");
        setNationalId("");
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
      const endpoint = currentPage === "admin" ? "/admin/login" : "/login";
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      
      if (currentPage === "admin") {
        if (data.id) {
          setAdminId(data.id);
          setIsAdmin(true);
          if (data.server) setSystemStatus(prev => ({ ...prev, server: data.server, database: data.database }));
          showMessage(`Welcome Admin! (${data.server || 'Server'} → ${data.database || 'DB'})`, "success");
          setUsername("");
          setPassword("");
          checkSystemStatus();
        } else {
          showMessage(data.error || "Admin login failed", "error");
        }
      } else {
        if (data.id) {
          setUid(data.id);
          if (data.server) setSystemStatus(prev => ({ ...prev, server: data.server, database: data.database }));
          showMessage(`Welcome! Logged in as User ID: ${data.id} (${data.server || 'Server'} → ${data.database || 'DB'})`, "success");
          loadResults();
          checkSystemStatus();
          checkVoteStatus(data.id);
        } else {
          showMessage(data.error || "Login failed. Check your credentials.", "error");
        }
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
        setHasVoted(true);
        // Get the candidate name for display
        const votedCandidate = candidates.find(c => c.id === parseInt(choice));
        setVotedFor(votedCandidate ? votedCandidate.name : `Candidate ${choice}`);
        loadResults();
        checkSystemStatus(); // Refresh status
      } else if (res.status === 409) {
        showMessage("You have already voted!", "warning");
        setHasVoted(true);
      } else {
        showMessage(data.error || "Vote failed", "error");
      }
    } catch (error) {
      showMessage("Network error: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function checkVoteStatus(userId) {
    try {
      const res = await fetch(`${API}/check-vote/${userId}`, {
        cache: 'no-cache'
      });
      const data = await res.json();
      setHasVoted(data.hasVoted);
      if (data.hasVoted) {
        setVotedFor(data.votedFor);
      }
    } catch (error) {
      console.log("Failed to check vote status");
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

  async function loadCandidates() {
    try {
      const res = await fetch(`${API}/admin/candidates?t=${Date.now()}`, {
        cache: 'no-cache'
      });
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (error) {
      console.log("Failed to load candidates");
    }
  }

  function logout() {
    if (isAdmin) {
      setAdminId(null);
      setIsAdmin(false);
      setCurrentPage("login");
    } else {
      setUid(null);
      setChoice("");
      setHasVoted(false);
      setVotedFor("");
    }
    setUsername("");
    setPassword("");
    setNationalId("");
    showMessage("Logged out successfully", "info");
  }

  useEffect(() => {
    loadResults();
    loadCandidates();
    checkSystemStatus();
    checkBackupStatus();
    const interval = setInterval(() => {
      loadResults();
      loadCandidates();
      checkSystemStatus();
      checkBackupStatus();
    }, 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const totalVotes = results.reduce((sum, r) => sum + parseInt(r.cnt), 0);

  // Admin dashboard view
  if (isAdmin && adminId) {
    return <AdminDashboard adminId={adminId} systemStatus={systemStatus} onLogout={logout} />;
  }

  // User voting interface (after login)
  if (uid) {
    return (
      <div className="app-container">
        <div className="header">
          <h1>🗳️ Distributed Voting System</h1>
          <div className="system-status">
            <div className={`status-indicator ${systemStatus.api === "online" ? "online" : "offline"}`}>
              <span className="status-dot"></span>
              API: {systemStatus.api}
            </div>
            <div className={`status-indicator server-indicator ${systemStatus.server !== "Unknown" ? "online" : "offline"}`}>
              <span className="status-dot"></span>
              <strong>{systemStatus.server}</strong>
            </div>
            <div className={`status-indicator db-indicator ${systemStatus.database !== "Unknown" ? (systemStatus.database === "db1" ? "db1" : "db2") : "offline"}`}>
              <span className="status-dot"></span>
              <strong>DB: {systemStatus.database.toUpperCase()}</strong>
            </div>
            {backupStatus && (
              <div className="status-indicator backup-indicator online" title={`Last backup: ${backupStatus.latestDb1?.file || 'none'}`}>
                <span className="status-dot"></span>
                <strong>💾 {backupStatus.totalFiles} backups</strong>
              </div>
            )}
          </div>
        </div>

        {message.text && (
          <div className={`message message-${message.type}`}>
            {message.text}
            <button className="message-close" onClick={() => setMessage({ text: "", type: "" })}>×</button>
          </div>
        )}

        <div className="voting-page">
          <div className="voting-content">
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
                {hasVoted ? (
                  <div className="vote-locked">
                    <div className="lock-icon">🔒</div>
                    <div className="lock-message">You have already voted!</div>
                    <div className="voted-for">Your vote: <strong>{votedFor}</strong></div>
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="no-candidates">No candidates available</div>
                ) : (
                  <div className="radio-group">
                    {candidates.map((candidate) => (
                      <label 
                        key={candidate.id} 
                        className={`radio-option ${choice === String(candidate.id) ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="choice"
                          value={String(candidate.id)}
                          checked={choice === String(candidate.id)}
                          onChange={(e) => setChoice(e.target.value)}
                        />
                        <span className="radio-label">{candidate.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {!hasVoted && (
                  <button 
                    className="btn btn-primary btn-large" 
                    onClick={submitVote}
                    disabled={loading || !choice}
                  >
                    {loading ? "Submitting..." : "Submit Vote"}
                  </button>
                )}
              </div>
            </div>

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
                      const candidate = candidates.find(c => c.id === r.choice);
                      const candidateName = candidate ? candidate.name : `Candidate ${r.choice}`;
                      const percentage = totalVotes > 0 ? ((r.cnt / totalVotes) * 100).toFixed(1) : 0;
                      return (
                        <div key={r.choice} className="result-item">
                          <div className="result-header">
                            <span className="result-choice">{candidateName}</span>
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
          <p>Distributed System - Load Balanced with Master-Master Replication</p>
        </div>
      </div>
    );
  }

  // ========== LOGIN PAGE ==========
  if (currentPage === "login") {
    return (
      <div className="page-container login-page">
        <div className="system-header">
          <h2>🗳️ Distributed Voting System</h2>
          <div className="system-status">
            <div className={`status-indicator ${systemStatus.api === "online" ? "online" : "offline"}`}>
              <span className="status-dot"></span>
              API: {systemStatus.api}
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
        <div className="page-card">
          <div className="page-icon">👤</div>
          <h1>User Login</h1>
          <p className="page-subtitle">Sign in to cast your vote</p>
          
          {message.text && (
            <div className={`message message-${message.type}`}>
              {message.text}
              <button className="message-close" onClick={() => setMessage({ text: "", type: "" })}>×</button>
            </div>
          )}

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter your username"
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
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && login()}
              disabled={loading}
            />
          </div>
          <button 
            className="btn btn-primary btn-full" 
            onClick={login} 
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <div className="page-links">
            <p>Don't have an account? <span onClick={() => navigateTo("register")}>Register</span></p>
            <p className="admin-link">Are you an admin? <span onClick={() => navigateTo("admin")}>Admin Login</span></p>
          </div>
        </div>
      </div>
    );
  }

  // ========== REGISTER PAGE ==========
  if (currentPage === "register") {
    return (
      <div className="page-container register-page">
        <div className="system-header">
          <h2>🗳️ Distributed Voting System</h2>
          <div className="system-status">
            <div className={`status-indicator ${systemStatus.api === "online" ? "online" : "offline"}`}>
              <span className="status-dot"></span>
              API: {systemStatus.api}
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
        <div className="page-card">
          <div className="page-icon">📝</div>
          <h1>Create Account</h1>
          <p className="page-subtitle">Register to participate in voting</p>
          
          {message.text && (
            <div className={`message message-${message.type}`}>
              {message.text}
              <button className="message-close" onClick={() => setMessage({ text: "", type: "" })}>×</button>
            </div>
          )}

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>National ID Card Number</label>
            <input
              type="text"
              placeholder="Enter your national ID"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && register()}
              disabled={loading}
            />
          </div>
          <button 
            className="btn btn-primary btn-full" 
            onClick={register} 
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>

          <div className="page-links">
            <p>Already have an account? <span onClick={() => navigateTo("login")}>Login</span></p>
          </div>
        </div>
      </div>
    );
  }

  // ========== ADMIN LOGIN PAGE ==========
  if (currentPage === "admin") {
    return (
      <div className="page-container admin-page">
        <div className="system-header">
          <h2>🗳️ Distributed Voting System</h2>
          <div className="system-status">
            <div className={`status-indicator ${systemStatus.api === "online" ? "online" : "offline"}`}>
              <span className="status-dot"></span>
              API: {systemStatus.api}
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
        <div className="page-card admin-card">
          <div className="page-icon">🔐</div>
          <h1>Admin Login</h1>
          <p className="page-subtitle">Access the admin dashboard</p>
          
          {message.text && (
            <div className={`message message-${message.type}`}>
              {message.text}
              <button className="message-close" onClick={() => setMessage({ text: "", type: "" })}>×</button>
            </div>
          )}

          <div className="form-group">
            <label>Admin Username</label>
            <input
              type="text"
              placeholder="Enter admin username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && login()}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Admin Password</label>
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && login()}
              disabled={loading}
            />
          </div>
          <button 
            className="btn btn-admin btn-full" 
            onClick={login} 
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Admin Login"}
          </button>

          <div className="page-links">
            <p>Not an admin? <span onClick={() => navigateTo("login")}>Go to User Login</span></p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

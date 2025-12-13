import { useState, useEffect } from "react";
import "./AdminDashboard.css";

const API = "/api";

export default function AdminDashboard({ adminId, systemStatus, onLogout }) {
  const [candidates, setCandidates] = useState([]);
  const [statistics, setStatistics] = useState([]);
  const [voteDetails, setVoteDetails] = useState([]);
  const [newCandidateName, setNewCandidateName] = useState("");
  const [newCandidateDesc, setNewCandidateDesc] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const showMessage = (text, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  useEffect(() => {
    loadCandidates();
    loadStatistics();
    loadVoteDetails();
    const interval = setInterval(() => {
      loadStatistics();
      loadVoteDetails();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadCandidates = async () => {
    try {
      const res = await fetch(`${API}/admin/candidates?t=${Date.now()}`, {
        cache: 'no-cache'
      });
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (error) {
      showMessage("Failed to load candidates", "error");
    }
  };

  const loadStatistics = async () => {
    try {
      const res = await fetch(`${API}/admin/statistics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId })
      });
      const data = await res.json();
      setStatistics(data.statistics || []);
    } catch (error) {
      showMessage("Failed to load statistics", "error");
    }
  };

  const loadVoteDetails = async () => {
    try {
      const res = await fetch(`${API}/admin/vote-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId })
      });
      const data = await res.json();
      setVoteDetails(data.voteDetails || []);
    } catch (error) {
      showMessage("Failed to load vote details", "error");
    }
  };

  const addCandidate = async () => {
    if (!newCandidateName.trim()) {
      showMessage("Candidate name is required", "error");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_id: adminId,
          name: newCandidateName,
          description: newCandidateDesc
        })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Candidate added successfully!", "success");
        setNewCandidateName("");
        setNewCandidateDesc("");
        loadCandidates();
      } else {
        showMessage(data.error || "Failed to add candidate", "error");
      }
    } catch (error) {
      showMessage("Network error: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteCandidate = async (candidateId) => {
    if (!window.confirm("Are you sure you want to delete this candidate?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/candidates/${candidateId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Candidate deleted successfully!", "success");
        loadCandidates();
        loadStatistics();
      } else {
        showMessage(data.error || "Failed to delete candidate", "error");
      }
    } catch (error) {
      showMessage("Network error: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = statistics.reduce((sum, s) => sum + (s.vote_count || 0), 0);

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>👨‍💼 Admin Dashboard</h1>
        <div className="admin-controls">
          <div className="admin-info">
            <span className="admin-badge">Admin ID: {adminId}</span>
            <span className="server-info">Server: {systemStatus.server}</span>
            <span className="db-info">Database: {systemStatus.database}</span>
          </div>
          <button className="btn btn-outline" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
          <button className="message-close" onClick={() => setMessage({ text: "", type: "" })}>×</button>
        </div>
      )}

      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          📊 Dashboard
        </button>
        <button 
          className={`tab-button ${activeTab === "candidates" ? "active" : ""}`}
          onClick={() => setActiveTab("candidates")}
        >
          👥 Manage Candidates
        </button>
        <button 
          className={`tab-button ${activeTab === "votes" ? "active" : ""}`}
          onClick={() => setActiveTab("votes")}
        >
          🗳️ Vote Details
        </button>
      </div>

      {activeTab === "dashboard" && (
        <div className="tab-content">
          <div className="card">
            <h2>📈 Voting Statistics</h2>
            <div className="stats-overview">
              <div className="stat-box">
                <div className="stat-label">Total Votes</div>
                <div className="stat-number">{totalVotes}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Total Candidates</div>
                <div className="stat-number">{candidates.length}</div>
              </div>
            </div>

            {statistics.length === 0 ? (
              <div className="no-data">No voting data yet</div>
            ) : (
              <div className="statistics-container">
                {statistics.map((stat) => {
                  const percentage = totalVotes > 0 ? ((stat.vote_count / totalVotes) * 100).toFixed(1) : 0;
                  return (
                    <div key={stat.id} className="stat-item">
                      <div className="stat-info">
                        <h3>{stat.name}</h3>
                        <span className="vote-count">{stat.vote_count} votes ({percentage}%)</span>
                      </div>
                      <div className="stat-bar-container">
                        <div 
                          className="stat-bar" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "candidates" && (
        <div className="tab-content">
          <div className="card">
            <h2>👥 Manage Candidates</h2>
            
            <div className="add-candidate-form">
              <h3>Add New Candidate</h3>
              <div className="form-group">
                <label>Candidate Name</label>
                <input
                  type="text"
                  placeholder="Enter candidate name"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  placeholder="Enter candidate description"
                  value={newCandidateDesc}
                  onChange={(e) => setNewCandidateDesc(e.target.value)}
                  disabled={loading}
                  rows="3"
                ></textarea>
              </div>
              <button 
                className="btn btn-primary"
                onClick={addCandidate}
                disabled={loading}
              >
                {loading ? "Adding..." : "Add Candidate"}
              </button>
            </div>

            <div className="candidates-list">
              <h3>Current Candidates</h3>
              {candidates.length === 0 ? (
                <div className="no-data">No candidates yet</div>
              ) : (
                <div className="list">
                  {candidates.map((candidate) => (
                    <div key={candidate.id} className="candidate-item">
                      <div className="candidate-info">
                        <h4>{candidate.name}</h4>
                        {candidate.description && (
                          <p className="description">{candidate.description}</p>
                        )}
                        <small className="created-at">
                          Created: {new Date(candidate.created_at).toLocaleString()}
                        </small>
                      </div>
                      <button 
                        className="btn btn-danger"
                        onClick={() => deleteCandidate(candidate.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "votes" && (
        <div className="tab-content">
          <div className="card">
            <h2>🗳️ Vote Details</h2>
            <div className="vote-details-refresh">
              <button 
                className="btn btn-icon"
                onClick={loadVoteDetails}
                title="Refresh"
              >
                🔄
              </button>
            </div>

            {voteDetails.length === 0 ? (
              <div className="no-data">No votes recorded yet</div>
            ) : (
              <div className="vote-details-table">
                <table>
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Username</th>
                      <th>Candidate</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voteDetails.map((vote, index) => (
                      <tr key={index}>
                        <td>{vote.user_id}</td>
                        <td>{vote.username}</td>
                        <td>{vote.candidate_name}</td>
                        <td>{new Date(vote.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

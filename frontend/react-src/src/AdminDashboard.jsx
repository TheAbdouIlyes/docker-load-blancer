import { useState, useEffect } from "react";
import "./AdminDashboard.css";
import { Brand, Icon, Notice, ServiceStatus, ThemeToggle } from "./Ui";

const API = "/api";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "table" },
  { id: "candidates", label: "Manage Candidates", icon: "users" },
  { id: "votes", label: "Vote Details", icon: "ballot" },
];

export default function AdminDashboard({
  adminId,
  systemStatus,
  backupStatus,
  theme,
  onToggleTheme,
  onLogout,
}) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCandidates = async () => {
    try {
      const res = await fetch(`${API}/admin/candidates?t=${Date.now()}`, {
        cache: "no-cache",
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
        body: JSON.stringify({ admin_id: adminId }),
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
        body: JSON.stringify({ admin_id: adminId }),
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
          description: newCandidateDesc,
        }),
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
    if (!window.confirm("Are you sure you want to delete this candidate?"))
      return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/candidates/${candidateId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId }),
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

  const handleTabKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.id);
    document.getElementById(`${nextTab.id}-tab`)?.focus();
  };

  const totalVotes = statistics.reduce(
    (sum, s) => sum + (s.vote_count || 0),
    0
  );
  const dismissMessage = () => setMessage({ text: "", type: "" });

  return (
    <div
      className={`vs-app admin-app vs-app--theme-${theme} vs-app--accent-red`}
    >
      <header className="vs-topbar">
        <div className="vs-container vs-topbar__inner">
          <div className="admin-heading">
            <Brand />
            <div className="admin-heading__text">
              <p className="vs-eyebrow">Administration</p>
              <h1>Dashboard</h1>
            </div>
          </div>
          <div className="vs-topbar__actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <div className="admin-account">
              <span className="vs-badge vs-badge--muted">
                Admin ID <strong>{adminId}</strong>
              </span>
              <button
                type="button"
                className="vs-button vs-button--secondary"
                onClick={onLogout}
              >
                <Icon name="logout" />
                Log out
              </button>
            </div>
          </div>
        </div>
        <div className="vs-container vs-topbar__status">
          <ServiceStatus
            systemStatus={systemStatus}
            backupStatus={backupStatus}
            compact
          />
        </div>
      </header>

      <Notice message={message} onDismiss={dismissMessage} />

      <main className="admin-main">
        <nav className="admin-tabs" role="tablist" aria-label="Admin sections">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className="admin-tab"
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "dashboard" && (
          <section
            id="dashboard-panel"
            role="tabpanel"
            aria-labelledby="dashboard-tab"
            className="vs-surface admin-panel"
          >
            <div className="vs-surface__header">
              <div>
                <p className="vs-eyebrow">Overview</p>
                <h2>Voting statistics</h2>
              </div>
              <span className="vs-badge">{candidates.length} candidates</span>
            </div>

            <div className="stats-overview">
              <div className="admin-stat">
                <span className="admin-stat__label">Total votes</span>
                <span className="admin-stat__value">{totalVotes}</span>
              </div>
              <div className="admin-stat">
                <span className="admin-stat__label">Total candidates</span>
                <span className="admin-stat__value">{candidates.length}</span>
              </div>
            </div>

            {statistics.length === 0 ? (
              <div className="vs-empty">
                <h3>No voting data yet</h3>
                <p>Results will appear here once votes are recorded.</p>
              </div>
            ) : (
              <ul className="admin-stat-list">
                {statistics.map((stat) => {
                  const percentage =
                    totalVotes > 0
                      ? ((stat.vote_count / totalVotes) * 100).toFixed(1)
                      : 0;
                  return (
                    <li key={stat.id} className="admin-stat-row">
                      <div className="admin-stat-row__header">
                        <span className="admin-stat-row__name">{stat.name}</span>
                        <span className="admin-stat-row__count">
                          {stat.vote_count} votes ({percentage}%)
                        </span>
                      </div>
                      <div
                        className="vs-progress"
                        role="progressbar"
                        aria-label={`${stat.name}: ${stat.vote_count} votes, ${percentage}%`}
                        aria-valuemin={0}
                        aria-valuemax={totalVotes}
                        aria-valuenow={stat.vote_count || 0}
                      >
                        <div
                          className="vs-progress__fill"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {activeTab === "candidates" && (
          <section
            id="candidates-panel"
            role="tabpanel"
            aria-labelledby="candidates-tab"
            className="vs-surface admin-panel"
          >
            <div className="vs-surface__header">
              <div>
                <p className="vs-eyebrow">Ballot management</p>
                <h2>Manage candidates</h2>
              </div>
            </div>

            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                addCandidate();
              }}
            >
              <div className="vs-field">
                <label className="vs-field__label" htmlFor="new-candidate-name">
                  Candidate name
                </label>
                <input
                  id="new-candidate-name"
                  type="text"
                  placeholder="Enter candidate name"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="vs-field">
                <label
                  className="vs-field__label"
                  htmlFor="new-candidate-description"
                >
                  Description <span className="vs-field__optional">(optional)</span>
                </label>
                <textarea
                  id="new-candidate-description"
                  placeholder="Enter candidate description"
                  value={newCandidateDesc}
                  onChange={(e) => setNewCandidateDesc(e.target.value)}
                  disabled={loading}
                  rows="3"
                />
              </div>
              <div className="admin-form__actions">
                <button
                  type="submit"
                  className="vs-button vs-button--primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="vs-spinner" aria-hidden="true" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Icon name="plus" />
                      Add candidate
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="admin-candidates">
              <h3>Current candidates</h3>
              {candidates.length === 0 ? (
                <div className="vs-empty">
                  <h3>No candidates yet</h3>
                  <p>Add a candidate to start building the ballot.</p>
                </div>
              ) : (
                <ul className="admin-candidate-list">
                  {candidates.map((candidate) => (
                    <li key={candidate.id} className="admin-candidate">
                      <div className="admin-candidate__body">
                        <h4>{candidate.name}</h4>
                        {candidate.description && (
                          <p className="admin-candidate__description">
                            {candidate.description}
                          </p>
                        )}
                        <span className="admin-candidate__meta">
                          Created: {new Date(candidate.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="admin-candidate__footer">
                        <button
                          type="button"
                          className="vs-button vs-button--danger"
                          onClick={() => deleteCandidate(candidate.id)}
                          disabled={loading}
                          aria-label={`Delete ${candidate.name}`}
                        >
                          <Icon name="trash" />
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === "votes" && (
          <section
            id="votes-panel"
            role="tabpanel"
            aria-labelledby="votes-tab"
            className="vs-surface admin-panel"
          >
            <div className="vs-surface__header">
              <div>
                <p className="vs-eyebrow">Audit log</p>
                <h2>Vote details</h2>
              </div>
              <button
                type="button"
                className="vs-button vs-button--quiet vs-button--icon"
                onClick={loadVoteDetails}
                aria-label="Refresh vote details"
                title="Refresh vote details"
              >
                <Icon name="refresh" />
              </button>
            </div>

            {voteDetails.length === 0 ? (
              <div className="vs-empty">
                <h3>No votes recorded yet</h3>
                <p>Recorded ballots will appear in this table.</p>
              </div>
            ) : (
              <div className="vote-details__table-wrap">
                <table className="vote-details__table">
                  <caption className="vs-visually-hidden">
                    Recorded votes
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">User ID</th>
                      <th scope="col">Username</th>
                      <th scope="col">Candidate</th>
                      <th scope="col">Timestamp</th>
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
          </section>
        )}
      </main>
    </div>
  );
}

import { useState, useEffect } from "react";
import "./App.css";
import AdminDashboard from "./AdminDashboard";
import { Brand, Icon, Notice, ServiceStatus, ThemeToggle } from "./Ui";

const API = "/api";

function AuthShell({
  variant,
  eyebrow,
  title,
  subtitle,
  systemStatus,
  backupStatus,
  message,
  onDismissMessage,
  theme,
  onToggleTheme,
  children,
  footer,
}) {
  const accent = variant === "login" ? "blue" : variant === "register" ? "green" : "red";

  return (
    <div
      className={`vs-app auth-app auth-app--${variant} vs-app--theme-${theme} vs-app--accent-${accent}`}
    >
      <header className="vs-topbar">
        <div className="vs-container vs-topbar__inner">
          <Brand />
          <div className="vs-topbar__actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
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

      <main className="auth-main">
        <section className="vs-surface auth-card" aria-labelledby={`auth-${variant}-title`}>
          <div className="auth-card__header">
            <p
              className={`vs-eyebrow ${
                variant === "admin" ? "auth-eyebrow--admin" : ""
              }`}
            >
              {eyebrow}
            </p>
            <h1 id={`auth-${variant}-title`}>{title}</h1>
            <p className="auth-subtitle">{subtitle}</p>
          </div>

          <Notice message={message} onDismiss={onDismissMessage} />
          {children}
          <div className="auth-links">{footer}</div>
        </section>
      </main>

      <footer className="auth-footer">
        Distributed voting · Load balanced across replicated databases
      </footer>
    </div>
  );
}

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
    database: "Unknown",
  });
  const [backupStatus, setBackupStatus] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("voting-theme") === "dark" ? "dark" : "light";
    } catch (error) {
      // Storage may be unavailable; the light theme remains the default.
      return "light";
    }
  });

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("voting-theme", next);
      } catch (error) {
        // Theme still applies for this session if storage is unavailable.
      }
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.dataset.vsTheme = theme;
  }, [theme]);

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
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSystemStatus({
          api: "online",
          backend: "connected",
          server: data.server || "Unknown",
          database: data.database || "Unknown",
          db1Available: data.db1Available,
          db2Available: data.db2Available,
        });
      } else {
        setSystemStatus({
          api: "error",
          backend: "disconnected",
          server: "Unknown",
          database: "Unknown",
        });
      }
    } catch (error) {
      setSystemStatus({
        api: "offline",
        backend: "error",
        server: "Unknown",
        database: "Unknown",
      });
    }
  };

  const checkBackupStatus = async () => {
    try {
      const res = await fetch(`/backup-status?t=${Date.now()}`, {
        cache: "no-cache",
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
        if (data.server)
          setSystemStatus((prev) => ({
            ...prev,
            server: data.server,
            database: data.database,
          }));
        showMessage(
          `Registration successful! (${data.server || "Server"} → ${data.database || "DB"})`,
          "success"
        );
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
          if (data.server)
            setSystemStatus((prev) => ({
              ...prev,
              server: data.server,
              database: data.database,
            }));
          showMessage(
            `Welcome Admin! (${data.server || "Server"} → ${data.database || "DB"})`,
            "success"
          );
          setUsername("");
          setPassword("");
          checkSystemStatus();
        } else {
          showMessage(data.error || "Admin login failed", "error");
        }
      } else {
        if (data.id) {
          setUid(data.id);
          if (data.server)
            setSystemStatus((prev) => ({
              ...prev,
              server: data.server,
              database: data.database,
            }));
          showMessage(
            `Welcome! Logged in as User ID: ${data.id} (${data.server || "Server"} → ${data.database || "DB"})`,
            "success"
          );
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
        if (data.server)
          setSystemStatus((prev) => ({
            ...prev,
            server: data.server,
            database: data.database,
          }));
        showMessage(
          `Vote recorded! (${data.server || "Server"} → ${data.database || "DB"})`,
          "success"
        );
        setChoice("");
        setHasVoted(true);
        // Get the candidate name for display
        const votedCandidate = candidates.find(
          (c) => c.id === parseInt(choice)
        );
        setVotedFor(
          votedCandidate ? votedCandidate.name : `Candidate ${choice}`
        );
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
        cache: "no-cache",
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
        cache: "no-cache",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
      const data = await res.json();
      setResults(data.results || []);
      // Update system status with server/db info
      if (data.server)
        setSystemStatus((prev) => ({
          ...prev,
          server: data.server,
          database: data.database,
        }));
    } catch (error) {
      showMessage("Failed to load results", "error");
    }
  }

  async function loadCandidates() {
    try {
      const res = await fetch(`${API}/admin/candidates?t=${Date.now()}`, {
        cache: "no-cache",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalVotes = results.reduce((sum, r) => sum + parseInt(r.cnt), 0);
  const dismissMessage = () => setMessage({ text: "", type: "" });

  // Admin dashboard view
  if (isAdmin && adminId) {
    return (
      <AdminDashboard
        adminId={adminId}
        systemStatus={systemStatus}
        backupStatus={backupStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={logout}
      />
    );
  }

  // User voting interface (after login)
  if (uid) {
    return (
      <div
        className={`vs-app voting-app vs-app--theme-${theme} vs-app--accent-blue`}
      >
        <header className="vs-topbar">
          <div className="vs-container vs-topbar__inner">
            <Brand />
            <div className="vs-topbar__actions">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <div className="voting-account">
                <div className="voting-account__identity">
                  <span className="vs-eyebrow">Signed in as</span>
                  <span className="voting-account__id">
                    User ID <strong>{uid}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  className="vs-button vs-button--secondary"
                  onClick={logout}
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

        <main className="voting-main">
          <Notice message={message} onDismiss={dismissMessage} />

          <div className="voting-intro">
            <p className="vs-eyebrow">Voter portal</p>
            <h1>Cast your vote</h1>
            <p>Review the candidates, make one selection, and submit your ballot.</p>
          </div>

          <div className="voting-grid">
            <section className="vs-surface" aria-labelledby="ballot-heading">
              <div className="vs-surface__header">
                <div>
                  <p className="vs-eyebrow">Ballot</p>
                  <h2 id="ballot-heading">Select a candidate</h2>
                </div>
                <span className="vs-badge">One vote per account</span>
              </div>

              {hasVoted ? (
                <div className="voting-locked" role="status">
                  <span className="voting-locked__icon" aria-hidden="true">
                    <Icon name="lock" />
                  </span>
                  <div>
                    <h3>Vote recorded</h3>
                    <p>You have already voted.</p>
                    <p className="voting-locked__choice">
                      Your vote: <strong>{votedFor}</strong>
                    </p>
                  </div>
                </div>
              ) : candidates.length === 0 ? (
                <div className="vs-empty">
                  <h3>No candidates available</h3>
                  <p>Check back once an administrator has added candidates.</p>
                </div>
              ) : (
                <>
                  <fieldset className="voting-fieldset">
                    <legend className="vs-visually-hidden">Candidate options</legend>
                    <div className="voting-options">
                      {candidates.map((candidate) => (
                        <label
                          key={candidate.id}
                          className={`voting-option ${
                            choice === String(candidate.id) ? "is-selected" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="choice"
                            value={String(candidate.id)}
                            checked={choice === String(candidate.id)}
                            onChange={(e) => setChoice(e.target.value)}
                          />
                          <span className="voting-option__body">
                            <span className="voting-option__name">{candidate.name}</span>
                            {candidate.description && (
                              <span className="voting-option__description">
                                {candidate.description}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button
                    type="button"
                    className="vs-button vs-button--primary vs-button--wide voting-submit"
                    onClick={submitVote}
                    disabled={loading || !choice}
                  >
                    {loading ? (
                      <>
                        <span className="vs-spinner" aria-hidden="true" />
                        Submitting vote…
                      </>
                    ) : (
                      "Submit vote"
                    )}
                  </button>
                  <p className="voting-help">
                    Your choice is final once submitted.
                  </p>
                </>
              )}
            </section>

            <section className="vs-surface" aria-labelledby="results-heading">
              <div className="vs-surface__header">
                <div>
                  <p className="vs-eyebrow">Live tally</p>
                  <h2 id="results-heading">Voting results</h2>
                </div>
                <button
                  type="button"
                  className="vs-button vs-button--quiet vs-button--icon"
                  onClick={loadResults}
                  aria-label="Refresh results"
                  title="Refresh results"
                >
                  <Icon name="refresh" />
                </button>
              </div>

              {results.length === 0 ? (
                <div className="vs-empty">
                  <h3>No votes yet</h3>
                  <p>Be the first to vote.</p>
                </div>
              ) : (
                <>
                  <div className="vs-metric-strip">
                    <div className="vs-metric">
                      <span className="vs-metric__label">Total votes</span>
                      <span className="vs-metric__value">{totalVotes}</span>
                    </div>
                  </div>
                  <ul className="results-list">
                    {results.map((r) => {
                      const candidate = candidates.find(
                        (c) => c.id === r.choice
                      );
                      const candidateName = candidate
                        ? candidate.name
                        : `Candidate ${r.choice}`;
                      const percentage =
                        totalVotes > 0
                          ? ((r.cnt / totalVotes) * 100).toFixed(1)
                          : 0;
                      return (
                        <li key={r.choice} className="result-row">
                          <div className="result-row__header">
                            <span className="result-row__name">{candidateName}</span>
                            <span className="result-row__count">
                              {r.cnt} votes · {percentage}%
                            </span>
                          </div>
                          <div
                            className="vs-progress"
                            role="progressbar"
                            aria-label={`${candidateName}: ${r.cnt} votes, ${percentage}%`}
                            aria-valuemin={0}
                            aria-valuemax={totalVotes}
                            aria-valuenow={parseInt(r.cnt) || 0}
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
                </>
              )}
            </section>
          </div>
        </main>

        <footer className="voting-footer">
          Distributed System - Load Balanced with Master-Master Replication
        </footer>
      </div>
    );
  }

  // ========== LOGIN PAGE ==========
  if (currentPage === "login") {
    return (
      <AuthShell
        variant="login"
        eyebrow="Voter access"
        title="User login"
        subtitle="Sign in to cast your vote."
        systemStatus={systemStatus}
        backupStatus={backupStatus}
        message={message}
        onDismissMessage={dismissMessage}
        theme={theme}
        onToggleTheme={toggleTheme}
        footer={
          <>
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                className="vs-link"
                onClick={() => navigateTo("register")}
              >
                Create one
              </button>
            </p>
            <p>
              Are you an admin?{" "}
              <button
                type="button"
                className="vs-link"
                onClick={() => navigateTo("admin")}
              >
                Admin login
              </button>
            </p>
          </>
        }
      >
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <div className="vs-field">
            <label className="vs-field__label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="vs-field">
            <label className="vs-field__label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="vs-button vs-button--primary vs-button--wide"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="vs-spinner" aria-hidden="true" />
                Logging in…
              </>
            ) : (
              "Log in"
            )}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ========== REGISTER PAGE ==========
  if (currentPage === "register") {
    return (
      <AuthShell
        variant="register"
        eyebrow="New voter"
        title="Create your account"
        subtitle="Register to take part in the vote."
        systemStatus={systemStatus}
        backupStatus={backupStatus}
        message={message}
        onDismissMessage={dismissMessage}
        theme={theme}
        onToggleTheme={toggleTheme}
        footer={
          <p>
            Already have an account?{" "}
            <button
              type="button"
              className="vs-link"
              onClick={() => navigateTo("login")}
            >
              Back to login
            </button>
          </p>
        }
      >
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            register();
          }}
        >
          <div className="vs-field">
            <label className="vs-field__label" htmlFor="register-username">
              Username
            </label>
            <input
              id="register-username"
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="vs-field">
            <label className="vs-field__label" htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <div className="vs-field">
            <label className="vs-field__label" htmlFor="register-national-id">
              National ID card number
            </label>
            <input
              id="register-national-id"
              type="text"
              placeholder="Enter your national ID"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              disabled={loading}
            />
            <p className="vs-field__hint">
              Enter the number from your national ID card.
            </p>
          </div>
          <button
            type="submit"
            className="vs-button vs-button--primary vs-button--wide"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="vs-spinner" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>
      </AuthShell>
    );
  }

  // ========== ADMIN LOGIN PAGE ==========
  if (currentPage === "admin") {
    return (
      <AuthShell
        variant="admin"
        eyebrow="Administrator access"
        title="Admin login"
        subtitle="Use your administrator credentials to continue."
        systemStatus={systemStatus}
        backupStatus={backupStatus}
        message={message}
        onDismissMessage={dismissMessage}
        theme={theme}
        onToggleTheme={toggleTheme}
        footer={
          <p>
            Not an admin?{" "}
            <button
              type="button"
              className="vs-link"
              onClick={() => navigateTo("login")}
            >
              Go to user login
            </button>
          </p>
        }
      >
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <div className="vs-field">
            <label className="vs-field__label" htmlFor="admin-username">
              Admin username
            </label>
            <input
              id="admin-username"
              type="text"
              placeholder="Enter admin username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="vs-field">
            <label className="vs-field__label" htmlFor="admin-password">
              Admin password
            </label>
            <input
              id="admin-password"
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="vs-button vs-button--primary vs-button--wide"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="vs-spinner" aria-hidden="true" />
                Authenticating…
              </>
            ) : (
              "Admin login"
            )}
          </button>
        </form>
      </AuthShell>
    );
  }

  return null;
}

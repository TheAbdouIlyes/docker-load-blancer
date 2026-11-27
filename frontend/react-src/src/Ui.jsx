import { useId } from "react";

const iconPaths = {
  ballot: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8.5 12 2.25 2.25L15.5 9.5" />
      <path d="M8 20h8" />
    </>
  ),
  check: <path d="m5 13 4 4L19 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M15 16l4-4-4-4M19 12H9" />
    </>
  ),
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.34 5.66" />
      <path d="M20 5v6h-6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 11a3 3 0 1 0 0-6M17 19a5.5 5.5 0 0 0-1-3.16" />
    </>
  ),
};

export function Icon({ name, className = "" }) {
  return (
    <svg
      className={`vs-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  );
}

export function Brand() {
  return (
    <div className="vs-brand">
      <span className="vs-brand__mark" aria-hidden="true">
        <Icon name="ballot" />
      </span>
      <span className="vs-brand__text">
        <span className="vs-brand__name">Distributed Voting</span>
        <span className="vs-brand__context">Secure ballot system</span>
      </span>
    </div>
  );
}

export function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="vs-theme-toggle"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label="Dark mode"
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <Icon name={isDark ? "moon" : "sun"} />
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}

function formatValue(value) {
  if (value === undefined || value === null || value === "") return "Unknown";
  const text = String(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toneForApi(value) {
  if (value === "online") return "good";
  if (value === "unknown") return "neutral";
  return "alert";
}

function toneForBackend(value) {
  if (value === "connected") return "good";
  if (value === "unknown") return "neutral";
  return "alert";
}

export function Notice({ message, onDismiss }) {
  if (!message?.text) return null;

  const isUrgent = message.type === "error" || message.type === "warning";

  return (
    <div
      className={`vs-notice vs-notice--${message.type || "info"}`}
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
    >
      <span>{message.text}</span>
      <button
        type="button"
        className="vs-notice__close"
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        <Icon name="close" />
      </button>
    </div>
  );
}

export function ServiceStatus({ systemStatus, backupStatus, compact = false }) {
  const titleId = useId();
  const server = systemStatus?.server || "Unknown";
  const database = systemStatus?.database || "Unknown";
  const backupFile = backupStatus?.latestDb1?.file;
  const backupValue = backupStatus
    ? backupStatus.totalFiles != null
      ? `${backupStatus.totalFiles} backups`
      : "Available"
    : "Unavailable";

  const items = [
    {
      label: "API",
      value: formatValue(systemStatus?.api),
      tone: toneForApi(systemStatus?.api),
    },
    {
      label: "Backend",
      value: formatValue(systemStatus?.backend),
      tone: toneForBackend(systemStatus?.backend),
    },
    {
      label: "Server",
      value: server,
      tone: server === "Unknown" ? "neutral" : "good",
    },
    {
      label: "Database",
      value: database === "Unknown" ? "Unknown" : database.toUpperCase(),
      tone: database === "Unknown" ? "neutral" : "good",
    },
    {
      label: "Backup",
      value: backupValue,
      tone: backupStatus ? "info" : "neutral",
      title: backupFile ? `Last backup: ${backupFile}` : undefined,
    },
  ];

  return (
    <section
      className={`vs-service ${compact ? "vs-service--compact" : ""}`}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="vs-visually-hidden">
        Service status
      </h2>
      <dl className="vs-service__list">
        {items.map((item) => (
          <div
            className="vs-service__item"
            data-tone={item.tone}
            key={item.label}
            title={item.title}
          >
            <dt>{item.label}</dt>
            <dd>
              <span className="vs-service__dot" aria-hidden="true" />
              <span>{item.value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

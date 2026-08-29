export type Tab = "inbox" | "compose";

export default function Header({
  active,
  onNavigate,
  onSignOut,
}: {
  active: Tab;
  onNavigate: (tab: Tab) => void;
  onSignOut: () => void;
}) {
  return (
    <header className="app-header">
      <span className="app-header-title">U've Got Mail</span>
      <nav className="app-header-tabs">
        <button
          type="button"
          className={`app-header-tab ${active === "inbox" ? "active" : ""}`}
          onClick={() => onNavigate("inbox")}
        >
          Inbox
        </button>
        <button
          type="button"
          className={`app-header-tab ${active === "compose" ? "active" : ""}`}
          onClick={() => onNavigate("compose")}
        >
          Compose
        </button>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </nav>
    </header>
  );
}

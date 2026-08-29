export type Tab = "inbox" | "compose" | "requests";

export default function Header({
  active,
  onNavigate,
  onAddFriend,
  onSignOut,
}: {
  active: Tab;
  onNavigate: (tab: Tab) => void;
  onAddFriend: () => void;
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
        <button
          type="button"
          className={`app-header-tab ${active === "requests" ? "active" : ""}`}
          onClick={() => onNavigate("requests")}
        >
          Requests
        </button>
        {/* Not a tab — opens the add-a-friend modal over whatever page is
            currently showing. */}
        <button type="button" className="app-header-tab" onClick={onAddFriend}>
          Add
        </button>
        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </nav>
    </header>
  );
}

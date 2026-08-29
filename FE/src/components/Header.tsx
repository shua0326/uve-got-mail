import AddFriendDialog from "./AddFriendDialog";
import { Button } from "./pouf/Button";
import { Icon } from "./pouf/Icon";
import { Navbar, type NavbarLink } from "./pouf/navbar";

export type Tab = "inbox" | "compose" | "requests" | "profile";

const TABS: { tab: Tab; label: string }[] = [
  { tab: "inbox", label: "Inbox" },
  { tab: "compose", label: "Compose" },
  { tab: "requests", label: "Requests" },
  { tab: "profile", label: "Profile" },
];

export default function Header({
  active,
  onNavigate,
  onSignOut,
}: {
  active: Tab;
  onNavigate: (tab: Tab) => void;
  onSignOut: () => void;
}) {
  // Real anchors, not buttons: pouf's Navbar styles links, and an `href`
  // keeps the browser affordances (focus ring, middle-click, "link" to a
  // screen reader) that a <button> in a nav gives up. There is no router, so
  // each one cancels its own navigation and flips App.tsx's state instead —
  // see the LOCAL EDIT banner in pouf/navbar.tsx.
  const links: NavbarLink[] = TABS.map(({ tab, label }) => ({
    label,
    href: `#${tab}`,
    active: active === tab,
    onClick: (event) => {
      event.preventDefault();
      onNavigate(tab);
    },
  }));

  return (
    <Navbar
      brand={
        <>
          <Icon name="mail" size="md" />
          {/* The product signing its own name — the one place a real hand is
              unambiguously right, so it is the one place that gets one.
              Styled in index.css (`.wordmark`); the Navbar's brand slot takes
              a ReactNode, so this needs no change inside pouf. */}
          <span className="wordmark">uve got mail!</span>
        </>
      }
      links={links}
      actions={
        <>
          {/* Not a tab — a modal over whatever page is currently showing.
              The dialog renders its own trigger button here, so the control
              and the thing it controls stay in one file. */}
          <AddFriendDialog />
          <Button size="sm" variant="quiet" onClick={onSignOut}>
            Sign out
          </Button>
        </>
      }
    />
  );
}

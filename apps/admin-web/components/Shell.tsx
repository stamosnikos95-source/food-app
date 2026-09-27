"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, ReactNode, useState } from "react";
import { describeError } from "../lib/api";
import { NotStaffError, SessionProvider, useSession } from "../lib/session";

const NAV = [
  { href: "/", label: "Παραγγελίες" },
  { href: "/menu/", label: "Μενού" },
  { href: "/reports/", label: "Αναφορές" },
  { href: "/ingredients/", label: "Υλικά", adminOnly: true },
  { href: "/recipes/", label: "Συνταγές", adminOnly: true },
  { href: "/customers/", label: "Πελάτες", adminOnly: true },
  { href: "/companies/", label: "Εταιρείες", adminOnly: true },
];

function LoginScreen() {
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(
        e instanceof NotStaffError
          ? "Αυτός ο λογαριασμός δεν έχει πρόσβαση στη διαχείριση."
          : describeError(e, { 401: "Λάθος email ή κωδικός.", 400: "Συμπλήρωσε έγκυρο email και κωδικό." }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <div>
          <div className="eyebrow">FOOD APP · ΔΙΑΧΕΙΡΙΣΗ</div>
          <h1 style={{ marginTop: 6 }}>Σύνδεση</h1>
          <p className="sub">Για το προσωπικό και τη διαχείριση του καταστήματος.</p>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Κωδικός</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button className="btn btn-primary" disabled={busy}>{busy ? "Σύνδεση…" : "Σύνδεση"}</button>
      </form>
    </main>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { ready, identity, logout, isAdmin } = useSession();
  const pathname = usePathname();

  if (!ready) return <div className="center">Φόρτωση…</div>;
  if (!identity) return <LoginScreen />;

  return (
    <>
      <header className="topbar">
        <div className="brand">Food App<small>ΔΙΑΧΕΙΡΙΣΗ</small></div>
        <nav className="nav" aria-label="Κύρια πλοήγηση">
          {NAV.filter((item) => !("adminOnly" in item) || isAdmin).map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="who">
          <span>{identity.email} · {identity.role === "admin" ? "Διαχειριστής" : "Προσωπικό"}</span>
          <button className="btn btn-quiet" onClick={logout}>Αποσύνδεση</button>
        </div>
      </header>
      {children}
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Frame>{children}</Frame>
    </SessionProvider>
  );
}

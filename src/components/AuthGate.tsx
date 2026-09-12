import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { localPreview } from "../lib/runtime-mode";
import { djangoAuth, type DjangoAuthSession } from "../lib/django";
import { djangoStore } from "../lib/django-store";
import { localStore } from "../lib/local-store";
import type { RoomMember, RoomStore } from "../lib/model";
import { SetPassword } from "./SetPassword";

export interface Access {
  store: RoomStore;
  member: RoomMember;
  local: boolean;
  signOut?: () => Promise<void>;
}

export function AuthGate({
  children,
}: {
  children: (access: Access) => ReactNode;
}) {
  const [session, setSession] = useState<DjangoAuthSession | null>(null);
  const [member, setMember] = useState<RoomMember | null>(null);
  const [loading, setLoading] = useState(!localPreview);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("password_reset"),
  );
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const store = useMemo(
    () => (session?.authenticated ? djangoStore : localStore),
    [session?.authenticated],
  );

  useEffect(() => {
    if (localPreview) return;
    let active = true;
    const expired = () => {
      setSession(null);
      setMember(null);
    };
    window.addEventListener("django-auth-expired", expired);
    void djangoAuth
      .session()
      .then((result) => {
        if (!active) return;
        setSession(result.authenticated ? result : null);
        setMember((result.member as RoomMember | undefined) ?? null);
        if (result.authenticated && !result.member)
          setError("This account is not invited to the room.");
      })
      .catch(() => {
        if (active)
          setError("The private room could not be reached. Try again shortly.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("django-auth-expired", expired);
    };
  }, []);

  if (localPreview)
    return children({
      store: localStore,
      member: { user_id: "this-device", display_name: "", role: "owner" },
      local: true,
    });
  if (
    member &&
    session?.authenticated &&
    member.user_id === session.member?.user_id
  )
    return children({
      store,
      member,
      local: false,
      signOut: async () => {
        await djangoAuth.logout();
        setMember(null);
        setSession(null);
      },
    });

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError("");
    setBusy(true);
    try {
      const result = await djangoAuth.login(
        String(values.get("email")).trim(),
        String(values.get("password")),
      );
      setSession(result);
      setMember((result.member as RoomMember | undefined) ?? null);
      if (!result.member) {
        setSession(null);
        setError("That email and password did not open the room. Try again.");
      }
    } catch {
      setError("That email and password did not open the room. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function recover(form: HTMLFormElement | null) {
    if (!form) return;
    const email = form.querySelector<HTMLInputElement>('input[name="email"]');
    if (!email?.reportValidity()) return;
    setBusy(true);
    setError("");
    setRecoveryMessage("");
    try {
      const result = await djangoAuth.recover(email.value.trim());
      setRecoveryMessage(result.message);
    } catch {
      setError("Could not reach the room. Check your connection.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="entryway">
      <img src={`${import.meta.env.BASE_URL}art/night-window.svg`} alt="" />
      <div className="entryway-form">
        <span className="eyebrow">A QUIET ROOM FOR YOUR WORLDS</span>
        <h1>
          Nooshin,
          <br />
          <em>this room is yours.</em>
        </h1>
        <p>
          A private place for the stories, songs, and little things you want to
          keep. — Saman
        </p>
        {loading ? (
          <p role="status">Opening the door…</p>
        ) : resetToken ? (
          <SetPassword
            submitPassword={(password, confirm) =>
              djangoAuth.reset(resetToken, password, confirm).then((result) => {
                setSession(result);
                setMember((result.member as RoomMember | undefined) ?? null);
                setResetToken(null);
                history.replaceState(
                  null,
                  "",
                  location.pathname + location.hash,
                );
              })
            }
            onDone={() => undefined}
          />
        ) : (
          <form onSubmit={signIn}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              <KeyRound size={17} />
              {busy ? "Opening…" : "Come in"}
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={(event) => void recover(event.currentTarget.form)}
            >
              Forgot your password?
            </button>
            {recoveryMessage && <p role="status">{recoveryMessage}</p>}
          </form>
        )}
        <small>Only you and I can open this door.</small>
      </div>
    </main>
  );
}

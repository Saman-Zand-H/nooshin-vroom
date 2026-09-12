import { useState, type FormEvent } from "react";

export function SetPassword({
  onDone,
  submitPassword,
}: {
  onDone: () => void;
  submitPassword: (password: string, confirm: string) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== data.get("confirm")) {
      setError("The two passwords don’t match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submitPassword(password, String(data.get("confirm")));
      onDone();
    } catch {
      setError("Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <p>Choose your own key to the room.</p>
      <label>
        New password
        <input
          type="password"
          name="password"
          minLength={12}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        Confirm password
        <input
          type="password"
          name="confirm"
          minLength={12}
          autoComplete="new-password"
          required
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? "Saving…" : "Save password & come in"}
      </button>
    </form>
  );
}

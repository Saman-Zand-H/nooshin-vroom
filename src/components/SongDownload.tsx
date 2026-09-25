import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { Entry } from "../lib/model";
import { djangoApiBase, djangoRequest } from "../lib/django";

type SongSource = {
  status: "found" | "miss";
  source?: string;
  file?: string;
  page?: string;
  variant?: "original" | "derivative";
};

type Phase = "idle" | "looking" | "found" | "none" | "uploading";

const FILE_ACCEPT = "audio/*,.mp3,.m4a,.aac,.flac,.ogg,.oga,.opus,.wav";

export function SongDownload({ entry }: { entry: Entry }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [source, setSource] = useState<SongSource | null>(null);
  const [note, setNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function begin() {
    if (phase === "looking") return;
    setPhase("looking");
    setNote("");
    try {
      // Misses walk three catalogs, so allow a longer budget than usual.
      const found = await djangoRequest<SongSource>(
        `/api/songs/${entry.id}/download/`,
        { signal: AbortSignal.timeout(60_000) },
      );
      if (
        found.status !== "found" ||
        (!found.file && found.source !== "manual")
      ) {
        setNote("No open catalog has this song yet");
        setPhase("none");
        return;
      }
      setSource(found);
      setPhase("found");
      const anchor = document.createElement("a");
      anchor.href = `${djangoApiBase}/api/songs/${entry.id}/download/file/`;
      anchor.rel = "noopener";
      anchor.click();
    } catch (error) {
      setNote(
        error instanceof Error && error.message
          ? error.message
          : "The song source is unavailable",
      );
      setPhase("none");
    }
  }

  async function addFile(file: File) {
    if (phase === "uploading") return;
    setPhase("uploading");
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const found = await djangoRequest<SongSource>(
        `/api/songs/${entry.id}/upload/`,
        { method: "POST", body: form, signal: AbortSignal.timeout(90_000) },
      );
      if (found.status !== "found")
        throw new Error("That file could not be added.");
      setSource(found);
      setNote("Saved from your file");
      setPhase("found");
    } catch (error) {
      setNote(
        error instanceof Error && error.message
          ? error.message
          : "That file could not be added.",
      );
      setPhase("none");
    }
  }

  function pickFile() {
    fileInput.current?.click();
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void addFile(file);
  }

  const hiddenInput = (
    <input
      ref={fileInput}
      type="file"
      accept={FILE_ACCEPT}
      hidden
      onChange={onPick}
    />
  );

  if (phase === "none") {
    return (
      <div className="entry-download-note">
        <span>{note || "No open catalog has this song yet"}</span>
        <button
          type="button"
          className="text-button"
          onClick={pickFile}
          title="Add an audio file you already have"
        >
          <Upload size={14} />
          Add your own file
        </button>
        {hiddenInput}
      </div>
    );
  }

  if (phase === "uploading") {
    return (
      <div className="entry-download">
        <span className="entry-download-note">Adding your file…</span>
      </div>
    );
  }

  return (
    <div className="entry-download">
      <button
        type="button"
        className="text-button"
        onClick={begin}
        disabled={phase === "looking"}
        title="Fetch the full track from an open catalog"
      >
        <Download size={16} />
        {phase === "looking"
          ? "Finding…"
          : phase === "found"
            ? "Download again"
            : "Download"}
      </button>
      {phase === "found" && source && (
        <span className="entry-download-note">
          {source.source === "manual"
            ? note || "Your own file"
            : source.variant === "derivative"
              ? "Closest version saved"
              : "Full song saved"}
          {source.page && (
            <>
              {" · "}
              <a href={source.page} target="_blank" rel="noopener noreferrer">
                open song
              </a>
            </>
          )}
          {source.source === "manual" && (
            <button
              type="button"
              className="text-button"
              onClick={pickFile}
              title="Replace this file with another one"
            >
              <Upload size={14} />
              Use a different file
            </button>
          )}
        </span>
      )}
      {hiddenInput}
    </div>
  );
}

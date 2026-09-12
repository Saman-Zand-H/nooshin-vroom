import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ImagePlus,
  LoaderCircle,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  emptyDraft,
  statusOptions,
  type Draft,
  type Entry,
  type Kind,
  type Uploads,
} from "../lib/model";
import { newDetails } from "../lib/section-details";
import { prepareImage, validateRecording } from "../lib/media";
import { useRoom } from "../lib/room-context";
import { useMediaUrl } from "./Artwork";
import { BookSearch } from "./BookSearch";
import { SectionFields } from "./sections/SectionFields";
import {
  screenType,
  withScreenType,
  type ScreenType,
} from "../lib/screen-media";

const labels: Record<
  Kind,
  { title: string; description: string; creator: string }
> = {
  book: {
    title: "Add a book.",
    description: "Search for your book or add its details below.",
    creator: "Author",
  },
  music: {
    title: "Save a song.",
    description: "For a song you want to find again.",
    creator: "Artist",
  },
  wish: {
    title: "Something you’d love.",
    description: "Show me what you’ve had your eye on.",
    creator: "Brand or place",
  },
  request: {
    title: "Play this for me.",
    description: "Tell me what you’d like to hear on the violin.",
    creator: "Artist",
  },
  note: {
    title: "Add a note.",
    description: "Something to remember or share with me.",
    creator: "",
  },
  film: {
    title: "Add a film or series.",
    description:
      "Your watchlist and favourites, whether you watch alone or together.",
    creator: "Director or creator",
  },
  game: {
    title: "Add a game.",
    description: "What you’re playing or want to try next.",
    creator: "Studio",
  },
  rabbit_hole: {
    title: "One thing leads to another.",
    description:
      "Make a trail through your favourite things. Add what connects each stop.",
    creator: "",
  },
  movie_night: {
    title: "What’s on tonight?",
    description: "A film or a few episodes. Just you, or a night with me.",
    creator: "",
  },
  adventure: {
    title: "A page for the adventure.",
    description: "Something you want to do, or a moment you want to remember.",
    creator: "",
  },
  lyric: {
    title: "Put it on the wall.",
    description: "The words, the song, the way you want to see them.",
    creator: "Artist",
  },
};

export function Composer({
  kind,
  entry,
  onClose,
  onSaved,
}: {
  kind: Kind;
  entry?: Entry;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { save, remove } = useRoom();
  const [draft, setDraft] = useState<Draft>(entry ?? emptyDraft(kind));
  const [uploads, setUploads] = useState<Uploads>({});
  const { url: existingImage } = useMediaUrl(entry?.image_path ?? null);
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const generation = useRef(0);
  const imageInput = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const copy = labels[kind];
  useEffect(() => {
    // A room refresh can replace the entry object while this dialog is open.
    // Keep the form state tied to the item being edited, without wiping edits
    // on ordinary background refreshes.
    setDraft(
      entry
        ? { ...entry, details: entry.details ?? newDetails(kind) }
        : emptyDraft(kind),
    );
    setUploads({});
    setError("");
  }, [entry?.id, kind]);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(() => {
    if (!uploads.image) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(uploads.image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [uploads.image]);
  const image =
    uploads.image === null
      ? draft.image_url
      : preview || existingImage || draft.image_url;
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  async function pickImage(file?: File) {
    if (!file) return;
    const id = ++generation.current;
    setImageBusy(true);
    setError("");
    try {
      const result = await prepareImage(file);
      if (id === generation.current) {
        setUploads((current) => ({ ...current, image: result }));
        update("image_url", null);
      }
    } catch (failure) {
      if (id === generation.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not open this picture.",
        );
    } finally {
      if (id === generation.current) setImageBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || imageBusy) return;
    setBusy(true);
    setError("");
    try {
      const formTitle = new FormData(event.currentTarget).get("title");
      const submittedTitle =
        typeof formTitle === "string" ? formTitle.trim() : draft.title.trim();
      if (!submittedTitle) throw new Error("Add a title before saving.");
      if (
        kind === "request" &&
        ["Recorded", "Delivered"].includes(draft.status) &&
        !draft.link &&
        !(
          uploads.recording ??
          (uploads.recording === null ? null : entry?.recording_path)
        )
      )
        throw new Error(
          "Attach the recording or add its link before marking this performance recorded or delivered.",
        );
      await save({ ...draft, title: submittedTitle }, uploads, entry);
      onSaved(entry ? "Changes saved." : "Added to your room.");
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Your draft is still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteEntry() {
    if (!entry) return;
    setBusy(true);
    setError("");
    try {
      await remove(entry);
      onSaved("Removed from your room.");
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not remove this item.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content composer"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
            else document.getElementById("main-content")?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="dialog-heading">
            <div>
              <span className="eyebrow">
                {entry ? "EDIT DETAILS" : "FOR YOUR COLLECTION"}
              </span>
              <Dialog.Title>
                {entry ? "Back to this one." : copy.title}
              </Dialog.Title>
              <Dialog.Description>{copy.description}</Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label="Close"
              disabled={busy}
            >
              <X size={21} />
            </Dialog.Close>
          </div>
          <form onSubmit={submit}>
            {kind === "book" && !entry && (
              <BookSearch
                onPick={(book) => {
                  setDraft((current) => ({
                    ...current,
                    title: book.title,
                    creator: book.creator,
                    image_url: book.image,
                    source_id: book.id,
                  }));
                  setUploads((current) => ({ ...current, image: undefined }));
                }}
              />
            )}
            <div className="composer-intro">
              <div className="image-picker">
                {image ? (
                  <img src={image} alt="Selected picture" />
                ) : (
                  <div className="image-empty">
                    <ImagePlus size={28} strokeWidth={1.2} />
                    <span>Add a picture</span>
                  </div>
                )}
                <input
                  ref={imageInput}
                  type="file"
                  className="sr-only"
                  aria-label="Upload picture"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    void pickImage(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="image-pick-button"
                  onClick={() => imageInput.current?.click()}
                  disabled={imageBusy || busy}
                >
                  {imageBusy ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Upload size={15} />
                  )}
                  {image ? "Change picture" : "Upload picture"}
                </button>
                {image && (
                  <button
                    type="button"
                    className="image-remove"
                    aria-label="Remove picture"
                    disabled={busy || imageBusy}
                    onClick={() => {
                      setUploads((current) => ({ ...current, image: null }));
                      update("image_url", null);
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="composer-main-fields">
                <label>
                  {kind === "wish"
                    ? "What is it?"
                    : kind === "lyric"
                      ? "Song title"
                      : kind === "adventure"
                        ? "Page title"
                        : kind === "movie_night"
                          ? "Name this evening"
                          : kind === "rabbit_hole"
                            ? "Name this rabbit hole"
                            : "Title"}
                  <input
                    name="title"
                    autoFocus
                    value={draft.title}
                    onChange={(event) => update("title", event.target.value)}
                    required
                    maxLength={240}
                    dir="auto"
                    placeholder={
                      kind === "note" ? "A title for this thought" : "Name it"
                    }
                  />
                </label>
                {copy.creator && (
                  <label>
                    {copy.creator}
                    <input
                      value={draft.creator}
                      onChange={(event) =>
                        update("creator", event.target.value)
                      }
                      maxLength={180}
                      dir="auto"
                      placeholder="Optional"
                    />
                  </label>
                )}
                {statusOptions[kind].length > 1 && (
                  <div className="form-grid">
                    <label>
                      Status
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          update("status", event.target.value)
                        }
                      >
                        {statusOptions[kind].map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    {kind === "book" && (
                      <label>
                        Format
                        <select
                          value={draft.format}
                          onChange={(event) =>
                            update("format", event.target.value)
                          }
                        >
                          <option>Book</option>
                          <option>Audiobook</option>
                          <option>Ebook</option>
                        </select>
                      </label>
                    )}
                    {kind === "film" && (
                      <label>
                        Type
                        <select
                          value={screenType(draft.format)}
                          onChange={(event) =>
                            update(
                              "format",
                              withScreenType(
                                draft.format,
                                event.target.value as ScreenType,
                              ),
                            )
                          }
                        >
                          <option value="film">Film</option>
                          <option value="series">Series</option>
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="helper image-helper">
              JPG, PNG, or WebP · up to 5 MB. Pictures are resized for your
              phone.
            </p>
            <label>
              {kind === "request"
                ? "Why this song?"
                : kind === "lyric"
                  ? "Words for the wall"
                  : kind === "adventure"
                    ? "The story of this page"
                    : kind === "movie_night"
                      ? "Anything else for the evening?"
                      : kind === "rabbit_hole"
                        ? "What ties it all together?"
                        : kind === "note"
                          ? "Your note"
                          : "A thought to keep"}
              <textarea
                value={draft.note}
                onChange={(event) => update("note", event.target.value)}
                rows={["note", "lyric", "adventure"].includes(kind) ? 5 : 3}
                required={kind === "lyric"}
                maxLength={4000}
                dir="auto"
                placeholder={
                  kind === "lyric"
                    ? "Type or paste the words you want to keep. Line breaks stay as you write them."
                    : kind === "wish"
                      ? "Size, colour, price, the reason you love it…"
                      : "Your thoughts, if you’d like to add them."
                }
              />
            </label>
            <SectionFields
              draft={draft}
              onChange={(details) => update("details", details)}
            />
            <label>
              {kind === "music" || kind === "request"
                ? "Spotify, YouTube, or recording link"
                : kind === "wish"
                  ? "Shop or product link"
                  : "A link"}
              <input
                type="url"
                value={draft.link}
                onChange={(event) => update("link", event.target.value)}
                placeholder="https://…"
                maxLength={2000}
              />
            </label>
            {["book", "film", "game"].includes(kind) && (
              <div className="form-grid">
                <label>
                  Progress (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={draft.status === "Finished" ? 100 : draft.progress}
                    disabled={draft.status === "Finished"}
                    onChange={(event) =>
                      update("progress", Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Your rating
                  <select
                    value={draft.rating}
                    onChange={(event) =>
                      update("rating", Number(event.target.value))
                    }
                  >
                    <option value={0}>Not rated</option>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <option key={rating} value={rating}>
                        {"★".repeat(rating)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {kind === "request" && (
              <div className="recording-picker">
                <label>
                  Attach a performance
                  <input
                    type="file"
                    accept=".m4a,audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a,audio/wav,audio/ogg,video/mp4,video/webm"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      try {
                        validateRecording(file);
                        setUploads((current) => ({
                          ...current,
                          recording: file,
                        }));
                        setError("");
                      } catch (failure) {
                        setError((failure as Error).message);
                      }
                    }}
                  />
                </label>
                <small>
                  {uploads.recording?.name ||
                    (entry?.recording_path && uploads.recording !== null
                      ? "Recording attached"
                      : "Audio or video · up to 50 MB")}
                </small>
                {(uploads.recording || entry?.recording_path) && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setUploads((current) => ({ ...current, recording: null }))
                    }
                  >
                    Remove recording
                  </button>
                )}
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button className="button primary" disabled={busy || imageBusy}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <ArrowRight size={17} />
                )}
                {busy ? "Saving…" : entry ? "Save changes" : "Save"}
              </button>
              {entry && (
                <button
                  type="button"
                  className="text-button remove-button"
                  onClick={() => setConfirmRemove(true)}
                  disabled={busy}
                >
                  <Trash2 size={15} />
                  Remove
                </button>
              )}
            </div>
            {confirmRemove && (
              <div className="remove-confirm">
                <p>
                  Remove “{entry?.title}” and its attachments from the room?
                </p>
                <button
                  type="button"
                  className="button danger"
                  onClick={() => void deleteEntry()}
                  disabled={busy}
                >
                  Remove item
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmRemove(false)}
                  disabled={busy}
                >
                  Keep it
                </button>
              </div>
            )}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

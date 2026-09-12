import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, BookOpen, LoaderCircle, Search } from "lucide-react";
import { searchBooks, type BookResult } from "../lib/catalogue";

export function BookSearch({
  onPick,
}: {
  onPick: (result: BookResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const search = async () => {
    if (query.trim().length < 2) {
      setError("Enter at least two letters.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const books = await searchBooks(query, controller.signal);
      if (!controller.signal.aborted) setResults(books);
    } catch {
      if (!controller.signal.aborted)
        setError(
          "Book search is unavailable. Add the details below, or try again.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <div className="catalogue-search">
      <label htmlFor="catalogue-query">
        Find a book <span className="optional">or add it yourself below</span>
      </label>
      <div className="search-input">
        <Search size={18} />
        <input
          id="catalogue-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
          placeholder="Title, author, or ISBN"
          maxLength={160}
        />
        <button
          type="button"
          className="button small"
          onClick={() => void search()}
          disabled={loading}
        >
          {loading ? <LoaderCircle size={17} className="spin" /> : "Find"}
        </button>
      </div>
      <div role="status" aria-live="polite">
        {loading && <p className="helper">Looking through the catalogues…</p>}
        {error && <p className="form-error">{error}</p>}
        {results?.length === 0 && (
          <p className="helper">
            No matches. Try a different spelling, or add it yourself.
          </p>
        )}
      </div>
      {Boolean(results?.length) && (
        <div className="catalogue-results">
          {results!.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => {
                onPick(book);
                setResults(null);
              }}
            >
              <span className="catalogue-cover">
                {book.image ? (
                  <img src={book.image} alt="" loading="lazy" />
                ) : (
                  <BookOpen size={20} />
                )}
              </span>
              <span dir="auto">
                <strong>{book.title}</strong>
                <small>
                  {book.creator || "Author not listed"} · {book.source}
                </small>
              </span>
              <ArrowDownLeft size={17} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface BookResult {
  id: string;
  title: string;
  creator: string;
  image: string | null;
  source: string;
}

export async function searchBooks(
  query: string,
  signal: AbortSignal,
): Promise<BookResult[]> {
  const term = query.trim().slice(0, 160);
  if (!term) return [];
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(term)}&maxResults=6&printType=books`,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
    );
    if (!response.ok) throw new Error("Catalogue unavailable");
    const data = await response.json();
    return (data.items ?? [])
      .filter(
        (book: { id?: string; volumeInfo?: { title?: string } }) =>
          book.id && book.volumeInfo?.title,
      )
      .map(
        (book: {
          id: string;
          volumeInfo: {
            title: string;
            authors?: string[];
            imageLinks?: { thumbnail?: string };
          };
        }) => {
          const cover = book.volumeInfo.imageLinks?.thumbnail?.replace(
            /^http:/,
            "https:",
          );
          return {
            id: `google:${book.id}`,
            title: book.volumeInfo.title.slice(0, 240),
            creator: (book.volumeInfo.authors ?? []).join(", ").slice(0, 180),
            image:
              cover &&
              /^https:\/\/(books\.google\.com|books\.googleusercontent\.com)\//.test(
                cover,
              )
                ? cover
                : null,
            source: "Google Books",
          };
        },
      );
  } catch (error) {
    if (signal.aborted) throw error;
  }
  const response = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}&limit=6&fields=key,title,author_name,cover_i`,
    { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) },
  );
  if (!response.ok)
    throw new Error(
      "Book search is unavailable. You can still add the title and your own cover below.",
    );
  const data = await response.json();
  return (data.docs ?? [])
    .filter((book: { key?: string; title?: string }) => book.key && book.title)
    .map(
      (book: {
        key: string;
        title: string;
        author_name?: string[];
        cover_i?: number;
      }) => ({
        id: `openlibrary:${book.key}`,
        title: book.title.slice(0, 240),
        creator: (book.author_name ?? []).join(", ").slice(0, 180),
        image: Number.isSafeInteger(book.cover_i)
          ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
          : null,
        source: "Open Library",
      }),
    );
}

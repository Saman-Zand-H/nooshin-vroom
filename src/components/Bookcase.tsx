import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  ChevronRight,
  Layers2,
  Plus,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
} from "react";
import type { Entry } from "../lib/model";
import { useRoom } from "../lib/room-context";
import { prepareImage } from "../lib/media";
import { useMediaUrl } from "./Artwork";
import "../bookshelf.css";

type DecorKind =
  | "bust"
  | "vase"
  | "globe"
  | "plant"
  | "candle"
  | "postcard"
  | "ticket"
  | "mug"
  | "pinecones"
  | "dolls"
  | "headphones"
  | "stationery"
  | "eggs"
  | "roses"
  | "speaker"
  | "tea-set"
  | "keepsakes"
  | "notebooks"
  | "binders"
  | "paperback-stack"
  | "custom";
type CustomDecor = { id: string; label: string; src: string; blob?: Blob };
type PlacedDecor = {
  id: string;
  kind: DecorKind;
  label?: string;
  row: number;
  x: number;
  src?: string;
};
type DecorSet = { id: string; name: string; items: DecorKind[] };
type Layout = {
  rows?: string[][];
  horizontal?: string[];
  stacked?: string[];
  decor?: PlacedDecor[];
  sets?: DecorSet[];
  activeSet?: string;
  custom?: CustomDecor[];
};

/**
 * Physical cubbies in the photographed cabinet.  The API still stores these
 * as stable cubby ids (0–13); the geometry only controls where each cubby is
 * painted in the cabinet.  Keeping this mapping here makes a layout fixture
 * readable and lets users move books between any of the real bays.
 */
const CUBBY_GEOMETRY = [
  // The real cabinet has three tall bays across the top. The left bay is
  // twice the width of either tall bay and stops at the first crosspiece.
  { id: 0, gridColumn: "1 / 3", gridRow: "1 / 2", shape: "wide" },
  { id: 1, gridColumn: "3 / 4", gridRow: "1 / 3", shape: "tall" },
  { id: 2, gridColumn: "4 / 5", gridRow: "1 / 3", shape: "tall" },
  // Two small bays sit below the wide top-left bay.
  { id: 3, gridColumn: "1 / 2", gridRow: "2 / 3", shape: "narrow" },
  { id: 4, gridColumn: "2 / 3", gridRow: "2 / 3", shape: "narrow" },
  // The folders and notebooks on the left run through two levels without a
  // crosspiece; the two right bays are split once, then merge again.
  { id: 5, gridColumn: "1 / 2", gridRow: "3 / 5", shape: "tall" },
  { id: 6, gridColumn: "2 / 3", gridRow: "3 / 5", shape: "tall" },
  { id: 7, gridColumn: "3 / 4", gridRow: "3 / 4", shape: "small" },
  { id: 8, gridColumn: "4 / 5", gridRow: "3 / 4", shape: "small" },
  { id: 9, gridColumn: "3 / 5", gridRow: "4 / 5", shape: "wide" },
  { id: 10, gridColumn: "1 / 3", gridRow: "5 / 6", shape: "wide" },
  { id: 11, gridColumn: "3 / 5", gridRow: "5 / 6", shape: "wide" },
] as const;
const ROW_COUNT = CUBBY_GEOMETRY.length;
const layoutKey = "control-room-bookshelf-layout-v8";
const decorCatalog: { kind: DecorKind; label: string }[] = [
  { kind: "mug", label: "Engineer mug" },
  { kind: "pinecones", label: "Pinecones" },
  { kind: "dolls", label: "Doll couple" },
  { kind: "headphones", label: "Black headphones" },
  { kind: "stationery", label: "Stationery" },
  { kind: "eggs", label: "Painted eggs" },
  { kind: "roses", label: "Rose vase" },
  { kind: "speaker", label: "Black speaker" },
  { kind: "tea-set", label: "Tea set" },
  { kind: "keepsakes", label: "Little keepsakes" },
  { kind: "notebooks", label: "Notebooks" },
  { kind: "binders", label: "Tall binders" },
  { kind: "paperback-stack", label: "Paperback stack" },
  { kind: "plant", label: "Juniper bonsai" },
  { kind: "vase", label: "Terracotta amphora" },
  { kind: "candle", label: "Wax candle" },
  { kind: "postcard", label: "Postcard" },
  { kind: "ticket", label: "Theatre ticket" },
  { kind: "bust", label: "Marble bust" },
  { kind: "globe", label: "Small globe" },
];
const defaultSets: DecorSet[] = [
  {
    id: "her-shelf",
    name: "Her shelf",
    items: [
      "mug",
      "pinecones",
      "dolls",
      "headphones",
      "stationery",
      "eggs",
      "roses",
      "tea-set",
    ],
  },
  { id: "quiet", name: "Quiet corner", items: ["vase", "bust"] },
  { id: "green", name: "A little green", items: ["plant", "vase", "candle"] },
  { id: "keepsakes", name: "Little keepsakes", items: ["postcard", "ticket"] },
];

const shelfCollision: CollisionDetection = (args) => {
  const containers = args.droppableContainers.filter((item) =>
    String(item.id).startsWith("row-"),
  );
  const rowHits = args.pointerCoordinates
    ? pointerWithin({ ...args, droppableContainers: containers })
    : rectIntersection({ ...args, droppableContainers: containers });
  const resolvedRows = rowHits.length
    ? rowHits
    : closestCenter({ ...args, droppableContainers: containers });
  if (!resolvedRows.length) return [];
  const row = Number(String(resolvedRows[0].id).slice(4));
  const books = args.droppableContainers.filter(
    (item) =>
      !String(item.id).startsWith("row-") && item.data.current?.row === row,
  );
  const bookHits = args.pointerCoordinates
    ? pointerWithin({ ...args, droppableContainers: books })
    : closestCenter({ ...args, droppableContainers: books });
  return bookHits.length ? bookHits : resolvedRows;
};

function readLayout(): Layout {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(layoutKey) || "{}");
    if (!value || typeof value !== "object") return {};
    const data = value as Layout;
    const horizontal = Array.isArray(data.horizontal)
      ? data.horizontal.filter((id) => typeof id === "string").slice(0, 500)
      : undefined;
    const stacked = Array.isArray(data.stacked)
      ? data.stacked.filter((id) => typeof id === "string").slice(0, 500)
      : undefined;
    const custom = Array.isArray(data.custom)
      ? data.custom
          .filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.label === "string" &&
              typeof item.src === "string" &&
              item.src.startsWith("data:image/"),
          )
          .slice(0, 24)
      : undefined;
    const rows =
      Array.isArray(data.rows) &&
      data.rows.length === ROW_COUNT &&
      data.rows.every(
        (row) =>
          Array.isArray(row) && row.every((id) => typeof id === "string"),
      )
        ? data.rows
        : undefined;
    const validKind = (kind: unknown) =>
      kind === "custom" || decorCatalog.some((item) => item.kind === kind);
    const decor = Array.isArray(data.decor)
      ? data.decor.filter(
          (item) =>
            item &&
            typeof item.id === "string" &&
            validKind(item.kind) &&
            Number.isInteger(item.row) &&
            item.row >= 0 &&
            item.row < ROW_COUNT &&
            Number.isFinite(item.x) &&
            item.x >= 0 &&
            item.x <= 100 &&
            (item.kind !== "custom" ||
              (typeof item.src === "string" &&
                item.src.startsWith("data:image/"))),
        )
      : undefined;
    const sets = Array.isArray(data.sets)
      ? data.sets
          .filter(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              Array.isArray(item.items) &&
              item.items.every(validKind),
          )
          .slice(0, 24)
      : undefined;
    return {
      rows,
      horizontal,
      stacked,
      decor,
      sets,
      custom,
      activeSet:
        typeof data.activeSet === "string" ? data.activeSet : undefined,
    };
  } catch {
    return {};
  }
}
function saveLayout(layout: Layout) {
  try {
    localStorage.setItem(layoutKey, JSON.stringify(layout));
  } catch {
    // Storage is optional; the current session remains usable.
  }
}

// Older server fixtures used ids 12 and 13 for the two bottom bays. The
// photographed cabinet now renders those bays as 10 and 11 after the tall
// middle compartments were modelled explicitly. Keep old arrangements visible
// when a room upgrades to this geometry.
function normalizeCubby(cubby: number) {
  if (cubby === 12) return 10;
  if (cubby === 13) return 11;
  return cubby;
}

function initialRows(entries: Entry[], saved: Layout): string[][] {
  const ids = new Set(entries.map((entry) => entry.id));
  const assigned = new Set<string>();
  const savedRows = saved.rows?.map((row) =>
    row.filter((id) => {
      if (!ids.has(id) || assigned.has(id)) return false;
      assigned.add(id);
      return true;
    }),
  );
  const seen = new Set(savedRows?.flat() || []);
  const rows =
    savedRows?.length === ROW_COUNT
      ? savedRows
      : Array.from({ length: ROW_COUNT }, () => []);
  entries.forEach((entry, index) => {
    if (!seen.has(entry.id)) rows[index % ROW_COUNT].push(entry.id);
  });
  return rows;
}

function rowsEqual(left: string[][], right: string[][]) {
  return (
    left.length === right.length &&
    left.every(
      (row, index) =>
        row.length === right[index].length &&
        row.every((id, itemIndex) => id === right[index][itemIndex]),
    )
  );
}

function setsEqual(left: Set<string>, right: Set<string>) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function placedDecorEqual(left: PlacedDecor[], right: PlacedDecor[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const next = right[index];
      return (
        item.id === next.id &&
        item.kind === next.kind &&
        item.label === next.label &&
        item.row === next.row &&
        item.x === next.x &&
        item.src === next.src
      );
    })
  );
}

function stackIndexFor(
  ids: string[],
  slot: number,
  horizontalBooks: Set<string>,
) {
  let index = 0;
  for (
    let cursor = slot - 1;
    cursor >= 0 && horizontalBooks.has(ids[cursor]);
    cursor -= 1
  )
    index += 1;
  return Math.min(index, 4);
}

export function Bookcase({
  entries,
  onEdit,
  onAdd,
  filtered,
  onClear,
  allEntries,
}: {
  allEntries: Entry[];
  entries: Entry[];
  onEdit: (entry: Entry) => void;
  onAdd: () => void;
  filtered: boolean;
  onClear: () => void;
}) {
  const { local, store } = useRoom();
  const bookshelf = store.bookshelf;
  const cabinet = useRef<HTMLDivElement>(null);
  const saved = useMemo(readLayout, []);
  const [rows, setRows] = useState(() => initialRows(allEntries, saved));
  const [horizontalBooks, setHorizontalBooks] = useState<Set<string>>(
    () => new Set(saved.horizontal || []),
  );
  const [stackedBooks, setStackedBooks] = useState<Set<string>>(
    () => new Set(saved.stacked || []),
  );
  const [placedDecor, setPlacedDecor] = useState<PlacedDecor[]>(
    saved.decor || [],
  );
  const [customDecor, setCustomDecor] = useState<CustomDecor[]>(
    saved.custom || [],
  );
  const [decorSets, setDecorSets] = useState<DecorSet[]>(
    saved.sets?.length ? saved.sets : defaultSets,
  );
  const [activeSet, setActiveSet] = useState(saved.activeSet || "quiet");
  const [showDecorTray, setShowDecorTray] = useState(false);
  const [decorMessage, setDecorMessage] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [activeDrag, setActiveDrag] = useState<UniqueIdentifier | null>(null);
  const [overRow, setOverRow] = useState<number | null>(null);
  const [serverRevision, setServerRevision] = useState<number | null>(null);
  const [serverReady, setServerReady] = useState(!bookshelf);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );

  useEffect(() => {
    setRows((current) => {
      const valid = new Set(allEntries.map((entry) => entry.id));
      const kept = current.map((row) => row.filter((id) => valid.has(id)));
      const seen = new Set(kept.flat());
      allEntries
        .filter((entry) => !seen.has(entry.id))
        .forEach((entry) => {
          const shortest = kept.reduce(
            (best, row, index) =>
              row.length < kept[best].length ? index : best,
            0,
          );
          kept[shortest].push(entry.id);
        });
      const next =
        kept.length === ROW_COUNT ? kept : initialRows(allEntries, {});
      return rowsEqual(current, next) ? current : next;
    });
  }, [allEntries]);
  useEffect(() => {
    if (!bookshelf) return;
    let active = true;
    void bookshelf
      .load()
      .then((layout) => {
        if (!active) return;
        const byId = new Set(allEntries.map((entry) => entry.id));
        const nextRows = Array.from(
          { length: ROW_COUNT },
          () => [] as string[],
        );
        const persistedBooks = layout.books.length
          ? layout.books
          : local
            ? allEntries.map((entry) => ({
                id: entry.id,
                cubby: normalizeCubby(entry.shelf_cubby ?? 0),
                position: entry.shelf_position ?? 0,
                orientation: entry.shelf_orientation ?? "vertical",
                stack: entry.shelf_stack ?? null,
              }))
            : [];
        persistedBooks
          .filter(
            (book) =>
              byId.has(book.id) &&
              normalizeCubby(book.cubby) >= 0 &&
              normalizeCubby(book.cubby) < ROW_COUNT,
          )
          .sort(
            (a, b) =>
              normalizeCubby(a.cubby) - normalizeCubby(b.cubby) ||
              a.position - b.position,
          )
          .forEach((book) =>
            nextRows[normalizeCubby(book.cubby)].push(book.id),
          );
        const placed = new Set(nextRows.flat());
        allEntries
          .filter((entry) => !placed.has(entry.id))
          .forEach((entry, index) =>
            nextRows[index % ROW_COUNT].push(entry.id),
          );
        setRows((current) =>
          rowsEqual(current, nextRows) ? current : nextRows,
        );
        const nextHorizontal = new Set(
          layout.books
            .filter((book) => book.orientation === "horizontal")
            .map((book) => book.id),
        );
        setHorizontalBooks((current) =>
          setsEqual(current, nextHorizontal) ? current : nextHorizontal,
        );
        const nextStacked = new Set(
          layout.books.filter((book) => book.stack).map((book) => book.id),
        );
        setStackedBooks((current) =>
          setsEqual(current, nextStacked) ? current : nextStacked,
        );
        const nextDecor = layout.decorations.map((decor) => ({
          id: decor.id,
          kind: decor.kind as DecorKind,
          label: decor.label,
          row: normalizeCubby(decor.cubby),
          x: Math.max(8, Math.min(92, decor.position)),
          ...(decor.image_path ? { src: `${decor.image_path}` } : {}),
        }));
        setPlacedDecor((current) =>
          placedDecorEqual(current, nextDecor) ? current : nextDecor,
        );
        setServerRevision(layout.revision);
        setServerReady(true);
      })
      .catch(() => setServerReady(true));
    return () => {
      active = false;
    };
  }, [allEntries, bookshelf, local]);
  useEffect(() => {
    // The bookshelf load is asynchronous. Do not let the stale localStorage
    // snapshot write back over a newer IndexedDB layout before it finishes.
    if (!local || (bookshelf && !serverReady)) return;
    saveLayout({
      rows,
      horizontal: [...horizontalBooks],
      stacked: [...stackedBooks],
      decor: placedDecor,
      sets: decorSets,
      activeSet,
      custom: customDecor,
    });
  }, [
    local,
    bookshelf,
    serverReady,
    rows,
    horizontalBooks,
    stackedBooks,
    placedDecor,
    decorSets,
    activeSet,
    customDecor,
  ]);
  useEffect(() => {
    if (!bookshelf || !serverReady || serverRevision === null) return;
    const timer = window.setTimeout(() => {
      void bookshelf
        .save({
          revision: serverRevision,
          books: rows.flatMap((row, cubby) =>
            row.map((id, position) => ({
              id,
              cubby,
              position,
              orientation: horizontalBooks.has(id) ? "horizontal" : "vertical",
              stack: stackedBooks.has(id) ? `stack-${cubby}-${position}` : null,
            })),
          ),
          decorations: placedDecor.map((decor) => ({
            id: decor.id,
            kind: decor.kind,
            label: decor.label || decor.kind,
            cubby: decor.row,
            position: Math.round(decor.x),
            image_path: null,
          })),
        })
        .then((next) => setServerRevision(next.revision))
        .catch(() => setServerReady(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    bookshelf,
    horizontalBooks,
    local,
    placedDecor,
    rows,
    serverReady,
    stackedBooks,
  ]);

  function rowForOver(over: DragEndEvent["over"] | DragOverEvent["over"]) {
    if (!over) return null;
    const row = over.data.current?.row;
    if (typeof row === "number") return row;
    return typeof over.id === "string" && over.id.startsWith("row-")
      ? Number(over.id.slice(4))
      : null;
  }
  function moveBook(
    id: string,
    rowIndex: number,
    targetId?: string,
    after = false,
  ) {
    setRows((current) => {
      const next = current.map((row) => row.filter((item) => item !== id));
      const target = next[rowIndex] || (next[rowIndex] = []);
      const index = targetId ? target.indexOf(targetId) : -1;
      target.splice(index < 0 ? target.length : index + (after ? 1 : 0), 0, id);
      return next;
    });
  }
  function addDecor(
    kind: DecorKind,
    row = 0,
    x = 78,
    src?: string,
    image?: Blob,
  ) {
    const temporaryId = crypto.randomUUID();
    setPlacedDecor((current) => [
      ...current,
      { id: temporaryId, kind, label: kind, row, x, ...(src ? { src } : {}) },
    ]);
    if (!local && bookshelf) {
      void bookshelf
        .createDecoration({
          kind,
          label: kind,
          cubby: row,
          position: Math.round(x),
          image,
        })
        .then((created) => {
          setPlacedDecor((current) =>
            current.map((item) =>
              item.id === temporaryId
                ? {
                    ...item,
                    id: created.id,
                    src: created.image_path || item.src,
                  }
                : item,
            ),
          );
        })
        .catch(() => {
          setPlacedDecor((current) =>
            current.filter((item) => item.id !== temporaryId),
          );
          setDecorMessage("Could not save that decorative.");
        });
    }
    setShowDecorTray(false);
  }
  function handleDragOver(event: DragOverEvent) {
    setOverRow(rowForOver(event.over));
  }
  function handleDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);
    const data = event.active.data.current;
    const row = rowForOver(event.over);
    setActiveDrag(null);
    setOverRow(null);
    if (row === null) return;
    const target = cabinet.current?.querySelector<HTMLElement>(
      `[data-shelf-drop="${row}"]`,
    );
    const bounds = target?.getBoundingClientRect();
    const rect = event.active.rect.current.translated;
    const x =
      bounds && rect
        ? Math.max(
            12,
            Math.min(
              88,
              ((rect.left + rect.width / 2 - bounds.left) / bounds.width) * 100,
            ),
          )
        : 78;
    if (data?.palette)
      addDecor(
        data.palette as DecorKind,
        row,
        x,
        data.src as string | undefined,
      );
    else if (data?.decor) {
      const decor = data.decor as PlacedDecor;
      setPlacedDecor((items) =>
        items.map((item) =>
          item.id === decor.id ? { ...item, row, x } : item,
        ),
      );
    } else if (event.over?.id !== event.active.id) {
      let targetId =
        event.over && !String(event.over.id).startsWith("row-")
          ? String(event.over.id)
          : undefined;
      // When horizontal books overlap, collision detection often resolves to
      // the row container instead of one book. Pick the nearest horizontal
      // book in that row so dropping a block onto the pile still creates a
      // stack instead of appending beside it.
      if (!targetId && horizontalBooks.has(id)) {
        const track = cabinet.current?.querySelector<HTMLElement>(
          `[data-shelf-drop="${row}"]`,
        );
        const activeRect =
          event.active.rect.current.translated ||
          event.active.rect.current.initial;
        const centerX = activeRect
          ? activeRect.left + activeRect.width / 2
          : bounds
            ? bounds.left + bounds.width / 2
            : 0;
        const candidates = track
          ? [...track.querySelectorAll<HTMLElement>(".shelf-book-horizontal")]
              .filter((book) => book.dataset.bookId !== id)
              .sort((a, b) => {
                const ar = a.getBoundingClientRect();
                const br = b.getBoundingClientRect();
                return (
                  Math.abs(ar.left + ar.width / 2 - centerX) -
                  Math.abs(br.left + br.width / 2 - centerX)
                );
              })
          : [];
        targetId = candidates[0]?.dataset.bookId;
      }
      const shouldStack = Boolean(
        targetId && horizontalBooks.has(id) && horizontalBooks.has(targetId),
      );
      setStackedBooks((current) => {
        const next = new Set(current);
        if (shouldStack) next.add(id);
        else next.delete(id);
        return next;
      });
      moveBook(id, row, targetId, shouldStack);
    }
  }

  function toggleHorizontal(id: string) {
    setHorizontalBooks((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setStackedBooks((stacked) => {
          const without = new Set(stacked);
          without.delete(id);
          return without;
        });
      } else next.add(id);
      return next;
    });
  }

  function stackWithNeighbor(id: string) {
    const rowIndex = rows.findIndex((row) => row.includes(id));
    if (rowIndex < 0) return;
    const neighborRow = rows.findIndex((row) =>
      row.some(
        (candidate) => candidate !== id && horizontalBooks.has(candidate),
      ),
    );
    if (neighborRow < 0) return;
    const neighbor = rows[neighborRow].find(
      (candidate) => candidate !== id && horizontalBooks.has(candidate),
    );
    if (!neighbor) return;
    setHorizontalBooks((current) => new Set(current).add(id));
    setStackedBooks((current) => new Set(current).add(id));
    moveBook(id, neighborRow, neighbor, true);
  }

  function dropBookAtPoint(id: string, clientX: number, clientY: number) {
    const track = [
      ...(cabinet.current?.querySelectorAll<HTMLElement>("[data-shelf-drop]") ||
        []),
    ].find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    });
    if (!track) return;
    const row = Number(track.dataset.shelfDrop);
    if (!Number.isInteger(row)) return;
    const target = [...track.querySelectorAll<HTMLElement>("[data-book-id]")]
      .filter((book) => book.dataset.bookId !== id)
      .map((book) => {
        const rect = book.getBoundingClientRect();
        return {
          id: book.dataset.bookId!,
          distance: Math.abs(clientX - (rect.left + rect.width / 2)),
        };
      })
      .sort((a, b) => a.distance - b.distance)[0];
    const shouldStack = Boolean(
      target && horizontalBooks.has(id) && horizontalBooks.has(target.id),
    );
    setStackedBooks((current) => {
      const next = new Set(current);
      if (shouldStack) next.add(id);
      else next.delete(id);
      return next;
    });
    moveBook(id, row, target?.id, shouldStack);
  }
  function saveSet() {
    const name = newSetName.trim().slice(0, 60);
    if (!name || decorSets.length >= 24) return;
    const id = `set-${crypto.randomUUID()}`;
    setDecorSets((sets) => [
      ...sets,
      { id, name, items: placedDecor.map((item) => item.kind) },
    ]);
    setActiveSet(id);
    setNewSetName("");
  }
  async function addCustomDecor(file?: File) {
    if (!file) return;
    const blob = await prepareImage(file);
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Could not read that decoration."));
      reader.readAsDataURL(blob);
    });
    const custom = {
      id: crypto.randomUUID(),
      label: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "My decoration",
      src,
      blob,
    };
    setCustomDecor((items) => [...items, custom].slice(-24));
    addDecor("custom", 0, 78, src, blob);
    setDecorMessage("Decorative added to the shelf.");
    setShowDecorTray(true);
  }

  return (
    <section className="bookcase-scene" aria-label="Bookshelf">
      <div className="bookcase-heading">
        <div>
          <span className="eyebrow">A PLACE FOR THE WORLDS YOU KEEP</span>
          <strong>
            {entries.length || "No"} {entries.length === 1 ? "book" : "books"}
          </strong>
        </div>
        <span className="bookcase-hint">
          Drag to any row · swipe the shelf to browse
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={shelfCollision}
        onDragStart={({ active }) => setActiveDrag(active.id)}
        onDragOver={handleDragOver}
        onDragCancel={() => {
          setActiveDrag(null);
          setOverRow(null);
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="bookcase" ref={cabinet}>
          {rows.map((row, rowIndex) => (
            <ShelfRow
              key={rowIndex}
              rowIndex={rowIndex}
              geometry={CUBBY_GEOMETRY[rowIndex]}
              ids={row.filter((id) => entryById.has(id))}
              entries={entryById}
              horizontalBooks={horizontalBooks}
              stackedBooks={stackedBooks}
              onToggleHorizontal={toggleHorizontal}
              onStackWithNeighbor={stackWithNeighbor}
              over={overRow === rowIndex}
              placedDecor={placedDecor.filter(
                (decor) => decor.row === rowIndex,
              )}
              onEdit={onEdit}
              onEditDecor={(id, changes) =>
                setPlacedDecor((items) =>
                  items.map((item) =>
                    item.id === id ? { ...item, ...changes } : item,
                  ),
                )
              }
              onAdd={onAdd}
              filtered={filtered}
              onClear={onClear}
              onManualDrop={dropBookAtPoint}
              onRemoveDecor={(id) =>
                setPlacedDecor((items) =>
                  items.filter((item) => item.id !== id),
                )
              }
            />
          ))}
          <div className="bookcase-plinth" aria-hidden="true" />
        </div>
        <DragOverlay dropAnimation={null} style={{ pointerEvents: "none" }}>
          {activeDrag ? (
            <DragPreview
              id={String(activeDrag)}
              entries={entryById}
              decor={placedDecor}
              custom={customDecor}
            />
          ) : null}
        </DragOverlay>
        <div className="bookcase-controls">
          <button
            className="button secondary bookcase-add-decor"
            onClick={() => setShowDecorTray((open) => !open)}
            aria-expanded={showDecorTray}
          >
            <Plus size={15} /> Add decor
          </button>
          <span>
            {showDecorTray
              ? "Drag a piece onto any shelf"
              : "A little room for the things around the books"}
          </span>
        </div>
        {showDecorTray && (
          <div
            className="bookcase-decor-tray"
            aria-label="Available decoratives"
          >
            <div className="decor-tray-head">
              <strong>Add a decorative</strong>
              <span>Upload an image · it appears on the shelf immediately</span>
            </div>
            <div className="decor-options">
              <label className="decor-upload">
                <Plus size={18} />
                <span>Upload decorative image</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    void addCustomDecor(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {decorMessage && (
              <p className="decor-message" role="status">
                {decorMessage}
              </p>
            )}
          </div>
        )}
      </DndContext>
      <p className="bookcase-caption">
        {entries.length
          ? "The best part is putting it here."
          : "Books, and the little things between them."}
      </p>
    </section>
  );
}

function ShelfRow({
  rowIndex,
  geometry,
  ids,
  entries,
  horizontalBooks,
  stackedBooks,
  onToggleHorizontal,
  onStackWithNeighbor,
  over,
  placedDecor,
  onEdit,
  onEditDecor,
  onAdd,
  filtered,
  onClear,
  onManualDrop,
  onRemoveDecor,
}: {
  rowIndex: number;
  geometry: (typeof CUBBY_GEOMETRY)[number];
  ids: string[];
  entries: Map<string, Entry>;
  horizontalBooks: Set<string>;
  stackedBooks: Set<string>;
  onToggleHorizontal: (id: string) => void;
  onStackWithNeighbor: (id: string) => void;
  over: boolean;
  placedDecor: PlacedDecor[];
  onEdit: (entry: Entry) => void;
  onEditDecor: (id: string, changes: Partial<PlacedDecor>) => void;
  onAdd: () => void;
  filtered: boolean;
  onClear: () => void;
  onManualDrop: (id: string, clientX: number, clientY: number) => void;
  onRemoveDecor: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `row-${rowIndex}`,
    data: { row: rowIndex },
  });
  return (
    <div
      className={`bookcase-shelf cubby-${geometry.id} cubby-${geometry.shape}${over ? " is-shelf-drop-target" : ""}`}
      data-shelf-index={rowIndex}
      data-cubby={geometry.id}
      style={{
        gridColumn: geometry.gridColumn,
        gridRow: geometry.gridRow,
      }}
    >
      <button
        className="shelf-scroll shelf-scroll-left"
        aria-label={`Scroll shelf ${rowIndex + 1} left`}
        onClick={(event) =>
          (event.currentTarget.nextElementSibling as HTMLElement)?.scrollBy({
            left: -190,
            behavior: "smooth",
          })
        }
      >
        <ChevronLeft size={15} />
      </button>
      <div className="shelf-track" ref={setNodeRef} data-shelf-drop={rowIndex}>
        {over && <span className="shelf-drop-label">Drop here</span>}
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          {Array.from({ length: ids.length + 1 }, (_, slot) => (
            <Fragment key={`slot-${slot}`}>
              {placedDecor
                .filter((decor) => {
                  const position = Math.max(
                    0,
                    Math.min(
                      ids.length,
                      Math.round((decor.x / 100) * (ids.length + 1)),
                    ),
                  );
                  return position === slot;
                })
                .map((decor) => (
                  <PlacedObject
                    key={decor.id}
                    decor={decor}
                    onEdit={onEditDecor}
                    onRemove={() => onRemoveDecor(decor.id)}
                  />
                ))}
              {slot < ids.length && entries.get(ids[slot]) ? (
                <BookTile
                  key={ids[slot]}
                  entry={entries.get(ids[slot])!}
                  onEdit={onEdit}
                  row={rowIndex}
                  horizontal={horizontalBooks.has(ids[slot])}
                  stacked={stackedBooks.has(ids[slot])}
                  stackIndex={
                    horizontalBooks.has(ids[slot])
                      ? stackIndexFor(ids, slot, horizontalBooks)
                      : 0
                  }
                  onToggleHorizontal={onToggleHorizontal}
                  onStackWithNeighbor={onStackWithNeighbor}
                  onManualDrop={onManualDrop}
                />
              ) : null}
            </Fragment>
          ))}
        </SortableContext>
        {!ids.length && rowIndex === 0 && (
          <div className="bookcase-empty-copy" role="status">
            <p>{filtered ? "No books match." : "Your first book goes here."}</p>
            <button
              className="text-button"
              onClick={filtered ? onClear : onAdd}
            >
              {filtered ? <Search size={15} /> : <Plus size={15} />}
              {filtered ? "Clear filters" : "Add a book"}
            </button>
          </div>
        )}
      </div>
      <button
        className="shelf-scroll shelf-scroll-right"
        aria-label={`Scroll shelf ${rowIndex + 1} right`}
        onClick={(event) =>
          (event.currentTarget.previousElementSibling as HTMLElement)?.scrollBy(
            { left: 190, behavior: "smooth" },
          )
        }
      >
        <ChevronRight size={15} />
      </button>
      <div className="shelf-plank" aria-hidden="true" />
    </div>
  );
}

function BookTile({
  entry,
  onEdit,
  row,
  horizontal = false,
  stacked = false,
  stackIndex = 0,
  onToggleHorizontal,
  onStackWithNeighbor,
  onManualDrop,
}: {
  entry: Entry;
  onEdit: (entry: Entry) => void;
  row: number;
  horizontal?: boolean;
  stacked?: boolean;
  stackIndex?: number;
  onToggleHorizontal?: (id: string) => void;
  onStackWithNeighbor?: (id: string) => void;
  onManualDrop?: (id: string, clientX: number, clientY: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, data: { row } });
  const seed = Array.from(entry.title).reduce(
    (hash, letter) => (hash * 31 + letter.codePointAt(0)!) >>> 0,
    0,
  );
  const spineWidth = horizontal ? 0 : 16 + (seed % 14);
  const spineHeight = horizontal ? 0 : 68 + (seed % 24);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didManualDrag = useRef(false);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...(horizontal ? {} : listeners)}
      className={`shelf-book${horizontal ? " shelf-book-horizontal" : ""}${stacked ? " shelf-book-stacked" : ""}${isDragging ? " is-dragging" : ""}`}
      data-book-id={entry.id}
      style={
        {
          "--stack-index": stackIndex,
          "--spine-width": `${spineWidth}px`,
          "--spine-height": `${spineHeight}%`,
          "--book-lean": `${(seed % 7) - 3}deg`,
          transform: CSS.Transform.toString(transform) || undefined,
          transition,
        } as CSSProperties
      }
      title={`${entry.title}${entry.creator ? ` · ${entry.creator}` : ""}`}
      role="group"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        if (!didManualDrag.current) onEdit(entry);
        didManualDrag.current = false;
      }}
      onPointerDownCapture={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        if (!horizontal || !onManualDrop) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerStart.current = { x: event.clientX, y: event.clientY };
        didManualDrag.current = false;
      }}
      onPointerMoveCapture={(event) => {
        const start = pointerStart.current;
        if (!start) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
          didManualDrag.current = true;
          event.preventDefault();
        }
      }}
      onPointerUpCapture={(event) => {
        if (didManualDrag.current && onManualDrop)
          onManualDrop(entry.id, event.clientX, event.clientY);
        pointerStart.current = null;
      }}
      onPointerCancelCapture={() => {
        pointerStart.current = null;
      }}
    >
      <BookArt entry={entry} horizontal={horizontal} />
      <span className="shelf-book-actions">
        <button
          type="button"
          className="shelf-book-open"
          aria-label={`Open ${entry.title}`}
        />
        {onToggleHorizontal && (
          <button
            type="button"
            className="shelf-book-toggle"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleHorizontal(entry.id);
            }}
            aria-label={
              horizontal
                ? `Stand ${entry.title} upright`
                : `Lay ${entry.title} horizontally`
            }
            title={horizontal ? "Stand upright" : "Lay horizontally"}
          >
            <RotateCw size={11} />
          </button>
        )}
        {horizontal && onStackWithNeighbor && (
          <button
            type="button"
            className="shelf-book-stack-button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onStackWithNeighbor(entry.id);
            }}
            aria-label={`Stack ${entry.title} with another horizontal book`}
            title="Stack with another horizontal book"
          >
            <Layers2 size={11} />
          </button>
        )}
      </span>
    </div>
  );
}

function BookArt({
  entry,
  horizontal = false,
}: {
  entry: Entry;
  horizontal?: boolean;
}) {
  const seed = Array.from(entry.title).reduce(
    (hash, letter) => (hash * 31 + letter.codePointAt(0)!) >>> 0,
    0,
  );
  return (
    <span
      className={`book-art binding-${seed % 10}`}
      style={{ "--book-height": `${112 + (seed % 22)}px` } as CSSProperties}
    >
      <span className="shelf-cover-fallback">
        <span>{entry.title}</span>
        <small>{entry.creator || "Unknown author"}</small>
      </span>
      <span className="shelf-book-edge" aria-hidden="true" />
      {entry.status === "Reading" && (
        <span className="spine-bookmark" aria-hidden="true" />
      )}
    </span>
  );
}

function PlacedObject({
  decor,
  onEdit,
  onRemove,
}: {
  decor: PlacedDecor;
  onEdit: (id: string, changes: Partial<PlacedDecor>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(decor.label || decor.kind);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `decor-${decor.id}`, data: { decor } });
  return (
    <div
      ref={setNodeRef}
      className={`placed-object decor-${decor.kind}${isDragging ? " is-dragging" : ""}`}
      data-decor-id={decor.id}
      style={{
        left: `${decor.x}%`,
        transform: [CSS.Transform.toString(transform), "translateX(-50%)"]
          .filter(Boolean)
          .join(" "),
      }}
    >
      <button
        {...listeners}
        {...attributes}
        className="decor-move"
        aria-label={`Move ${decor.kind}`}
      >
        <ShelfObject kind={decor.kind} src={decor.src} />
      </button>
      <button
        type="button"
        className="decor-edit"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setLabel(decor.label || decor.kind);
          setEditing(true);
        }}
        aria-label={`Edit ${decor.label || decor.kind}`}
      >
        Edit
      </button>
      <button
        type="button"
        className="decor-remove"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${decor.kind}`}
      >
        <Trash2 size={13} />
      </button>
      {editing && (
        <form
          className="decor-edit-popover"
          onPointerDown={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            onEdit(decor.id, { label: label.trim() || decor.kind });
            setEditing(false);
          }}
        >
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            aria-label="Decoration label"
            maxLength={80}
          />
          <button type="submit">Save</button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

function ShelfObject({ kind, src }: { kind: DecorKind; src?: string }) {
  if (src) {
    return (
      <img
        className={`shelf-object shelf-object-${kind}`}
        src={src}
        alt=""
        draggable={false}
      />
    );
  }
  return (
    <span className={`shelf-object shelf-object-${kind}`} aria-hidden="true">
      <span className="object-detail object-detail-one" />
      <span className="object-detail object-detail-two" />
      <span className="object-detail object-detail-three" />
    </span>
  );
}
function DragPreview({
  id,
  entries,
  decor,
  custom,
}: {
  id: string;
  entries: Map<string, Entry>;
  decor: PlacedDecor[];
  custom: CustomDecor[];
}) {
  const entry = entries.get(id);
  if (entry)
    return (
      <div className="shelf-book drag-book-preview">
        <BookArt entry={entry} />
      </div>
    );
  const kind = (decor.find((item) => `decor-${item.id}` === id)?.kind ||
    id.replace("palette-", "")) as DecorKind;
  const src = id.startsWith("palette-custom-")
    ? custom.find((item) => `palette-custom-${item.id}` === id)?.src
    : decor.find((item) => `decor-${item.id}` === id)?.src;
  return <ShelfObject kind={kind} src={src} />;
}

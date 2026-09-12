import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Access } from "../components/AuthGate";
import type { Draft, Entry, RoomSnapshot, Uploads } from "./model";

interface RoomContextValue extends Access, RoomSnapshot {
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  save: (draft: Draft, uploads: Uploads, existing?: Entry) => Promise<Entry>;
  remove: (entry: Entry) => Promise<void>;
}
const RoomContext = createContext<RoomContextValue | null>(null);
export function RoomProvider({
  access,
  children,
}: {
  access: Access;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>({
    entries: [],
    events: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const serial = useRef(0);
  const reload = useCallback(async () => {
    const request = ++serial.current;
    try {
      const data = await access.store.load();
      if (request === serial.current) {
        setSnapshot(data);
        setError("");
      }
    } catch {
      if (request === serial.current)
        setError(
          "Could not load your room. Your saved items have not been changed.",
        );
    } finally {
      if (request === serial.current) setLoading(false);
    }
  }, [access.store]);
  useEffect(() => {
    void reload();
    const stop = access.store.subscribe(() => {
      void reload();
    });
    return () => {
      ++serial.current;
      stop();
    };
  }, [reload, access.store]);
  return (
    <RoomContext.Provider
      value={{
        ...access,
        ...snapshot,
        loading,
        error,
        reload,
        save: async (draft, uploads, existing) => {
          const item = await access.store.save(draft, uploads, existing);
          await reload();
          return item;
        },
        remove: async (entry) => {
          await access.store.remove(entry);
          await reload();
        },
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}
export function useRoom() {
  const room = useContext(RoomContext);
  if (!room) throw new Error("RoomProvider is required");
  return room;
}

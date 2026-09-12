import type { Entry, Kind } from "../../lib/model";
export interface SectionActions {
  onAdd: (kind: Kind) => void;
  onEdit: (entry: Entry) => void;
}

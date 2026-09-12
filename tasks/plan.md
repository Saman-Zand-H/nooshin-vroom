# Physical bookshelf implementation plan

## Goal

Replace the generic three-rail library with a persisted digital twin of the photographed walnut cubby shelf. Keep real room entries as editable books, support vertical books, horizontal stacks, and shelf objects, and store layout in Django/PostgreSQL so another device sees the same arrangement.

## Slices

1. **Persistent layout contract**
   - Add shelf cubby, order, orientation, and stack fields to `RoomEntry`.
   - Add a `ShelfDecoration` model for catalog and uploaded objects.
   - Add authenticated GET/PATCH Django Ninja endpoints with validation and optimistic revision handling.
   - Seed representative physical-shelf book records only where the room has no matching entry identity.

2. **Frontend layout adapter**
   - Add typed Django store methods for shelf layout.
   - Load the server layout on bookshelf mount and save changes after drag/orientation/decor edits.
   - Keep local IndexedDB preview as a documented fallback only for `VITE_LOCAL_PREVIEW=true`.

3. **Physical cubby renderer**
   - Render the photographed irregular five-level walnut cubby proportions and recessed dividers.
   - Place server books and decorations in cubby slots, with horizontal stack geometry and drag/drop constrained to valid cubbies.
   - Preserve mobile swipe tracks and accessible click/edit controls.

4. **Verification**
   - API tests for authorization, validation, optimistic conflicts, and persistence.
   - Browser checks for cubby rendering, book creation/editing, horizontal stacks, decoration placement, cross-row drag, reload, and 390px layout.
   - Rebuild Docker services and confirm health.

## Open data boundary

The photographs show many titles whose text is not fully legible. Seeded records will use only readable/clearly identified titles; ambiguous physical items remain available as manually addable books instead of being falsely named. The shelf geometry and object placement are deterministic and persisted.

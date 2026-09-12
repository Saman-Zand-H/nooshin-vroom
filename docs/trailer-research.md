# Control Room trailer research

Date: 2026-09-05
Scope: one-time, mobile-first teaser for the private Control Room app. The user wants a few swipeable pages that feel personal and exciting, without turning into a generic wellness page or a couple's anniversary card.

## Primary examples

These are first-party experiences or first-party project pages. They are references for interaction patterns, not templates to copy.

| Reference | What to study | Transferable pattern |
| --- | --- | --- |
| [The Wilderness Downtown](https://www.thewildernessdowntown.com/) (Arcade Fire) | A music experience that turns a visitor's input into a cinematic, multi-window journey. | Ask for one small input, then make the result feel authored for that person. For Control Room, the input can be a tap/swipe choice such as `ENTER`, `ARCHIVE`, or a mode; do not ask for personal data. |
| [Take This Lollipop](https://www.takethislollipop.com/) | A short, suspenseful, personalized browser film. | Create anticipation with a clear beginning, escalating reveals, and a short payoff. Keep the trailer under a few minutes and make each screen advance the reveal. |
| [Bear 71](https://www.nfb.ca/interactive/bear-71/) (National Film Board of Canada) | First-person interactive documentary using map, story, and ambient interface layers. | Give the interface a world model: archive/map/signal layers can make mock dashboard screenshots feel like an actual Control Room system. |
| [The Boat](https://www.sbs.com.au/theboat/) (SBS) | Interactive graphic narrative that reveals a story through movement, sound, and sequential scenes. | Use horizontal scene progression, restrained motion, and short lines of copy. Each swipe should change the scene, not merely paginate text. |
| [Snow Fall](https://www.nytimes.com/projects/2012/snow-fall/) (The New York Times) | Longform visual story with full-screen chapters, typography, photography, and scroll-triggered transitions. | Treat each screen as a composed chapter: one headline, one visual anchor, one action. Preserve a visible progress cue. |
| [Chrome Experiments](https://experiments.withgoogle.com/collection/chrome) | Collection of small browser experiments built around a single interaction idea. | Pick one signature interaction for the trailer (swipe, hold, orbit, or unlock) and repeat it consistently instead of adding many mini-games. |

## Strong concept for this project

Make the one-time piece a **launch trailer / transmission from the Control Room**, not a separate gift app. It should preview the world she will later use.

Suggested 7-screen flow:

1. **Boot** — `CONTROL ROOM // INCOMING TRANSMISSION`; one tap starts; no autoplay audio.
2. **Signal** — a short line that establishes the site as *her* private archive, e.g. `A place for the things worth keeping.`
3. **Taste graph** — animate connections between music, books, films, games, and moods. Use her real interests as labels; keep copy observational rather than romantic.
4. **Modes** — swipe through three atmospheres (for example `VILLAIN`, `HEAVEN`, `CHAOS`) with different color/texture treatments. Present them as aesthetic control states, not diagnoses.
5. **Archive preview** — one song card, one book/audiobook card, one film/game card. Let her tap one card to flip/reveal a short personal note.
6. **Request channel** — preview the violin request board as a “send a request / receive a performance” signal. Use a fake sample request, clearly marked as preview data.
7. **Unlock** — `THE CONTROL ROOM IS READY`; one final button enters the dashboard. Optional small line from the maker, warm but not a relationship-performance demand.

## Interaction and copy rules

- 5–8 screens, 30–90 seconds. Every swipe changes a visual or reveals a fact.
- Mobile-first: full-screen panels, large tap targets, one-handed swipe fallback with next/previous buttons.
- Keep a progress marker (`01 / 07`) and a skip/enter affordance so the trailer never traps her.
- Use real details she recognizes (artists, books, modes, game/Marvel/GoT energy), but avoid exposing private or embarrassing information.
- Use sound only after an explicit tap; provide mute control and make the trailer complete without audio.
- End with a usable transition into the actual app. Avoid a dead-end “hope you feel better” message.
- One hidden motif can reward attention; do not make it the premise or repeat it on every screen.

## Evidence limits

The links above were checked as first-party destinations where reachable from this environment. Some older interactive projects redirect or require JavaScript; interaction descriptions are based on the projects' established first-party presentation and should be rechecked in a browser before copying implementation details.

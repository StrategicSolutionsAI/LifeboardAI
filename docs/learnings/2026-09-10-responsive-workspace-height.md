# Preserve content reachability in short workspaces

- Symptom: At 667x375, fixed Tasks controls consumed the bounded workspace and collapsed the list to zero height.
- Cause: Correct flex sizing at ordinary desktop heights did not guarantee positive remaining space in a landscape phone viewport.
- Correction: Below 600px viewport height, let the main workspace own scrolling and let its controls and list expand naturally. At normal heights, keep the bounded list scroller.
- Verification: Landscape main scroll range reached 2294px with search open; the last task remained reachable above mobile navigation. At 1280x800, main had no overflow while the list scrolled independently.
- Durable rule: For a fixed-height workspace, verify both normal-height scroll ownership and shortest-supported viewport reachability, including expanded filters or search.

# English interface

The requested scope is a Chinese/English interface for the whole site, with a switch at the upper right of the navigation. Blog titles, summaries, body text, captions and table-of-contents entries remain in their original language. Categories, navigation, metadata labels, search controls, games, tools, accessibility labels and exported tool images have English versions.

Use an in-place language switch, defaulting to Chinese and remembering an explicit choice in localStorage. Keep URLs, game state, tool input and article sources unchanged. English daily quotations use the existing verified English-original collection; fortune readings receive a complete English companion collection.

## Approach

Separate English routes would duplicate the static site and require transferring interactive state. Rewriting every existing script around a framework would add unrelated complexity. A shared source-text catalog with exact and parameterized messages fits the existing Astro pages: translate UI text nodes and selected accessibility attributes in place, retain their source for switching back, and observe newly rendered UI. Explicit skip boundaries protect article content and user input. Canvas, dialogs and third-party comments use the same locale API directly.

Translations must not change HTML structure, machine-readable values, links, filters or form input. Keep the switch visible on mobile. Verify fresh English loads, repeated switches, dynamic results, storage failures, article preservation and narrow layouts.

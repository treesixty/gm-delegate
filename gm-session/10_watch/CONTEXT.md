# 10_watch, entity link

**Auto stage. No human review.** A wrong link costs a few tokens into a drawer nobody
opens. Its output is context for the next stage, never something a player sees.

## Input

A window handed to you: the last ~30 seconds of table activity, or everything since the
last Foundry state change, whichever is shorter. Plus current Foundry state (selected
token, active scene, combat on/off, recent rolls).

## Process

Decide which SINGLE catalog document this window is about, if any. The candidate set is
closed: the files under `_npcs/`, `_characters/`, `_world/locations/`. This is entity
linking against a known list, not open-ended "is this relevant."

**Foundry state is the strong prior.** A selected innkeeper token plus a window that
mentions the inn is a near-certain link. Table chatter about someone's job matches nothing
in the catalog and links to nothing. That is correct; let it fall out.

## Output, `10_watch/out/window.md`

```
link: _npcs/innkeeper.md # or: none
confidence: high | low
why: one line
foundry: selected=Actor.xxx, scene=..., combat=false
```

If `link: none`, downstream stages do not run. That is the common case and it is free.

## Validation (the script, not you)

`validate.py` checks that `link` is either `none` or a path to a file that actually
exists. A link to a nonexistent file fails and the moment is dropped. You never need to
verify file existence yourself; produce your best link and let the script fence it.

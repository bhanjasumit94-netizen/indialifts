---
name: Referee disconnect must stop presence and validate sessions
description: Why ending referee sessions must clear realtime presence and why the referee page must continuously validate the session node.
---

The admin "End Sessions" button must make every connected referee device appear
Offline and any open referee page transition to a session-expired screen. There
are two independent data paths involved:

1. **Session validity** (`referee_sessions/{cid}/{sid}`). The QR link carries the
session id. The referee page must watch this node in real time; when it is
removed, marked `is_active: false`, or expires, the page must immediately treat
itself as invalid and stop functioning.

2. **Presence** (`referee_presence/{cid}/{deviceId}`). The admin "Connected / Offline"
UI is driven by this node, not by the session node. The device writes its own
presence while the page is valid. Ending sessions therefore has to explicitly
remove the whole `referee_presence/{cid}` node (and `referee_devices/{cid}` for
consistency); otherwise the device stays "Connected" until its browser tab is
closed or the `onDisconnect` fires.

**Why:** originally the session hook only read the URL and never re-checked the
session record, and `endRefereeSessions` only invalidated the session record and
cleared signals. The device kept writing presence and the admin UI kept reading
it, so devices remained Connected even though the QR session was technically
dead.

**How to apply:** any change to referee session lifecycle must keep three things
in sync: (a) the session record, (b) the presence/device record, and (c) the
referee page's continuous validation of (a) and its decision to stop tracking
(b) when (a) becomes invalid.

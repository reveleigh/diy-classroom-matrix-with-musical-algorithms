# LED Matrix Project

A 24x20 classroom audio-visual sorting display built to teach Computer Science concepts.

## Hardware

- **Display:** 480 LED matrix (24x20), 12V WS2815 strips, 33.33mm pitch
- **Controller:** Raspberry Pi Zero 2 W + IQAudio DigiAmp+ HAT
- **Level Shifter:** 74AHCT125 (GPIO 10 → 5V)
- **Power:** Tiger Power 12V 10A → WAGO connectors → LED strips + DigiAmp+
- **Safety:** 10A blade fuse + 2200µF capacitor

## Power Injection

- Pixel #120 (Row 5, 25%) and Pixel #360 (Row 15, 75%)
- Single continuous 12V rail

## Audio

- Dayton Audio DAEX30HESF-4 40W Exciter
- Plywood chassis acts as soundboard

## Software Modes

1. **Sorting Visualisation** — Bubble, Selection, Insertion, Merge, Quick, Radix, Bogo, and Cocktail sort. Supports starting state presets (Shuffle, Reverse, Nearly Sorted), interactive baseline-aligned equalizer sliders, and a direct CSV editor, plus global settings (delay, sound toggle, volume) and a spoken performance summary at completion (e.g. *"Data sorted requiring [X] comparisons"*).
2. **Pathfinding Visualisation** — Dijkstra, A* (Manhattan heuristic), Breadth-First Search (BFS), and Depth-First Search (DFS) on an interactive 20 × 24 grid with wall drawing and movable start/target nodes.
3. **Songs & Audio Visualisation** — Dedicated songs player (supporting MP3 and WAV) with folder listener auto-sync on boot (no code changes needed to add new tracks), global controls, and a varied 5-phase visual sequence cycle (equalizer columns, ripple rings, double sine waves, stardust rainfall, and rainbow scrolls).
4. **Search Algorithms** — Linear Search and Binary Search with support for sorted, unsorted, best case, average case, and worst case target selection.
5. **Auralisation** — Maps array values to logarithmic frequencies/tones.
6. **Image Processing** — OpenCV-based downsampling (`cv2.INTER_AREA`) to display live web-camera feeds or static assets on the 24 × 20 grid.

## Reference

https://panthema.net/2013/sound-of-sorting/
## Physical UI / Hardware Buttons

The matrix includes a 3-button physical interface for screen-free control. They are wired using pull-up logic to **GPIO 17, 27, and 23**. 

### Menu System Architecture
The buttons drive a `HardwareStateMachine` that handles menu navigation, visual feedback (glyphs and text rendering), audio narration, and executing the actual algorithms. 

The menu flow is optimized for speed:
1. **Button 1 (Navigate/Dive):** Short press loops options (e.g. SORTS → PATHS → SEARCHES). Long press dives into a sub-menu.
2. **Button 2 (Execute/Back):** Short press immediately executes the selected action. Long press goes back a tier or cancels.
3. **Button 3 (Timer):** Dedicated shortcut to instantly start classroom timers.

The UX is designed to be highly responsive. Lower tiers (like Tier 1 and 2) hold persistent visual "Glyphs" on the matrix while audio reads out the options. Deeper tiers (Tier 3) actively generate randomized previews of arrays and pass that *exact* cached data to the executor to ensure a 1:1 match between the preview and the real execution. Pathfinding skips Tier 3 entirely, opting to generate and preview random mazes directly in Tier 2 for faster interaction.

### Hardware & Software Challenges Overcome
Connecting the physical GPIO buttons to the web-first, threaded architecture presented a number of interesting technical challenges:
- **Audio/ALSA Deadlocks**: Initially, Pygame was configured with aggressively small audio buffers (`pre_init(1024)`) to reduce audio latency when pressing buttons. However, on the Pi Zero, this starved the ALSA audio driver, causing a complete kernel-level deadlock that froze the Python threads (blocking the buttons from responding) and required hard process kills. Returning to standard buffer sizes resolved this while maintaining perceived instant playback.
- **Garbage Collected GPIO Pins**: The `gpiozero.Button` instances were originally created inside a local setup function. When the setup function finished, Python's Garbage Collector silently destroyed the button instances, tearing down the hardware event hooks. This caused the buttons to mysteriously stop working after a few presses while the Web UI remained perfectly functional. Storing persistent references to the buttons inside the state machine permanently resolved this.
- **Preview vs. Execution Desync**: Originally, generating an array preview for the matrix and then starting the sort resulted in two different randomized arrays. We restructured the state machine to cache the generated preview data and inherit it upon execution, ensuring visual consistency.
- **Offline Resilience & Network Watchdogs**: In a classroom environment, WiFi is notoriously unreliable (e.g. captive portals, dropped hotspots). Initially, a failed network connection on boot would crash the entire script, bricking the physical hardware buttons. We decoupled the architecture by initializing the hardware buttons *before* attempting any cloud connections, allowing the matrix to boot instantly into an offline-ready state. Meanwhile, a custom OS-level systemd daemon (`wifi-watchdog.service`) forcefully wakes up Linux's NetworkManager to actively hunt for hotspots if the connection drops, ensuring seamless recovery. We also added logic to limit diagnostic connection flashing to 3 attempts, preventing the matrix from behaving like a strobe light when aggressively background-reconnecting on unstable networks.


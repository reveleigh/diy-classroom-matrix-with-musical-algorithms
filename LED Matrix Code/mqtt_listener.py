import os
import sys
import time
import json
import socket
import threading
import subprocess
from datetime import datetime
import algorithms
import hardware_buttons

# Module-level config so on_message callback can access it
config = {}
hw_state_machine = None

# Try importing pygame
try:
    import pygame
except ImportError:
    pass  # We don't strictly need pygame for this simple LED blink but let's keep it safe

# Try importing rpi_ws281x
try:
    from rpi_ws281x import Adafruit_NeoPixel, Color
except ImportError:
    print("Error: 'rpi_ws281x' library is not installed.")
    print("To install it on your Raspberry Pi Zero 2 W, run:")
    print("  sudo pip3 install rpi_ws281x --break-system-packages")
    sys.exit(1)

# Try importing paho-mqtt
try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("Error: 'paho-mqtt' library is not installed.")
    print("To install it on your Raspberry Pi Zero 2 W, run:")
    print("  sudo pip3 install paho-mqtt --break-system-packages")
    sys.exit(1)

# Threading control variables
active_thread = None
stop_event = threading.Event()
skip_forward_event = threading.Event()
skip_backward_event = threading.Event()
thread_lock = threading.Lock()
sound_list = []
current_mode = None
vis_mode_state = {"mode": "loop"}
rick_frames_cache = None

# Real-time state syncing
current_state = {
    "algo": None,
    "song_id": None,
    "is_paused": False
}

# This dumps our current matrix state into a local JSON file.
# It's quite handy for letting the web dashboard know what we're currently up to.
def write_state():
    """Writes the current playback state to a local JSON file for Next.js to read."""
    try:
        with open("/tmp/led_matrix_state.json", "w") as f:
            json.dump(current_state, f)
    except Exception as e:
        print(f"Failed to write state: {e}")

# We load all our audio files into the Pygame mixers ahead of time here.
# This stops any annoying lag when we want sounds to trigger instantly.
def load_sounds():
    """Loads all 24 WAV files into a global sound list."""
    global sound_list
    possible_paths = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "sounds"),
        "sounds",
        os.path.expanduser("~/sounds"),
        os.path.expanduser("~/LED-Matrix-Code/sounds"),
        os.path.expanduser("~/LED-Matrix/sounds"),
        "/home/<YOUR_USERNAME>/LED-Matrix/sounds",
        "/home/<YOUR_USERNAME>/sounds"
    ]
    
    sound_dir = None
    for p in possible_paths:
        if os.path.exists(p) and os.path.isdir(p):
            sound_dir = p
            break
            
    if not sound_dir:
        print("Warning: 'sounds' folder not found. Audio will be disabled.")
        return
        
    print(f"Loading sounds from: {sound_dir}")
    try:
        import pygame
        pygame.mixer.pre_init(44100, -16, 1, 1024) # 1024 buffer to prevent ALSA underruns on Pi Zero
        pygame.init()
        pygame.mixer.set_num_channels(16)
        
        for i in range(24):
            file_path = os.path.join(sound_dir, f"{i}.wav")
            if os.path.exists(file_path):
                sound_list.append(pygame.mixer.Sound(file_path))
            else:
                print(f"Warning: Missing sound file {file_path}")
        print(f"Loaded {len(sound_list)} sounds successfully.")
        
        # Preload Rickroll assets for instant playback
        rick_mp3 = os.path.join(sound_dir, "rick.mp3")
        if os.path.exists(rick_mp3):
            algorithms._sound_cache["rick.mp3"] = pygame.mixer.Sound(rick_mp3)
            print("Preloaded rick.mp3 into sound cache.")
            
        rick_json = os.path.join(sound_dir, "rick_frames.json")
        if os.path.exists(rick_json):
            with open(rick_json, 'r') as f:
                global rick_frames_cache
                rick_frames_cache = json.load(f)
            print("Preloaded rick_frames.json into memory.")
            
    except Exception as e:
        print(f"Warning: Failed to initialize Pygame audio: {e}")

# This little helper plays our spoken audio files at whatever volume we need.
# It sorts out grabbing a free audio channel and actually playing the clip.
def play_narration(filename, volume):
    """
    Finds and plays a narration WAV file from the sounds folder using pygame.
    """
    try:
        import pygame
        possible_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "sounds"),
            "sounds",
            os.path.expanduser("~/sounds"),
            os.path.expanduser("~/LED-Matrix-Code/sounds"),
            os.path.expanduser("~/LED-Matrix/sounds"),
            "/home/<YOUR_USERNAME>/LED-Matrix/sounds",
            "/home/<YOUR_USERNAME>/sounds"
        ]
        for p in possible_paths:
            file_path = os.path.join(p, filename)
            if os.path.exists(file_path):
                sound = pygame.mixer.Sound(file_path)
                sound.set_volume(volume)
                sound.play()
                return sound
    except Exception as e:
        print(f"Warning: Could not play narration {filename}: {e}")
    return None

# LED Matrix Configuration Constants (fallback if config.json fails)
LED_COUNT      = 480      # Total number of LEDs (20 columns x 24 rows)
LED_PIN        = 10       # GPIO 10 (SPI MOSI, Physical Pin 19)
LED_FREQ_HZ    = 800000   # LED signal frequency in hertz (usually 800khz)
LED_DMA        = 10       # DMA channel to use for generating signal
LED_INVERT     = False    # Do not invert (using 74AHCT125 logic level shifter)
LED_CHANNEL    = 0        # set to '0' when using SPI MOSI

# Matrix Dimensions
COLS = 20
ROWS = 24

# Precalculated Gamma 2.5 Lookup Table for image rendering color accuracy
GAMMA = 2.5
GAMMA_LUT = [int(pow(i / 255.0, GAMMA) * 255.0 + 0.5) for i in range(256)]

# Color mappings for different buttons/algorithms in HTTP/MQTT requests
ALGO_COLORS = {
    "bubble": Color(0, 0, 255),      # Blue
    "selection": Color(0, 255, 0),   # Green
    "insertion": Color(255, 0, 0),   # Red
    "merge": Color(255, 255, 0),     # Yellow
    "quick": Color(0, 255, 255),     # Cyan
    "heap": Color(255, 0, 255),      # Magenta
    "shell": Color(255, 127, 0),     # Orange
    "bogo": Color(255, 255, 255),    # White
}

# This translates standard 2D (x, y) coordinates into a flat 1D strip index.
# We absolutely need this to account for the physical zig-zag wiring of the matrix.
def xy_to_index(x, y):
    """Translates a 2D grid coordinate (X, Y) to the 1D physical LED strip index."""
    if not (0 <= x < COLS) or not (0 <= y < ROWS):
        return None
    y_from_bottom = (ROWS - 1) - y
    if y_from_bottom % 2 == 0:
        return y_from_bottom * COLS + x
    else:
        return y_from_bottom * COLS + (COLS - 1 - x)

# This does exactly what it says on the tin: instantly turns off all LEDs.
# It gives us a completely blank canvas to start drawing on again.
def clear_matrix(strip):
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, Color(0, 0, 0))
    strip.show()

# Here we push the latest game status straight to our Next.js backend API.
# This keeps the remote web dashboard perfectly in sync with the hardware.
def update_game_status(status):
    nextjs_url = config.get("nextjs_api_url", "")
    api_key = config.get("matrix_api_key", "")
    if not nextjs_url:
        return
    game_url = nextjs_url.replace("/songs", "/game-status")
    try:
        import urllib.request
        import json
        req = urllib.request.Request(
            game_url,
            data=json.dumps({"status": status}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-API-Key": api_key
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            print(f"Updated game status in DB to: {status} (HTTP {res.status})")
    except Exception as e:
        print(f"Failed to update game status in DB to {status}: {e}")

# Flashes the top row of LEDs in a specific colour.
# It's brilliant for giving a quick visual nudge or alert without disrupting everything.
def blink_top_row(strip, color, blinks=3, duration_sec=0.2):
    """Blinks the top row of the LED matrix (Y=0) a specific color."""
    for _ in range(blinks):
        # Turn top row ON
        for x in range(COLS):
            idx = xy_to_index(x, 0)
            if idx is not None:
                strip.setPixelColor(idx, color)
        strip.show()
        time.sleep(duration_sec)
        
        # Turn top row OFF
        for x in range(COLS):
            idx = xy_to_index(x, 0)
            if idx is not None:
                strip.setPixelColor(idx, Color(0, 0, 0))
        strip.show()
        time.sleep(duration_sec)

# Track how many times we've connected to prevent endless green flashing on unstable networks
connection_success_count = 0

# This callback fires as soon as we successfully hook into the Mosquitto broker.
# It automatically subscribes the client to all the control topics we care about.
def on_connect(client, strip, flags, rc):
    global connection_success_count
    """Callback when client connects to the broker."""
    if rc == 0:
        connection_success_count += 1
        print(f"Successfully connected to Mosquitto MQTT Broker! (Connection #{connection_success_count})")
        # Subscribe to the control topic
        topic = client._userdata_dict.get("topic", "classroom/matrix/control")
        client.subscribe(topic)
        print(f"Subscribed to topic: {topic}")
        # Blink top row Green to signal connection success, but go silent after 3 connects
        if connection_success_count <= 3:
            blink_top_row(strip, Color(0, 255, 0), blinks=2, duration_sec=0.1)
    else:
        print(f"Failed to connect, return code: {rc}")
        # Blink top row Red to signal connection failure
        if connection_success_count <= 3:
            blink_top_row(strip, Color(255, 0, 0), blinks=3, duration_sec=0.1)

# This is the main brain for dealing with incoming MQTT JSON payloads.
# It parses the commands and routes them off to the right algorithm or system state.
def process_payload(strip, data):
    global active_thread, stop_event, skip_forward_event, skip_backward_event, current_mode, hw_state_machine

    try:
        # Reset the hardware button inactivity timer when receiving any web command
        if hw_state_machine:
            hw_state_machine.register_interaction()

        if data.get("algo") == "simulate_button":
            if hw_state_machine:
                hw_state_machine.simulate_button(data.get("btn"), data.get("type"))
            return
        
        algo = data.get("algo", "").lower()
        
        if not algo:
            print("Warning: Key 'algo' was missing or empty in payload.")
            return

        # Extract parameters with safe fallbacks
        speed = float(data.get("speed", 0.1))
        sound_enabled = bool(data.get("sound", True))
        volume = float(data.get("volume", 0.25))
        brightness_val = data.get("brightness", None)
        type_val = data.get("type", None)
        custom_array = data.get("array", None)
        target_val = data.get("target", None)
        
        # Clip parameters to valid ranges
        speed = max(0.005, min(2.0, speed))
        volume = max(0.0, min(1.0, volume))

        # Read the visualization mode (for both starting new and live updates)
        vis_mode = data.get("vis_mode")
        if vis_mode is not None:
            vis_mode_state["mode"] = str(vis_mode)
        
        artwork_pixels = data.get("artwork_pixels")
        if artwork_pixels is not None:
            vis_mode_state["artwork_pixels"] = artwork_pixels

        # Short-circuit if this is just updating the visualizer mode live
        if algo == "set_vis_mode":
            print(f"Updated live visualization mode to: {vis_mode_state['mode']}")
            return
        
        # Apply brightness dynamically on the fly
        if brightness_val is not None:
            try:
                b_int = max(0, min(255, int(brightness_val)))
                strip.setBrightness(b_int)
                strip.show()
                print(f"Dynamically updated strip brightness to: {b_int}/255")
            except Exception as e:
                print(f"Error dynamically setting brightness: {e}")

        # Short-circuit if this is a standalone brightness control command
        if algo == "brightness":
            return

        # Short-circuit for audio feedback without stopping active visualizers
        if algo == "math_feedback":
            sound_file = data.get("sound_file", "ding.wav")
            if sound_enabled:
                algorithms.play_sound_by_name(sound_file, volume=volume)
                print(f"Played math feedback sound: {sound_file} at volume {volume}")
            return

        # Short-circuit if this is a static layout update for sorting
        if type_val == "update" and algo in ["bubble", "insertion", "merge", "quick", "selection", "radix", "bogo", "cocktail"]:
            if custom_array:
                # Stop any active visualization thread before updating static layout
                with thread_lock:
                    if active_thread is not None and active_thread.is_alive():
                        stop_event.set()
                        active_thread.join()
                algorithms.draw_array(strip, custom_array)
            return

        # Short-circuit if this is a live volume adjustment
        if algo == "volume":
            new_vol = float(data.get("volume", 0.25))
            new_vol = max(0.0, min(1.0, new_vol))
            try:
                import pygame
                if pygame.mixer.get_init():
                    pygame.mixer.music.set_volume(new_vol)
                    print(f"Updated live music playback volume to {new_vol}")
            except Exception as vol_err:
                print(f"Error updating live volume: {vol_err}")
            return

        # Short-circuit if this is a live music pause
        if algo == "pause":
            try:
                import pygame
                if pygame.mixer.get_init():
                    pygame.mixer.music.pause()
                    stop_event.is_paused = True
                    current_state["is_paused"] = True
                    write_state()
                    print("Paused music and visualizer.")
            except Exception as pause_err:
                print(f"Error pausing: {pause_err}")
            return

        if algo == "next":
            skip_forward_event.set()
            stop_event.set()
            print("Skipping to next track.")
            return

        if algo == "prev":
            skip_backward_event.set()
            stop_event.set()
            print("Skipping to previous track.")
            return

        # Short-circuit if this is a live music resume
        if algo == "resume":
            try:
                import pygame
                import time
                if pygame.mixer.get_init():
                    pygame.mixer.music.unpause()
                    time.sleep(0.1) # Give SDL audio buffer time to report get_busy() = True
                    stop_event.is_paused = False
                    current_state["is_paused"] = False
                    write_state()
                    print("Resumed music and visualizer.")
            except Exception as resume_err:
                print(f"Error resuming: {resume_err}")
            return

        print(f"Dispatching Command: {algo} | Speed: {speed}s | Sound: {sound_enabled} | Volume: {volume}")

        # Stop any currently running visualization thread safely
        with thread_lock:
            # We must stop the active thread if it's alive, even if it's the same algorithm restarted
            if active_thread is not None and active_thread.is_alive():
                print(f"Stopping active visualization thread (mode change/restart from {current_mode} to {algo})...")
                stop_event.set()
                active_thread.join()
                print("Visualization thread stopped.")
            
            # Reset stop event for the new run
            stop_event.clear()
            stop_event.is_paused = False

            # Reset current state
            current_state["algo"] = None
            current_state["song_id"] = None
            current_state["is_paused"] = False
            write_state()

            # Stop music, clear matrix, and restart narration if changing modes or restarting a visualization
            # Do NOT stop background music when transitioning between math modes (math_start, math_question, math_help, math_feedback)
            math_modes = ["math_start", "math_question", "math_help", "math_feedback"]
            is_math_transition = (algo in math_modes) and (current_mode in math_modes)
            is_update = data.get("type") == "update"

            if (algo != current_mode or (algo in ["bubble", "insertion", "merge", "quick", "selection", "radix", "bogo", "cocktail", "lifegoeson", "song", "navidrome", "math_start", "text", "time", "countdown", "math_question", "math_help", "pathfinding", "glyph", "clear", "linear_search", "binary_search"] and not is_update)) and not is_math_transition:
                # Explicitly stop music playback if active
                try:
                    import pygame
                    if pygame.mixer.get_init():
                        pygame.mixer.stop()  # Stops all Sound objects
                        pygame.mixer.music.stop()
                        if hasattr(pygame.mixer.music, 'unload'):
                            pygame.mixer.music.unload()
                except Exception:
                    pass
                
                # Transitioning between math modes should not clear the border to avoid flashing
                if current_mode in ["math_question", "math_help"] and algo in ["math_question", "math_help"]:
                    pass
                else:
                    clear_matrix(strip)
                
                # Play narration before starting the sort visualization
                
            delay_before_start = 0
            if sound_enabled and algo in ["bubble", "insertion", "merge", "quick", "selection", "radix", "bogo", "cocktail", "linear_search", "binary_search"]:
                if algo == "linear_search":
                    narration_file = "linear search.wav"
                elif algo == "binary_search":
                    narration_file = "binary search.wav"
                else:
                    narration_file = f"{algo}.wav"
                snd = play_narration(narration_file, volume)
                if snd and algo in ["linear_search", "binary_search"]:
                    delay_before_start = snd.get_length()
            
            # Switch algorithm
            if algo == "linear_search":
                active_thread = threading.Thread(
                    target=algorithms.linear_search_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array, "target": target_val, "delay_before_start": delay_before_start},
                    daemon=True
                )
                active_thread.start()
                print("Started Linear Search visualization thread.")
            elif algo == "binary_search":
                active_thread = threading.Thread(
                    target=algorithms.binary_search_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array, "target": target_val, "delay_before_start": delay_before_start},
                    daemon=True
                )
                active_thread.start()
                print("Started Binary Search visualization thread.")
            elif algo == "bubble":
                active_thread = threading.Thread(
                    target=algorithms.bubble_sort_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array},
                    daemon=True
                )
                active_thread.start()
                print("Started Bubble Sort visualization thread.")
            elif algo == "cocktail":
                active_thread = threading.Thread(
                    target=algorithms.cocktail_sort_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array},
                    daemon=True
                )
                active_thread.start()
                print("Started Cocktail Sort visualization thread.")
            elif algo == "bogo":
                active_thread = threading.Thread(
                    target=algorithms.bogo_sort_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array},
                    daemon=True
                )
                active_thread.start()
                print("Started Bogo Sort visualization thread.")
            elif algo == "selection":
                active_thread = threading.Thread(
                    target=algorithms.selection_sort_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array},
                    daemon=True
                )
                active_thread.start()
                print("Started Selection Sort visualization thread.")
            elif algo == "insertion":
                active_thread = threading.Thread(
                    target=algorithms.insertion_sort_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array},
                    daemon=True
                )
                active_thread.start()
                print("Started Insertion Sort visualization thread.")
            elif algo == "merge":
                active_thread = threading.Thread(
                    target=algorithms.merge_sort_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array},
                    daemon=True
                )
                active_thread.start()
                print("Started Merge Sort visualization thread.")
            elif algo == "quick":
                active_thread = threading.Thread(
                    target=algorithms.quick_sort_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array},
                    daemon=True
                )
                active_thread.start()
                print("Started Quick Sort visualization thread.")
            elif algo == "radix":
                active_thread = threading.Thread(
                    target=algorithms.radix_sort_visualize,
                    args=(strip, sound_list, speed, sound_enabled, volume, stop_event),
                    kwargs={"arr": custom_array},
                    daemon=True
                )
                active_thread.start()
                print("Started Radix Sort visualization thread.")
            elif algo == "lifegoeson":
                active_thread = threading.Thread(
                    target=algorithms.life_goes_on_visualize,
                    args=(strip, speed, volume, stop_event),
                    daemon=True
                )
                active_thread.start()
                print("Started Life Goes On song playback thread.")
            elif algo == "song":
                song_file = str(data.get("sound_file", "life-goes-on.wav"))
                active_thread = threading.Thread(
                    target=algorithms.play_song_visualize,
                    args=(strip, song_file, speed, volume, stop_event, vis_mode_state),
                    daemon=True
                )
                active_thread.start()
                print(f"Started song playback thread for: {song_file}")
            elif algo == "navidrome":
                song_ids = data.get("song_ids", [])
                if not song_ids:
                    single_id = str(data.get("song_id", ""))
                    if single_id:
                        song_ids = [single_id]
                
                if not song_ids:
                    print("Navidrome: missing song_ids or song_id, ignoring command.")
                else:
                    # A background thread to fetch and play our music streams from Navidrome.
                    # It handles the audio whilst the main thread gets on with the visual syncing.
                    def _play_navidrome_playlist(s_ids, volume, stop_ev, cfg, matrix_strip, spd):
                        import urllib.request
                        import tempfile
                        import hashlib
                        import random
                        import string
                        import urllib.parse
                        import os as _os

                        nav_url = cfg.get("navidrome_url", "")
                        nav_user = cfg.get("navidrome_user", "")
                        nav_pass = cfg.get("navidrome_pass", "")

                        if not nav_url or not nav_user or not nav_pass:
                            print("Navidrome: missing config (navidrome_url/user/pass). Check config.json.")
                            return

                        queue_idx = 0
                        while queue_idx < len(s_ids):
                            # Important: check if stop_ev is set AND no skip events are set.
                            # If a skip event is set, stop_ev will be set (to kill the previous song),
                            # but we shouldn't break the playlist loop here.
                            if stop_ev.is_set() and not (skip_forward_event.is_set() or skip_backward_event.is_set()):
                                print("Navidrome: playback stopped, exiting playlist loop.")
                                break
                            
                            sid = s_ids[queue_idx]
                            
                            # Write state so Next.js knows what track is playing
                            current_state["algo"] = "navidrome_album"
                            current_state["song_id"] = sid
                            current_state["is_paused"] = False
                            write_state()
                            
                            # Clear skip events before playing a new track
                            skip_forward_event.clear()
                            skip_backward_event.clear()
                            
                            # Build token auth (md5 method — same as Next.js)
                            salt = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
                            token = hashlib.md5((nav_pass + salt).encode()).hexdigest()

                            stream_url = (
                                f"{nav_url}/rest/stream.view"
                                f"?id={sid}"
                                f"&u={urllib.parse.quote(nav_user)}"
                                f"&t={token}&s={salt}"
                                f"&v=1.16.1&c=led-matrix"
                                f"&format=mp3&maxBitRate=128"
                            )

                            print(f"Navidrome: downloading song {sid} ...")
                            tmp_path = None
                            try:
                                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                                    tmp_path = tmp.name
                                    with urllib.request.urlopen(stream_url, timeout=30) as response:
                                        tmp.write(response.read())
                                print(f"Navidrome: download complete, playing {tmp_path}")
                                
                                # This function blocks until the song finishes playing or stop_ev is set
                                algorithms.play_song_visualize(matrix_strip, tmp_path, spd, volume, stop_ev, vis_mode_state)
                                
                            except Exception as e:
                                print(f"Navidrome: failed to download/play song {sid}: {e}")
                            finally:
                                if tmp_path:
                                    try:
                                        _os.unlink(tmp_path)
                                    except Exception:
                                        pass
                                        
                            # Check why we exited play_song_visualize
                            if stop_ev.is_set():
                                if skip_forward_event.is_set():
                                    print("Navidrome: skip forward requested.")
                                    stop_ev.clear()
                                    skip_forward_event.clear()
                                    queue_idx += 1
                                    continue
                                elif skip_backward_event.is_set():
                                    print("Navidrome: skip backward requested.")
                                    stop_ev.clear()
                                    skip_backward_event.clear()
                                    queue_idx = max(0, queue_idx - 1)
                                    continue
                                else:
                                    print("Navidrome: playback stopped via stop event, exiting playlist loop.")
                                    break
                                    
                            # Natural completion of the track
                            queue_idx += 1

                    active_thread = threading.Thread(
                        target=_play_navidrome_playlist,
                        args=(song_ids, volume, stop_event, config, strip, speed),
                        daemon=True
                    )
                    active_thread.start()
                    print(f"Navidrome: started download+play thread for {len(song_ids)} songs")
            elif algo == "clear":
                algorithms.clear_matrix(strip)
                strip.show()
                print("Matrix cleared.")
            elif algo == "glyph":
                name = str(data.get("name", "SORTS"))
                color_val = data.get("color", "green")
                active_thread = threading.Thread(
                    target=algorithms.draw_glyph,
                    args=(strip, name, color_val),
                    daemon=True
                )
                active_thread.start()
                print(f"Drew glyph: {name}")
            elif algo == "text":
                text = str(data.get("text", ""))
                font = str(data.get("font", "font5x7"))
                scroll = bool(data.get("scroll", True))
                color_val = data.get("color", "green")
                if scroll:
                    active_thread = threading.Thread(
                        target=algorithms.draw_text_scroll_loop,
                        args=(strip, text, font, speed, color_val, stop_event),
                        daemon=True
                    )
                    active_thread.start()
                    print(f"Started scrolling text visualization thread for: '{text}' in {color_val}")
                else:
                    algorithms.draw_text_static(strip, text, font, color_val)
                    print(f"Drew static text: '{text}' in {color_val}")
            elif algo == "time":
                font = str(data.get("font", "font3x5"))
                scroll = bool(data.get("scroll", False))
                layout = str(data.get("layout", "standard"))
                color_val = data.get("color", "green")
                sound_enabled = bool(data.get("sound", True))
                volume = float(data.get("volume", 0.25))
                active_thread = threading.Thread(
                    target=algorithms.time_visualize,
                    args=(strip, font, scroll, speed, color_val, layout, sound_enabled, volume, stop_event),
                    daemon=True
                )
                active_thread.start()
                print(f"Started time visualization thread. Layout: {layout}, Color: {color_val}, Sound: {sound_enabled}, Volume: {volume}, Font: {font}, Scroll: {scroll}")
            elif algo == "timer_preview":
                seconds = int(data.get("seconds", 60))
                color_val = data.get("color", "orange")
                active_thread = threading.Thread(
                    target=algorithms.draw_timer_preview_static,
                    args=(strip, seconds, color_val, stop_event),
                    daemon=True
                )
                active_thread.start()
                print(f"Started timer preview. Seconds: {seconds}, Color: {color_val}")
            elif algo == "countdown":
                seconds = int(data.get("seconds", 60))
                font = str(data.get("font", "font3x5"))
                scroll = bool(data.get("scroll", False))
                layout = str(data.get("layout", "standard"))
                color_val = data.get("color", "green")
                sound_enabled = bool(data.get("sound", True))
                volume = float(data.get("volume", 0.25))
                active_thread = threading.Thread(
                    target=algorithms.countdown_visualize,
                    args=(strip, seconds, font, scroll, speed, color_val, layout, sound_enabled, volume, stop_event),
                    daemon=True
                )
                active_thread.start()
                print(f"Started countdown thread. Seconds: {seconds}, Layout: {layout}, Sound: {sound_enabled}, Volume: {volume}, Font: {font}, Scroll: {scroll}")
            elif algo == "math_start":
                # 1. Stop any previous music playback
                try:
                    import pygame
                    if pygame.mixer.get_init():
                        pygame.mixer.music.stop()
                except Exception:
                    pass
                
                # 2. Reset stop event for the new game session
                stop_event.clear()
                stop_event.is_paused = False

                music_file = data.get("music_file", "none")
                song_id = data.get("song_id", "")
                music_volume = float(data.get("music_volume", 0.4))
                game_volume = float(data.get("game_volume", 0.25))
                mode = str(data.get("mode", "timed"))
                time_limit = int(data.get("time_limit", 60))

                # 3. Spawn background music downloader/player thread immediately so streaming begins concurrently
                if music_file == "navidrome" and song_id:
                    nav_url = config.get("navidrome_url", "")
                    nav_user = config.get("navidrome_user", "")
                    nav_pass = config.get("navidrome_pass", "")
                    
                    if not nav_url or not nav_user or not nav_pass:
                        print("Math Lab Navidrome: missing credentials in config.json.")
                        update_game_status("playing")
                    else:
                        import urllib.request
                        import urllib.parse
                        import tempfile
                        import hashlib
                        import random
                        import string

                        salt = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
                        token = hashlib.md5((nav_pass + salt).encode()).hexdigest()

                        stream_url = (
                            f"{nav_url}/rest/stream.view"
                            f"?id={song_id}"
                            f"&u={urllib.parse.quote(nav_user)}"
                            f"&t={token}&s={salt}"
                            f"&v=1.16.1&c=led-matrix"
                            f"&format=mp3&maxBitRate=128"
                        )
                        print(f"Math Lab Navidrome: downloading background song {song_id}...")

                        # This background thread keeps Navidrome music playing during our Maths games.
                        # It ensures the tunes keep rolling uninterrupted while the maths logic runs.
                        def _play_math_navidrome_bg(url, game_mode, time_lim, vol, stop_ev, config_data):
                            tmp_path = None
                            try:
                                with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                                    tmp_path = tmp.name
                                    with urllib.request.urlopen(url, timeout=30) as response:
                                        tmp.write(response.read())
                                print(f"Math Lab Navidrome: download complete, starting playback: {tmp_path}")
                                
                                import pygame
                                if not pygame.mixer.get_init():
                                    pygame.mixer.init()
                                pygame.mixer.music.load(tmp_path)
                                pygame.mixer.music.set_volume(vol)
                                pygame.mixer.music.play()
                                update_game_status("playing")
                                
                                stop_ev.is_paused = False

                                if game_mode == "timed":
                                    import time
                                    start_t = time.time()
                                    fade_dur = 4.0
                                    sleep_t = time_lim - fade_dur
                                    if sleep_t > 0:
                                        steps = int(sleep_t * 10)
                                        for _ in range(steps):
                                            if stop_ev.is_set():
                                                return
                                            time.sleep(0.1)
                                    fade_steps = 40
                                    step_del = fade_dur / fade_steps
                                    for i in range(fade_steps):
                                        if stop_ev.is_set():
                                            return
                                        cur_vol = vol * (1.0 - (i / fade_steps))
                                        try:
                                            if pygame.mixer.get_init():
                                                pygame.mixer.music.set_volume(cur_vol)
                                        except Exception:
                                            pass
                                        time.sleep(step_del)
                                    try:
                                        if pygame.mixer.get_init():
                                            pygame.mixer.music.stop()
                                    except Exception:
                                        pass

                                elif game_mode == "free":
                                    import time
                                    import json
                                    
                                    time.sleep(1.5)
                                    nextjs_url = config_data.get("nextjs_api_url", "")
                                    api_key = config_data.get("matrix_api_key", "")
                                    if nextjs_url:
                                        game_url = nextjs_url.replace("/songs", "/game-status")
                                    else:
                                        game_url = None

                                    while not stop_ev.is_set():
                                        try:
                                            if pygame.mixer.get_init():
                                                if not pygame.mixer.music.get_busy():
                                                    print("Math Lab bg music ended. Stopping game...")
                                                    stop_ev.set()
                                                    if game_url:
                                                        req = urllib.request.Request(
                                                            game_url,
                                                            data=json.dumps({"status": "gameover"}).encode("utf-8"),
                                                            headers={
                                                                "Content-Type": "application/json",
                                                                "X-API-Key": api_key
                                                            },
                                                            method="POST"
                                                        )
                                                        with urllib.request.urlopen(req, timeout=5) as res:
                                                            print(f"Math Lab gameover sent. Response: {res.status}")
                                                    break
                                        except Exception as mon_err:
                                            print(f"Math Lab monitor error: {mon_err}")
                                        time.sleep(0.5)

                            except Exception as nav_err:
                                print(f"Math Lab Navidrome: play failed: {nav_err}")
                                update_game_status("playing")
                            finally:
                                if tmp_path:
                                    try:
                                        import os as _os
                                        _os.unlink(tmp_path)
                                    except Exception:
                                        pass

                        threading.Thread(
                            target=_play_math_navidrome_bg,
                            args=(stream_url, mode, time_limit, music_volume, stop_event, config),
                            daemon=True
                        ).start()

                elif music_file and music_file != "none":
                    possible_paths = [
                        "sounds/songs",
                        "sounds",
                        os.path.expanduser("~/sounds/songs"),
                        os.path.expanduser("~/LED-Matrix-Code/sounds/songs"),
                        os.path.expanduser("~/LED-Matrix/sounds/songs"),
                        "/home/<YOUR_USERNAME>/LED-Matrix/sounds/songs",
                        "/home/<YOUR_USERNAME>/sounds/songs"
                    ]
                    song_path = None
                    for p in possible_paths:
                        test_path = os.path.join(p, music_file)
                        if os.path.exists(test_path):
                            song_path = test_path
                            break

                    if song_path:
                        # A fallback background thread for playing local music during Maths games.
                        # Just in case Navidrome is throwing a wobbly and isn't available.
                        def _play_math_local_bg(path, game_mode, time_lim, vol, stop_ev):
                            try:
                                import pygame
                                if not pygame.mixer.get_init():
                                    pygame.mixer.init()
                                pygame.mixer.music.load(path)
                                pygame.mixer.music.set_volume(vol)
                                pygame.mixer.music.play()
                                update_game_status("playing")
                                print(f"Math Lab bg music started: {path} at volume {vol}")

                                stop_ev.is_paused = False

                                if game_mode == "timed":
                                    import time
                                    start_t = time.time()
                                    fade_dur = 4.0
                                    sleep_t = time_lim - fade_dur
                                    if sleep_t > 0:
                                        steps = int(sleep_t * 10)
                                        for _ in range(steps):
                                            if stop_ev.is_set():
                                                return
                                            time.sleep(0.1)
                                    fade_steps = 40
                                    step_del = fade_dur / fade_steps
                                    for i in range(fade_steps):
                                        if stop_ev.is_set():
                                            return
                                        cur_vol = vol * (1.0 - (i / fade_steps))
                                        try:
                                            if pygame.mixer.get_init():
                                                pygame.mixer.music.set_volume(cur_vol)
                                        except Exception:
                                            pass
                                        time.sleep(step_del)
                                    try:
                                        if pygame.mixer.get_init():
                                            pygame.mixer.music.stop()
                                    except Exception:
                                        pass
                            except Exception as music_err:
                                print(f"Failed to start Math Lab background music: {music_err}")
                                update_game_status("playing")

                        threading.Thread(
                            target=_play_math_local_bg,
                            args=(song_path, mode, time_limit, music_volume, stop_event),
                            daemon=True
                        ).start()
                    else:
                        print(f"Math Lab background music file {music_file} not found.")
                        update_game_status("playing")
                else:
                    print("Math Lab started without background music (silent).")
                    update_game_status("playing")

                # 4. Play the ready simple countdown animation synchronously (takes exactly 3.0 seconds)
                try:
                    algorithms.play_simple_countdown(strip, Color(0, 255, 0), stop_event)
                except Exception as anim_err:
                    print(f"Failed to play ready countdown animation: {anim_err}")
                    # Clear matrix
                    for i in range(strip.numPixels()):
                        strip.setPixelColor(i, Color(0, 0, 0))
                    strip.show()
                
                # Update mode and reset active_thread since math_start is setup phase
                active_thread = None
                current_mode = "math_start"

            elif algo == "math_question":
                type_str = str(data.get("type", "multiply"))
                factor_a = int(data.get("factorA", 1))
                factor_b = int(data.get("factorB", 1))
                sound_enabled = bool(data.get("sound", True))
                volume = float(data.get("volume", 0.25))
                allowed_multiply = data.get("allowed_multiply", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
                allowed_divide = data.get("allowed_divide", [0, 1, 2, 3, 4, 5])
                active_thread = threading.Thread(
                    target=algorithms.math_question_visualize,
                    args=(strip, type_str, factor_a, factor_b, sound_enabled, volume, allowed_multiply, allowed_divide, stop_event),
                    daemon=True
                )
                active_thread.start()
                print(f"Started math question thread: {factor_a} {type_str} {factor_b}")
            elif algo == "math_help":
                type_str = str(data.get("type", "multiply"))
                factor_a = int(data.get("factorA", 1))
                factor_b = int(data.get("factorB", 1))
                sound_enabled = bool(data.get("sound", True))
                volume = float(data.get("volume", 0.25))
                active_thread = threading.Thread(
                    target=algorithms.math_help_visualize,
                    args=(strip, type_str, factor_a, factor_b, sound_enabled, volume, stop_event),
                    daemon=True
                )
                active_thread.start()
                print(f"Started math help thread: {factor_a} {type_str} {factor_b}")
            elif algo == "pathfinding":
                # Extract pathfinding parameters
                pf_type = str(data.get("type", "dijkstra"))
                pf_start = data.get("start", [6, 4])
                pf_target = data.get("target", [17, 15])
                pf_walls = data.get("walls", [])
                
                if pf_type == "update":
                    # Draw static grid updates immediately and synchronously (no path solved)
                    algorithms.draw_pathfinding_grid(strip, pf_start, pf_target, pf_walls)
                    active_thread = None
                else:
                    active_thread = threading.Thread(
                        target=algorithms.pathfinding_visualize,
                        args=(strip, pf_type, pf_start, pf_target, pf_walls, sound_list, speed, sound_enabled, volume, stop_event),
                        daemon=True
                    )
                    active_thread.start()
                    print(f"Started pathfinding thread. Algo: {pf_type}, Start: {pf_start}, Target: {pf_target}, Walls count: {len(pf_walls)}")
            elif algo == "game":
                # Extract coordinates
                x = int(data.get("x", 0))
                y = int(data.get("y", 0))
                # Clip coordinates to matrix dimensions
                x = max(0, min(COLS - 1, x))
                y = max(0, min(ROWS - 1, y))
                
                clear_matrix(strip)
                idx = xy_to_index(x, y)
                if idx is not None:
                    # Swap parameters: Color(green, red, blue) -> Color(0, 255, 0) displays Red physically
                    strip.setPixelColor(idx, Color(0, 255, 0)) 
                strip.show()
                print(f"Game mode: Drew red pixel at ({x}, {y})")
            elif algo == "gif":
                frames = data.get("frames", [])
                if isinstance(frames, list) and len(frames) > 0:
                    active_thread = threading.Thread(
                        target=algorithms.gif_visualize,
                        args=(strip, frames, stop_event),
                        daemon=True
                    )
                    active_thread.start()
                    print(f"Started GIF animation thread with {len(frames)} frames.")
            elif algo == "image":
                pixels = data.get("pixels", [])
                if isinstance(pixels, list) and len(pixels) == 480:
                    for i, pixel_color in enumerate(pixels):
                        y = i // COLS
                        x = i % COLS
                        idx = xy_to_index(x, y)
                        if idx is not None and isinstance(pixel_color, list) and len(pixel_color) >= 3:
                            # Extract raw colors
                            r_raw = max(0, min(255, int(pixel_color[0])))
                            g_raw = max(0, min(255, int(pixel_color[1])))
                            b_raw = max(0, min(255, int(pixel_color[2])))
                            
                            # Apply Gamma correction mapping (makes dark colors look darker)
                            r = GAMMA_LUT[r_raw]
                            g = GAMMA_LUT[g_raw]
                            b = GAMMA_LUT[b_raw]
                            
                            # Swap Red and Green channels due to physical GRB subpixel order
                            strip.setPixelColor(idx, Color(g, r, b))
                    strip.show()
                    print("Image mode: Rendered uploaded image with Gamma correction onto the matrix.")
                else:
                    print("Error: Invalid or wrong-sized pixel array received in image mode.")
            elif algo == "rickroll":
                # Our cheeky easter egg thread that handles the Rick Astley animation.
                # It plays the iconic track and sequentially renders the GIF frames on the matrix.
                def rickroll_thread(strip, stop_event):
                    global rick_frames_cache
                    frames = rick_frames_cache
                    
                    if frames is None:
                        import json
                        import os
                        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sounds", "rick_frames.json")
                        try:
                            with open(json_path, 'r') as f:
                                frames = json.load(f)
                        except Exception as e:
                            print(f"Error loading {json_path}: {e}")
                            return
                        
                    algorithms.play_sound_by_name("rick.mp3", 1.0)
                    if frames:
                        algorithms.gif_visualize(strip, frames, stop_event)
                        
                active_thread = threading.Thread(
                    target=rickroll_thread,
                    args=(strip, stop_event),
                    daemon=True
                )
                active_thread.start()
            elif algo == "idle":
                print("Switched to Ambient Idle Mode (Display Off).")
            elif algo == "shutdown":
                print("Powering down matrix and system...")
                clear_matrix(strip)
                os.system("sudo shutdown -h now")
            else:
                print(f"Algorithm '{algo}' is not yet supported or implemented.")
            
            current_mode = algo
                
    except json.JSONDecodeError:
        print("Error: Message payload is not valid JSON.")
    except Exception as e:
        print(f"Error executing message callback: {e}")

# This MQTT callback fires immediately whenever a new topic message arrives.
# It decodes the raw payload into JSON and quickly passes it over to process_payload.
def on_message(client, strip, msg):
    """Callback when an MQTT message is received."""
    payload_str = msg.payload.decode('utf-8')
    print(f"Received MQTT message on '{msg.topic}': {payload_str}")
    try:
        data = json.loads(payload_str)
        process_payload(strip, data)
    except Exception as e:
        print(f"Failed to process MQTT payload: {e}")

# This is the primary entry point where all the magic starts.
# It initialises the NeoPixels, audio mixers, MQTT clients, and our physical hardware buttons.
def main():
    global config, hw_state_machine
    # Load configuration
    config_file = "config.json"
    if not os.path.exists(config_file):
        # Fallback path (home directory on Pi)
        config_file = os.path.expanduser("~/config.json")
        
    config = {}
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                config = json.load(f)
            print(f"Loaded configuration from {config_file}")
        except Exception as e:
            print(f"Warning: Failed to parse {config_file}: {e}. Using defaults.")
    else:
        print(f"Warning: {config_file} not found. Using defaults.")

    # Extract configuration parameters
    host = config.get("mqtt_host", "127.0.0.1")
    port = config.get("mqtt_port", 1883)
    transport = config.get("mqtt_transport", "tcp").lower()
    username = config.get("mqtt_username", "")
    password = config.get("mqtt_password", "")
    topic = config.get("mqtt_topic", "classroom/matrix/control")
    use_tls = config.get("mqtt_use_tls", False)
    brightness = config.get("led_brightness", 127)

    # Initialize NeoPixel strip
    strip = Adafruit_NeoPixel(LED_COUNT, LED_PIN, LED_FREQ_HZ, LED_DMA, LED_INVERT, brightness, LED_CHANNEL)
    try:
        strip.begin()
    except RuntimeError as e:
        print(f"\nInitialization Error: {e}")
        print("\nNote: Driving WS281x pixels via SPI MOSI requires root privileges.")
        print("Please run this script using sudo:")
        print("  sudo python3 mqtt_listener.py\n")
        sys.exit(1)

    print(f"LED Matrix loaded. Geometry: {COLS}x{ROWS}. Brightness: {brightness}/255.")
    clear_matrix(strip)
    
    # Pre-load audio scale files
    load_sounds()

    # Set up MQTT Client (compatible with both paho-mqtt v1.x and v2.x)
    try:
        # Paho-MQTT v2.x
        from paho.mqtt.enums import CallbackAPIVersion
        client = mqtt.Client(CallbackAPIVersion.VERSION1, userdata=strip, transport=transport)
    except ImportError:
        # Paho-MQTT v1.x
        client = mqtt.Client(userdata=strip, transport=transport)

    # Store custom metadata inside the client object for callback access
    client._userdata_dict = {"topic": topic}
    
    # Register callbacks
    client.on_connect = on_connect
    client.on_message = on_message

    # Configure authentication if credentials are provided
    if username and password:
        client.username_pw_set(username, password)
        print(f"MQTT Authentication configured for user: {username}")

    # Configure WebSockets specific path
    if transport == "websockets":
        client.ws_set_options(path="/mqtt")
        print("MQTT transport mode set to WebSockets.")

    # Configure TLS if requested or using port 443
    if use_tls or port == 443:
        client.tls_set()
        print("MQTT TLS/SSL security enabled.")

    # ---------------------------------------------------------
    # HARDWARE INITIALIZATION (Offline-First)
    # ---------------------------------------------------------
    global hw_state_machine
    # A handy hardware button callback function.
    # It basically fakes an MQTT payload injection so we can trigger actions offline.
    def dispatch_callback(payload):
        print(f"[Hardware] Dispatching: {payload}")
        process_payload(strip, payload)
        
    # Another hardware button callback function.
    # We use this to trigger instant audio feedback whenever a physical button is pressed.
    def play_sound_callback(sound_name):
        algorithms.play_sound_by_name(sound_name, volume=0.25)
        
    # The final hardware button callback function.
    # It instantly renders text on the matrix, which is brilliant for physical menu navigation.
    def text_display_callback(text):
        process_payload(strip, {"algo": "text", "text": text, "color": [255, 255, 255], "speed": 0.0, "scroll": False})

    hw_state_machine = hardware_buttons.HardwareStateMachine(dispatch_callback, play_sound_callback, text_display_callback)
    hardware_buttons.setup_hardware_buttons(hw_state_machine)

    # Pre-warm pygame mixer to prevent audio dropout on first button press
    try:
        import pygame
        pygame.mixer.init()
    except Exception as e:
        print(f"Warning: Failed to pre-warm pygame mixer: {e}")

    print("Hardware buttons initialized and active (Offline Mode Ready).")

    # ---------------------------------------------------------
    # NETWORK INITIALIZATION (Background Thread)
    # ---------------------------------------------------------
    print(f"Attempting to connect to MQTT Broker at {host}:{port} in background...")
    
    # A little helper function to get our MQTT broker connection sorted.
    # It includes retry logic just in case the network is being a bit stubborn.
    def connect_mqtt():
        attempt_count = 0
        while True:
            try:
                client.connect(host, port, keepalive=60)
                print("MQTT connect() success (socket established).")
                # Start the network loop in a non-blocking background thread
                client.loop_start()
                print("MQTT Network listener thread started. Listening for commands...")
                break # Exit the infinite retry loop once connected!
            except Exception as e:
                attempt_count += 1
                print(f"MQTT connection setup failed: {e}. Retrying in 5 seconds (Attempt {attempt_count})...")
                # Blink Red to signal connection setup failure, but go silent after 3 attempts
                if attempt_count <= 3:
                    blink_top_row(strip, Color(255, 0, 0), blinks=4, duration_sec=0.15)
                time.sleep(5)

    # Start the connection retry loop in a background thread
    connection_thread = threading.Thread(target=connect_mqtt, daemon=True)
    connection_thread.start()

    print("Press Ctrl+C to terminate the daemon.")

    try:
        # Main execution loop - simply sleeps and keeps the process alive
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nStopping MQTT client loop...")
        client.loop_stop()
        print("Disconnecting from broker...")
        client.disconnect()
        print("Clearing LED matrix...")
        clear_matrix(strip)
        print("Daemon stopped. Goodbye!")

if __name__ == "__main__":
    main()

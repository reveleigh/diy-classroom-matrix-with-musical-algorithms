import time
import random
try:
    from gpiozero import Button
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("Warning: gpiozero not available. Hardware buttons disabled.")

MENU = {
    "SORTS": {
        "BUB": ["BST", "AVG", "WST", "NRL"],
        "INS": ["BST", "AVG", "WST", "NRL"],
        "MRG": ["BST", "AVG", "WST", "NRL"],
        "QCK": ["BST", "AVG", "WST", "NRL"],
    },
    "PATHS": {
        "DIJ": ["BST", "AVG", "WST"],
        "AST": ["BST", "AVG", "WST"],
    },
    "SEARCHES": {
        "LIN": ["BST", "AVG", "WST"],
        "BIN": ["BST", "AVG", "WST"],
    }
}

TIER1_KEYS = list(MENU.keys())

# Map tier 2 codes to real MQTT algorithm names
ALGO_MAP = {
    "BUB": "bubble",
    "INS": "insertion",
    "MRG": "merge",
    "QCK": "quick",
    "DIJ": "pathfinding",
    "AST": "pathfinding", # we'll pass type="a_star"
    "LIN": "linear_search", # To be implemented in algorithms.py
    "BIN": "binary_search"  # To be implemented in algorithms.py
}

def generate_array(scenario):
    if scenario == "BST":
        return list(range(24))
    elif scenario == "WST":
        return list(range(23, -1, -1))
    elif scenario == "NRL":
        arr = list(range(24))
        # Swap 3 random pairs
        for _ in range(3):
            i, j = random.sample(range(24), 2)
            arr[i], arr[j] = arr[j], arr[i]
        return arr
    else: # AVG
        return random.sample(range(24), 24)

def format_time(seconds):
    if seconds < 60:
        return f"{seconds}s"
    elif seconds < 3600:
        return f"{seconds//60}m"
    return f"{seconds//3600}h"

def load_menu_image(name):
    import os
    import json

    filepath = os.path.join(os.path.dirname(__file__), "Glyphs", "menu_icons.json")
    if not os.path.exists(filepath):
        return None
        
    try:
        with open(filepath, "r") as f:
            icons = json.load(f)
            return icons.get(name)
    except Exception as e:
        print(f"Error loading menu icons JSON: {e}")
        return None

class HardwareStateMachine:
    def __init__(self, dispatch_callback, play_sound_callback, text_display_callback):
        self.dispatch = dispatch_callback
        self.play_sound = play_sound_callback
        self.display_text = text_display_callback
        
        self.tier = 0
        self.idx1 = 0
        self.idx2 = 0
        self.idx3 = 0

        self.mode = "menu"
        self.timer_options = [10, 30, 60, 120, 300, 600, 900, 1800]
        self.timer_idx = 0
        self.timer_running = False
        self.clock_display = False
        
        self.t2_keys = []
        self.t3_keys = []
        
        self.last_interaction_time = time.time()
        import threading
        self.inactivity_thread = threading.Thread(target=self.inactivity_monitor, daemon=True)
        self.inactivity_thread.start()
        
        self.update_sub_keys()
        self.announce_state()

    def register_interaction(self):
        self.last_interaction_time = time.time()

    def inactivity_monitor(self):
        while True:
            time.sleep(1)
            # Sleep if idle for 30 seconds, not in clock mode, and timer is not running
            if self.tier > 0 and self.mode != "clock" and not self.timer_running:
                if time.time() - self.last_interaction_time > 30.0:
                    self.tier = 0
                    self.announce_state(play_voice=False)

    def update_sub_keys(self):
        t1_val = TIER1_KEYS[self.idx1]
        self.t2_keys = list(MENU[t1_val].keys())
        if self.idx2 >= len(self.t2_keys):
            self.idx2 = 0
            
        t2_val = self.t2_keys[self.idx2]
        self.t3_keys = MENU[t1_val][t2_val]
        if self.idx3 >= len(self.t3_keys):
            self.idx3 = 0

    def get_spoken_sound(self):
        if self.tier == 0:
            return None
        if self.tier == 1:
            map1 = {"SORTS": "sorts.wav", "PATHS": "path finding.wav", "SEARCHES": "searches.wav"}
            return map1.get(TIER1_KEYS[self.idx1])
        elif self.tier == 2:
            val = self.t2_keys[self.idx2]
            map2 = {"BUB": "bubble.wav", "INS": "insertion.wav", "MRG": "merge.wav", "QCK": "quick.wav", "DIJ": "dijkstras.wav", "AST": "a star.wav", "LIN": "linear search.wav", "BIN": "binary search.wav"}
            return map2.get(val)
        elif self.tier == 3:
            val = self.t3_keys[self.idx3]
            map3 = {"BST": "best case.wav", "AVG": "average case.wav", "WST": "worst case.wav", "NRL": "nearly sorted.wav"}
            return map3.get(val)

    def announce_state(self, play_voice=True):
        # Display Visuals
        if self.tier == 0:
            self.display_text("")
        elif self.tier == 1 or (self.tier == 2 and TIER1_KEYS[self.idx1] != "PATHS"):
            text = TIER1_KEYS[self.idx1]
            pixels = load_menu_image(text)
            if pixels:
                self.dispatch({"algo": "image", "pixels": pixels})
            else:
                self.dispatch({"algo": "glyph", "name": text, "color": "orange"})
        elif self.tier == 2 and TIER1_KEYS[self.idx1] == "PATHS":
            walls = [[random.randint(0, 23), random.randint(0, 19)] for _ in range(40)]
            start = [random.randint(0, 23), random.randint(0, 19)]
            target = [random.randint(0, 23), random.randint(0, 19)]
            while start == target:
                target = [random.randint(0, 23), random.randint(0, 19)]
            
            preview_payload = {
                "type": "update",
                "algo": "pathfinding",
                "start": start,
                "target": target,
                "walls": walls
            }
            self.active_preview_payload = preview_payload
            self.dispatch(preview_payload)
        elif self.tier == 3:
            t1 = TIER1_KEYS[self.idx1]
            t2 = self.t2_keys[self.idx2]
            t3 = self.t3_keys[self.idx3]
            
            preview_payload = {"type": "update"}

            if t1 == "SORTS":
                preview_payload.update({"algo": "bubble", "array": generate_array(t3)})
            elif t1 == "SEARCHES":
                arr = list(range(2, 22))
                if t2 == "BIN":
                    arr.sort()
                else:
                    random.shuffle(arr)
                preview_payload.update({"algo": "bubble", "array": arr})
                
            self.active_preview_payload = preview_payload
            self.dispatch(preview_payload)
        
        # Play Sound
        if play_voice:
            sound = self.get_spoken_sound()
            if sound:
                self.play_sound(sound)

    def handle_wakeup(self):
        self.register_interaction()
        if self.tier == 0 and self.mode == "menu":
            self.tier = 1
            self.announce_state()
            return True
        return False

    def b1_short(self):
        self.register_interaction()
        if self.handle_wakeup(): return
        if self.mode == "clock": return
        if self.tier == 1:
            self.idx1 = (self.idx1 + 1) % len(TIER1_KEYS)
            self.update_sub_keys()
        elif self.tier == 2:
            self.idx2 = (self.idx2 + 1) % len(self.t2_keys)
            self.update_sub_keys()
        elif self.tier == 3:
            self.idx3 = (self.idx3 + 1) % len(self.t3_keys)
        self.announce_state()

    def b1_long(self):
        self.register_interaction()
        if self.handle_wakeup(): return
        if self.mode == "clock": return
        if self.tier < 3:
            t1 = TIER1_KEYS[self.idx1]
            if t1 == "PATHS" and self.tier == 2:
                return
            self.tier += 1
            self.announce_state()

    def b2_short(self):
        self.register_interaction()
        if self.handle_wakeup(): return
        if self.mode == "clock" and not self.clock_display:
            if self.timer_running:
                self.dispatch({"algo": "clear"})
                self.timer_running = False
            else:
                self.dispatch({"algo": "countdown", "seconds": self.timer_options[self.timer_idx], "color": "orange", "sound": True, "volume": 0.25, "font": "font3x5", "scroll": False, "speed": 0.08, "layout": "grid2x2"})
                self.timer_running = True
            return

        if self.mode == "clock": return

        t1 = TIER1_KEYS[self.idx1]
        t2 = self.t2_keys[self.idx2]
        t3 = self.t3_keys[self.idx3] if self.tier == 3 else self.t3_keys[0]

        algo_name = ALGO_MAP.get(t2, "bubble")
        
        payload = {
            "algo": algo_name,
            "sound": True,
            "speed": 0.1
        }
        
        if t1 == "SORTS":
            if self.tier == 3 and hasattr(self, 'active_preview_payload') and "array" in self.active_preview_payload:
                payload["array"] = self.active_preview_payload["array"]
            else:
                payload["array"] = generate_array(t3)
        elif t1 == "PATHS":
            payload["algo"] = "pathfinding"
            payload["type"] = "astar" if t2 == "AST" else "dijkstra"
            if hasattr(self, 'active_preview_payload') and "walls" in self.active_preview_payload:
                payload["walls"] = self.active_preview_payload["walls"]
                payload["start"] = self.active_preview_payload.get("start", [0, 0])
                payload["target"] = self.active_preview_payload.get("target", [23, 19])
            else:
                payload["start"] = [0, 0]
                payload["target"] = [23, 19]
                payload["walls"] = [[random.randint(0, 23), random.randint(0, 19)] for _ in range(40)]
        elif t1 == "SEARCHES":
            if self.tier == 3 and hasattr(self, 'active_preview_payload') and "array" in self.active_preview_payload:
                arr = self.active_preview_payload["array"]
            else:
                arr = list(range(2, 22))
                if t2 == "BIN":
                    arr.sort()
                else:
                    random.shuffle(arr)

            if t3 == "BST":
                target = arr[9] if t2 == "BIN" else arr[0]
            elif t3 == "WST":
                target = 999 if random.random() < 0.1 else arr[-1]
            else:
                target = random.choice(arr)
                
            payload["array"] = arr
            payload["target"] = target
        
        self.dispatch(payload)
        
    def b2_long(self):
        self.register_interaction()
        if self.handle_wakeup(): return
        if self.mode == "clock":
            self.mode = "menu"
            self.tier = 0
            self.timer_running = False
            self.dispatch({"algo": "clear"})
            self.play_sound("ui_back.wav")
            return
        if self.tier > 1:
            self.tier -= 1
            self.announce_state(play_voice=False)
            self.play_sound("ui_back.wav")
        elif self.tier == 1:
            self.tier = 0
            self.announce_state(play_voice=False)
            self.play_sound("ui_back.wav")
    def b3_short(self):
        self.register_interaction()
        if self.mode != "clock" or self.clock_display:
            self.mode = "clock"
            self.clock_display = False
            self.timer_running = False
            self.dispatch({"algo": "clear"})
        else:
            self.timer_idx = (self.timer_idx + 1) % len(self.timer_options)
            if self.timer_running:
                self.timer_running = False
                self.dispatch({"algo": "clear"})
        
        self.dispatch({"algo": "timer_preview", "seconds": self.timer_options[self.timer_idx], "color": "orange"})

    def b3_long(self):
        self.register_interaction()
        self.mode = "clock"
        self.clock_display = True
        self.timer_running = False
        self.dispatch({"algo": "time", "color": "orange", "font": "font3x5", "scroll": False, "speed": 0.08, "sound": True, "volume": 0.25, "layout": "grid2x2"})

    def simulate_button(self, btn, press_type):
        """Called by the NextJS Web UI API"""
        print(f"Web UI Button Simulation: {btn} {press_type}")
        if btn == "B1":
            self.b1_long() if press_type == "long" else self.b1_short()
        elif btn == "B2":
            self.b2_long() if press_type == "long" else self.b2_short()
        elif btn == "B3":
            self.b3_long() if press_type == "long" else self.b3_short()

def setup_hardware_buttons(state_machine):
    if not GPIO_AVAILABLE:
        return

    # Attach to state_machine to prevent Garbage Collection (GC) from disabling the pins
    b1 = Button(17, hold_time=1.0)
    b2 = Button(27, hold_time=1.0)
    b3 = Button(23, hold_time=1.0)

    # State tracking so short press doesn't fire when long press finishes
    b1_long_fired = False
    b2_long_fired = False
    b3_long_fired = False

    def b1_held():
        nonlocal b1_long_fired
        b1_long_fired = True
        state_machine.b1_long()

    def b1_released():
        nonlocal b1_long_fired
        if not b1_long_fired:
            state_machine.b1_short()
        b1_long_fired = False

    def b2_held():
        nonlocal b2_long_fired
        b2_long_fired = True
        state_machine.b2_long()

    def b2_released():
        nonlocal b2_long_fired
        if not b2_long_fired:
            state_machine.b2_short()
        b2_long_fired = False

    def b3_held():
        nonlocal b3_long_fired
        b3_long_fired = True
        state_machine.b3_long()

    def b3_released():
        nonlocal b3_long_fired
        if not b3_long_fired:
            state_machine.b3_short()
        b3_long_fired = False

    b1.when_held = b1_held
    b1.when_released = b1_released

    b2.when_held = b2_held
    b2.when_released = b2_released

    b3.when_held = b3_held
    b3.when_released = b3_released
    
    # Store references to prevent garbage collection
    state_machine._gpio_buttons = (b1, b2, b3)
    print("Hardware buttons (GPIO) configured successfully.")

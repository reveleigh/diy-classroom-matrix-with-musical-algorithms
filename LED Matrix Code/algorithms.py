import os
import time
import random
import json
import datetime

# Try importing rpi_ws281x
try:
    from rpi_ws281x import Color
except ImportError:
    pass

# Matrix Dimensions
COLS = 20
ROWS = 24

# Colors
COLOR_DEFAULT = Color(0, 0, 200)      # Blue for unsorted elements
COLOR_COMPARE = Color(255, 0, 0)      # Red for elements being compared (Green on GRB hardware)
COLOR_SWAP    = Color(255, 255, 0)    # Yellow for swapped elements
COLOR_SORTED  = Color(0, 200, 0)      # Green for sorted elements (Red on GRB hardware)
COLOR_BLACK   = Color(0, 0, 0)        # Off

def xy_to_index(x, y):
    """
    Translates a 2D grid coordinate (X, Y) to the 1D physical LED strip index.
    Layout: Serpentine starting at the BOTTOM-LEFT corner (0, 23).
    """
    if not (0 <= x < COLS) or not (0 <= y < ROWS):
        return None
    y_from_bottom = (ROWS - 1) - y
    if y_from_bottom % 2 == 0:
        return y_from_bottom * COLS + x
    else:
        return y_from_bottom * COLS + (COLS - 1 - x)

def clear_matrix(strip):
    """
    Clears the entire LED matrix display.
    """
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, COLOR_BLACK)
    strip.show()

def draw_column(strip, x, value, color):
    """
    Draws a vertical bar in column x.
    """
    for y in range(ROWS):
        idx = xy_to_index(x, y)
        if idx is not None:
            if y >= (ROWS - 1 - value):
                strip.setPixelColor(idx, color)
            else:
                strip.setPixelColor(idx, COLOR_BLACK)

def draw_array(strip, arr, compared_indices=None, swapped_indices=None, sorted_indices=None):
    """
    Renders the entire array onto the LED matrix with status-specific colors.
    """
    if compared_indices is None: compared_indices = []
    if swapped_indices is None: swapped_indices = []
    if sorted_indices is None: sorted_indices = set()

    for x in range(COLS):
        val = arr[x]
        if x in swapped_indices:
            color = COLOR_SWAP
        elif x in compared_indices:
            color = COLOR_COMPARE
        elif x in sorted_indices:
            color = COLOR_SORTED
        else:
            color = COLOR_DEFAULT
            
        draw_column(strip, x, val, color)
    strip.show()

def responsive_sleep(duration, stop_event):
    """
    Sleeps for the specified duration in small 10ms intervals, 
    checking the stop_event frequently for fast cancellation responsiveness.
    Returns True if completed successfully, False if interrupted.
    """
    delay = duration
    while delay > 0:
        if stop_event.is_set():
            return False
        sleep_chunk = min(0.01, delay)
        time.sleep(sleep_chunk)
        delay -= sleep_chunk
    return True

def run_success_animation(strip, arr, sound_list, speed_delay, sound_enabled, volume, stop_event, comparisons=None):
    """
    Sweeps a green wave (COLOR_COMPARE) across the display from left to right, 
    turning the already-red sorted bars (COLOR_SORTED) to green one column at a time.
    At the end, if comparisons is provided and sound is enabled, plays the verbal completion narration.
    """
    print("Sorting complete! Running success animation...")
    
    # Sweep green columns left-to-right over the existing sorted array
    for x in range(COLS):
        if stop_event.is_set():
            return
            
        # Play the tone that matches the column index
        sound_idx = int(x * 23 / (COLS - 1))
        if sound_enabled and sound_list:
            sound_list[sound_idx].set_volume(volume)
            sound_list[sound_idx].play()
            
        # Draw columns 0 to x in Green (COLOR_COMPARE) and the rest in Red (COLOR_SORTED)
        for col in range(COLS):
            val = arr[col]
            color = COLOR_COMPARE if col <= x else COLOR_SORTED
            draw_column(strip, col, val, color)
        strip.show()
        
        if not responsive_sleep(max(0.05, speed_delay), stop_event):
            return
        
    # Play success sound
    if sound_enabled:
        play_sound_by_name("tada.wav", volume=volume)
        
        # Narration report at the end
        if comparisons is not None:
            responsive_sleep(1.0, stop_event)
            phrases = ["data sorted requiring.wav"] + get_number_sound_files(comparisons) + ["comparisons.wav"]
            play_phrase_sequence(phrases, volume, stop_event)
            
    # Wait with the fully green array
    if not responsive_sleep(1.5, stop_event):
        return
    
    # Fade out left-to-right
    for x in range(COLS):
        if stop_event.is_set():
            return
        draw_column(strip, x, -1, COLOR_BLACK)
        strip.show()
        if not responsive_sleep(0.02, stop_event):
            return

def draw_array_search(strip, arr, target, active_idx=None, dim_indices=None, found_idx=None):
    """
    Renders the array for searching, with dim sections, active search index, and found index.
    """
    if dim_indices is None: dim_indices = []
    
    for x in range(COLS):
        if x >= len(arr):
            break
        val = arr[x]
        
        if x == found_idx:
            color = COLOR_SORTED # Green/Red (Success)
        elif x == active_idx:
            color = Color(255, 255, 255) # White
        elif val == target:
            color = Color(0, 255, 0) # Green (Target we are looking for)
        elif x in dim_indices:
            color = Color(0, 0, 50) # Dim Blue
        else:
            color = COLOR_DEFAULT
            
        draw_column(strip, x, val, color)
    strip.show()

def linear_search_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None, target=None, delay_before_start=0):
    print(f"Starting Linear Search for target {target}")
    if arr is None or len(arr) == 0: return
    
    if delay_before_start > 0:
        draw_array_search(strip, arr, target)
        if stop_event.wait(delay_before_start):
            return

    comparisons = 0
    found_idx = None
    
    for i in range(len(arr)):
        if stop_event.is_set():
            return
            
        comparisons += 1
        draw_array_search(strip, arr, target, active_idx=i)
        
        if sound_enabled and len(sound_list) > 0:
            if arr[i] < len(sound_list):
                sound_list[arr[i]].set_volume(volume)
                sound_list[arr[i]].play()
            else:
                play_sound_by_name("ui_tick.wav", volume)
            
        if not responsive_sleep(speed, stop_event):
            return
            
        if arr[i] == target:
            found_idx = i
            draw_array_search(strip, arr, target, found_idx=i)
            if sound_enabled:
                play_sound_by_name("tada.wav", volume)
                time.sleep(0.5)
            break
            
    if found_idx is None and sound_enabled:
        play_sound_by_name("error.wav", volume)
        time.sleep(0.5)

def binary_search_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None, target=None, delay_before_start=0):
    print(f"Starting Binary Search for target {target}")
    if arr is None or len(arr) == 0: return
    
    if delay_before_start > 0:
        draw_array_search(strip, arr, target)
        if stop_event.wait(delay_before_start):
            return

    left = 0
    right = len(arr) - 1
    found_idx = None
    
    while left <= right:
        if stop_event.is_set():
            return
            
        mid = (left + right) // 2
        
        # Dim elements outside the current window
        dim_indices = [i for i in range(len(arr)) if i < left or i > right]
        draw_array_search(strip, arr, target, active_idx=mid, dim_indices=dim_indices)
        
        if sound_enabled and len(sound_list) > 0:
            if arr[mid] < len(sound_list):
                sound_list[arr[mid]].set_volume(volume)
                sound_list[arr[mid]].play()
            else:
                play_sound_by_name("ui_tick.wav", volume)
            
        if not responsive_sleep(speed, stop_event):
            return
            
        if arr[mid] == target:
            found_idx = mid
            draw_array_search(strip, arr, target, found_idx=mid, dim_indices=dim_indices)
            if sound_enabled:
                play_sound_by_name("tada.wav", volume)
                time.sleep(0.5)
            break
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
            
    if found_idx is None and sound_enabled:
        play_sound_by_name("error.wav", volume)
        time.sleep(0.5)

def bubble_sort_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None):
    """
    Runs the Bubble Sort visualization.
    Can be aborted at any step when stop_event is set.
    """
    try:
        if arr is None:
            arr = random.sample(range(24), COLS)
        else:
            arr = list(arr)
            
        print(f"\nBubble Sort starting state: {arr}")
        
        n = len(arr)
        sorted_indices = set()
        comparison_count = 0
        
        # Render initial state
        draw_array(strip, arr, sorted_indices=sorted_indices)
        
        # Pause to let the user see the starting state
        if not responsive_sleep(1.5, stop_event):
            return
            
        # Start Bubble Sort loop
        for i in range(n - 1):
            if stop_event.is_set():
                return
                
            swapped_any = False
            for j in range(n - i - 1):
                if stop_event.is_set():
                    return
                    
                comparison_count += 1
                
                # 1. Highlight compared columns
                draw_array(strip, arr, compared_indices=[j, j+1], sorted_indices=sorted_indices)
                
                # Play audio tones for compared items
                if sound_enabled and sound_list:
                    sound_list[arr[j]].set_volume(volume)
                    sound_list[arr[j+1]].set_volume(volume)
                    sound_list[arr[j]].play()
                    sound_list[arr[j+1]].play()
                    
                if not responsive_sleep(speed, stop_event):
                    return
                
                # 2. Check if swap is needed
                if arr[j] > arr[j+1]:
                    arr[j], arr[j+1] = arr[j+1], arr[j]
                    swapped_any = True
                    
                    # Highlight swapped columns
                    draw_array(strip, arr, swapped_indices=[j, j+1], sorted_indices=sorted_indices)
                    
                    # Play sound again for swap confirmation
                    if sound_enabled and sound_list:
                        sound_list[arr[j+1]].set_volume(volume)
                        sound_list[arr[j+1]].play()
                        
                    if not responsive_sleep(speed, stop_event):
                        return
            
            # The last item of this pass is now in its final sorted position (Red on GRB)
            sorted_indices.add(n - i - 1)
            
            # If no two elements were swapped in the inner loop, the array is already sorted
            if not swapped_any:
                break
                
        # Mark all elements as sorted (displaying them all as Red on GRB)
        sorted_indices = set(range(COLS))
        draw_array(strip, arr, sorted_indices=sorted_indices)
        
        if not responsive_sleep(0.5, stop_event):
            return
        
        # Success celebratory animation (sweeps Green one column at a time over Red)
        run_success_animation(strip, arr, sound_list, speed, sound_enabled, volume, stop_event, comparisons=comparison_count)
                
    finally:
        # Clear the display on exit/cancellation
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, COLOR_BLACK)
        strip.show()

def bogo_sort_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None):
    """
    Runs the Bogo Sort visualization. Shuffles randomly until sorted.
    Can be aborted at any step when stop_event is set.
    """
    try:
        if arr is None:
            arr = random.sample(range(24), COLS)
        else:
            arr = list(arr)
            
        print(f"\nBogo Sort starting state: {arr}")
        comparison_count = 0
        
        # Render initial state
        draw_array(strip, arr)
        
        # Pause to let the user see the starting state
        if not responsive_sleep(1.5, stop_event):
            return
            
        while not stop_event.is_set():
            # Check if sorted from left to right
            is_sorted = True
            for i in range(COLS - 1):
                if stop_event.is_set():
                    return
                    
                comparison_count += 1
                
                # Highlight elements being checked
                draw_array(strip, arr, compared_indices=[i, i+1])
                
                # Play tone for the checked element
                if sound_enabled and sound_list:
                    sound_list[arr[i]].set_volume(volume)
                    sound_list[arr[i]].play()
                    
                # Sleep based on speed
                if not responsive_sleep(speed, stop_event):
                    return
                    
                if arr[i] > arr[i+1]:
                    is_sorted = False
                    break
                    
            if is_sorted:
                # Play the last element's tone on success
                if sound_enabled and sound_list:
                    sound_list[arr[COLS-1]].set_volume(volume)
                    sound_list[arr[COLS-1]].play()
                
                # Mark all elements as sorted
                sorted_indices = set(range(COLS))
                draw_array(strip, arr, sorted_indices=sorted_indices)
                if not responsive_sleep(0.5, stop_event):
                    return
                    
                run_success_animation(strip, arr, sound_list, speed, sound_enabled, volume, stop_event, comparisons=comparison_count)
                break
            else:
                # Shuffle the array again
                random.shuffle(arr)
                
                # Draw the shuffled array
                draw_array(strip, arr)
                
                # Short pause before next check
                if not responsive_sleep(speed * 2, stop_event):
                    return
                    
    finally:
        # Clear the display on exit/cancellation
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, COLOR_BLACK)
        strip.show()
        strip.show()

def cocktail_sort_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None):
    """
    Runs the Cocktail Shaker Sort visualization.
    Sweeps back and forth comparing and swapping adjacent elements.
    Can be aborted at any step when stop_event is set.
    """
    try:
        if arr is None:
            arr = random.sample(range(24), COLS)
        else:
            arr = list(arr)
            
        print(f"\nCocktail Sort starting state: {arr}")
        
        n = len(arr)
        sorted_indices = set()
        comparison_count = 0
        
        # Render initial state
        draw_array(strip, arr, sorted_indices=sorted_indices)
        
        # Pause to let the user see the starting state
        if not responsive_sleep(1.5, stop_event):
            return
            
        start = 0
        end = n - 1
        swapped = True
        
        while swapped and not stop_event.is_set():
            swapped = False
            
            # 1. Forward Pass (Left to Right)
            for i in range(start, end):
                if stop_event.is_set():
                    return
                    
                comparison_count += 1
                
                # Highlight compared columns
                draw_array(strip, arr, compared_indices=[i, i+1], sorted_indices=sorted_indices)
                
                # Play audio tones for compared items
                if sound_enabled and sound_list:
                    sound_list[arr[i]].set_volume(volume)
                    sound_list[arr[i+1]].set_volume(volume)
                    sound_list[arr[i]].play()
                    sound_list[arr[i+1]].play()
                    
                if not responsive_sleep(speed, stop_event):
                    return
                    
                if arr[i] > arr[i+1]:
                    arr[i], arr[i+1] = arr[i+1], arr[i]
                    swapped = True
                    
                    # Highlight swapped columns
                    draw_array(strip, arr, swapped_indices=[i, i+1], sorted_indices=sorted_indices)
                    
                    if sound_enabled and sound_list:
                        sound_list[arr[i+1]].set_volume(volume)
                        sound_list[arr[i+1]].play()
                        
                    if not responsive_sleep(speed, stop_event):
                        return
                        
            if not swapped:
                break
                
            # The item at end is now in its sorted position
            sorted_indices.add(end)
            end -= 1
            
            # 2. Backward Pass (Right to Left)
            swapped = False
            for i in range(end - 1, start - 1, -1):
                if stop_event.is_set():
                    return
                    
                comparison_count += 1
                
                # Highlight compared columns
                draw_array(strip, arr, compared_indices=[i, i+1], sorted_indices=sorted_indices)
                
                # Play audio tones for compared items
                if sound_enabled and sound_list:
                    sound_list[arr[i]].set_volume(volume)
                    sound_list[arr[i+1]].set_volume(volume)
                    sound_list[arr[i]].play()
                    sound_list[arr[i+1]].play()
                    
                if not responsive_sleep(speed, stop_event):
                    return
                    
                if arr[i] > arr[i+1]:
                    arr[i], arr[i+1] = arr[i+1], arr[i]
                    swapped = True
                    
                    # Highlight swapped columns
                    draw_array(strip, arr, swapped_indices=[i, i+1], sorted_indices=sorted_indices)
                    
                    if sound_enabled and sound_list:
                        sound_list[arr[i]].set_volume(volume)
                        sound_list[arr[i]].play()
                        
                    if not responsive_sleep(speed, stop_event):
                        return
                        
            # The item at start is now in its sorted position
            sorted_indices.add(start)
            start += 1
            
        # Mark all elements as sorted
        sorted_indices = set(range(COLS))
        draw_array(strip, arr, sorted_indices=sorted_indices)
        if not responsive_sleep(0.5, stop_event):
            return
            
        run_success_animation(strip, arr, sound_list, speed, sound_enabled, volume, stop_event, comparisons=comparison_count)
        
    finally:
        # Clear the display on exit/cancellation
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, COLOR_BLACK)
        strip.show()

def selection_sort_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None):
    """
    Runs the Selection Sort visualization.
    Finds the minimum element from the unsorted part and puts it at the beginning.
    """
    try:
        if arr is None:
            arr = random.sample(range(24), COLS)
        else:
            arr = list(arr)
            
        print(f"\nSelection Sort starting state: {arr}")
        n = len(arr)
        sorted_indices = set()
        comparison_count = 0
        
        draw_array(strip, arr, sorted_indices=sorted_indices)
        if not responsive_sleep(1.5, stop_event):
            return
 
        for i in range(n):
            if stop_event.is_set():
                return
            min_idx = i
            for j in range(i + 1, n):
                if stop_event.is_set():
                    return
                
                comparison_count += 1
                
                # Highlight compared elements (current min and the scan index j)
                draw_array(strip, arr, compared_indices=[min_idx, j], sorted_indices=sorted_indices)
                if sound_enabled and sound_list:
                    sound_list[arr[j]].set_volume(volume)
                    sound_list[arr[j]].play()
                if not responsive_sleep(speed, stop_event):
                    return
                if arr[j] < arr[min_idx]:
                    min_idx = j
 
            if min_idx != i:
                arr[i], arr[min_idx] = arr[min_idx], arr[i]
                draw_array(strip, arr, swapped_indices=[i, min_idx], sorted_indices=sorted_indices)
                if sound_enabled and sound_list:
                    sound_list[arr[i]].set_volume(volume)
                    sound_list[arr[i]].play()
                if not responsive_sleep(speed, stop_event):
                    return
            
            sorted_indices.add(i)
 
        sorted_indices = set(range(COLS))
        draw_array(strip, arr, sorted_indices=sorted_indices)
        if not responsive_sleep(0.5, stop_event):
            return
        run_success_animation(strip, arr, sound_list, speed, sound_enabled, volume, stop_event, comparisons=comparison_count)
        
    finally:
        # Clear the display on exit/cancellation
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, COLOR_BLACK)
        strip.show()

def insertion_sort_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None):
    """
    Runs the Insertion Sort visualization.
    Inserts elements sequentially into their sorted position in the prefix.
    """
    try:
        if arr is None:
            arr = random.sample(range(24), COLS)
        else:
            arr = list(arr)
            
        print(f"\nInsertion Sort starting state: {arr}")
        n = len(arr)
        sorted_indices = set()
        comparison_count = 0
        
        draw_array(strip, arr, sorted_indices=sorted_indices)
        if not responsive_sleep(1.5, stop_event):
            return
 
        for i in range(1, n):
            if stop_event.is_set():
                return
            key = arr[i]
            j = i - 1
            
            # The prefix up to i-1 is relatively sorted
            sorted_indices = set(range(i))
            
            # Highlight key position and comparing
            draw_array(strip, arr, compared_indices=[i], sorted_indices=sorted_indices)
            if not responsive_sleep(speed, stop_event):
                return
 
            while j >= 0:
                comparison_count += 1
                if arr[j] > key:
                    if stop_event.is_set():
                        return
                    # Highlight shifting elements
                    draw_array(strip, arr, compared_indices=[j, j + 1], sorted_indices=sorted_indices)
                    if sound_enabled and sound_list:
                        sound_list[arr[j]].set_volume(volume)
                        sound_list[arr[j]].play()
                    
                    arr[j + 1] = arr[j]
                    if not responsive_sleep(speed, stop_event):
                        return
                    j -= 1
                else:
                    break
                
            arr[j + 1] = key
            # Highlight final insert position
            draw_array(strip, arr, swapped_indices=[j + 1], sorted_indices=sorted_indices)
            if sound_enabled and sound_list:
                sound_list[key].set_volume(volume)
                sound_list[key].play()
            if not responsive_sleep(speed, stop_event):
                return
 
        sorted_indices = set(range(COLS))
        draw_array(strip, arr, sorted_indices=sorted_indices)
        if not responsive_sleep(0.5, stop_event):
            return
        run_success_animation(strip, arr, sound_list, speed, sound_enabled, volume, stop_event, comparisons=comparison_count)
        
    finally:
        # Clear the display on exit/cancellation
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, COLOR_BLACK)
        strip.show()

def merge_sort_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None):
    """
    Runs the Merge Sort visualization recursively.
    Divides and merges segments in-place, updating the display on write-backs.
    """
    try:
        if arr is None:
            arr = random.sample(range(24), COLS)
        else:
            arr = list(arr)
            
        print(f"\nMerge Sort starting state: {arr}")
        comparison_count = 0
        draw_array(strip, arr)
        if not responsive_sleep(1.5, stop_event):
            return
 
        def merge_sort_recursive(l, r):
            if stop_event.is_set():
                return
            if l >= r:
                return
            mid = (l + r) // 2
            merge_sort_recursive(l, mid)
            merge_sort_recursive(mid + 1, r)
            merge(l, mid, r)
 
        def merge(l, mid, r):
            nonlocal comparison_count
            if stop_event.is_set():
                return
            left_arr = arr[l : mid + 1]
            right_arr = arr[mid + 1 : r + 1]
            i = 0
            j = 0
            k = l
            while i < len(left_arr) and j < len(right_arr):
                if stop_event.is_set():
                    return
                
                comparison_count += 1
                
                # Highlight compared elements
                draw_array(strip, arr, compared_indices=[l + i, mid + 1 + j])
                if sound_enabled and sound_list:
                    sound_list[left_arr[i]].set_volume(volume)
                    sound_list[right_arr[j]].set_volume(volume)
                    sound_list[left_arr[i]].play()
                    sound_list[right_arr[j]].play()
                if not responsive_sleep(speed, stop_event):
                    return
                
                if left_arr[i] <= right_arr[j]:
                    arr[k] = left_arr[i]
                    i += 1
                else:
                    arr[k] = right_arr[j]
                    j += 1
                
                draw_array(strip, arr, swapped_indices=[k])
                if sound_enabled and sound_list:
                    sound_list[arr[k]].set_volume(volume)
                    sound_list[arr[k]].play()
                if not responsive_sleep(speed, stop_event):
                    return
                k += 1
                
            while i < len(left_arr):
                if stop_event.is_set():
                    return
                arr[k] = left_arr[i]
                draw_array(strip, arr, swapped_indices=[k])
                if sound_enabled and sound_list:
                    sound_list[arr[k]].set_volume(volume)
                    sound_list[arr[k]].play()
                if not responsive_sleep(speed, stop_event):
                    return
                i += 1
                k += 1

            while j < len(right_arr):
                if stop_event.is_set():
                    return
                arr[k] = right_arr[j]
                draw_array(strip, arr, swapped_indices=[k])
                if sound_enabled and sound_list:
                    sound_list[arr[k]].set_volume(volume)
                    sound_list[arr[k]].play()
                if not responsive_sleep(speed, stop_event):
                    return
                j += 1
                k += 1

        merge_sort_recursive(0, COLS - 1)
        if stop_event.is_set():
            return
        
        # Once fully sorted
        sorted_indices = set(range(COLS))
        draw_array(strip, arr, sorted_indices=sorted_indices)
        if not responsive_sleep(0.5, stop_event):
            return
        run_success_animation(strip, arr, sound_list, speed, sound_enabled, volume, stop_event, comparisons=comparison_count)
        
    finally:
        # Clear the display on exit/cancellation
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, COLOR_BLACK)
        strip.show()

def quick_sort_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None):
    """
    Runs the Quick Sort visualization recursively using Lomuto partitioning.
    """
    try:
        if arr is None:
            arr = random.sample(range(24), COLS)
        else:
            arr = list(arr)
            
        print(f"\nQuick Sort starting state: {arr}")
        comparison_count = 0
        draw_array(strip, arr)
        if not responsive_sleep(1.5, stop_event):
            return
 
        def quick_sort_recursive(l, r):
            if stop_event.is_set():
                return
            if l < r:
                p_idx = partition(l, r)
                quick_sort_recursive(l, p_idx - 1)
                quick_sort_recursive(p_idx + 1, r)
 
        def partition(l, r):
            nonlocal comparison_count
            if stop_event.is_set():
                return l
            pivot = arr[r]
            # Highlight pivot index r
            draw_array(strip, arr, compared_indices=[r])
            if not responsive_sleep(speed, stop_event):
                return l
                
            i = l - 1
            for j in range(l, r):
                if stop_event.is_set():
                    return l
                
                comparison_count += 1
                
                # Highlight compared element j and pivot r
                draw_array(strip, arr, compared_indices=[j, r])
                if sound_enabled and sound_list:
                    sound_list[arr[j]].set_volume(volume)
                    sound_list[arr[r]].set_volume(volume)
                    sound_list[arr[j]].play()
                    sound_list[arr[r]].play()
                if not responsive_sleep(speed, stop_event):
                    return l
                
                if arr[j] < pivot:
                    i += 1
                    arr[i], arr[j] = arr[j], arr[i]
                    draw_array(strip, arr, swapped_indices=[i, j])
                    if sound_enabled and sound_list:
                        sound_list[arr[i]].set_volume(volume)
                        sound_list[arr[i]].play()
                    if not responsive_sleep(speed, stop_event):
                        return l
            
            arr[i + 1], arr[r] = arr[r], arr[i + 1]
            draw_array(strip, arr, swapped_indices=[i + 1, r])
            if sound_enabled and sound_list:
                sound_list[arr[i + 1]].set_volume(volume)
                sound_list[arr[i + 1]].play()
            if not responsive_sleep(speed, stop_event):
                return l
            
            return i + 1
 
        quick_sort_recursive(0, COLS - 1)
        if stop_event.is_set():
            return
            
        # Once fully sorted
        sorted_indices = set(range(COLS))
        draw_array(strip, arr, sorted_indices=sorted_indices)
        if not responsive_sleep(0.5, stop_event):
            return
        run_success_animation(strip, arr, sound_list, speed, sound_enabled, volume, stop_event, comparisons=comparison_count)
        
    finally:
        # Clear the display on exit/cancellation
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, COLOR_BLACK)
        strip.show()

def radix_sort_visualize(strip, sound_list, speed, sound_enabled, volume, stop_event, arr=None):
    """
    Runs the Radix Sort visualization (LSD base-10 radix sort).
    Sorts elements by units, then tens digits.
    """
    try:
        if arr is None:
            arr = random.sample(range(24), COLS)
        else:
            arr = list(arr)
            
        print(f"\nRadix Sort starting state: {arr}")
        draw_array(strip, arr)
        if not responsive_sleep(1.5, stop_event):
            return
 
        # Max value is 23, so we sort by units (exp=1) and tens (exp=10)
        for exp in [1, 10]:
            if stop_event.is_set():
                return
                
            # 1. Bucket elements
            buckets = [[] for _ in range(10)]
            for idx in range(COLS):
                if stop_event.is_set():
                    return
                val = arr[idx]
                digit = (val // exp) % 10
                buckets[digit].append(val)
                
                # Highlight scanning element
                draw_array(strip, arr, compared_indices=[idx])
                if sound_enabled and sound_list:
                    sound_list[val].set_volume(volume)
                    sound_list[val].play()
                if not responsive_sleep(speed, stop_event):
                    return
 
            # 2. Write back to arr
            k = 0
            for b_idx in range(10):
                for val in buckets[b_idx]:
                    if stop_event.is_set():
                        return
                    arr[k] = val
                    draw_array(strip, arr, swapped_indices=[k])
                    if sound_enabled and sound_list:
                        sound_list[val].set_volume(volume)
                        sound_list[val].play()
                    if not responsive_sleep(speed, stop_event):
                        return
                    k += 1
 
        # Once fully sorted
        sorted_indices = set(range(COLS))
        draw_array(strip, arr, sorted_indices=sorted_indices)
        if not responsive_sleep(0.5, stop_event):
            return
        run_success_animation(strip, arr, sound_list, speed, sound_enabled, volume, stop_event, comparisons=0)
        
    finally:
        # Clear the display on exit/cancellation
        for i in range(strip.numPixels()):
            strip.setPixelColor(i, COLOR_BLACK)
        strip.show()

def play_song_visualize(strip, song_filename, speed, volume, stop_event, vis_mode_state=None):
    """
    Plays a custom song (WAV/MP3) located in 'sounds/songs/' or fallbacks
    and animates a series of 5 varied, premium visual sequences in a loop:
      1. Equalizer simulation (bouncing vertical bars with colorful gradients)
      2. Concentric ripple waves pulsing from the center outward/inward
      3. Horizontally scrolling sine waves with phase-shifting
      4. Stardust rainfall (random sparkling pixels fading smoothly)
      5. Scrolling diagonal rainbow spectrum waves
    """
    import pygame
    import random
    import math

    # 1. Locate the file in sounds/songs or fallback to sounds
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
        test_path = os.path.join(p, song_filename)
        if os.path.exists(test_path):
            song_path = test_path
            break

    if not song_path:
        print(f"Error: Song file {song_filename} not found in any directories.")
        return

    try:
        # Ensure mixer is initialized
        if not pygame.mixer.get_init():
            try:
                pygame.mixer.init()
            except Exception as mixer_err:
                print(f"Error: Failed to initialize pygame mixer: {mixer_err}")
                return

        # Load and play the song
        pygame.mixer.music.load(song_path)
        pygame.mixer.music.set_volume(volume)
        pygame.mixer.music.play()
        print(f"Started song playback for: {song_path}")

        # Color helpers
        def wheel(pos):
            pos = int(pos) & 255
            if pos < 85:
                return Color(pos * 3, 255 - pos * 3, 0)
            elif pos < 170:
                pos -= 85
                return Color(255 - pos * 3, 0, pos * 3)
            else:
                pos -= 170
                return Color(0, pos * 3, 255 - pos * 3)

        # Helper to check playback status
        def check_exit():
            return stop_event.is_set() or (not pygame.mixer.music.get_busy() and not getattr(stop_event, "is_paused", False))

        # Let's track active visualizer phase (each runs for roughly 6 seconds)
        phase_duration = 6.0
        
        # Clear matrix at start
        clear_matrix(strip)

        # Main animation loop while music is active
        start_time = time.time()
        current_phase = 0

        # Maintain a matrix state for raindrop/stardust fade-outs
        stars_brightness = [0] * strip.numPixels()
        stars_colors = [Color(0,0,0)] * strip.numPixels()

        while not check_exit():
            # Check if paused
            if getattr(stop_event, "is_paused", False):
                if not responsive_sleep(0.1, stop_event):
                    return
                continue

            now = time.time()
            elapsed = now - start_time
            
            mode_val = "loop"
            if vis_mode_state and "mode" in vis_mode_state:
                mode_val = vis_mode_state["mode"]
            
            # Switch phase based on mode
            if mode_val == "loop":
                if elapsed >= phase_duration:
                    current_phase = (current_phase + 1) % 6
                    start_time = now
                    clear_matrix(strip)
                    stars_brightness = [0] * strip.numPixels() # reset stars
            elif str(mode_val).isdigit():
                target_phase = int(mode_val) % 6
                if current_phase != target_phase:
                    current_phase = target_phase
                    start_time = now
                    clear_matrix(strip)
                    stars_brightness = [0] * strip.numPixels()
            elif mode_val == "artwork":
                if current_phase != 99:
                    current_phase = 99
                    start_time = now
                    clear_matrix(strip)
                    stars_brightness = [0] * strip.numPixels()
                
                # Render the artwork pixels received from Next.js
                artwork_pixels = vis_mode_state.get("artwork_pixels")
                if current_phase == 99:
                    if artwork_pixels and len(artwork_pixels) == COLS:
                        y_offset = (ROWS - COLS) // 2
                        for y in range(COLS):
                            for x in range(COLS):
                                # pixels are nested [ [ [R,G,B], [R,G,B]... ], ... ]
                                if y < len(artwork_pixels) and x < len(artwork_pixels[y]):
                                    r, g, b = artwork_pixels[y][x]
                                    idx = xy_to_index(x, y + y_offset)
                                    if idx is not None:
                                        # Matrix expects GRB
                                        strip.setPixelColor(idx, Color(g, r, b))
                        strip.show()
                    if not responsive_sleep(0.5, stop_event): return
                    continue
            
            # --- PATTERN 0: Equalizer simulation ---
            if current_phase == 0:
                # 20 columns, each gets a height
                for x in range(COLS):
                    t = time.time() * 8.0 + x * 0.5
                    height = int((math.sin(t) + 1.0) / 2.0 * (ROWS - 1)) + 1
                    for y in range(ROWS):
                        idx = xy_to_index(x, (ROWS - 1) - y)
                        if idx is not None:
                            if y < height:
                                # Colors for GRB strip (Red bottom, Yellow middle, Green top)
                                if y < ROWS * 0.5:
                                    color = Color(0, 255, 0)
                                elif y < ROWS * 0.8:
                                    color = Color(255, 255, 0)
                                else:
                                    color = Color(255, 0, 0)
                                strip.setPixelColor(idx, color)
                            else:
                                strip.setPixelColor(idx, Color(0, 0, 0))
                strip.show()
                if not responsive_sleep(0.04, stop_event): return

            # --- PATTERN 1: Concentric Ripple Waves ---
            elif current_phase == 1:
                cx, cy = COLS / 2.0, ROWS / 2.0
                t = time.time() * 12.0
                for y in range(ROWS):
                    for x in range(COLS):
                        idx = xy_to_index(x, y)
                        if idx is not None:
                            dx = x - cx
                            dy = y - cy
                            dist = math.sqrt(dx*dx + dy*dy)
                            brightness_wave = math.sin(dist * 0.8 - t)
                            if brightness_wave > 0.4:
                                color = wheel(dist * 15 + t * 4)
                                strip.setPixelColor(idx, color)
                            else:
                                strip.setPixelColor(idx, Color(0, 0, 0))
                strip.show()
                if not responsive_sleep(0.05, stop_event): return

            # --- PATTERN 2: Smooth Plasma Lava (Warm Colors) ---
            elif current_phase == 2:
                t = time.time() * 2.0
                for y in range(ROWS):
                    for x in range(COLS):
                        v1 = math.sin(x * 0.3 + t)
                        v2 = math.sin(y * 0.3 - t * 0.8)
                        v3 = math.sin((x + y + t) * 0.2)
                        val = (v1 + v2 + v3 + 3.0) / 6.0  # Normalize to 0-1
                        
                        # Map val to 0-45 to keep colors strictly Red/Orange/Yellow on wheel
                        color_idx = int(val * 45)
                        idx = xy_to_index(x, y)
                        if idx is not None:
                            strip.setPixelColor(idx, wheel(color_idx))
                strip.show()
                if not responsive_sleep(0.05, stop_event): return

            # --- PATTERN 3: Fire / Flame Simulation (Warm Colors) ---
            elif current_phase == 3:
                t = time.time() * 8.0
                for x in range(COLS):
                    # Oscillating flame heights
                    base_h = (math.sin(x * 0.8 + t * 0.5) + math.cos(x * 1.5 - t * 0.3)) * 2.5 + (ROWS * 0.35)
                    for y in range(ROWS):
                        idx = xy_to_index(x, (ROWS - 1) - y)
                        if idx is not None:
                            if y <= base_h:
                                intensity = 1.0 - (y / base_h)
                                r = 255
                                g = int(140 * intensity)
                                b = int(20 * (intensity ** 2))
                                # Hardware expects GRB order
                                strip.setPixelColor(idx, Color(g, r, b))
                            elif y <= base_h + 3 and random.random() > 0.6:
                                strip.setPixelColor(idx, Color(80, 255, 0)) # Orange sparks
                            else:
                                strip.setPixelColor(idx, Color(0, 0, 0))
                strip.show()
                if not responsive_sleep(0.06, stop_event): return

            # --- PATTERN 4: Stardust Rainfall ---
            elif current_phase == 4:
                if random.random() < 0.3:
                    for _ in range(random.randint(1, 3)):
                        rx = random.randint(0, COLS - 1)
                        ry = random.randint(0, ROWS - 1)
                        ridx = xy_to_index(rx, ry)
                        if ridx is not None:
                            stars_brightness[ridx] = 255
                            stars_colors[ridx] = wheel(random.randint(0, 255))

                for i in range(strip.numPixels()):
                    if stars_brightness[i] > 0:
                        stars_brightness[i] = max(0, stars_brightness[i] - 25)
                        b = stars_brightness[i]
                        c = stars_colors[i]
                        r = int(((c >> 16) & 0xFF) * b / 255)
                        g = int(((c >> 8) & 0xFF) * b / 255)
                        bl = int((c & 0xFF) * b / 255)
                        strip.setPixelColor(i, Color(r, g, bl))
                    else:
                        strip.setPixelColor(i, Color(0, 0, 0))
                strip.show()
                if not responsive_sleep(0.04, stop_event): return

            # --- PATTERN 5: Diagonal Color Wash ---
            elif current_phase == 5:
                t = time.time() * 40.0
                for y in range(ROWS):
                    for x in range(COLS):
                        idx = xy_to_index(x, y)
                        if idx is not None:
                            pos = int((x - y) * 10 + t) & 255
                            strip.setPixelColor(idx, wheel(pos))
                strip.show()
                if not responsive_sleep(0.04, stop_event): return

    except Exception as e:
        print(f"Error playing song visualization: {e}")
    finally:
        try:
            if pygame.mixer.get_init():
                pygame.mixer.music.stop()
                if hasattr(pygame.mixer.music, 'unload'):
                    pygame.mixer.music.unload()
        except Exception:
            pass
        clear_matrix(strip)
        print(f"Playback finished for song: {song_filename}")

def life_goes_on_visualize(strip, speed, volume, stop_event):
    """
    Backwards compatibility wrapper to play life-goes-on.wav.
    """
    play_song_visualize(strip, "life-goes-on.wav", speed, volume, stop_event)


# ==============================================================================
# Glyph Typography & Text Rendering Operations
# ==============================================================================

FONTS_DATA = {}
FONT_METRICS = {
    "font3x5": {"width": 3, "height": 5, "tile_width": 4, "tile_height": 6, "cols_fit": 5, "rows_fit": 4},
    "font5x7": {"width": 5, "height": 7, "tile_width": 6, "tile_height": 8, "cols_fit": 3, "rows_fit": 3},
    "font8x8": {"width": 8, "height": 8, "tile_width": 8, "tile_height": 8, "cols_fit": 2, "rows_fit": 3},
    "fontplayful": {"width": 5, "height": 7, "tile_width": 6, "tile_height": 8, "cols_fit": 3, "rows_fit": 3}
}

def load_fonts():
    global FONTS_DATA
    if not FONTS_DATA:
        fonts_path = os.path.join(os.path.dirname(__file__), "Glyphs", "fonts.json")
        try:
            with open(fonts_path, "r") as f:
                FONTS_DATA = json.load(f)
            print("Loaded fonts.json successfully.")
        except Exception as e:
            print(f"Error loading fonts.json: {e}")
            FONTS_DATA = {}

def draw_glyph(strip, name, color=None):
    if color is None:
        color_resolved = Color(0, 255, 0)
    elif isinstance(color, str):
        color_resolved = parse_color(color)
    else:
        color_resolved = color
    load_fonts()
    
    # Glyphs are stored under the "glyphs" key in fonts.json
    glyphs_dict = FONTS_DATA.get("glyphs", {})
    glyph = glyphs_dict.get(name)
    
    if not glyph:
        print(f"Glyph {name} not found.")
        return
        
    clear_matrix(strip)
    for r in range(min(ROWS, len(glyph))):
        for c in range(min(COLS, len(glyph[r]))):
            if glyph[r][c] == 1:
                idx = xy_to_index(c, r)
                strip.setPixelColor(idx, color_resolved)
    strip.show()

def draw_text_static(strip, text, font_name="font5x7", color=None):
    if color is None:
        color_resolved = Color(0, 255, 0) # Default Red in physical GRB
    elif isinstance(color, str):
        color_resolved = parse_color(color)
    else:
        color_resolved = color
    load_fonts()
    font = FONTS_DATA.get(font_name, {})
    metrics = FONT_METRICS.get(font_name, FONT_METRICS["font5x7"])
    
    tile_w = metrics["tile_width"]
    tile_h = metrics["tile_height"]
    cols_fit = metrics["cols_fit"]
    rows_fit = metrics["rows_fit"]
    max_chars = cols_fit * rows_fit
    
    chars = text[:max_chars].upper()
    
    # Clear strip
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, COLOR_BLACK)
        
    for idx, char in enumerate(chars):
        matrix = font.get(char, font.get(" ", []))
        if not matrix:
            continue
        
        tile_col = idx % cols_fit
        tile_row = idx // cols_fit
        
        start_col = tile_col * tile_w
        start_row = tile_row * tile_h
        
        for r in range(len(matrix)):
            for c in range(len(matrix[r])):
                target_r = start_row + r
                target_c = start_col + c
                if target_r < ROWS and target_c < COLS:
                    pixel_val = matrix[r][c]
                    if pixel_val == 1:
                        idx_strip = xy_to_index(target_c, target_r)
                        if idx_strip is not None:
                            strip.setPixelColor(idx_strip, color_resolved)
    strip.show()

def draw_text_static_centered_y(strip, text, font_name="font3x5", color=None):
    if color is None:
        color_resolved = Color(0, 255, 0) # Default Red in physical GRB
    elif isinstance(color, str):
        color_resolved = parse_color(color)
    else:
        color_resolved = color
    load_fonts()
    font = FONTS_DATA.get(font_name, {})
    metrics = FONT_METRICS.get(font_name, FONT_METRICS["font3x5"])
    
    tile_w = metrics["tile_width"]
    font_h = metrics["height"]
    
    # Vertically center on the 24-row display
    start_row = (ROWS - font_h) // 2 # (24 - 5) // 2 = 9
    
    # Clear strip
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, COLOR_BLACK)
        
    for idx, char in enumerate(text[:5]): # Max 5 characters fit horizontally (5 * 4 = 20 columns)
        matrix = font.get(char, font.get(" ", []))
        if not matrix:
            continue
        
        start_col = idx * tile_w
        
        for r in range(len(matrix)):
            for c in range(len(matrix[r])):
                target_r = start_row + r
                target_c = start_col + c
                if target_r < ROWS and target_c < COLS:
                    pixel_val = matrix[r][c]
                    if pixel_val == 1:
                        idx_strip = xy_to_index(target_c, target_r)
                        if idx_strip is not None:
                            strip.setPixelColor(idx_strip, color_resolved)
    strip.show()


def draw_text_scroll_loop(strip, text, font_name="font5x7", speed=0.08, color=None, stop_event=None):
    if color is None:
        color_resolved = Color(0, 255, 0) # Default Red in physical GRB
    elif isinstance(color, str):
        color_resolved = parse_color(color)
    else:
        color_resolved = color
    load_fonts()
    font = FONTS_DATA.get(font_name, {})
    metrics = FONT_METRICS.get(font_name, FONT_METRICS["font5x7"])
    
    font_h = metrics["height"]
    tile_w = metrics["tile_width"]
    
    canvas_w = len(text) * tile_w
    if canvas_w == 0:
        return
        
    text_canvas = [[0 for _ in range(canvas_w)] for _ in range(font_h)]
    
    for idx, char in enumerate(text.upper()):
        matrix = font.get(char, font.get(" ", []))
        if not matrix:
            continue
        start_col = idx * tile_w
        for r in range(len(matrix)):
            for c in range(len(matrix[r])):
                if r < font_h and (start_col + c) < canvas_w:
                    text_canvas[r][start_col + c] = matrix[r][c]
                    
    offset = COLS
    start_row = (ROWS - font_h) // 2
    
    while not stop_event.is_set():
        for r in range(font_h):
            target_r = start_row + r
            if target_r < 0 or target_r >= ROWS:
                continue
            for c in range(COLS):
                virtual_c = c - offset
                idx_strip = xy_to_index(c, target_r)
                if idx_strip is not None:
                    if 0 <= virtual_c < canvas_w and text_canvas[r][virtual_c] == 1:
                        strip.setPixelColor(idx_strip, color_resolved)
                    else:
                        strip.setPixelColor(idx_strip, COLOR_BLACK)
        strip.show()
        
        if not responsive_sleep(speed, stop_event):
            break
            
        offset -= 1
        if offset < -canvas_w:
            offset = COLS

CHARS_8x10 = {
    "0": [
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0]
    ],
    "1": [
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,1,0,0,0],
        [0,1,1,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,0,1,1,0,0,0],
        [0,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,0]
    ],
    "2": [
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,0,0,0,0],
        [0,1,1,0,0,0,0,0],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1]
    ],
    "3": [
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,1,1,1,1,0,0],
        [0,0,1,1,1,1,0,0],
        [0,0,0,0,0,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0]
    ],
    "4": [
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,1,1,0],
        [0,0,0,0,0,1,1,0]
    ],
    "5": [
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,1,0],
        [0,0,0,0,0,1,1,1],
        [0,0,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0]
    ],
    "6": [
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0]
    ],
    "7": [
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [0,0,0,0,0,1,1,1],
        [0,0,0,0,1,1,1,0],
        [0,0,0,1,1,1,0,0],
        [0,0,0,1,1,0,0,0],
        [0,0,1,1,0,0,0,0],
        [0,0,1,1,0,0,0,0],
        [0,0,1,1,0,0,0,0],
        [0,0,1,1,0,0,0,0]
    ],
    "8": [
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,0],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0]
    ],
    "9": [
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [0,1,1,1,1,1,1,1],
        [0,0,1,1,1,1,1,1],
        [0,0,0,0,0,1,1,1],
        [0,0,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0]
    ],
    "D": [
        [1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,0,0]
    ],
    "O": [
        [0,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,0,0,0,0,1,1],
        [1,1,1,1,1,1,1,1],
        [0,1,1,1,1,1,1,0]
    ],
    "N": [
        [1,1,0,0,0,1,1,0],
        [1,1,1,0,0,1,1,0],
        [1,1,1,1,0,1,1,0],
        [1,1,0,1,1,1,1,0],
        [1,1,0,0,1,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0],
        [1,1,0,0,0,1,1,0]
    ],
    "E": [
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,0,0],
        [1,1,1,1,1,1,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1]
    ]
}

def parse_color(color_str):
    """
    Parses a color string (CSS name or #RRGGBB hex) into a Color object.
    Translates standard RGB to the physical GRB layout: Color(G, R, B).
    """
    if not color_str:
        return Color(255, 0, 0)  # Default Green (GRB)
    color_str = color_str.lower().strip()
    if color_str == "red":
        return Color(0, 255, 0)
    elif color_str == "green":
        return Color(255, 0, 0)
    elif color_str == "blue":
        return Color(0, 0, 255)
    elif color_str == "yellow" or color_str == "amber":
        return Color(255, 255, 0)
    elif color_str == "orange":
        return Color(127, 255, 0)
    elif color_str == "white":
        return Color(255, 255, 255)
    elif color_str == "cyan":
        return Color(255, 0, 255)
    elif color_str == "magenta":
        return Color(0, 255, 255)
    elif color_str.startswith("#"):
        hex_val = color_str.lstrip("#")
        if len(hex_val) == 6:
            try:
                r = int(hex_val[0:2], 16)
                g = int(hex_val[2:4], 16)
                b = int(hex_val[4:6], 16)
                return Color(g, r, b)  # GRB order
            except ValueError:
                pass
    return Color(255, 0, 0)

def play_cuckoo_sound(volume=0.25):
    """
    Plays the 'cuckoo.wav' sound file on the hour.
    """
    try:
        import pygame
        # Ensure mixer is initialized
        if not pygame.mixer.get_init():
            try:
                pygame.mixer.init()
            except Exception as mixer_err:
                print(f"Warning: Failed to initialize pygame mixer in play_cuckoo_sound: {mixer_err}")
                return None
                
        possible_paths = [
            "sounds",
            os.path.expanduser("~/sounds"),
            os.path.expanduser("~/LED-Matrix/sounds"),
            "/home/<YOUR_USERNAME>/sounds"
        ]
        filename = "cuckoo.wav"
        for p in possible_paths:
            file_path = os.path.join(p, filename)
            if os.path.exists(file_path):
                sound = pygame.mixer.Sound(file_path)
                sound.set_volume(volume)
                sound.play()
                print("Played cuckoo.wav successfully!")
                return sound
        print("Warning: cuckoo.wav not found in any possible sound paths.")
    except Exception as e:
        print(f"Warning: Could not play cuckoo sound: {e}")
    return None

def draw_clock_grid2x2(strip, time_str, color=None):
    if isinstance(color, str):
        color = parse_color(color)
    if color is None:
        color = Color(255, 0, 0)
        
    time_str = time_str.replace(":", "")
    if len(time_str) != 4:
        return
        
    # Clear screen
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, COLOR_BLACK)
        
    positions = [
        (1, 1),   # Top Left char
        (11, 1),  # Top Right char
        (1, 13),  # Bottom Left char
        (11, 13)  # Bottom Right char
    ]
    
    is_multi = (color == "multi") or (isinstance(color, str) and color.lower().strip() == "multi")
    
    for idx, char in enumerate(time_str):
        char_upper = char.upper()
        if char_upper not in CHARS_8x10:
            continue
        matrix = CHARS_8x10[char_upper]
        start_x, start_y = positions[idx]
        
        if is_multi:
            # Top in Blue, Bottom in Green
            digit_color = Color(0, 0, 255) if idx < 2 else Color(255, 0, 0)
        else:
            digit_color = color
            
        for r in range(10):
            for c in range(8):
                if matrix[r][c] == 1:
                    pixel_x = start_x + c
                    pixel_y = start_y + r
                    idx_strip = xy_to_index(pixel_x, pixel_y)
                    if idx_strip is not None:
                        strip.setPixelColor(idx_strip, digit_color)
    strip.show()

def time_visualize(strip, font_name="font3x5", scroll=False, speed=0.08, color=None, layout="standard", sound_enabled=True, volume=0.25, stop_event=None):
    if color is None:
        color = Color(255, 0, 0)
        
    is_multi = (isinstance(color, str) and color.lower().strip() == "multi")
    if isinstance(color, str) and not is_multi:
        color_resolved = parse_color(color)
    else:
        color_resolved = color
        
    load_fonts()
    last_cuckoo_hour = -1
    
    if layout == "grid2x2":
        last_time = ""
        while not stop_event.is_set():
            now = datetime.datetime.now()
            now_str = now.strftime("%H%M")
            if now_str != last_time:
                draw_clock_grid2x2(strip, now_str, color_resolved)
                last_time = now_str
                # Cuckoo chime on the hour
                if now.minute == 0 and now.hour != last_cuckoo_hour:
                    if sound_enabled:
                        play_cuckoo_sound(volume)
                    last_cuckoo_hour = now.hour
            if not responsive_sleep(0.5, stop_event):
                break
    elif layout == "centered_colon":
        last_time = ""
        while not stop_event.is_set():
            now = datetime.datetime.now()
            now_str = now.strftime("%H:%M")
            if now_str != last_time:
                draw_text_static_centered_y(strip, now_str, "font3x5", color_resolved)
                last_time = now_str
                # Cuckoo chime on the hour
                if now.minute == 0 and now.hour != last_cuckoo_hour:
                    if sound_enabled:
                        play_cuckoo_sound(volume)
                    last_cuckoo_hour = now.hour
            if not responsive_sleep(0.5, stop_event):
                break
    else:
        if color_resolved == "multi":
            color_resolved = Color(255, 0, 0)
            
        if not scroll:
            last_time = ""
            while not stop_event.is_set():
                now = datetime.datetime.now()
                now_str = now.strftime("%H:%M")
                if now_str != last_time:
                    draw_text_static(strip, now_str, font_name, color_resolved)
                    last_time = now_str
                    # Cuckoo chime on the hour
                    if now.minute == 0 and now.hour != last_cuckoo_hour:
                        if sound_enabled:
                            play_cuckoo_sound(volume)
                        last_cuckoo_hour = now.hour
                if not responsive_sleep(0.5, stop_event):
                    break
        else:
            metrics = FONT_METRICS.get(font_name, FONT_METRICS["font5x7"])
            font = FONTS_DATA.get(font_name, {})
            font_h = metrics["height"]
            tile_w = metrics["tile_width"]
            start_row = (ROWS - font_h) // 2
            
            offset = COLS
            while not stop_event.is_set():
                now = datetime.datetime.now()
                now_str = now.strftime("%H:%M:%S")
                # Cuckoo chime on the hour
                if now.minute == 0 and now.hour != last_cuckoo_hour:
                    if sound_enabled:
                        play_cuckoo_sound(volume)
                    last_cuckoo_hour = now.hour
                
                canvas_w = len(now_str) * tile_w
                text_canvas = [[0 for _ in range(canvas_w)] for _ in range(font_h)]
                
                for idx, char in enumerate(now_str):
                    matrix = font.get(char, font.get(" ", []))
                    if not matrix:
                        continue
                    start_col = idx * tile_w
                    for r in range(len(matrix)):
                        for c in range(len(matrix[r])):
                            if r < font_h and (start_col + c) < canvas_w:
                                text_canvas[r][start_col + c] = matrix[r][c]
                
                for r in range(font_h):
                    target_r = start_row + r
                    if target_r < 0 or target_r >= ROWS:
                        continue
                    for c in range(COLS):
                        virtual_c = c - offset
                        idx_strip = xy_to_index(c, target_r)
                        if idx_strip is not None:
                            if 0 <= virtual_c < canvas_w and text_canvas[r][virtual_c] == 1:
                                strip.setPixelColor(idx_strip, color_resolved)
                            else:
                                strip.setPixelColor(idx_strip, COLOR_BLACK)
                strip.show()
                
                if not responsive_sleep(speed, stop_event):
                    break
                    
                offset -= 1
                if offset < -canvas_w:
                    offset = COLS

_sound_cache = {}

def play_sound_by_name(filename, volume=0.25):
    """
    Plays a WAV file by name from the sounds directory, utilizing an in-memory cache.
    """
    global _sound_cache
    try:
        import pygame
        if not pygame.mixer.get_init():
            try:
                pygame.mixer.init()
            except Exception as mixer_err:
                print(f"Warning: Failed to initialize pygame mixer in play_sound_by_name: {mixer_err}")
                return None

        # Check in-memory cache first
        if filename in _sound_cache:
            sound = _sound_cache[filename]
            sound.set_volume(volume)
            pygame.mixer.stop()
            sound.play()
            return sound
                
        possible_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "sounds"),
            "sounds",
            os.path.expanduser("~/sounds"),
            os.path.expanduser("~/LED-Matrix-Code/sounds"),
            os.path.expanduser("~/LED-Matrix/sounds"),
            "/home/<YOUR_USERNAME>/LED-Matrix/sounds",
            "/home/<YOUR_USERNAME>/sounds"
        ]

        # Dynamically translate maths/ to math/ if directory is named math
        if filename.startswith("maths/"):
            for p in possible_paths:
                if os.path.isdir(os.path.join(p, "math")):
                    filename = "math/" + filename[6:]
                    break

        file_found = False
        for p in possible_paths:
            file_path = os.path.join(p, filename)
            if os.path.exists(file_path):
                sound = pygame.mixer.Sound(file_path)
                _sound_cache[filename] = sound # Store in cache
                sound.set_volume(volume)
                pygame.mixer.stop()
                sound.play()
                return sound
                
        if not file_found:
            print(f"Warning: Sound file not found on any path: {filename}")
            
    except Exception as e:
        print(f"Warning: Could not play sound {filename}: {e}")
    return None

def countdown_visualize(strip, total_seconds, font_name="font3x5", scroll=False, speed=0.08, color=None, layout="standard", sound_enabled=True, volume=0.25, stop_event=None):
    load_fonts()
    start_time = time.time()
    last_display = ""
    last_played_time = 0.0
    offset = COLS
    
    while not stop_event.is_set():
        elapsed = time.time() - start_time
        remaining_frac = max(0.0, total_seconds - elapsed)
        remaining = max(0, int(remaining_frac))
        
        # 1. Determine active color (White if > 60s, Red if <= 60s)
        if remaining > 60:
            active_color = Color(255, 255, 255) # White
        else:
            active_color = Color(0, 255, 0) # Red (GRB)
            
        # 2. Check for sound triggering in the last 10 seconds with accelerated tension beeps
        if 0.0 < remaining_frac <= 10.0:
            if 5.0 < remaining_frac <= 10.0:
                current_interval = 1.0
            elif 3.0 < remaining_frac <= 5.0:
                current_interval = 0.5
            elif 1.0 < remaining_frac <= 3.0:
                current_interval = 0.25
            else: # 0.0 < remaining_frac <= 1.0
                current_interval = 0.125

            if time.time() - last_played_time >= current_interval:
                sound_idx = 11 - max(1, min(10, int(remaining_frac)))
                if sound_enabled:
                    play_sound_by_name(f"{sound_idx}.wav", volume=volume)
                last_played_time = time.time()
            
        # Determine loop sleep duration based on remaining time (10ms precision under 11s)
        loop_sleep = 0.01 if remaining_frac <= 11.0 else 0.1

        # 3. Handle Completion (remaining == 0)
        if remaining == 0:
            # Play shutdown.wav
            if sound_enabled:
                play_sound_by_name("shutdown.wav", volume=volume)
            
            # Blink larger DONE 3 times
            for _ in range(3):
                if stop_event.is_set():
                    break
                draw_clock_grid2x2(strip, "DONE", Color(0, 255, 0)) # Red (GRB)
                if not responsive_sleep(0.5, stop_event):
                    break
                clear_matrix(strip)
                if not responsive_sleep(0.5, stop_event):
                    break
            break # Exit loop when complete
            
        # 4. Render current time
        mins = remaining // 60
        secs = remaining % 60
        
        if layout == "grid2x2":
            disp_str = f"{mins:02d}{secs:02d}"
            if disp_str != last_display:
                draw_clock_grid2x2(strip, disp_str, active_color)
                last_display = disp_str
            if not responsive_sleep(loop_sleep, stop_event):
                break
        elif layout == "centered_colon":
            # Centered 1-row layout (smaller, in the middle, with a colon)
            if not scroll:
                disp_str = f"{mins}:{secs:02d}"
                if disp_str != last_display:
                    draw_text_static_centered_y(strip, disp_str, "font3x5", active_color)
                    last_display = disp_str
                if not responsive_sleep(loop_sleep, stop_event):
                    break
            else:
                # Scroll mode (remains standard scrolling)
                disp_str = f"{mins}:{secs:02d}"
                metrics = FONT_METRICS.get(font_name, FONT_METRICS["font5x7"])
                font = FONTS_DATA.get(font_name, {})
                font_h = metrics["height"]
                tile_w = metrics["tile_width"]
                start_row = (ROWS - font_h) // 2
                
                canvas_w = len(disp_str) * tile_w
                text_canvas = [[0 for _ in range(canvas_w)] for _ in range(font_h)]
                
                for idx, char in enumerate(disp_str):
                    matrix = font.get(char, font.get(" ", []))
                    if not matrix:
                        continue
                    start_col = idx * tile_w
                    for r in range(len(matrix)):
                        for c in range(len(matrix[r])):
                            if r < font_h and (start_col + c) < canvas_w:
                                text_canvas[r][start_col + c] = matrix[r][c]
                
                offset = COLS
                while not stop_event.is_set():
                    # Check dynamic color/sound updates mid-scroll
                    elapsed = time.time() - start_time
                    remaining_frac = max(0.0, total_seconds - elapsed)
                    remaining = max(0, int(remaining_frac))
                    if remaining > 60:
                        active_color = Color(255, 255, 255)
                    else:
                        active_color = Color(0, 255, 0)
                    
                    for r in range(font_h):
                        target_r = start_row + r
                        if target_r < 0 or target_r >= ROWS:
                            continue
                        for c in range(COLS):
                            virtual_c = c - offset
                            idx_strip = xy_to_index(c, target_r)
                            if idx_strip is not None:
                                if 0 <= virtual_c < canvas_w and text_canvas[r][virtual_c] == 1:
                                    strip.setPixelColor(idx_strip, active_color)
                                else:
                                    strip.setPixelColor(idx_strip, COLOR_BLACK)
                    strip.show()
                    offset -= 1
                    if offset < -canvas_w:
                        break
                    if not responsive_sleep(speed, stop_event):
                        return
        else:
            # Standard layout
            if not scroll:
                disp_str = f"{mins}:{secs:02d}"
                if disp_str != last_display:
                    draw_text_static(strip, disp_str, font_name, active_color)
                    last_display = disp_str
                if not responsive_sleep(loop_sleep, stop_event):
                    break
            else:
                # Scroll mode
                disp_str = f"{mins}:{secs:02d}"
                metrics = FONT_METRICS.get(font_name, FONT_METRICS["font5x7"])
                font = FONTS_DATA.get(font_name, {})
                font_h = metrics["height"]
                tile_w = metrics["tile_width"]
                start_row = (ROWS - font_h) // 2
                
                canvas_w = len(disp_str) * tile_w
                text_canvas = [[0 for _ in range(canvas_w)] for _ in range(font_h)]
                
                for idx, char in enumerate(disp_str):
                    matrix = font.get(char, font.get(" ", []))
                    if not matrix:
                        continue
                    start_col = idx * tile_w
                    for r in range(len(matrix)):
                        for c in range(len(matrix[r])):
                            if r < font_h and (start_col + c) < canvas_w:
                                text_canvas[r][start_col + c] = matrix[r][c]
                
                for r in range(font_h):
                    target_r = start_row + r
                    if target_r < 0 or target_r >= ROWS:
                        continue
                    for c in range(COLS):
                        virtual_c = c - offset
                        idx_strip = xy_to_index(c, target_r)
                        if idx_strip is not None:
                            if 0 <= virtual_c < canvas_w and text_canvas[r][virtual_c] == 1:
                                strip.setPixelColor(idx_strip, active_color)
                            else:
                                strip.setPixelColor(idx_strip, COLOR_BLACK)
                strip.show()
                
                if not responsive_sleep(speed, stop_event):
                    break
                    
                offset -= 1
                if offset < -canvas_w:
                    offset = COLS

# ==============================================================================
# Arithmetic Lab Visualisations & Sound Synthesis
# ==============================================================================

math_border_offset = 0

def draw_math_static_grid_pixels(strip, type_str, factor_a, factor_b):
    """
    Sets the pixels for the static math grid (Cream/Gold) but does NOT call strip.show()
    and does NOT touch the outer two edges.
    """
    if type_str == "multiply":
        cols = factor_a
        rows = factor_b
    else:
        dividend = factor_a
        divisor = factor_b
        cols = dividend // divisor
        rows = divisor
        
    start_col = (COLS - cols) // 2
    start_row = (ROWS - rows) // 2
    
    color_cream = Color(253, 255, 208) # GRB: Green=253, Red=255, Blue=208
    color_gold = Color(215, 255, 0)   # GRB: Green=215, Red=255, Blue=0
    
    for x in range(2, COLS - 2):
        for y in range(2, ROWS - 2):
            idx = xy_to_index(x, y)
            if idx is not None:
                strip.setPixelColor(idx, COLOR_BLACK)
                
    for c in range(cols):
        col_color = color_cream if c < 10 else color_gold
        for r in range(rows):
            grid_c = start_col + c
            grid_r = start_row + r
            if 2 <= grid_c < COLS - 2 and 2 <= grid_r < ROWS - 2:
                idx = xy_to_index(grid_c, grid_r)
                if idx is not None:
                    strip.setPixelColor(idx, col_color)

def draw_math_static_grid(strip, type_str, factor_a, factor_b):
    """
    Draws the static grid representing the math fact.
    """
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, COLOR_BLACK)
    draw_math_static_grid_pixels(strip, type_str, factor_a, factor_b)
    strip.show()

def get_number_sound_files(num):
    """
    Decomposes any integer 1 <= num < 500 into sequential sound filenames.
    """
    if num <= 0:
        return []
        
    number_words = {
        1: "one.wav", 2: "two.wav", 3: "three.wav", 4: "four.wav", 5: "five.wav",
        6: "six.wav", 7: "seven.wav", 8: "eight.wav", 9: "nine.wav", 10: "ten.wav",
        11: "eleven.wav", 12: "twelve.wav", 13: "thirteen.wav", 14: "fourteen.wav",
        15: "fifteen.wav", 16: "sixteen.wav", 17: "seventeen.wav", 18: "eighteen.wav",
        19: "nineteen.wav", 20: "twenty.wav", 30: "thirty.wav", 40: "forty.wav",
        50: "fifty.wav", 60: "sixty.wav", 70: "seventy.wav", 80: "eighty.wav",
        90: "ninety.wav"
    }
    
    if num in number_words:
        return [f"maths/{number_words[num]}"]
    elif num < 100:
        tens = (num // 10) * 10
        ones = num % 10
        res = []
        if tens in number_words:
            res.append(f"maths/{number_words[tens]}")
        if ones in number_words:
            res.append(f"maths/{number_words[ones]}")
        return res
    elif num < 500:
        hundreds = (num // 100) * 100
        hundreds_words = {
            100: "one hundred.wav",
            200: "two hundred.wav",
            300: "three hundred.wav",
            400: "four hundred.wav"
        }
        rem = num % 100
        res = []
        if hundreds in hundreds_words:
            res.append(f"maths/{hundreds_words[hundreds]}")
        if rem > 0:
            res.append("maths/and.wav")
            res.extend(get_number_sound_files(rem))
        return res
    return []

def draw_math_help_frame_pixels(strip, type_str, factor_a, factor_b, active_col_index):
    """
    Sets the pixels for the math help frame but does NOT call strip.show()
    and does NOT touch the outer two edges.
    """
    if type_str == "multiply":
        cols = factor_a
        rows = factor_b
    else:
        dividend = factor_a
        divisor = factor_b
        cols = dividend // divisor
        rows = divisor
        
    active_color = Color(0, 255, 0)    # GRB Red
    color_cream = Color(253, 255, 208) # GRB Cream
    color_gold = Color(215, 255, 0)   # GRB Gold
    
    start_col = (COLS - cols) // 2
    start_row = (ROWS - rows) // 2
    
    for x in range(2, COLS - 2):
        for y in range(2, ROWS - 2):
            idx = xy_to_index(x, y)
            if idx is not None:
                strip.setPixelColor(idx, COLOR_BLACK)
                
    for c in range(cols):
        if c == active_col_index:
            col_color = active_color
        else:
            col_color = color_cream if c < 10 else color_gold
            
        for r in range(rows):
            grid_c = start_col + c
            grid_r = start_row + r
            if 2 <= grid_c < COLS - 2 and 2 <= grid_r < ROWS - 2:
                idx = xy_to_index(grid_c, grid_r)
                if idx is not None:
                    strip.setPixelColor(idx, col_color)

def draw_math_help_frame(strip, type_str, factor_a, factor_b, active_col_index):
    """
    Draws a frame for the math help visualisation.
    """
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, COLOR_BLACK)
    draw_math_help_frame_pixels(strip, type_str, factor_a, factor_b, active_col_index)
    strip.show()

def draw_math_rainbow_border(strip, offset):
    """
    Draws a moving diagonal rainbow on the outer two edges of the display.
    """
    def local_wheel(pos):
        pos = pos & 255
        if pos < 85:
            return Color(pos * 3, 255 - pos * 3, 0) # GRB format
        elif pos < 170:
            pos -= 85
            return Color(255 - pos * 3, 0, pos * 3) # GRB format
        else:
            pos -= 170
            return Color(0, pos * 3, 255 - pos * 3) # GRB format

    for x in range(COLS):
        for y in range(ROWS):
            # Outer two rings check
            if x < 2 or x >= COLS - 2 or y < 2 or y >= ROWS - 2:
                idx = xy_to_index(x, y)
                if idx is not None:
                    color_pos = int((x + y) * (256 / 44) + offset) & 255
                    strip.setPixelColor(idx, local_wheel(color_pos))
    strip.show()

def play_phrases_and_animate_border(strip, phrases, volume, type_str, factor_a, factor_b, stop_event):
    global math_border_offset
    for i, p in enumerate(phrases):
        if stop_event.is_set():
            break
        sound = play_sound_by_name(p, volume=volume)
        if sound:
            gap = 0.05
            if i < len(phrases) - 1:
                next_p = phrases[i+1]
                ones = ["one.wav", "two.wav", "three.wav", "four.wav", "five.wav", "six.wav", "seven.wav", "eight.wav", "nine.wav"]
                if any(p.endswith(t + ".wav") for t in ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]):
                    if any(next_p.endswith(o) for o in ones):
                        gap = -0.08
                elif p.endswith("hundred.wav") and next_p.endswith("and.wav"):
                    gap = -0.1
                elif p.endswith("and.wav"):
                    gap = -0.05
            
            duration = max(0, sound.get_length() + gap)
            start_time = time.time()
            while time.time() - start_time < duration:
                if stop_event.is_set():
                    break
                draw_math_static_grid_pixels(strip, type_str, factor_a, factor_b)
                draw_math_rainbow_border(strip, math_border_offset)
                math_border_offset = (math_border_offset + 4) & 255
                if not responsive_sleep(0.04, stop_event):
                    break

def play_sequence_with_rainbow_border(strip, phrases, volume, type_str, factor_a, factor_b, active_col_index, stop_event):
    global math_border_offset
    for i, p in enumerate(phrases):
        if stop_event.is_set():
            break
        sound = play_sound_by_name(p, volume=volume)
        if sound:
            gap = 0.05
            if i < len(phrases) - 1:
                next_p = phrases[i+1]
                ones = ["one.wav", "two.wav", "three.wav", "four.wav", "five.wav", "six.wav", "seven.wav", "eight.wav", "nine.wav"]
                if any(p.endswith(t + ".wav") for t in ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]):
                    if any(next_p.endswith(o) for o in ones):
                        gap = -0.08
                elif p.endswith("hundred.wav") and next_p.endswith("and.wav"):
                    gap = -0.1
                elif p.endswith("and.wav"):
                    gap = -0.05
            
            duration = max(0, sound.get_length() + gap)
            start_time = time.time()
            while time.time() - start_time < duration:
                if stop_event.is_set():
                    break
                draw_math_help_frame_pixels(strip, type_str, factor_a, factor_b, active_col_index)
                draw_math_rainbow_border(strip, math_border_offset)
                math_border_offset = (math_border_offset + 4) & 255
                if not responsive_sleep(0.04, stop_event):
                    break

def play_phrase_sequence(phrases, volume, stop_event):
    for i, p in enumerate(phrases):
        if stop_event.is_set():
            break
        sound = play_sound_by_name(p, volume=volume)
        if sound:
            # Small gap between sounds by default
            gap = 0.05
            if i < len(phrases) - 1:
                next_p = phrases[i+1]
                ones = ["one.wav", "two.wav", "three.wav", "four.wav", "five.wav", "six.wav", "seven.wav", "eight.wav", "nine.wav"]
                # Overlap tens (e.g. forty) and ones (e.g. four) to make them sound like one word
                if any(p.endswith(t + ".wav") for t in ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]):
                    if any(next_p.endswith(o) for o in ones):
                        gap = -0.08 # 80ms overlap
                elif p.endswith("hundred.wav") and next_p.endswith("and.wav"):
                    gap = -0.1
                elif p.endswith("and.wav"):
                    gap = -0.05
            
            responsive_sleep(max(0, sound.get_length() + gap), stop_event)

def math_help_column_active(strip, type_str, factor_a, factor_b, active_col_index, sound_file, volume, stop_event):
    """
    Draws the active column as red and speaks the count.
    """
    draw_math_help_frame(strip, type_str, factor_a, factor_b, active_col_index)
    
    sound = play_sound_by_name(sound_file, volume)
    duration = sound.get_length() if sound else 0.8
    
    responsive_sleep(duration, stop_event)

def math_help_column_active_silent(strip, type_str, factor_a, factor_b, active_col_index, duration, stop_event):
    """
    Draws the active column as red silently.
    """
    draw_math_help_frame(strip, type_str, factor_a, factor_b, active_col_index)
    responsive_sleep(duration, stop_event)

def math_question_visualize(strip, type_str, factor_a, factor_b, sound_enabled=True, volume=0.25, allowed_multiply=None, allowed_divide=None, stop_event=None):
    """
    Renders the static grid and reads the math question aloud using randomized phrasing.
    Runs a looping rainbow border on the outer two display edges.
    """
    global math_border_offset
    
    # 1. Clear only inner display area (columns 2 to 17, rows 2 to 21)
    for x in range(2, COLS - 2):
        for y in range(2, ROWS - 2):
            idx = xy_to_index(x, y)
            if idx is not None:
                strip.setPixelColor(idx, Color(0, 0, 0))
        
    # 2. Draw static grid pixels
    draw_math_static_grid_pixels(strip, type_str, factor_a, factor_b)
    
    # 3. Immediately draw border and show to render the new grid instantly without a gap!
    draw_math_rainbow_border(strip, math_border_offset)
    
    phrases = []
    if type_str == "multiply":
        # Multiplicative Phrasing patterns
        available_patterns = [0, 1, 2, 3, 4, 5]
        if factor_b == 2:
            available_patterns.append(6) # doubled
        if factor_b == 3:
            available_patterns.append(7) # tripled
        if factor_b == 4:
            available_patterns.append(8) # quadrupled
        if factor_a == factor_b:
            available_patterns.append(9) # squared
            
        if allowed_multiply is None:
            allowed_multiply = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            
        valid_choices = [p for p in available_patterns if p in allowed_multiply]
        if not valid_choices:
            valid_choices = [0] # Safe fallback
            
        chosen = random.choice(valid_choices)
        
        if chosen == 0:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/multiplied by.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 1:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/times.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 2:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/Lots of.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 3:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/rows of.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 4:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/sets of.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 5:
            phrases.append("maths/the product of.wav")
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/and.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 6:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/doubled.wav")
        elif chosen == 7:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/tripled.wav")
        elif chosen == 8:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/quadrupled.wav")
        elif chosen == 9:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/squared.wav")
    else:
        # Divisive Phrasing patterns
        if allowed_divide is None:
            allowed_divide = [0, 1, 2, 3, 4, 5]
            
        valid_choices = [p for p in [0, 1, 2, 3, 4, 5] if p in allowed_divide]
        if not valid_choices:
            valid_choices = [0] # Safe fallback
            
        chosen = random.choice(valid_choices)
        if chosen == 0:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/divided by.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 1:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/divided equally into.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 2:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/shared equally among.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 3:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/split in to.wav")
            phrases.extend(get_number_sound_files(factor_b))
        elif chosen == 4:
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/in to.wav")
            phrases.extend(get_number_sound_files(factor_b))
            phrases.append("maths/equal parts.wav")
        elif chosen == 5:
            phrases.append("maths/the quotient of.wav")
            phrases.extend(get_number_sound_files(factor_a))
            phrases.append("maths/and.wav")
            phrases.extend(get_number_sound_files(factor_b))
            
    # Play sequence while animating border
    if sound_enabled and phrases:
        play_phrases_and_animate_border(strip, phrases, volume, type_str, factor_a, factor_b, stop_event)
        
    # Ongoing loop to keep the rainbow border animating
    while not stop_event.is_set():
        draw_math_static_grid_pixels(strip, type_str, factor_a, factor_b)
        draw_math_rainbow_border(strip, math_border_offset)
        math_border_offset = (math_border_offset + 4) & 255
        if not responsive_sleep(0.04, stop_event):
            break

def math_help_visualize(strip, type_str, factor_a, factor_b, sound_enabled=True, volume=0.25, stop_event=None):
    """
    Sequentially draws each column as Red while other columns are Base Color, speaking the counts.
    Runs a looping rainbow border on the outer two display edges.
    """
    global math_border_offset
    if type_str == "multiply":
        cols = factor_a
        rows = factor_b
    else:
        dividend = factor_a
        divisor = factor_b
        cols = dividend // divisor
        rows = divisor
        
    for c in range(cols):
        if stop_event.is_set():
            break
            
        if type_str == "multiply":
            count_val = (c + 1) * rows
        else:
            count_val = c + 1
            
        if sound_enabled:
            files = get_number_sound_files(count_val)
            play_sequence_with_rainbow_border(strip, files, volume, type_str, factor_a, factor_b, c, stop_event)
            # 400ms pause with border animation
            start_time = time.time()
            while time.time() - start_time < 0.4:
                if stop_event.is_set():
                    break
                draw_math_help_frame_pixels(strip, type_str, factor_a, factor_b, c)
                draw_math_rainbow_border(strip, math_border_offset)
                math_border_offset = (math_border_offset + 4) & 255
                if not responsive_sleep(0.04, stop_event):
                    break
        else:
            # Highlight silently for 0.8 seconds while animating the border
            start_time = time.time()
            while time.time() - start_time < 0.8:
                if stop_event.is_set():
                    break
                draw_math_help_frame_pixels(strip, type_str, factor_a, factor_b, c)
                draw_math_rainbow_border(strip, math_border_offset)
                math_border_offset = (math_border_offset + 4) & 255
                if not responsive_sleep(0.04, stop_event):
                    break
            
    # Restore the static grid layout and keep the rainbow border animating indefinitely
    while not stop_event.is_set():
        draw_math_static_grid_pixels(strip, type_str, factor_a, factor_b)
        draw_math_rainbow_border(strip, math_border_offset)
        math_border_offset = (math_border_offset + 4) & 255
        if not responsive_sleep(0.04, stop_event):
            break

def get_pf_neighbors(x, y, ROWS, COLS):
    """
    Returns 4-directional neighbors for pathfinding.
    Ordered as Up, Down, Left, Right to match the frontend expansion order.
    """
    neighbors = []
    # Up: (x, y - 1)
    if y > 0:
        neighbors.append((x, y - 1))
    # Down: (x, y + 1)
    if y < ROWS - 1:
        neighbors.append((x, y + 1))
    # Left: (x - 1, y)
    if x > 0:
        neighbors.append((x - 1, y))
    # Right: (x + 1, y)
    if x < COLS - 1:
        neighbors.append((x + 1, y))
    return neighbors

def draw_pathfinding_grid(strip, start, target, walls):
    """
    Draws the static pathfinding grid representation on the matrix.
    start: [r, c] (row, col)
    target: [r, c] (row, col)
    walls: list of [r, c] coordinates
    """
    ROWS = 24
    COLS = 20
    
    # Start: Green (GRB -> Color(255, 0, 0))
    COLOR_START = Color(255, 0, 0)
    # Target: Red (GRB -> Color(0, 255, 0))
    COLOR_TARGET = Color(0, 255, 0)
    # Wall: Dull Blue (Color(0, 0, 128))
    COLOR_WALL = Color(0, 0, 128)
    # Empty: Black (Color(0, 0, 0))
    COLOR_EMPTY = Color(0, 0, 0)
    
    # Map coordinates from row/col to (x, y) where x=col, y=row
    start_node = (start[1], start[0])
    target_node = (target[1], target[0])
    walls_set = set((w[1], w[0]) for w in walls)
    
    # Render all pixels on the LED matrix
    for y in range(ROWS):
        for x in range(COLS):
            coord = (x, y)
            idx = xy_to_index(x, y)
            if idx is None:
                continue
            if coord == start_node:
                strip.setPixelColor(idx, COLOR_START)
            elif coord == target_node:
                strip.setPixelColor(idx, COLOR_TARGET)
            elif coord in walls_set:
                strip.setPixelColor(idx, COLOR_WALL)
            else:
                strip.setPixelColor(idx, COLOR_EMPTY)
    strip.show()

def pathfinding_visualize(strip, algo, start, target, walls, sound_list, speed, sound_enabled, volume, stop_event):
    """
    Visualizes Dijkstra, A*, BFS, or DFS pathfinding on the 20x24 physical matrix.
    start: [r, c] (row, col)
    target: [r, c] (row, col)
    walls: list of [r, c] coordinates
    """
    import pygame
    import heapq
    from collections import deque
    
    ROWS = 24
    COLS = 20
    
    # Map coordinates from row/col to (x, y) where x=col, y=row
    start_node = (start[1], start[0])
    target_node = (target[1], target[0])
    walls_set = set((w[1], w[0]) for w in walls)
    
    # Colors in GRB layout: Color(green, red, blue)
    # Start: Green (GRB -> Color(255, 0, 0))
    COLOR_START = Color(255, 0, 0)
    # Target: Red (GRB -> Color(0, 255, 0))
    COLOR_TARGET = Color(0, 255, 0)
    # Wall: Dull Blue (Color(0, 0, 128))
    COLOR_WALL = Color(0, 0, 128)
    # Searching (Active Highlight): Bright White (physical White -> Color(255, 255, 255))
    COLOR_SEARCHING = Color(255, 255, 255)
    # Visited (Dimmed Trail): Dull Red (GRB -> Color(0, 128, 0))
    COLOR_VISITED = Color(0, 128, 0)
    # Path: Green (physical Green -> Color(255, 0, 0))
    COLOR_PATH = Color(255, 0, 0)
    # Empty: Black (Color(0, 0, 0))
    COLOR_EMPTY = Color(0, 0, 0)
    
    print(f"Pathfinding Visualizer: algo={algo}, sound_enabled={sound_enabled}, volume={volume}, sound_list_len={len(sound_list)}")
    if sound_enabled:
        if not pygame.mixer.get_init():
            print("WARNING: Pygame mixer is not initialized! Sound cannot be played. Check process locks (sudo fuser -v /dev/snd/*).")
        elif not sound_list:
            print("WARNING: sound_list is empty! Sound files (0.wav-23.wav) were not loaded.")
    
    draw_pathfinding_grid(strip, start, target, walls)
    
    # Intro Narration
    if sound_enabled:
        if algo == "dijkstra":
            play_sound_by_name("dijkstras.wav", volume=volume)
            responsive_sleep(1.8, stop_event)
        elif algo == "astar":
            play_sound_by_name("a star.wav", volume=volume)
            responsive_sleep(1.8, stop_event)
            
    if stop_event.is_set():
        return
        
    # Solve pathfinding to get traversed list and parents
    visited_in_order = []
    parent = {}
    
    if algo == "bfs":
        queue = deque([start_node])
        visited_set = {start_node}
        
        while queue:
            if stop_event.is_set():
                return
            curr = queue.popleft()
            if curr == target_node:
                break
            
            # Expand neighbors
            for nxt in get_pf_neighbors(curr[0], curr[1], ROWS, COLS):
                if nxt not in visited_set and nxt not in walls_set:
                    visited_set.add(nxt)
                    parent[nxt] = curr
                    visited_in_order.append(nxt)
                    queue.append(nxt)
                    
    elif algo == "dfs":
        stack = [start_node]
        visited_set = set()
        
        while stack:
            if stop_event.is_set():
                return
            curr = stack.pop()
            if curr in visited_set or curr in walls_set:
                continue
            visited_set.add(curr)
            visited_in_order.append(curr)
            
            if curr == target_node:
                break
                
            for nxt in get_pf_neighbors(curr[0], curr[1], ROWS, COLS):
                if nxt not in visited_set and nxt not in walls_set:
                    parent[nxt] = curr
                    stack.append(nxt)
                    
    elif algo == "dijkstra" or algo == "astar":
        dist = { (x, y): float('inf') for y in range(ROWS) for x in range(COLS) }
        dist[start_node] = 0
        visited_set = set()
        
        heap = []
        if algo == "dijkstra":
            heapq.heappush(heap, (0, start_node))
        else:
            h = abs(start_node[0] - target_node[0]) + abs(start_node[1] - target_node[1])
            heapq.heappush(heap, (h, h, 0, start_node))
            
        while heap:
            if stop_event.is_set():
                return
                
            if algo == "dijkstra":
                d, curr = heapq.heappop(heap)
            else:
                f, h, d, curr = heapq.heappop(heap)
                
            if curr in visited_set or curr in walls_set:
                continue
            visited_set.add(curr)
            visited_in_order.append(curr)
            
            if curr == target_node:
                break
                
            for nxt in get_pf_neighbors(curr[0], curr[1], ROWS, COLS):
                if nxt in visited_set or nxt in walls_set:
                    continue
                new_dist = dist[curr] + 1
                if new_dist < dist[nxt]:
                    dist[nxt] = new_dist
                    parent[nxt] = curr
                    if algo == "dijkstra":
                        heapq.heappush(heap, (new_dist, nxt))
                    else:
                        h_nxt = abs(nxt[0] - target_node[0]) + abs(nxt[1] - target_node[1])
                        f_nxt = new_dist + h_nxt
                        heapq.heappush(heap, (f_nxt, h_nxt, new_dist, nxt))
                        
    # Filter visited nodes to exclude start/target
    filtered_visited = [n for n in visited_in_order if n != start_node and n != target_node]
    
    # 2. Animate Exploration
    last_visited = None
    last_tentative_path = set()
    for step, node in enumerate(filtered_visited):
        if stop_event.is_set():
            return
            
        # Trace path from the current node back to the start node
        tentative_path = []
        curr_trace = node
        while curr_trace in parent:
            curr_trace = parent[curr_trace]
            if curr_trace != start_node:
                tentative_path.append(curr_trace)
        tentative_set = set(tentative_path)
            
        # 1. Dim the previous visited node to the visited trail color (dim blue)
        # only if it is not part of the new tentative path!
        if last_visited is not None and last_visited not in tentative_set:
            idx_last = xy_to_index(last_visited[0], last_visited[1])
            if idx_last is not None:
                strip.setPixelColor(idx_last, COLOR_VISITED)
                
        # 2. For any node in last_tentative_path that is NOT in the new tentative path,
        # dim it back to visited (dim blue)
        for old_node in last_tentative_path:
            if old_node != node and old_node not in tentative_set:
                idx_old = xy_to_index(old_node[0], old_node[1])
                if idx_old is not None:
                    strip.setPixelColor(idx_old, COLOR_VISITED)
                    
        # 3. Draw the new tentative path in Green
        for new_node in tentative_path:
            idx_new = xy_to_index(new_node[0], new_node[1])
            if idx_new is not None:
                strip.setPixelColor(idx_new, COLOR_PATH)
                
        # 4. Highlight the current node to the active searching color (bright white)
        idx = xy_to_index(node[0], node[1])
        if idx is not None:
            strip.setPixelColor(idx, COLOR_SEARCHING)
            
        # 5. Keep Start/Target solid White
        idx_start = xy_to_index(start_node[0], start_node[1])
        idx_target = xy_to_index(target_node[0], target_node[1])
        
        import time
        import math
        pulse = 0.3 + 0.7 * ((math.sin(time.time() * 3.0) + 1.0) / 2.0)
        c_start = Color(int(255 * pulse), 0, 0)
        c_target = Color(0, int(255 * pulse), 0)
        
        if idx_start is not None:
            strip.setPixelColor(idx_start, c_start)
        if idx_target is not None:
            strip.setPixelColor(idx_target, c_target)
            
        strip.show()
            
        if sound_enabled and sound_list:
            import math
            dx = node[0] - start_node[0]
            dy = node[1] - start_node[1]
            dist = math.sqrt(dx*dx + dy*dy)
            
            max_dist = math.sqrt((COLS - 1)**2 + (ROWS - 1)**2)
            sound_idx = int(dist * (len(sound_list) - 1) / max_dist)
            sound_idx = max(0, min(len(sound_list) - 1, sound_idx))
            
            sound_list[sound_idx].set_volume(volume)
            sound_list[sound_idx].play()
                
        last_tentative_path = tentative_set
        last_visited = node
        
        if not responsive_sleep(speed, stop_event):
            return
            
    # Clean up the last tentative path and visited nodes before final path reveal
    for old_node in last_tentative_path:
        idx_old = xy_to_index(old_node[0], old_node[1])
        if idx_old is not None:
            strip.setPixelColor(idx_old, COLOR_VISITED)
            
    if last_visited is not None:
        idx_last = xy_to_index(last_visited[0], last_visited[1])
        if idx_last is not None:
            strip.setPixelColor(idx_last, COLOR_VISITED)
    
    idx_start = xy_to_index(start_node[0], start_node[1])
    idx_target = xy_to_index(target_node[0], target_node[1])
    if idx_start is not None:
        strip.setPixelColor(idx_start, COLOR_START)
    if idx_target is not None:
        strip.setPixelColor(idx_target, COLOR_TARGET)
    strip.show()
            
    # Trace shortest path
    shortest_path = []
    curr = target_node
    while curr in parent:
        curr = parent[curr]
        if curr != start_node:
            shortest_path.insert(0, curr)
            
    # 3. Animate Path Reveal
    if shortest_path:
        for path_step, node in enumerate(shortest_path):
            if stop_event.is_set():
                return
                
            idx = xy_to_index(node[0], node[1])
            if idx is not None:
                strip.setPixelColor(idx, COLOR_PATH)
                strip.show()
                
                if sound_enabled and sound_list:
                    import math
                    dx = node[0] - start_node[0]
                    dy = node[1] - start_node[1]
                    dist = math.sqrt(dx*dx + dy*dy)
                    
                    max_dist = math.sqrt((COLS - 1)**2 + (ROWS - 1)**2)
                    sound_idx = int(dist * (len(sound_list) - 1) / max_dist)
                    sound_idx = max(0, min(len(sound_list) - 1, sound_idx))
                    
                    sound_list[sound_idx].set_volume(volume)
                    sound_list[sound_idx].play()
                    
            if not responsive_sleep(speed * 1.5, stop_event):
                return
                
        # Celebration Sound
        if sound_enabled:
            play_sound_by_name("tada.wav", volume=volume)
            responsive_sleep(1.0, stop_event)
            phrases = ["path found.wav", "checked.wav"] + get_number_sound_files(len(visited_in_order)) + ["nodes.wav", "the path is.wav"] + get_number_sound_files(len(shortest_path)) + ["units long.wav"]
            play_phrase_sequence(phrases, volume, stop_event)
    else:
        # Failure Sound
        if sound_enabled:
            play_sound_by_name("error.wav", volume=volume)
            responsive_sleep(1.0, stop_event)
            phrases = ["no path found.wav", "checked.wav"] + get_number_sound_files(len(visited_in_order)) + ["nodes.wav"]
            play_phrase_sequence(phrases, volume, stop_event)
            
    # Keep final state until cleared / mode changed
    while not stop_event.is_set():
        import time
        import math
        pulse = 0.3 + 0.7 * ((math.sin(time.time() * 3.0) + 1.0) / 2.0)
        c_start = Color(int(255 * pulse), 0, 0)
        c_target = Color(0, int(255 * pulse), 0)
        
        if idx_start is not None:
            strip.setPixelColor(idx_start, c_start)
        if idx_target is not None:
            strip.setPixelColor(idx_target, c_target)
        strip.show()
        responsive_sleep(0.03, stop_event)


def play_simple_countdown(strip, color_num=None, stop_event=None):
    if color_num is None:
        color_num = Color(0, 255, 0) # Green in physical GRB
    
    # Count down "3", "2", "1" (1.0s each)
    nums = ["3", "2", "1"]
    for num in nums:
        if stop_event and stop_event.is_set():
            return
        
        char_matrix = CHARS_8x10.get(num, [])
        char_h = len(char_matrix)
        char_w = len(char_matrix[0]) if char_h > 0 else 0
        start_c = (COLS - char_w) // 2
        start_r = (ROWS - char_h) // 2

        for r in range(ROWS):
            for c in range(COLS):
                idx = xy_to_index(c, r)
                if idx is None:
                    continue
                if start_r <= r < start_r + char_h and start_c <= c < start_c + char_w:
                    pixel_val = char_matrix[r - start_r][c - start_c]
                    if pixel_val == 1:
                        strip.setPixelColor(idx, color_num)
                    else:
                        strip.setPixelColor(idx, COLOR_BLACK)
                else:
                    strip.setPixelColor(idx, COLOR_BLACK)
        strip.show()
        
        # Sleep exactly 1.0s
        time.sleep(1.0)

    # Final Clear
    for i in range(strip.numPixels()):
        strip.setPixelColor(i, COLOR_BLACK)
    strip.show()

def gif_visualize(strip, frames, stop_event):
    """
    Plays a pre-parsed GIF animation.
    frames is a list of dicts: {'pixels': [[r,g,b], ...], 'delay': int_ms}
    """
    if not frames:
        return
        
    print(f"Playing GIF with {len(frames)} frames")
    
    GAMMA = 2.5
    GAMMA_LUT = [int(pow(i / 255.0, GAMMA) * 255.0 + 0.5) for i in range(256)]
    
    while not stop_event.is_set():
        for frame in frames:
            if stop_event.is_set():
                break
                
            pixels = frame.get("pixels", [])
            delay_ms = frame.get("delay", 100)
            
            if isinstance(pixels, list) and len(pixels) == 480:
                for i, pixel_color in enumerate(pixels):
                    y = i // COLS
                    x = i % COLS
                    idx = xy_to_index(x, y)
                    if idx is not None and isinstance(pixel_color, list) and len(pixel_color) >= 3:
                        r_raw = max(0, min(255, int(pixel_color[0])))
                        g_raw = max(0, min(255, int(pixel_color[1])))
                        b_raw = max(0, min(255, int(pixel_color[2])))
                        
                        # Apply Gamma correction
                        r = GAMMA_LUT[r_raw]
                        g = GAMMA_LUT[g_raw]
                        b = GAMMA_LUT[b_raw]
                        
                        # Swap Red and Green for GRB matrix
                        strip.setPixelColor(idx, Color(g, r, b))
                
                strip.show()
                # Responsive sleep handles fractional seconds (ms / 1000)
                responsive_sleep(delay_ms / 1000.0, stop_event)

def rickroll_visualize(strip, stop_event):
    from PIL import Image, ImageSequence
    
    # Play the song
    play_sound_by_name("rick.mp3", 1.0)
    
    gif_path = os.path.join("sounds", "rick.gif")
    if not os.path.exists(gif_path):
        print(f"Rickroll GIF not found: {gif_path}")
        return
        
    try:
        img = Image.open(gif_path)
        frames = []
        for frame in ImageSequence.Iterator(img):
            frame_rgb = frame.convert('RGB')
            # Use NEAREST instead of LANCZOS to maintain sharp pixels if it's small,
            # or LANCZOS if it's larger. rick.gif might be larger, so let's use LANCZOS
            frame_resized = frame_rgb.resize((COLS, ROWS), Image.Resampling.LANCZOS)
            
            pixels = []
            for y in range(ROWS):
                for x in range(COLS):
                    r, g, b = frame_resized.getpixel((x, y))
                    pixels.append([r, g, b])
                    
            delay = frame.info.get('duration', 100)
            if delay < 20: delay = 100 # safeguard
            frames.append({'pixels': pixels, 'delay': delay})
            
        print(f"Loaded rick.gif: {len(frames)} frames")
        
        while not stop_event.is_set():
            for frame in frames:
                if stop_event.is_set():
                    break
                    
                pixels = frame["pixels"]
                delay_ms = frame["delay"]
                
                for i, pixel_color in enumerate(pixels):
                    y = i // COLS
                    x = i % COLS
                    idx = xy_to_index(x, y)
                    if idx is not None:
                        r_raw = max(0, min(255, int(pixel_color[0])))
                        g_raw = max(0, min(255, int(pixel_color[1])))
                        b_raw = max(0, min(255, int(pixel_color[2])))
                        
                        r = GAMMA_LUT[r_raw]
                        g = GAMMA_LUT[g_raw]
                        b = GAMMA_LUT[b_raw]
                        
                        strip.setPixelColor(idx, Color(g, r, b))
                        
                strip.show()
                responsive_sleep(delay_ms / 1000.0, stop_event)
                
    except Exception as e:
        print(f"Error playing rickroll: {e}")

def draw_timer_preview_static(strip, seconds, color_str="orange", stop_event=None):
    if isinstance(color_str, str):
        color = parse_color(color_str)
    else:
        color = color_str
    if color is None:
        color = Color(255, 0, 0)
        
    if seconds < 60:
        val = seconds
        unit = "secs"
    elif seconds < 3600:
        val = seconds // 60
        unit = "mins"
    else:
        val = seconds // 3600
        unit = "hour"
        
    val_str = f"{val:02d}"
    if len(val_str) > 2:
        val_str = "99"
        
    clear_matrix(strip)
    
    # Draw top half (val_str) using CHARS_8x10
    positions = [(1, 1), (11, 1)]
    for idx, char in enumerate(val_str):
        matrix = CHARS_8x10.get(char, None)
        if not matrix:
            continue
        start_c, start_r = positions[idx]
        for r in range(len(matrix)):
            for c in range(len(matrix[r])):
                if matrix[r][c]:
                    target_c = start_c + c
                    target_r = start_r + r
                    if target_r < ROWS and target_c < COLS:
                        idx_strip = xy_to_index(target_c, target_r)
                        if idx_strip is not None:
                            strip.setPixelColor(idx_strip, color)
                            
    # Draw bottom half (unit) using font3x5
    load_fonts()
    font = FONTS_DATA.get("font3x5", {})
    metrics = FONT_METRICS.get("font3x5", {"width": 3, "height": 5, "tile_width": 4, "tile_height": 6})
    tile_w = metrics["tile_width"]
    font_h = metrics["height"]
    
    canvas_w = len(unit) * tile_w - (tile_w - metrics["width"]) # tight width
    start_col = (COLS - canvas_w) // 2
    # Center vertically in bottom half (y=12 to 23 is 12 pixels tall)
    start_row = 12 + (12 - font_h) // 2 
    
    for idx, char in enumerate(unit.upper()):
        matrix = font.get(char, font.get(" ", []))
        if not matrix:
            continue
        char_start_c = start_col + idx * tile_w
        for r in range(len(matrix)):
            for c in range(len(matrix[r])):
                if matrix[r][c]:
                    target_c = char_start_c + c
                    target_r = start_row + r
                    if target_r < ROWS and target_c < COLS:
                        idx_strip = xy_to_index(target_c, target_r)
                        if idx_strip is not None:
                            strip.setPixelColor(idx_strip, color)
                            
    strip.show()
    
    if stop_event:
        while not stop_event.is_set():
            if not responsive_sleep(0.1, stop_event):
                break

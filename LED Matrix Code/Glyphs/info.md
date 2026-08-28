# Pixel Grid Typography Spacing Guide

To display legible text on a pixel grid, you need to think about both the character itself and the empty space (padding) around it so letters don't bleed into each other.

For a grid that is **20 pixels wide by 24 pixels tall**, here is how the spacing breaks down based on standard digital typography sizes:

---

## 1. The Standard 5 × 7 Font Matrix (Recommended)

This is the most common and reliable size for low-resolution LED matrices. Each character sits in a bounding box that is 5 pixels wide and 7 pixels tall.

*   **Character Size:** 5 × 7 pixels
*   **With Padding:** You need to add at least 1 pixel of spacing to the right and bottom of each letter. This makes the total space required for one character **6 × 8 pixels**.

### How many fit on your screen?
*   **Width:** 20 pixels ÷ 6 pixels per character = **3 characters wide** (with 2 extra pixels left over for margins).
*   **Height:** 24 pixels ÷ 8 pixels per character = **3 rows of text**.

> [!NOTE]
> Using this setup, your 20 × 24 grid can comfortably display 3 letters across and 3 rows down (a total of 9 characters at once), or a short 3-letter word like "RUN" or "MAX".

---

## 2. The Compact 3 × 5 Font Matrix

If you need to squeeze more text onto the screen, you can use a minimalist 3 × 5 pixel font. It is still readable, though stylized (capital letters work best).

*   **Character Size:** 3 × 5 pixels
*   **With Padding:** Adding 1 pixel of spacing makes the total tile size **4 × 6 pixels**.

### How many fit on your screen?
*   **Width:** 20 pixels ÷ 4 pixels per character = **5 characters wide**.
*   **Height:** 24 pixels ÷ 6 pixels per character = **4 rows of text**.

> [!TIP]
> This gives you a much larger capacity of 20 characters total (5 across, 4 down), making it great for displaying small data points or short phrases.

---

## 3. The Bold 8 × 8 Font Matrix

If you only want to display a single, highly detailed letter at a time (or a maximum of two), you can use a standard arcade-style 8 × 8 grid.

*   **Character Size:** 7 × 7 pixels inside an 8 × 8 tile (padding is usually built into the font design).
*   **Total Tile:** 8 × 8 pixels.

### How many fit on your screen?
*   **Width:** 20 pixels ÷ 8 pixels = **2 characters wide** (with 4 pixels left over).
*   **Height:** 24 pixels ÷ 8 pixels = **3 rows of text**.

---

## Summary Reference Table

| Font Style | Pure Character Size | Space Needed (with Padding) | Total Characters on Your 20×24 Grid |
| :--- | :--- | :--- | :--- |
| **Compact** | 3 × 5 px | 4 × 6 px | 20 characters (5 wide × 4 high) |
| **Standard (Best)** | 5 × 7 px | 6 × 8 px | 9 characters (3 wide × 3 high) |
| **Large/Bold** | 7 × 7 px | 8 × 8 px | 6 characters (2 wide × 3 high) |

# Scrolling Issue Fix Documentation

## Confirmed Android Reproduction

- On Android mobile, vertical page scrolling still worked only when the finger started on the extreme edge of the page.
- If the finger started on visible webpage elements, scrolling did not occur.
- This was especially noticeable on the menu carousels because they cover a large portion of the mobile layout.

## 2026-03-09 Fix Attempt

### Problem Found

`src/menu/carousel-menu-view.ts` and `src/menu/faction-carousel-view.ts` already declared `touchAction = 'pan-y'`, but both components still called `preventDefault()` as soon as a touch started. That prevented Android from beginning a native vertical scroll when the gesture started on the carousel itself.

### Change Made

- Kept the existing horizontal swipe carousel behavior.
- Stopped suppressing touch behavior on `touchstart`.
- Delayed carousel drag activation until the gesture clearly became horizontal.
- Allowed vertical gestures to fall through to the browser so Android can keep scrolling when the touch begins on the carousel element.
- Preserved tap-to-select behavior for non-drag touches.

### Validation Attempt

- Rebuilt the project with `npm run build`.
- Manual verification should focus on Android menu screens that contain the main carousel and faction carousel:
  - vertical scroll starting on the carousel
  - horizontal swipe still changing carousel selection
  - tap still selecting carousel entries

### Follow-up If Problem Persists

If Android scrolling is still blocked on non-carousel controls after this change, inspect any additional elements that attach touch handlers with `preventDefault()` or any container-level CSS that disables native panning on menu content.

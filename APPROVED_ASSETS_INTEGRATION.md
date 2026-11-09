# Approved intro and CH.01 asset inventory (integration guard)

This file records the locally approved **hoemyeong_index_intro_6s_applied.html** artifact before integration. Do not replace the approved visuals with text placeholders.

| Embedded resource | Bytes | SHA-256 prefix |
|---|---:|---|
| Intro MP4 | 802,373 | ca040fc042bcb880 |
| Approved CH.01 scene WebP | 79,334 | be18073b498a8f27 |
| Drawer horror MP4 | 11,785,260 | 74a5f2e789e3040e |
| Supporting WebP 1 | 19,274 | a9aed33d2dce17fc |
| Supporting WebP 2 | 62,930 | da55f38d3830800a |
| Supporting WebP 3 | 11,582 | 1b0a145516fa6f3b |
| Doll WebP | 35,830 | 489fecc529eb9f58 |

## Required behavior
- Intro: approved 6-second video (logo 3 seconds, exterior 3 seconds) with static/glitch audio.
- CH.01: use the approved 79,334-byte cleaned WebP, not a generated approximation.
- CH.01 telephone must not be clickable; G15 belongs to CH.04.
- Preserve all original puzzles, 0-artifact collection, multiplayer cooperation, and jump-scare videos.
- The current public main index.html is a **placeholder**, not the approved artifact. It references reception.webp, which is currently absent from the repository.
- Do not merge the lightweight mobile shell over the approved artifact. Integrate server events into the approved game only after original asset delivery and browser tests.

## Deployment gate
1. Publish the exact approved media assets with matching checksums.
2. Connect them to the approved gameplay shell.
3. Verify mobile intro and CH.01 scene.
4. Verify two-device websocket join, ready, start, puzzle progress, reconnect.
5. Only then merge to main.

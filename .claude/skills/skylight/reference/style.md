# The Skylight style, in numbers

What a finished Skylight clip looks and sounds like. `scripts/build.py` and `scripts/premium.js` already use these numbers;
this page is for planning and for checking the result.

## The idea in one line

A 40-60 s vertical podcast clip that opens on the interviewer's question. The speaker's face sits in the top half with a
two-tier caption under it (a thin lead-in, then a bold keyword). Every few seconds it snaps into B-roll with written words, into a
clean white "light paper" animation (a graph, orbs, a cut-out person with logos) or into a generated world (an object floating
in a sky, a sunset, a studio or space). One accent colour pulled from the footage, two fonts and three textures tie it together.

## Share of screen time

| What | Share |
|---|---:|
| A-roll: the speaker in the top half, two-tier caption below | ~40% |
| B-roll with written words, arrows and selector boxes (always with people in them when it can) | ~25% |
| Full screens: light-paper animations and generated worlds | ~35% |
| Black or white flashes | 0% |

Never more than ~4.5 s on a face, never more than ~7 s away from it. The interviewer appears for the opening question; the rest
is the guest.

**What goes where:** A-roll for transitional statements and to rest the viewer. B-roll for emotional moments and for the people or
things being talked about. A white animation for every valuable moment that can be visualised: a number, a comparison, a change,
a threshold. A world whenever a line names an object or an image ("36 hours a day" → an hourglass in the clouds).

## Home base (the A-roll)

A tight vertical crop of the podcast camera: face about a third of the frame tall, eyes 25-30% from the top, nose on the centre
line, shoulders filling the bottom. The bottom 40% darkens with a soft black gradient so the caption reads. The crop follows the
face slowly and never moves fast; **no pushes or zooms** on the speaker. Static punch-ins (a hard cut to 1.3-1.4×) are fine.
Use a different camera angle every few lines.

## Look

| Role | Blue example | Notes |
|---|---|---|
| Black (A-roll shadow, lower gradient) | `#0d0d11` | |
| White (light paper) | `#eceef5` | cool off-white |
| Dark vibrant (bars, pill fill) | `#3f6f99` | |
| Bright vibrant (orbs, highlight box) | `#2a5cff` | |
| Pale (bold-word tint, swoosh) | `#cfe0f5` | |
| Ink on white | `#16181e` | near black |

The footage keeps its own colour: no grade on the speakers. `palette.py` pulls the accent from the set (never from skin) and builds
the four tones; blue is the safe default.

## Type

- **Two tiers.** The lead-in is DM Sans Light, lowercase, white, ~3.5% of the frame height. The keyword line is DM Sans Bold,
  lowercase except names, 6.5-9% of the frame height, white with a faint pale tint toward the bottom. On the A-roll the tiers
  are left-aligned at x≈7% and centred around 65% from the top. A third small tier is optional. **No box, no stroke.** Words
  come on with the voice.
- **How a word comes on:** thin words blur up in 4-6 frames. The special word blurs in from heavy blur, glitches in letter by
  letter (~0.4 s), writes out or pops.
- **Name cards** on each speaker's first line: the name in bold (~2.7%), then a thin white rule drawing out under it, then the
  title (~1.9%). The interviewer goes bottom left, the guest bottom right.
- **On white:** the same tiers in dark ink, centred near the top.
- **Highlight box:** the key phrase in white bold inside a bright accent box that wipes in left to right.
- **Pill:** a short phrase in a rounded pill (dark fill, pale 2 px border, white text).

## Transitions

- **Focus-in (every cut):** the new shot lands blurred (~16 px) and is sharp by frame 5. No dissolves.
- **Pan right (into B-roll and full screens, and between two people):** a hard cut, then the new shot slides ~6.5% of the width
  and settles in 0.5 s with a little horizontal blur.
- **Return (back to the A-roll):** lands at ~104% and settles to 100% in 0.5 s.
- **Whip up (sky → night):** a vertical whip of ~0.6 s with heavy vertical motion blur.
- **Rise:** a cut-out person rises from the bottom edge, blurred, and sharpens in ~0.5 s.

## Motion

- B-roll drifts slowly (scale 1.00 → ~1.04 over the shot).
- Bars grow with an ease-out over ~0.5 s, on the spoken word.
- Hand-drawn arrows draw on in ~0.4 s (curved, white, ~3 px, rounded ends).
- Selector box: four corner brackets flicker in, then expand to fit the object.
- Orbs drift slowly with a breathing halo; on a merge they slide together and bloom into one.
- Worlds: the object bobs and turns slowly; two cloud layers drift at different speeds (parallax); sparkles drift up at night.

## Pacing

About 0.4 cuts a second, median shot ~1.9 s, longest ~4.6 s. The opening question holds on one face for a few seconds. Most cuts
land on a word.

## Sound

- Loudness -15.5 LUFS, true peak -1.5 dB.
- The user's own music bed 13.2 dB under the voice. No sound effects by default; the code-made kit (`sfx/`) can be turned on
  with `--sfx soft` (transitions only) or `--sfx full` (a sound on every caption page, special word and pop-up).

## Never

Flash frames, black frames, dissolves between shots, boxes or strokes on captions, all-caps captions, slow pushes on the speaker,
risers, a grade on the footage.

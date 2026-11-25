# ai-shutdown-1123: the first Skylight video (41 s)

Podcast: The Diary Of A CEO Clips, "If YOU Think AI Is Safe, You NEED To See This" (youtube nXYSqqUGRLI, 16:49, four people,
18 camera angles). Clip: Roman Yampolskiy asks Andrew McAfee what evidence would make him shut AI down; Waymos crashing into
people for a month; "what if it's only a week?"; "it's maybe too late"; McAfee's conclusion. 8 pieces of the podcast, 337.10-386.62 s.
The files in `work/` are this clip's real `clip.json`, `speakers.json`, `words.json` and `plan.json`: copy their shape.

How it was made (`pc` = `node ~/.claude/skills/skylight/scripts/pc.mjs`, `D` = the video folder):

```
pc new D && pc get D https://www.youtube.com/watch?v=nXYSqqUGRLI && pc breakdown D
# read work/breakdown.md, write work/clip.json, then:
pc cut D                          # fixed "hanging" -> "haggling." in work/words.json by hand
# work/speakers.json = [{"s":0,"e":4.2,"x":0.54}]   Roman talks in the wide shot (his beard hides his lips)
pc track D && pc palette D        # picked option 2, accent blue
pc images D waymo="Waymo Jaguar I-Pace San Francisco" crossing="pedestrians crossing street crosswalk people" street="pedestrians Shibuya crossing" sky="blue sky cumulus clouds" hourglass="hourglass sand timer" mitlogo="MIT logo" --svg
ffmpeg -ss 384 -i D/raw/podcast.mp4 -frames:v 1 D/work/andy_frame.png
pc prep D waymo=waymo_1:cover:0.2,0.5 crossing=crossing_1:cover:0.5,0.45 street=street_3:cover:0.3,0.5 umbrellas=street_2:cover:0.45,0.5 sky=sky_0:cover:0.45,0.5 hourglass=hourglass_0:glass mit=mitlogo_1:logo andy=work/andy_frame.png:person
# write work/plan.json, then:
pc plandoc D && pc all D ai-shutdown
```

## Lessons from this one
- The mouth-motion speaker check fails on a beard and on a listener with a hand at their mouth: always look at `aroll_sheet.png`.
- Commons only serves standard thumbnail widths (1280, 1920): other sizes answer 429.
- HyperFrames owns a timed `<video>`'s own style: punch-ins go on a wrapper div (build.py does this).
- A parent with `background-clip:text` can't paint children that have their own transform or filter: the bold-word gradient
  sits on each word and letter (build.py does this).
- "Pan right" is a hard cut and a slide inside the new shot, not a push between two shots.
- Glass objects (the hourglass) get `:glass` so the sky shows through them.

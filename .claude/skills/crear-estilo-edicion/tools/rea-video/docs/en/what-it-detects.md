# What it detects

## How the picture was made

Each shot gets one of the 11 labels below. "Tool can measure" means it can be decided offline without looking at the image. The rest need a vision model or an agent to look at the frames.

| Label | Common examples | Tool can measure | Eval videos |
|---|---|---|---|
| Live action | Talking head, vlog, product demo, store visit | ✓ | 5 |
| AI-generated video | Text-to-video, image-to-video, AI short dramas | ✓ | 24 |
| Digital avatar | A portrait driven to speak by audio | Partly | 0 |
| 3D render | Blender / C4D explainers, product animation | ✓ | 14 |
| 2D animation | Hand-drawn, Live2D, After Effects character animation | ✗ needs vision | 0 |
| Stop-motion | Clay, felt or paper puppets shot frame by frame | ✗ needs vision | 0 |
| Film footage | Movie, TV or short-drama clips cut into commentary, montages or famous-scene compilations | ✗ needs vision (the tool only gives clues) | 8 |
| Code / template | Text animation, UI, charts, slide-style cards | ✓ | 16 |
| Screen recording / screenshot | Software walkthroughs, web pages | ✓ | 11 |
| Still with pan and zoom | One image with zoom and pan | ✓ | 3 |
| Held frame | An image or card that stays on screen | ✓ | 5 |

The same shot also gets separate marks for:

- Post-production overlays: subtitles, styled text, titles, stickers, layout templates. Text on objects (packaging, signs) is kept apart from subtitles where possible. See "Editing and packaging layer" below.
- Real assets: screen recordings, screenshots, photos and video clips embedded in the picture, whose original files a remake needs. Products, logos and people in AI shots are listed as reference images for the remake.
- AI edits on live action (judged visually): face swap, lip sync, restyling, AI outfit change, keying and background replacement, adding or removing objects, beauty filters. The remake plan reads "shoot first, then apply this AI edit with this model".

## How live action was shot

| Aspect | What it reports |
|---|---|
| Framing | Shot size (wide to extreme close-up), camera height, composition |
| Camera | Handheld / gimbal / tripod, push, pull, pan and track, phone or camera, slow motion / time-lapse / speed ramps |
| Lighting | Key light direction and height; lighting ratio; soft or hard light; color temperature; background blur; rim light, catch light, practical lights in frame |
| Lighting setup | 12 setups with gear lists: frontal soft light, key + fill, hard side light, backlight, night ambient, low key, high key, colored mood light (RGB / neon), product still life, direct outdoor sun, outdoor overcast, outdoor backlight |
| Color | Style (natural, teal and orange, Japanese, film, black and white, dark, high saturation) plus saturation, contrast, black level, warmth |
| Editing | Pace, jump cuts, punch-ins, share of inserts, whether cuts land on the beat |
| Format | Talking head, tabletop, handheld product demo, vlog |

Lighting ratio, softness, color temperature and color are measured from pixels. The light source, rim light, whether it's outdoors and the capture speed come from looking at the image. The report lists both sides next to each other.

## Editing and packaging layer

The whole video is analyzed on one timeline instead of shot by shot, because a subtitle or sticker often spans a cut.

| Item | How it's measured | Output |
|---|---|---|
| Subtitle timeline | OCR at 2 frames per second, tracks text line by line at the same position, then aligns start and end to about 0.1 seconds using grayscale frames at 10 fps; two-line subtitles are merged into one line | `packaging/subtitles.srt` |
| Text style | Measured from pixels: text color, outline color and width, box color, gradient, keyword highlight color (including a color change as a word is spoken), size, slant, weight | Style column in the report |
| Text type | Subtitle (lines replacing each other at one position), styled text (at least two of: large, colored, slanted, thick outline, multicolor, pop-in), title (stays at the top), text callout (chapter cards, labels that follow an object), text in the scene | Type of each text item |
| Entrance / exit | Direct, scale pop, fade, slide, character by character; bounce or color change mid-line | Report and ASS animation |
| Stickers / GIFs / picture-in-picture | A clearly bounded area that stays still over moving video; stays while everything around it changes at a cut; appears and disappears as a block mid-shot (marked "possible" on live action); moving inside on a fixed cycle means a looping GIF | Time, position and crop (`packaging/sticker_XX.jpg`). Measured recall is about half; vision fills in the rest |
| Sound effect sync | Each effect is aligned to the nearest visual event (subtitle / styled text / sticker appearing, or a cut, within ±0.2 seconds). Without a VLM, transient sounds at the moments styled text and stickers appear are added as low-confidence candidates | "Visual event" column of the effects table |

It also exports `packaging/overlays.ass` (colors, outlines, positions and pop animation; burn in directly with `ffmpeg -vf ass=` after switching to the source font) and `packaging/timeline.json`.

Pixels can't tell which font is used or what a sticker shows, so a VLM or agent fills that in by looking. In 3D, animation and layout shots, objects appear suddenly as part of the picture, so only stickers that span a cut or loop count there. The rest are listed as "picture content" and can be confirmed visually if needed. Evaluation results are in [eval/RESULTS.md](../../eval/RESULTS.md).

## Sound

- Voice: real person or AI voice, and the spoken script.
- Music: BPM, key, sections, and whether it's AI-generated or library music.
- Sound effects: the time and type of each effect, and the visual event it lands on (subtitle / styled text / sticker appearing, or a cut).

## Special moments

These are moments worth cutting out on their own: magic reveals, plot twists, climaxes and continuity errors. Finding them means understanding the content, so the side that can see (a VLM or agent) does it. It reads the spoken lines, on-screen text and a whole-video overview to pick passages, then zooms into each passage to set four key frames: initial state, method or key action, moment of change, reaction. Candidates from sound and picture (a gasp, a surprised tone, laughter, a sudden rise in voice level, fast motion that freezes) only suggest where to look. Each moment is then told in 3–6 steps. It marks the frame where the thing actually changes (often earlier than when the camera shows it or someone gasps), draws a red circle where it's certain, and separates what is visible, what is only inferred (the method, where a prop came from) and why viewers missed it. The changing part is marked frame by frame, showing how the object moved instead of suddenly appearing. Each moment exports a numbered diagram with the frame-by-frame process, a slow-motion clip of only the change (0.2 seconds per frame, with timestamps), a reveal short (normal speed → slowed and zoomed change → freeze → reaction), and the original clip with sound plus key frames. See `moments` in [cli.md](cli.md).

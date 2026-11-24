# Remake from the report

The report's "Make it yourself" section starts by naming the type of video (talking head, tabletop / unboxing, vlog, live-action skit, AI story short, AI product ad, AI music video, digital-avatar talking head, short AI clip, 3D / animation, film commentary / montage, motion-graphics explainer, screen tutorial, stills with pan and zoom, beat-synced montage, dance / action performance). It then lists the steps in the order that type of video is usually made. The type only decides which steps exist and their order. The content of each step comes from this video:

- Shooting: the measured shot size, camera position, lighting (key direction, ratio, softness, color temperature), color, and a lighting setup derived from those measurements
- Generation: how many generation units, how many calls to which model, and the first frame and reference images for each unit
- Editing: shot count, average seconds per cut, jump cuts and punch-ins, transitions other than hard cuts
- Packaging: subtitle line count, position, color and entrance, with the subtitle timeline saved as an SRT file
- Sound: source of voice and music, BPM, key, number of sound effects
- Last step: put the finished shots back on the original timeline and output a side-by-side comparison with the source

If something wasn't measured, its step is left out. A video often mixes methods, and when another type covers a quarter of the duration, its steps are listed too. Below is how to make each kind of picture. At the end, have the agent assemble everything on the original timeline.

## Live-action shots: shoot them

1. The report gives a shooting schedule: how many scenes, how many camera setups per scene, which to shoot first, plus shot size, handheld or mounted, where the key light comes from, whether fill is needed, and a gear list. Shots from the same scene are grouped together even when they are apart in the final video.
2. After shooting, send the footage to the agent and say "cut my footage in following the shot list".
3. The agent trims each clip to the matching shot's position and length, assembles the original timeline, and outputs a side-by-side comparison so you can check the pacing. Shots you haven't filmed use the source as a placeholder, so you can shoot one scene and check it before moving on.

## AI-generated shots: use a video model

1. The report gives generation units: connected shots in the same scene are combined into one generation, with the model, the reference images to prepare (product, character), multi-shot prompts (Chinese and English), and how each generation continues from the previous one.
2. There are two ways to run them:
   - By hand: paste the unit prompt and references into a web tool such as Jimeng or Kling, then send the generated video to the agent to put back on the original timeline.
   - Automatically: with [capsule-cinema](https://github.com/JuneYaooo/capsule-cinema) installed, say "remake the AI shots with capsule-cinema". The agent calls the video model, assembles the result and outputs a comparison. Model calls cost money, so it does a free dry run first and generates only after you confirm.
3. Automatic generation runs one job for each call in a generation unit, so connected shots can share a call when the model supports it.

## Dance and action shots: drive them from the source

Dance, fight and fitness shots are about large full-body motion. Product demos, talking heads, or singing and speaking with small movements don't count; they stay in normal generation units and work with lip sync or a digital avatar. Generating from only first and last frames leaves the motion in between to the model's guess, which loses choreography and beat sync, so the report lists these shots separately as "motion-driven" instead of putting them in generation units.

1. Have the agent run `rea-video drive <report directory>`. It erases subtitles and stickers and cuts the shots at pauses near beats into segments of about 10 seconds, each with its own driving video.
2. Prepare a character sheet (front, side and back full-body views in the same outfit, plus a face close-up) and use it for every segment.
3. In most cases, use the driving video directly as a reference, with no need for depth or a blank 3D model. For a single person, full body, in one take, use Kling motion control. For several people, camera movement or cuts inside the segment, use Seedance 2.5 omni-reference. To run locally, use Wan Animate. The report picks a first choice for this video on these criteria, with prompts already written:
   - Busy source background (streets, crowds, clutter), or a new scene very different from the source: convert to a depth video (`--depth` or Video Depth Anything) first, which keeps only motion, space and camera.
   - Space and camera also need to change, or the motion will be reused: use motion capture onto a blank 3D model, set new cameras and render in Blender, then generate from that reference.
   - The facial performance matters: stay with the source as a direct reference. Depth, skeleton and blank models carry only the body, so expressions are lost.
   - The new character is chibi, an animal or a cartoon with very different proportions: use a skeleton video (DWPose + Wan VACE).
4. Send the generated segments to the agent. It runs `rea-video drive --join` to put them back on the original timeline and outputs a side-by-side comparison, so you can check beat sync against the original track.

## Code / UI motion: write code

The report gives the text, layout and motion timing of each segment. Ask the agent to "write a Remotion project from the report". After that, changing the copy only means changing data. The tool doesn't generate this project itself; the agent writes it.

## Stills with pan and zoom: generate locally

From one image and the measured zoom and pan speed, the agent generates the shot locally with no model call.

## Sound: three separate tracks

- Voice-over: the script is in the report. Use TTS or record it yourself.
- Music: find a track in a music library by BPM, key and style, or generate one with Suno.
- Sound effects: add them from the timing table.

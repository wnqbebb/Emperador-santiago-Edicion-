# Cases

The 7 reports below were all generated with this version: the tool measured each video, then an AI assistant reviewed the frames shot by shot (with no vision model turned on) before the report and video package were written. In the contact sheets, each cell is one shot, and the color bar shows the production method, confidence and time. The full reports include the key takeaways, story line, shot list, remake steps, and evidence and prompts for each shot. The linked reports are in Chinese.

The sample videos in `docs/cases/videos/` were recompressed to keep the repo small. Platform marks (Douyin / TikTok / WeChat) are gone and there is an extra layer of compression. If you run them yourself, results will differ from the reports, especially with the tool alone and no visual review. To reproduce a report, use the original file downloaded from the platform.

## 1. Source vs AI remake: TikTok live action → remade with a new product

20 seconds · source 14 shots / remake 21 seconds, 8 shots

![Shot-by-shot breakdown of the juicer source and its AI remake](../cases/juicer_pair.jpg)

▶ [TikTok source](../cases/videos/v11_tiktok_original.mp4) · [AI remake](../cases/videos/v12_oiioii_juicer_remake.mp4) · Full reports: [source](../cases/v11/report.md) · [remake](../cases/v12/report.md)

| | Source | AI remake |
|---|---|---|
| How it was made | All first-person phone footage with a real voice-over | All AI-generated |
| How to remake it | 1 scene, 2 camera setups | 8 shots combined into 3 Seedance 2.0 generations |
| What to prepare | The physical product | A product reference image (with a clear logo on the bottle) |

- Source: it opens with the conclusion (title "This bottle is a GAME CHANGER"), then shows each step in one cut until the drink is ready. The hands, the jars on the counter and the background stay consistent in every shot, with natural handheld shake.
- Remake: add ingredients, close the lid, blend, pour, one step per shot. The brand text on the bottle is garbled in every shot, whole fruit turns into a smoothie within half a second with no blending, and the glass changes shape three times in two seconds. These are the giveaways of generated footage.
- The remake is organized around generation: 8 shots in 3 generations, each using reference images to keep the product's look. The report states which inputs each generation needs, where they come from, and the full Chinese and English prompts.

## 2. Mixed video: AI character dialogue + code UI + real screenshots

19 seconds · 10 shots

![Contact sheet of the mixed video breakdown](../cases/dual_role/storyboard.jpg)

▶ [Source video](../cases/videos/dual_role.mp4) · [Full report](../cases/dual_role/report.md)

How it was made: code/template render 59% + AI-generated video 41%. Two AI characters talk back and forth (5 shots, in two rooms at night), intercut with 5 dark gray template segments that hold screenshots of a diagnostic report, note images and a GitHub page, each slowly pushing in. There is no music and no added sound effects.

How to remake it: generate the 5 dialogue shots in 4 calls, using two character reference images to lock their looks. Build the 5 template segments as 1 code project and swap in your own screenshots.

## 3. 3D explainer: why salted duck eggs ooze oil

66 seconds · 29 shots

![Contact sheet of the 3D explainer breakdown](../cases/salted_egg/storyboard.jpg)

▶ [Source video](../cases/videos/salted_egg.mp4) · [Full report](../cases/salted_egg/report.md)

How it was made: all 29 shots are 3D renders. A plush monkey keeps viewers watching while a cross-section model of a duck egg explains the idea in 4 steps, turning each invisible process into a visible animated metaphor. The same cross-section model appears in 8 shots, with fur and materials stable across frames. Narration sits over library music, with 6 added sound effects on animation beats such as salt grains popping out and oil dripping.

There are two ways to remake it:

- Use a video model: 29 shots in 14 generations.
- Have an LLM write Blender or Three.js code: build the character and cross-section once and render each shot from a set camera. This gives the best consistency across angles, and changing the copy only means changing code.

## 4. Code UI motion: product promo

70 seconds · 9 shots

![Contact sheet of the code UI motion breakdown](../cases/v10/storyboard.jpg)

▶ [Source video](../cases/videos/v10_oiioii_gen_coding_first.mp4) · [Full report](../cases/v10/report.md)

How it was made: a promo for OiiOii's "video remake" feature, made entirely of code-driven UI animation with no voice-over. It walks through the flow of uploading a hit video, rewriting it in one sentence and producing videos in batches. The AI people and products on screen are still images inside UI cards, not full-screen AI video. There is one added sound effect when particles scatter at the end.

How to remake it: no video model needed. Write 1 Remotion project, with full control of text and UI, where changing the copy only means changing data. An LLM can write it directly, and the report has a shot-by-shot motion timeline.

## 5. AI music video: a historical figure in a recording studio

164 seconds · 118 shots

![Contact sheet of the AI music video breakdown (first 24 shots)](../cases/qing_mv/preview.jpg)

(The image shows the first 24 shots from an earlier segmentation.) ▶ [Source video](../cases/videos/qing_mv.mp4) · [Full report (118 shots)](../cases/qing_mv/report.md)

How it was made: AI-generated video 53% + digital avatar lip sync 32% + still pan and zoom 13% + code-rendered title 3%. Zeng Guofan, wearing headphones in a recording studio, sings the story of his life, with each lyric paired with a matching historical image. The opening credits name Claude as lyricist and Suno as composer. Five shots are the same finished clip used twice in the video, so a remake only generates them once.

How to remake it:

- First generate the song with Suno, following the style and rhythm.
- For the lip-sync shots in the studio, drive a digital avatar with a portrait and the vocal.
- Generate the remaining AI shots in 33 calls.
- Make the still pan-and-zoom shots locally from one image each, with no model call.

The report's "Sound" section is wrong for this video: it calls the vocal TTS narration and the music a library track, when it's actually an AI-generated song. Visual review only looks at the picture, and judging sound takes a model that can hear audio.

## 6. Live-action product video: immersive unboxing

71 seconds · 69 shots

![Contact sheet of the unboxing breakdown](../cases/unboxing/storyboard.jpg)

▶ [Source video](../cases/videos/unboxing.mp4) (Douyin creator 阿咪🍓, 720p transcode) · [Full report](../cases/unboxing/report.md)

How it was made: 99% live action. A phone is fixed on an overhead mount while a pair of hands unpacks 7 cream-colored home items on a rug. There is no voice-over. Unboxing sound recorded on set and short lines of small subtitles carry the pacing, at about one shot per second. The unboxing sounds are location audio, so they don't count as added sound effects.

How to remake it: no model needed. Use a phone and an overhead mount, lay the products flat on a light rug, and reach in from the bottom of the frame to unbox them. In post, add an upbeat library track and write subtitles in small text next to the products.

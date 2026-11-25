"""Clipper step 2: cut the chosen clip out of the podcast, then transcribe the clip word by word.

python -X utf8 cut.py <video dir>

Reads work/clip.json: {"title": "...", "segments": [[src_start, src_end], ...]} (source seconds, in play order).
Writes work/clip.mp4 (16:9, 30 fps, the podcast's own colour), work/voice.wav (48 kHz), work/words.json (word times on the
clip's timeline) and work/clip_shots.json (the podcast's camera shots mapped onto the clip, joins counted as cuts)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ff, probe, rj, wj, wt, transcribe, FPS

FADE = 0.012          # 12 ms audio fades at every join: no clicks


def main():
    d = os.path.abspath(sys.argv[1])
    work = os.path.join(d, 'work')
    clip = rj(os.path.join(work, 'clip.json'))
    src = os.path.join(d, clip.get('src', 'raw/podcast.mp4'))
    segs = [(float(a), float(b)) for a, b in clip['segments']]
    pi = probe(src)
    size = '1080:1920' if pi['h'] > pi['w'] else '1920:1080'   # Emperador: un clip vertical se queda vertical
    fc, vs, as_ = [], [], []
    for k, (a, b) in enumerate(segs):
        fc.append(f'[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS,fps={FPS},scale={size}:flags=lanczos,setsar=1[v{k}]')
        fc.append(f'[0:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS,aresample=48000,'
                  f'afade=t=in:d={FADE},afade=t=out:st={max(0, b - a - FADE):.3f}:d={FADE}[a{k}]')
        vs.append(f'[v{k}]')
        as_.append(f'[a{k}]')
    fc.append(''.join(v + a for v, a in zip(vs, as_)) + f'concat=n={len(segs)}:v=1:a=1[v][a]')
    out = os.path.join(work, 'clip.mp4')
    ff(['-i', src, '-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium',
        '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', os.path.join(work, 'clip.mov')])
    ff(['-i', os.path.join(work, 'clip.mov'), '-c:v', 'copy', '-an', out])
    ff(['-i', os.path.join(work, 'clip.mov'), '-vn', '-ac', '1', '-ar', '48000', os.path.join(work, 'voice.wav')])
    os.remove(os.path.join(work, 'clip.mov'))
    dur = probe(out)['dur']
    print(f'clip: {len(segs)} pieces, {dur:.2f} s')

    # the camera shots on the clip's timeline
    shots_p = os.path.join(work, 'shots.json')
    cshots = []
    if os.path.exists(shots_p):
        sj = rj(shots_p)
        t0 = 0.0
        for a, b in segs:
            for s in sj['shots']:
                lo, hi = max(a, s['s']), min(b, s['e'])
                if hi - lo > 0.05:
                    cshots.append({'s': round(t0 + lo - a, 3), 'e': round(t0 + hi - a, 3), 'angle': s['angle'], 'faces': s['faces'],
                                   'src': round(lo, 3)})
            t0 += b - a
        wj(os.path.join(work, 'clip_shots.json'), cshots)
        names = {x['id']: x['name'] for x in sj['angles']}
        print('angles in the clip:', ' -> '.join(f'A{s["angle"]} {names[s["angle"]]} ({s["e"] - s["s"]:.1f}s)' for s in cshots))

    wav = os.path.join(work, 'clip16k.wav')
    ff(['-i', os.path.join(work, 'voice.wav'), '-ac', '1', '-ar', '16000', wav])
    words, segs_t = transcribe(wav)
    wj(os.path.join(work, 'words.json'), {'words': words, 'segments': segs_t, 'duration': round(dur, 3)})
    wt(os.path.join(work, 'transcript.txt'), '\n'.join(f'[{s["s"]:6.2f}-{s["e"]:6.2f}] {s["text"]}' for s in segs_t) + '\n')
    print(f'wrote work/clip.mp4, voice.wav, words.json ({len(words)} words), transcript.txt')


if __name__ == '__main__':
    main()

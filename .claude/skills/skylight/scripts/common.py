"""Shared helpers for Skylight. macOS and Windows: no shell, explicit utf-8, ffmpeg found wherever it is."""
import glob, json, os, shutil, subprocess, sys

SK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1080, 1920          # the reel, 9:16 (study: the style is vertical by nature)
FPS = 30


def _find(name):
    exe = name + ('.exe' if os.name == 'nt' else '')
    env = os.environ.get('PC_' + name.upper())
    if env and os.path.exists(env):
        return env
    p = shutil.which(name)
    if p:
        return p
    home = os.path.expanduser('~')
    cands = ['/opt/homebrew/bin/' + exe, '/usr/local/bin/' + exe, os.path.join(home, '.local', 'bin', exe),
             r'C:\ffmpeg\bin\\' + exe, os.path.join(home, 'scoop', 'shims', exe),
             os.path.join(os.environ.get('LOCALAPPDATA', home), 'Microsoft', 'WinGet', 'Links', exe)]
    for c in cands:
        for g in sorted(glob.glob(c)):
            if os.path.isfile(g):
                return g
    sys.exit(f'{name} not found. Install it (Mac: brew install ffmpeg, Windows: winget install Gyan.FFmpeg) or set PC_{name.upper()}.')


FFMPEG = _find('ffmpeg')
FFPROBE = _find('ffprobe')


def ff(args, quiet=True):
    cmd = [FFMPEG, '-hide_banner', '-y'] + (['-loglevel', 'error'] if quiet else []) + args
    r = subprocess.run(cmd)
    if r.returncode:
        sys.exit('ffmpeg failed: ' + ' '.join(map(str, cmd))[:600])


def probe(path):
    r = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate',
                        '-of', 'json', path], capture_output=True, text=True, encoding='utf-8')
    j = json.loads(r.stdout or '{}')
    v = next((s for s in j.get('streams', []) if s.get('codec_type') == 'video'), {})
    num, den = (v.get('r_frame_rate') or '0/1').split('/')
    return {'dur': float(j.get('format', {}).get('duration', 0)), 'w': v.get('width', 0), 'h': v.get('height', 0),
            'fps': float(num) / max(1.0, float(den)), 'audio': any(s.get('codec_type') == 'audio' for s in j.get('streams', []))}


def rj(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def wj(path, obj, indent=1):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=indent, ensure_ascii=False)


def wt(path, text):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def transcribe(wav16k, model=None):
    """Word times with faster-whisper. Returns [{'w','s','e'}] and segments [{'s','e','text'}]."""
    import warnings
    warnings.filterwarnings('ignore', category=RuntimeWarning)   # harmless Accelerate matmul warnings on macOS
    from faster_whisper import WhisperModel
    lang = os.environ.get('PC_LANG', 'en')  # Emperador: idioma del clip (es, en, …)
    m = WhisperModel(model or os.environ.get('PC_WHISPER', 'small.en' if lang == 'en' else 'small'), device='cpu', compute_type='int8')
    audio = wav16k
    try:   # Emperador: el wav se lee con soundfile (algunas versiones de PyAV fallan al abrirlo)
        import soundfile as sf
        data, sr = sf.read(wav16k, dtype='float32')
        if sr == 16000:
            audio = data if data.ndim == 1 else data.mean(axis=1)
    except Exception:
        pass
    segs, _ = m.transcribe(audio, language=lang, word_timestamps=True, vad_filter=True)
    words, out = [], []
    for s in segs:
        out.append({'s': round(s.start, 3), 'e': round(s.end, 3), 'text': s.text.strip()})
        for w in (s.words or []):
            words.append({'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)})
    return words, out


def face_detector(w, h):
    import cv2
    d = cv2.FaceDetectorYN.create(os.path.join(SK, 'assets', 'models', 'face_detection_yunet_2023mar.onnx'), '', (w, h), 0.6, 0.3, 50)
    return d


def faces(det, frame):
    """[(x, y, w, h, score, nose_x, nose_y, mouth_l_x, mouth_l_y, mouth_r_x, mouth_r_y)] in pixels of frame."""
    _, f = det.detect(frame)
    if f is None:
        return []
    out = []
    for r in f:
        x, y, w, h = r[:4]
        out.append((float(x), float(y), float(w), float(h), float(r[14]), float(r[8]), float(r[9]), float(r[10]), float(r[11]),
                    float(r[12]), float(r[13])))
    return out


def frames(path, w, h, fps=None, ss=None, to=None):
    """Yield RGB frames (numpy HxWx3) decoded by ffmpeg, scaled to w x h."""
    import numpy as np
    args = [FFMPEG, '-hide_banner', '-loglevel', 'error']
    if ss is not None:
        args += ['-ss', f'{ss:.3f}']
    if to is not None:
        args += ['-to', f'{to:.3f}']
    vf = (f'fps={fps},' if fps else '') + f'scale={w}:{h}:flags=bicubic'
    args += ['-i', path, '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-']
    p = subprocess.Popen(args, stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    p.wait()


def tc(t):
    m, s = divmod(max(0.0, t), 60)
    return f'{int(m):02d}:{s:04.1f}'

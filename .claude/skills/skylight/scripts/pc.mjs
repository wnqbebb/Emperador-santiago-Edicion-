#!/usr/bin/env node
// Skylight: one entry point for every step, macOS and Windows.  node pc.mjs <command> <video dir> [options]
//   setup                         check / install everything (Python venv, packages, ffmpeg, yt-dlp, HyperFrames, sound kit)
//   new <dir>                     make <dir>/raw work out scenes
//   get <dir> <link|file>         the podcast -> raw/podcast.mp4 (H.264, 1080p max)
//   breakdown <dir>               clipper 1: word transcript + frame-by-frame breakdown -> work/breakdown.md, angles.png
//   cut <dir>                     clipper 2: work/clip.json -> work/clip.mp4, voice.wav, words.json
//   track <dir> [--face .34]      9:16 with the speaker tracked -> work/aroll.mp4 (+ aroll_sheet.png to check)
//   palette <dir>                 accent colour + four tones, 3 options -> work/palette.json, palette.png
//   plandoc <dir>                 the planning document -> work/plan.html
//   images <dir> slot="words"...  free pictures from Wikimedia Commons -> work/dl/ (+ contact sheets, credits.json)
//   prep <dir> name=src:how ...   B-roll covers, cut-outs, logos -> scenes/assets/img/
//   build <dir>                   textures, plates, plan.json -> scenes/index.html + work/cues.json
//   snap <dir> 1.0,5.5,...        stills to look at before rendering -> work/snap/
//   render <dir>                  scenes/index.html -> work/scenes.mp4 (local, free)
//   mix <dir> [--music f]         cue sheet -> work/mix.wav (+ work/cue_sheet.md)
//   final <dir> [name]            -> out/<name>.mp4
//   all <dir> [name]              build + render + mix + final
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const SK = path.dirname(SCRIPTS);
const HOME = os.homedir();
const WIN = process.platform === 'win32';
const exe = n => n + (WIN ? '.exe' : '');

function which(n) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const d of dirs) for (const e of WIN ? ['.exe', '.cmd', ''] : ['']) {
    const p = path.join(d, n + e);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}
function findFfmpeg() {
  const c = [process.env.PC_FFMPEG, which('ffmpeg'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'C:\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(process.env.LOCALAPPDATA || HOME, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')];
  return c.find(p => p && fs.existsSync(p)) || null;
}
function findPython() {
  const c = [process.env.PC_PY,
    path.join(HOME, '.cache', 'skylight', 'venv', WIN ? 'Scripts' : 'bin', exe('python'))];
  for (const p of c) if (p && fs.existsSync(p)) {
    const r = spawnSync(p, ['-c', 'import numpy, cv2, PIL, soundfile, faster_whisper'], { encoding: 'utf8' });
    if (r.status === 0) return p;
  }
  return null;
}
function findYtdlp() {
  const c = [process.env.PC_YTDLP, which('yt-dlp'), path.join(HOME, '.cache', 'skylight', 'bin', exe('yt-dlp'))];
  return c.find(p => p && fs.existsSync(p)) || null;
}

const FF = findFfmpeg();
const env = { ...process.env, PYTHONUTF8: '1' };
if (FF) env.PATH = path.dirname(FF) + path.delimiter + (env.PATH || '');   // HyperFrames and remove-background need ffmpeg too

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: WIN && /\.cmd$|^npx$/.test(path.basename(cmd)), ...opts });
  if (r.status !== 0) { console.error(`\nfailed: ${cmd} ${args.join(' ')}`); process.exit(r.status || 1); }
}
function py(script, args, isolated = false) {
  const P = findPython();
  if (!P) { console.error('No Python with the packages yet: run  node pc.mjs setup'); process.exit(1); }
  run(P, ['-X', 'utf8', ...(isolated ? ['-I'] : []), path.join(SCRIPTS, script), ...args]);
}
const npx = WIN ? 'npx.cmd' : 'npx';
// Emperador: usa el HyperFrames del proyecto (PC_HYPERFRAMES) en vez de descargar otro
function hf(dir, args) { const H = process.env.PC_HYPERFRAMES; run(H || npx, H ? args : ['-y', 'hyperframes', ...args], { cwd: path.join(dir, 'scenes') }); }

function setup() {
  let ok = true;
  const say = (k, v) => console.log(`  ${v ? 'ok     ' : 'MISSING'} ${k}${typeof v === 'string' ? '  ' + v : ''}`);
  say('ffmpeg', FF || false);
  if (!FF) { ok = false; console.log(WIN ? '    winget install Gyan.FFmpeg' : '    brew install ffmpeg   (or set PC_FFMPEG to a static build)'); }
  let P = findPython();
  if (!P) {
    const base = [process.env.PC_BASE_PY, which('python3.12'), which('python3.11'), which('python3.10'), which('python3'), which('python'), '/usr/bin/python3'].find(p => p && fs.existsSync(p));
    if (!base) { say('python 3.9+', false); console.log(WIN ? '    winget install Python.Python.3.12' : '    install Python 3.10+ from python.org'); process.exit(1); }
    const venv = path.join(HOME, '.cache', 'skylight', 'venv');
    console.log('  making a private Python in', venv);
    run(base, ['-m', 'venv', venv]);
    const vp = path.join(venv, WIN ? 'Scripts' : 'bin', exe('python'));
    run(vp, ['-m', 'pip', 'install', '-q', '--upgrade', 'pip']);
    run(vp, ['-m', 'pip', 'install', '-q', 'numpy', 'opencv-python-headless>=4.8,<5', 'pillow', 'soundfile', 'faster-whisper']);
    P = findPython();
  }
  say('python + packages', P || false);
  let Y = findYtdlp();
  if (!Y) {
    const url = WIN ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : process.platform === 'darwin' ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
    const out = path.join(HOME, '.cache', 'skylight', 'bin', exe('yt-dlp'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    console.log('  downloading the standalone yt-dlp (no Python version limits)');
    run(process.execPath, ['-e', `fetch(${JSON.stringify(url)}).then(r=>r.arrayBuffer()).then(b=>{require('fs').writeFileSync(${JSON.stringify(out)},Buffer.from(b));require('fs').chmodSync(${JSON.stringify(out)},0o755)})`]);
    Y = findYtdlp();
  }
  say('yt-dlp', Y || false);
  const h = process.env.PC_HYPERFRAMES ? spawnSync(process.env.PC_HYPERFRAMES, ['--version'], { encoding: 'utf8', env }) : spawnSync(npx, ['-y', 'hyperframes', '--version'], { encoding: 'utf8', env, shell: WIN });
  say('hyperframes', h.status === 0 ? h.stdout.trim() : false);
  if (!fs.existsSync(path.join(SK, 'sfx', 'click.wav')) && P) run(P, ['-X', 'utf8', path.join(SCRIPTS, 'sfx.py')]);
  say('sound kit', fs.existsSync(path.join(SK, 'sfx', 'click.wav')));
  say('fonts (DM Sans, Instrument Serif)', fs.existsSync(path.join(SK, 'assets', 'fonts', 'DMSans-Variable.woff2')));
  say('face model (YuNet)', fs.existsSync(path.join(SK, 'assets', 'models', 'face_detection_yunet_2023mar.onnx')));
  console.log(ok && P && Y ? 'All set' : 'Fix the MISSING lines, then run setup again.');
}

const [cmd, dirArg, ...rest] = process.argv.slice(2);
const dir = dirArg ? path.resolve(dirArg) : null;
switch (cmd) {
  case 'setup': setup(); break;
  case 'new':
    for (const s of ['raw', 'work', 'out', 'scenes/assets/img']) fs.mkdirSync(path.join(dir, s), { recursive: true });
    console.log(dir); break;
  case 'get': {
    const src = rest[0];
    const out = path.join(dir, 'raw', 'podcast.mp4');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (fs.existsSync(src)) { fs.copyFileSync(src, out); console.log('copied', src); break; }
    const Y = findYtdlp();
    if (!Y) { console.error('no yt-dlp: run setup'); process.exit(1); }
    run(Y, ['--js-runtimes', 'node', '--no-progress', '-f', 'bv*[vcodec^=avc1][height<=1080]+ba[ext=m4a]/bv*[height<=1080]+ba/b',
      '--merge-output-format', 'mp4', '--write-info-json', '-o', path.join(dir, 'raw', 'podcast.%(ext)s'), ...(FF ? ['--ffmpeg-location', path.dirname(FF)] : []), src]);
    break;
  }
  case 'breakdown': py('breakdown.py', [dir, ...rest]); break;
  case 'cut': py('cut.py', [dir]); break;
  case 'track': py('track.py', [dir, ...rest]); break;
  case 'palette': py('palette.py', [dir, ...rest]); break;
  case 'plandoc': py('plandoc.py', [dir]); break;
  case 'images': py('fetch_images.py', [dir, ...rest], true); break;
  case 'prep': py('prep_images.py', [dir, ...rest], true); break;
  case 'build': {
    const a = path.join(dir, 'scenes', 'assets');
    fs.mkdirSync(a, { recursive: true });
    fs.copyFileSync(path.join(dir, 'work', 'aroll.mp4'), path.join(a, 'aroll.mp4'));
    if (!fs.existsSync(path.join(a, 'tex', 'paper.png'))) py('gen_assets.py', [dir]);
    py('build.py', [dir]);
    break;
  }
  case 'snap': hf(dir, ['snapshot', '--at', rest[0] || '1,5,10', '-o', path.join(dir, 'work', 'snap'), '--no-end']); break;
  case 'render': hf(dir, ['render', '-o', path.join(dir, 'work', 'scenes.mp4'), '-q', 'delivery', '--quiet']); break;
  case 'mix': py('mix.py', [dir, ...rest]); break;
  case 'final': case 'all': {
    // options: [name] [--music file] [--music-db -13] [--sfx-db -6.5] [--lufs -15.5]
    const mixArgs = [], plain = [];
    for (let i = 0; i < rest.length; i++) {
      if (rest[i].startsWith('--')) { mixArgs.push(rest[i]); if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) mixArgs.push(rest[++i]); }
      else plain.push(rest[i]);
    }
    if (cmd === 'all') {
      const a = path.join(dir, 'scenes', 'assets');
      fs.mkdirSync(a, { recursive: true });
      fs.copyFileSync(path.join(dir, 'work', 'aroll.mp4'), path.join(a, 'aroll.mp4'));
      if (!fs.existsSync(path.join(a, 'tex', 'paper.png'))) py('gen_assets.py', [dir]);
      py('build.py', [dir]);
      hf(dir, ['render', '-o', path.join(dir, 'work', 'scenes.mp4'), '-q', 'delivery', '--quiet']);
      py('mix.py', [dir, ...mixArgs]);
    }
    const out = path.join(dir, 'out', (plain[0] || 'skylight-clip') + '.mp4');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (!FF) { console.error('no ffmpeg: run setup'); process.exit(1); }
    run(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(dir, 'work', 'scenes.mp4'), '-i', path.join(dir, 'work', 'mix.wav'),
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', out]);
    console.log('wrote', out);
    break;
  }
  default:
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}

const el = id => document.getElementById(id);
const video = el('source');
let canvas = el('screen');
const wave = el('wave');
const waveContext = wave.getContext('2d');
const clips = [];
let selected = null;
let loaded = null;
let userLut = null;
let look = 'natural';
let showOriginalColor = false;
let mode = 'after';
let working = '';
let editIndex = null;
let position = 0;
let sequence = [];
let duration = 0;
let playback = 0;
let playing = false;
let placement = Promise.resolve();
let placementId = 0;
let audio, gain, destination, voiceFilter, voiceCompressor;
let batchRunning = false;
let batchCancel = false;
let exportBlob = null;
let exportExtension = '';
let resultUrl;
let thumbnailsGeneration = 0;
const layoutTime = value => value.toFixed(3);
const spanTime = value => value.toFixed(1).replace('.', ',');
const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
const formats = [
  ['MP4','video/mp4;codecs=avc1.420028,mp4a.40.2','mp4'],
  ['WebM','video/webm;codecs=vp9,opus','webm'],
  ['WebM compatible','video/webm;codecs=vp8,opus','webm']
].filter(([,mime,extension]) => (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) ||
  (extension==='mp4' && typeof VideoEncoder!=='undefined' && typeof AudioEncoder!=='undefined'));
formats.forEach(([name],index) => el('format').add(new Option(name,index)));

function status(text,error = false,fraction = null) {
  el('status').textContent = text;
  el('status').parentElement.dataset.error = String(error);
  el('progress').hidden = fraction === null;
  if (fraction !== null) el('progress').value = fraction;
}
function fail(error) { status(error.message || String(error),true); }
function control(text,action,label = text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.title = label;
  button.setAttribute('aria-label',label);
  button.addEventListener('click',() => Promise.resolve().then(action).catch(fail));
  return button;
}
function busy(state) {
  working = state;
  updateControls();
}
function updateControls() {
  const hasClips = clips.length > 0;
  const exporting = working === 'export';
  for (const field of document.querySelectorAll('[data-edit]')) field.disabled = Boolean(working) || batchRunning;
  for (const id of ['before','after','play','rewind','position']) el(id).disabled = !duration || exporting || working === 'import';
  for (const id of ['add','restore']) el(id).disabled = !selected || Boolean(working);
  for (const id of ['analyse','saveCuts']) el(id).disabled = !hasClips || Boolean(working);
  el('export').disabled = !exporting && (!clips.some(clip=>clip.keep.length) || Boolean(working) || !formats.length);
  el('export').textContent = exporting ? 'Cancelar exportación' : 'Exportar video';
  el('play').textContent = playing && !exporting ? 'Ⅱ' : '▶';
  const playLabel = playing && !exporting ? 'Pausar montaje' : 'Reproducir montaje';
  el('play').setAttribute('aria-label',playLabel);
  el('play').title = playLabel;
  el('audioLane').hidden = !hasClips;
  el('saveSettings').disabled = !hasClips || Boolean(working) || batchRunning;
  el('exportQueue').disabled = !batchRunning && (!hasClips || Boolean(working) || !formats.length);
  el('exportQueue').textContent = batchRunning ? 'Detener cola' : 'Exportar cola';
  el('clipCount').textContent = String(clips.length);
  el('before').classList.toggle('active', mode === 'before');
  el('after').classList.toggle('active', mode === 'after');
  el('before').ariaPressed = String(mode === 'before');
  el('after').ariaPressed = String(mode === 'after');
  el('compare').ariaPressed = String(showOriginalColor);
  el('compare').textContent = showOriginalColor ? 'Volver al LUT' : 'Solo comparar color';
  el('compare').disabled = mode === 'before' || exporting || (!gl && !fallback);
  el('strength').disabled = mode === 'before' || exporting || (!gl && !fallback) || look === 'none';
  for (const button of el('looks').querySelectorAll('button')) {
    button.ariaPressed = String(button.dataset.look === look);
    button.disabled = exporting || (!gl && !fallback);
  }
}

function makeSequence(view) {
  let from = 0;
  const output = [];
  clips.forEach((clip,index)=>{
    const ranges = view === 'before' ? [[0,clip.duration]] : clip.keep;
    for (const [a,b] of ranges) {
      const to = from+b-a;
      output.push({clip,index,a,b,from,to});
      from = to;
    }
  });
  return output;
}
function pointAt(at) {
  if (!sequence.length) return null;
  return sequence.find(part=>at < part.to - .000001) || sequence.at(-1);
}
function locationOf(clip,source) {
  const parts = sequence.filter(part => part.clip === clip);
  const following = parts.find(part => source < part.b - .000001);
  if (following) return following.from+Math.max(0,source-following.a);
  return parts.at(-1)?.to ?? 0;
}
function renderTrack() {
  const track = el('track');
  track.replaceChildren();
  for (const part of sequence) {
    const block = control(String(part.index+1),()=>seekTo(part.from),part.clip.file.name+' · '+layoutTime(part.a)+' s');
    block.className = 'block';
    block.style.setProperty('--length',part.b-part.a);
    if (part.clip.poster) {
      const image = document.createElement('img');
      image.src = part.clip.poster;
      image.alt = '';
      const label = document.createElement('span');
      label.textContent = String(part.index+1);
      block.replaceChildren(image,label);
    }
    track.append(block);
  }
  const marker = document.createElement('i');
  marker.id = 'trackCursor';
  marker.className = 'track-cursor';
  marker.hidden = !duration;
  track.append(marker);
  const raw = clips.reduce((sum,clip)=>sum+clip.duration,0);
  const final = makeSequence('after').at(-1)?.to ?? 0;
  el('summary').textContent = clips.length + ' clips · ' + spanTime(duration) + ' s';
  el('trimmed').textContent = spanTime(Math.max(0,raw-final))+' s recortados';
  el('position').max = duration;
  showPosition(position);
}
function rebuild() {
  sequence = makeSequence(mode);
  duration = sequence.at(-1)?.to ?? 0;
  position = Math.min(position,duration);
  renderTrack();
  updateControls();
}
function stamp(time) {
  const int = Math.floor(Math.max(0,time)*10);
  return Math.floor(int/600)+':'+String(Math.floor(int/10)%60).padStart(2,'0')+'.'+int%10;
}
function showPosition(time) {
  position = Math.max(0,Math.min(time,duration));
  el('position').value = position;
  el('clock').textContent = stamp(position)+' / '+stamp(duration);
  const marker = el('trackCursor');
  if (marker) marker.style.left = Math.min(99.8,duration ? position/duration*100 : 0)+'%';
}
function renderClips() {
  const list = el('clips');
  list.replaceChildren();
  clips.forEach((clip,index) => {
    const row = document.createElement('li');
    row.className = 'clip'+(selected === clip?' selected':'');
    const name = control('',()=>focusClip(clip), 'Seleccionar '+clip.file.name);
    name.className = 'clip-name';
    const title = document.createElement('b');
    title.textContent = (index+1)+'. '+clip.file.name;
    const detail = document.createElement('small');
    detail.textContent = spanTime(clip.duration)+' s · '+clip.label;
    name.append(title,detail);
    const actions = document.createElement('div');
    actions.className = 'clip-buttons';
    const up = control('↑',()=>move(index,-1),'Subir clip');
    const down = control('↓',()=>move(index,1),'Bajar clip');
    const remove = control('×',()=>removeClip(index),'Quitar clip');
    up.disabled = Boolean(working) || index === 0;
    down.disabled = Boolean(working) || index === clips.length-1;
    remove.disabled = Boolean(working);
    name.disabled = working === 'import' || working === 'export';
    actions.append(up,down,remove);
    row.append(name,actions);
    list.append(row);
  });
  updateControls();
}
function setEditor(a = 0,b = selected?.duration ?? 0,index = null) {
  editIndex = index;
  el('start').value = layoutTime(a);
  el('end').value = layoutTime(b);
  el('add').textContent = index === null ? 'Añadir tramo' : 'Actualizar tramo';
}
function drawWave() {
  const {width,height} = wave;
  waveContext.clearRect(0,0,width,height);
  if (!selected) return;
  for (const [a,b] of selected.keep) {
    waveContext.fillStyle = '#e4dafb';
    waveContext.fillRect(a/selected.duration*width,0,(b-a)/selected.duration*width,height);
  }
  const levels = selected.levels;
  if (levels?.length) {
    waveContext.fillStyle = '#735bc4';
    for (let x=0;x<width;x++) {
      const first = Math.floor(x * levels.length / width);
      const last = Math.max(first+1,Math.ceil((x+1)*levels.length/width));
      let peak = 0;
      for (let i=first;i<last;i++) peak = Math.max(peak,levels[i]||0);
      const h = Math.max(1,Math.sqrt(peak)*height*.94);
      waveContext.fillRect(x,(height-h)/2,1,h);
    }
  }
  if (selected===loaded) {
    waveContext.fillStyle = '#492dad';
    waveContext.fillRect(Math.min(width-2,video.currentTime/selected.duration*width),0,2,height);
  }
}
function renderEditor() {
  el('activeName').textContent = selected?.file.name ?? 'Selecciona un clip para ajustar sus cortes';
  const intervals = el('intervals');
  intervals.replaceChildren();
  selected?.keep.forEach(([a,b],index)=>{
    const item = document.createElement('div');
    item.className = 'slice';
    const times = document.createElement('span');
    times.textContent = layoutTime(a)+' → '+layoutTime(b)+' s';
    const actions = document.createElement('div');
    actions.append(control('Ver',()=>seekTo(locationOf(selected,a))),control('Editar',()=>setEditor(a,b,index)),
      control('×',()=>{ stop();selected.keep.splice(index,1); changedCuts(); },'Quitar tramo'));
    for (const action of actions.children) action.disabled = Boolean(working);
    item.append(times,actions);
    intervals.append(item);
  });
  drawWave();
}
function select(clip) {
  if (selected === clip) return;
  selected = clip;
  if (clip) refreshSwatches(clip);
  else {
    lastSwatchClip = null;
    thumbnailsGeneration++;
    for (const preview of el('looks').querySelectorAll('canvas')) preview.hidden = true;
  }
  setEditor();
  renderEditor();
  renderClips();
}
async function focusClip(clip) {
  select(clip);
  if (mode==='after' && !clip.keep.length) return;
  await seekTo(locationOf(clip,0));
}
function changedCuts() {
  setEditor();
  rebuild();
  renderEditor();
  renderClips();
  return seekTo(position);
}
function move(index,delta) {
  stop();
  [clips[index],clips[index+delta]] = [clips[index+delta],clips[index]];
  rebuild();
  renderClips();
  return selected ? focusClip(selected) : seekTo(0);
}
async function removeClip(index) {
  stop();
  const [clip] = clips.splice(index,1);
  if (clip === selected) select(clips[Math.min(index,clips.length-1)] ?? null);
  rebuild();
  renderClips();
  if (clips.length) await seekTo(position);
  else {
    loaded = null;
    video.removeAttribute('src');
    video.load();
    canvas.hidden = true;
    el('empty').hidden = false;
  }
  URL.revokeObjectURL(clip.url);
}

function watch(target,event,timeout = 15000) {
  return new Promise((resolve,reject)=>{
    const timer = setTimeout(()=>done(new Error('El navegador tardó demasiado en abrir el medio.')),timeout);
    function done(error) {
      clearTimeout(timer);
      target.removeEventListener(event,success);
      target.removeEventListener('error',failure);
      error ? reject(error) : resolve();
    }
    function success() { done(); }
    function failure() { done(new Error('El navegador no admite el archivo o su códec.')); }
    target.addEventListener(event,success,{once:true});
    target.addEventListener('error',failure,{once:true});
  });
}
async function seekMedia(media,time) {
  const target = Math.max(0,Math.min(time,Math.max(0,media.duration-.002)));
  if (Math.abs(media.currentTime-target)<.001 && !media.seeking) return;
  const ready = watch(media,'seeked');
  media.currentTime = target;
  await ready;
}
function resize(clip,rule) {
  const zoom = Math.min(1, Math.min(Number(rule),(!gl || colorError) ? 540 : Infinity)/Math.min(clip.width,clip.height),3840/Math.max(clip.width,clip.height));
  canvas.width = Math.max(2,Math.floor(clip.width*zoom/2)*2);
  canvas.height = Math.max(2,Math.floor(clip.height*zoom/2)*2);
}
function place(part,time,forced = false) {
  const id = ++placementId;
  const task = placement.catch(()=>{}).then(async()=>{
    if (id !== placementId && !forced) return false;
    const clip = part.clip;
    if (loaded !== clip || video.readyState < 2) {
      video.pause();
      loaded = null;
      const ready = watch(video,'loadeddata');
      video.src = clip.url;
      video.load();
      await ready;
      loaded = clip;
    }
    await seekMedia(video,time);
    if (id !== placementId && !forced) return false;
    canvas.hidden = false;
    el('empty').hidden = true;
    paint();
    return true;
  });
  placement = task;
  return task;
}
function stop() {
  playback++;
  playing = false;
  video.pause();
  updateControls();
}
async function seekTo(at,interrupt = true) {
  if (working === 'export' || !duration) return;
  if (interrupt) stop();
  at = Math.max(0,Math.min(duration,at));
  const part = pointAt(at);
  const revision = playback;
  if (!part) return;
  showPosition(at);
  if (await place(part,part.a+Math.min(part.b-part.a,at-part.from)) && revision === playback) {
    select(part.clip);
    drawWave();
    refreshSwatches(part.clip);
  }
}
async function changeMode(next,atCurrent = true) {
  if (working === 'export' || next === mode) return;
  const prev = pointAt(position);
  const resume = playing;
  stop();
  const stamp = prev ? prev.a+position-prev.from : 0;
  mode = next;
  showOriginalColor = false;
  rebuild();
  await seekTo(atCurrent && prev ? locationOf(prev.clip,stamp) : 0,false);
  if (resume) startPreview().catch(fail);
}

function audioGraph() {
  if (!audio) {
    audio = new AudioContext();
    const source = audio.createMediaElementSource(video);
    gain = audio.createGain();
    destination = audio.createMediaStreamDestination();
    voiceFilter = audio.createBiquadFilter();
    voiceFilter.type = 'highpass';
    voiceFilter.Q.value = .707;
    voiceCompressor = audio.createDynamicsCompressor();
    source.connect(voiceFilter);
    voiceFilter.connect(voiceCompressor);
    voiceCompressor.connect(gain);
    setVoiceTreatment();
    gain.connect(audio.destination);
    gain.connect(destination);
  }
  return audio;
}
async function startPreview() {
  if (playing) { stop(); return; }
  if (!duration || working === 'export') return;
  const token = ++playback;
  playing = true;
  updateControls();
  try {
    await within(audioGraph().resume(),4000,'El navegador bloqueó el audio. Pulsa Reproducir otra vez.');
    if (position >= duration-.02) showPosition(0);
    let lastPreviewClip = pointAt(position)?.clip;
    setVoiceTreatment(mode==='before');
    for (const part of sequence.slice(sequence.indexOf(pointAt(position)))) {
      if (token!==playback) return;
      const local = part.a+Math.max(0,position-part.from);
      if (!await place(part,local) || token!==playback) return;
      select(part.clip);
      if (mode==='after' && part.a < local+.001 && part.a===local && part.clip!==lastPreviewClip) {
        if (part.from>0) playAccent(audio,gain);
        lastPreviewClip = part.clip;
      }
      await within(video.play(),5000,'El navegador no pudo iniciar la reproducción.');
      while (token===playback && !video.ended && video.currentTime<part.b) {
        showPosition(part.from+Math.max(0,video.currentTime-part.a));
        paint();
        await tick();
      }
      if (token!==playback) return;
      video.pause();
      showPosition(part.to);
    }
  } finally {
    if (token===playback) { stop(); drawWave(); }
  }
}

async function inspect(file) {
  const url = URL.createObjectURL(file);
  const media = document.createElement('video');
  media.preload = 'auto';
  media.muted = true;
  try {
    const ready = watch(media,'loadeddata');
    media.src = url;
    await ready;
    const duration = media.duration;
    if (!(duration > 0) || !Number.isFinite(media.duration) || !media.videoWidth) throw new Error('No contiene un video compatible.');
    let poster = '';
    try {
      const thumbnail = document.createElement('canvas');
      thumbnail.width = 160;
      thumbnail.height = 100;
      const ratio = Math.max(160/media.videoWidth,100/media.videoHeight);
      const w = media.videoWidth*ratio, h = media.videoHeight*ratio;
      thumbnail.getContext('2d').drawImage(media,(160-w)/2,(100-h)/2,w,h);
      poster = thumbnail.toDataURL('image/jpeg',.72);
    } catch (_) {}
    return {file,url,duration,width:media.videoWidth,height:media.videoHeight,poster,keep:[[0,duration]],levels:null,label:'Pendiente'};
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    media.removeAttribute('src');
    media.load();
  }
}

const windowSize = .01;
function levelsFromBuffer(decoded) {
  const size = Math.max(1,Math.round(decoded.sampleRate*windowSize));
  const levels = new Float32Array(Math.ceil(decoded.length/size));
  const channels = Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
  for (let index=0;index<levels.length;index++) {
    const a = index*size, b = Math.min(decoded.length,a+size);
    let max = 0;
    for (const channel of channels) {
      let power = 0;
      for (let sample=a;sample<b;sample++) power += channel[sample]**2;
      max = Math.max(max,Math.sqrt(power/(b-a)));
    }
    levels[index] = max;
  }
  return levels;
}
function within(promise,millis,error) {
  let timer;
  const timeout = new Promise((_,reject)=>{ timer = setTimeout(()=>reject(new Error(error)),millis); });
  return Promise.race([promise,timeout]).finally(()=>clearTimeout(timer));
}
async function decodeViaPlayback(clip,progress) {
  const context = audioGraph();
  await within(context.resume(),2500,'El navegador bloqueó el audio. Pulsa «Volver a detectar».');
  const media = document.createElement('video');
  media.preload = 'auto';
  media.playsInline = true;
  const mute = context.createGain();
  mute.gain.value = 0;
  const probe = context.createMediaElementSource(media);
  const processor = context.createScriptProcessor(2048,2,1);
  const size = Math.max(1,Math.round(context.sampleRate*windowSize));
  const power = [0,0];
  let count = 0;
  const output = [];
  mute.connect(context.destination);
  probe.connect(processor);
  processor.connect(mute);
  processor.onaudioprocess = event=>{
    if (media.paused || media.seeking) return;
    const left = event.inputBuffer.getChannelData(0);
    const right = event.inputBuffer.getChannelData(1);
    for (let index=0;index<left.length;index++) {
      power[0] += left[index]**2;
      power[1] += right[index]**2;
      if (++count === size) {
        output.push(Math.sqrt(Math.max(...power)/size));
        power[0]=0;power[1]=0;count=0;
      }
    }
    progress(media.currentTime/clip.duration);
  };
  try {
    const ready = watch(media,'loadeddata');
    media.src = clip.url;
    await ready;
    const end = watch(media,'ended',(clip.duration+18)*1000);
    end.catch(()=>{});
    await within(media.play(),4000,'El navegador bloqueó la lectura del audio.');
    await end;
    if (count) output.push(Math.sqrt(Math.max(...power)/count));
    if (!output.length) throw new Error('No se pudo leer el audio.');
    // The monitor samples in real time, so a short encoder tail may extend past the video.
    return Float32Array.from(output.slice(0,Math.ceil(clip.duration/windowSize)));
  } finally {
    media.pause();
    processor.onaudioprocess = null;
    probe.disconnect();
    processor.disconnect();
    mute.disconnect();
    media.removeAttribute('src');
    media.load();
  }
}
async function readLevels(clip,progress) {
  if (clip.levels) return clip.levels;
  try {
    const context = new OfflineAudioContext(1,1,16000);
    const decoded = await context.decodeAudioData(await clip.file.arrayBuffer());
    clip.levels = levelsFromBuffer(decoded);
  } catch (_) {
    clip.levels = await decodeViaPlayback(clip,progress);
  }
  return clip.levels;
}
function settings(validate = true) {
  const limits = [['threshold',-80,-10,-42],['gap',80,5000,320],['pad',0,500,100]];
  const values = limits.map(([name,low,high,fallback])=>{
    const value = el(name).valueAsNumber;
    if (value >= low && value <= high) return value;
    if (validate) throw new Error('Revisa el umbral, la pausa mínima y el margen.');
    return fallback;
  });
  const tight = el('pace').value === 'tight';
  return tight ? [Math.max(-46,values[0]),Math.min(.09,values[1]/1000),Math.min(.017,values[2]/1000),true] :
    [values[0],values[1]/1000,values[2]/1000,el('shortPauses').checked];
}
async function processClips(queue, rejected = []) {
  if (!queue.length && !rejected.length) return;
  const options = settings(false);
  let removed = 0, ready = 0, coverage = 0;
  const failed = [...rejected];
  for (const [index,clip] of queue.entries()) {
    clip.label='Analizando…';
    renderClips();
    status('Analizando audio '+(index+1)+' de '+queue.length+' · '+clip.file.name,false,index/queue.length);
    await tick();
    try {
      const levels = await readLevels(clip,fraction=> status(
        'Leyendo audio '+(index+1)+' de '+queue.length+' · '+clip.file.name,false,(index+Math.min(.999,fraction))/queue.length
      ));
      const scanned = Math.min(clip.duration,levels.length*windowSize);
      clip.scanned = scanned;
      coverage += scanned;
      if (scanned < clip.duration-.16) failed.push(clip.file.name+' (pista más corta que el video)');
      const ranges = detect(clip,levels,...options);
      if (!ranges) {
        clip.label = 'Sin voz detectable';
        failed.push(clip.file.name+' (audio muy bajo o ausente)');
      } else {
        clip.keep = ranges;
        const cut = clip.duration-ranges.reduce((t,[a,b])=>t+b-a,0);
        removed += Math.max(0,cut);
        clip.label = cut >= .015 ? 'Recortado' : 'Sin pausas largas';
        ready++;
      }
    } catch (_) {
      clip.label='Audio no analizado';
      failed.push(clip.file.name+' (audio incompatible o bloqueado)');
    }
    renderClips();
  }
  const report = ready ? ready+' de '+(queue.length+rejected.length)+' clips analizados · '+spanTime(removed)+' s eliminados de '+spanTime(coverage)+' s de audio analizado.' : '';
  status([report,failed.length?'Para revisar: '+failed.join(', ')+'.':''].filter(Boolean).join(' '),Boolean(failed.length));
}

async function importClips(files) {
  if (!files.length || working) return;
  stop();
  busy('import');
  renderClips();
  const opened = [];
  const rejected = [];
  const previouslyEmpty = !clips.length;
  try {
    audioGraph().resume().catch(()=>{});
    for (const [index,file] of files.entries()) {
      status('Cargando clip '+(index+1)+' de '+files.length+' · '+file.name,false,index/files.length);
      try {
        const clip = await inspect(file);
        clips.push(clip);
        opened.push(clip);
      } catch (_) { rejected.push(file.name+' (el navegador no pudo abrir el video)'); }
      renderClips();
    }
    if (opened.length) {
      if (previouslyEmpty) {
        resize(opened[0],1080);
        select(opened[0]);
      }
      mode = 'after';
    }
    await processClips(opened,rejected);
    rebuild();
    await seekTo(previouslyEmpty ? 0 : position);
  } finally {
    busy('');
    renderClips();
    renderEditor();
  }
}

async function analyseAgain() {
  if (working || !clips.length) return;
  settings();
  stop();
  busy('import');
  try {
    audioGraph().resume().catch(()=>{});
    mode = 'after';
    await processClips(clips);
    rebuild();
    await seekTo(position);
  } finally {
    busy('');
    renderClips();
    renderEditor();
  }
}

function detect(clip, levels, db, gap, pad, shortenBrief = false) {
  const quiet = 10 ** (db / 20);
  const deepQuiet = 10 ** (Math.min(-44, db-3) / 20);
  if (!levels.some(level => level >= quiet)) return null;
  const keep = [];
  let quietStart = -1;
  let quietPeak = 0;
  let sectionStart = 0;
  function closeQuiet(endIndex) {
    const a = quietStart * windowSize;
    const b = Math.min(clip.duration, endIndex * windowSize);
    const shortCleanGap = shortenBrief && a > 0 && endIndex < levels.length &&
      b-a >= .18 - 1e-6 && quietPeak <= deepQuiet;
    if (b-a < gap - 1e-6 && !shortCleanGap) return;
    const margin = shortCleanGap ? Math.min(pad,.060) : pad;
    const from = a === 0 ? 0 : a + margin;
    const to = endIndex === levels.length ? clip.duration : b - margin;
    if (to <= from) return;
    if (from > sectionStart) keep.push([sectionStart, from]);
    sectionStart = to;
  }
  for (let index=0; index<levels.length; index++) {
    if (levels[index] < quiet) {
      if (quietStart === -1) { quietStart = index; quietPeak = 0; }
      quietPeak = Math.max(quietPeak,levels[index]);
    } else if (quietStart !== -1) {
      closeQuiet(index);
      quietStart = -1;
    }
  }
  if (quietStart !== -1) closeQuiet(levels.length);
  if (sectionStart < clip.duration) keep.push([sectionStart,clip.duration]);
  return keep.length ? keep : null;
}


const clamp = n => Math.max(0, Math.min(1,n));
function naturalLut() {
  const size = 33, data = new Float32Array(size**3 * 3);
  let index = 0;
  for (let b=0;b<size;b++) for (let g=0;g<size;g++) for (let r=0;r<size;r++) {
    const rgb = [r,g,b].map(n => n/(size-1));
    const luma = .2126*rgb[0] + .7152*rgb[1] + .0722*rgb[2];
    const chroma = Math.max(...rgb)-Math.min(...rgb);
    const weight = 4*luma*(1-luma);
    const neutral = Math.max(0,1-2.8*chroma);
    const highlight = Math.min(1,1.2*luma);
    const skinHue = Math.exp(-(((rgb[0]-rgb[1]-.12)/.16)**2 + ((rgb[1]-rgb[2]-.105)/.16)**2));
    const warmthControl = weight*(.45+.55*neutral)*(.75+.25*highlight);
    const correctedLuma = luma + .030*weight*(2*luma-1) + .016*(1-luma)**3
      - .018*Math.max(0,(luma-.75)/.25)**2;
    const saturation = 1.025 - .042*skinHue - .018*Math.max(0,(luma-.8)/.2);
    const offsets = [-.012,-.001,.018];
    for (const [channel,value] of rgb.entries()) {
      data[index++] = clamp(correctedLuma + (value-luma)*saturation + offsets[channel]*warmthControl);
    }
  }
  return {size,data,min:[0,0,0],max:[1,1,1]};
}

function parseCube(text) {
  let size;
  let min = [0,0,0], max = [1,1,1];
  const values = [];
  for (const line of text.split(/\r?\n/)) {
    const stripped = line.split('#')[0].trim();
    if (!stripped || /^TITLE\b/.test(stripped)) continue;
    const [key,...rest] = stripped.split(/\s+/);
    if (key === 'LUT_3D_SIZE') {
      size = Number(rest[0]);
      if (rest.length !== 1 || !Number.isInteger(size) || size < 2 || size > 65) {
        throw new Error('Usa un LUT cúbico 3D con tamaño de 2 a 65.');
      }
    } else if (key === 'DOMAIN_MIN' || key === 'DOMAIN_MAX') {
      const domain = rest.map(Number);
      if (domain.length !== 3 || !domain.every(Number.isFinite)) throw new Error('El dominio del LUT no es válido.');
      if (key === 'DOMAIN_MIN') min = domain;
      else max = domain;
    } else if (key === 'LUT_3D_INPUT_RANGE') {
      const endpoints = rest.map(Number);
      if (endpoints.length !== 2 || !endpoints.every(Number.isFinite)) throw new Error('El dominio del LUT no es válido.');
      min = Array(3).fill(endpoints[0]);
      max = Array(3).fill(endpoints[1]);
    } else {
      const rgb = [key,...rest].map(Number);
      if (rgb.length !== 3 || !rgb.every(Number.isFinite)) throw new Error('No se pudo leer el LUT 3D .cube.');
      values.push(...rgb);
    }
  }
  if (!size || values.length !== size**3*3 || min.some((low,i) => low >= max[i])) throw new Error('El tamaño o dominio del LUT 3D no coincide con su contenido.');
  return {size,min,max,data:new Float32Array(values)};
}

const builtInLut = naturalLut();
const gl = canvas.getContext('webgl2', {alpha:false, antialias:false, preserveDrawingBuffer:true});
let fallback = gl ? null : canvas.getContext('2d',{willReadFrequently:true});
let program, videoTexture, lutTexture, currentLut;
let colorError;
function shader(type, code) {
  const s = gl.createShader(type);
  gl.shaderSource(s,code);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function setupColor() {
  if (!gl) return;
  const vert = shader(gl.VERTEX_SHADER, `#version 300 es
    out vec2 uv;
    void main() {
      vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
      uv = vec2(p.x, 1.0 - p.y);
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`);
  const frag = shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float;
    precision highp sampler3D;
    in vec2 uv;
    out vec4 pixel;
    uniform sampler2D frame;
    uniform sampler3D lut;
    uniform vec3 low;
    uniform vec3 high;
    uniform vec2 box;
    uniform float n;
    uniform float amount;
    vec3 grade(vec3 unit) {
      vec3 position = unit * (n-1.);
      ivec3 base = min(ivec3(position), ivec3(int(n)-2));
      vec3 f = position - vec3(base);
      int first = f.x >= f.y && f.x >= f.z ? 0 : (f.y >= f.z ? 1 : 2);
      int last = f.x < f.y && f.x < f.z ? 0 : (f.y < f.z ? 1 : 2);
      int middle = 3 - first - last;
      ivec3 one = ivec3(0);
      one[first] = 1;
      ivec3 two = one;
      two[middle] = 1;
      vec3 c0 = texelFetch(lut,base,0).rgb;
      vec3 c1 = texelFetch(lut,base+one,0).rgb;
      vec3 c2 = texelFetch(lut,base+two,0).rgb;
      vec3 c3 = texelFetch(lut,base+ivec3(1),0).rgb;
      return c0 + f[first]*(c1-c0) + f[middle]*(c2-c1) + f[last]*(c3-c2);
    }
    void main() {
      vec2 point = (uv - .5) / box + .5;
      if (any(lessThan(point, vec2(0))) || any(greaterThan(point, vec2(1)))) {
        pixel = vec4(0,0,0,1);
        return;
      }
      vec3 rgb = texture(frame, point).rgb;
      vec3 unit = clamp((rgb-low)/(high-low),0.,1.);
      pixel = vec4(clamp(mix(rgb, grade(unit), amount),0.,1.),1.);
    }`);
  program = gl.createProgram();
  gl.attachShader(program,vert);
  gl.attachShader(program,frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  videoTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D,videoTexture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program,'frame'),0);
  lutTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D,lutTexture);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.uniform1i(gl.getUniformLocation(program,'lut'),1);
  uploadLut(builtInLut);
}
function uploadLut(lut) {
  if (lut === currentLut) return;
  const {size,data,min,max} = lut;
  gl.activeTexture(gl.TEXTURE1);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage3D(gl.TEXTURE_3D,0,gl.RGB32F,size,size,size,0,gl.RGB,gl.FLOAT,data);
  gl.uniform1f(gl.getUniformLocation(program,'n'),size);
  gl.uniform3fv(gl.getUniformLocation(program,'low'),min);
  gl.uniform3fv(gl.getUniformLocation(program,'high'),max);
  currentLut = lut;
}
function paint() {
  if (!loaded || video.readyState < 2 || video.seeking) return;
  paintSource(video,video.videoWidth,video.videoHeight);
}
function paintSource(source,sourceWidth,sourceHeight) {
  const {width,height} = canvas;
  const scale = Math.min(width/sourceWidth,height/sourceHeight);
  const w = sourceWidth*scale, h = sourceHeight*scale;
  const amount = look === 'none' || (working !== 'export' && (showOriginalColor || mode === 'before')) ? 0 : Number(el('strength').value)/100;
  if (gl && !colorError) {
    const chosen = look;
    const useFilter = working==='export' || mode==='after';
    const lut = combinedLut(chosen, useFilter && !showOriginalColor ? el('filter').value : 'clean');
    uploadLut(lut);
    gl.activeTexture(gl.TEXTURE0);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.viewport(0,0,width,height);
    gl.uniform2f(gl.getUniformLocation(program,'box'),w/width,h/height);
    gl.uniform1f(gl.getUniformLocation(program,'amount'), look==='none' && (working==='export' || mode==='after') && !showOriginalColor && el('filter').value!=='clean' ? 1 : amount);
    gl.drawArrays(gl.TRIANGLES,0,3);
  } else if (fallback) {
    fallback.fillStyle = '#000';
    fallback.fillRect(0,0,width,height);
    fallback.drawImage(source,(width-w)/2,(height-h)/2,w,h);
    const filter = (working==='export' || mode==='after') && !showOriginalColor ? el('filter').value : 'clean';
    const strength = look==='none' && filter!=='clean' ? 1 : amount;
    if (strength > 0) {
      const x = Math.ceil((width-w)/2), y = Math.ceil((height-h)/2);
      const frame = fallback.getImageData(x,y,Math.max(1,Math.floor(width-2*x)),Math.max(1,Math.floor(height-2*y)));
      applyLutToPixels(frame.data,combinedLut(look,filter),strength);
      fallback.putImageData(frame,x,y);
    }
  }
}
function applyLutToPixels(pixels,lut,amount) {
  const {size,data,min,max} = lut;
  const offsets = min.map((low,channel)=>Array.from({length:256},(_,value)=>{
    const unit = clamp((value/255-low)/(max[channel]-low))*(size-1);
    return [Math.min(size-2,Math.floor(unit)),unit-Math.min(size-2,Math.floor(unit))];
  }));
  const delta = [3,3*size,3*size*size];
  for (let i=0;i<pixels.length;i+=4) {
    const r = offsets[0][pixels[i]], g = offsets[1][pixels[i+1]], b = offsets[2][pixels[i+2]];
    const base = 3*(r[0]+size*(g[0]+size*b[0]));
    const fx = r[1], fy = g[1], fz = b[1];
    const first = fx>=fy && fx>=fz ? 0 : (fy>=fz ? 1 : 2);
    const last = fx<fy && fx<fz ? 0 : (fy<fz ? 1 : 2);
    const middle = 3-first-last;
    const top = first===0 ? fx : first===1 ? fy : fz;
    const mid = middle===0 ? fx : middle===1 ? fy : fz;
    const bottom = last===0 ? fx : last===1 ? fy : fz;
    const one = base+delta[first], two = one+delta[middle], three = base+delta[0]+delta[1]+delta[2];
    for (let c=0;c<3;c++) {
      const value = data[base+c]+top*(data[one+c]-data[base+c])+mid*(data[two+c]-data[one+c])+bottom*(data[three+c]-data[two+c]);
      pixels[i+c] = (1-amount)*pixels[i+c]+amount*value*255;
    }
  }
}
try { setupColor(); } catch (error) {
  colorError = error;
  const replacement = canvas.cloneNode();
  canvas.replaceWith(replacement);
  canvas = replacement;
  fallback = canvas.getContext('2d',{willReadFrequently:true});
}
if (!gl || colorError) el('graphics').hidden = false;


const looks = [
  {id:'natural',name:'Boutique natural',swatch:'linear-gradient(125deg,#443530,#bb927d,#eedfca)'},
  {id:'editorial',name:'Luz editorial',swatch:'linear-gradient(125deg,#52495c,#ba9da5,#f8e9e3)',offset:[.020,.020,.030],exposure:.04,saturation:.90},
  {id:'cinema',name:'Índigo cine',swatch:'linear-gradient(125deg,#221d3d,#655880,#cdbad7)',offset:[-.027,-.010,.062],exposure:-.025,saturation:.87},
  {id:'warm',name:'Dorado suave',swatch:'linear-gradient(125deg,#493022,#ca9765,#f2d4a7)',offset:[.055,.022,-.028],exposure:.007,saturation:1.06},
  {id:'mono',name:'Blanco y negro',swatch:'linear-gradient(125deg,#252634,#838390,#eae9ee)',offset:[0,0,0],exposure:-.015,saturation:0},
  {id:'none',name:'Original',swatch:'linear-gradient(125deg,#52515b,#8a8996,#d8d6df)'}
];
const latchedLuts = new Map();
function paletteLut(id) {
  if (id==='custom') return userLut ?? builtInLut;
  const preset = looks.find(item=>item.id===id);
  if (!preset?.offset) return builtInLut;
  if (!latchedLuts.has(id)) {
    const data = new Float32Array(builtInLut.data.length);
    for (let i=0;i<data.length;i+=3) {
      const rgb = builtInLut.data.subarray(i,i+3);
      const luma = .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
      const range = 4*luma*(1-luma);
      for (let c=0;c<3;c++) {
        data[i+c] = clamp(luma+(rgb[c]-luma)*preset.saturation+range*(preset.exposure+preset.offset[c]*(1-luma*.55)));
      }
    }
    latchedLuts.set(id,{...builtInLut,data});
  }
  return latchedLuts.get(id);
}
function renderLooks() {
  const grid = el('looks');
  grid.replaceChildren();
  for (const preset of looks) {
    const button = control('',async()=>{
      look = preset.id;
      showOriginalColor = false;
      if (mode === 'before') await changeMode('after');
      updateControls();
      paint();
    },'Aplicar '+preset.name);
    button.className = 'look';
    button.dataset.look = preset.id;
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.setProperty('--swatch',preset.swatch);
    const sample = document.createElement('canvas');
    sample.width = 130; sample.height = 75;
    sample.hidden = true;
    swatch.append(sample);
    const name = document.createElement('b');
    name.textContent = preset.name;
    button.append(swatch,name);
    grid.append(button);
  }
  lastSwatchClip = null;
  updateControls();
  if (selected) refreshSwatches(selected);
}
let lastSwatchClip;
function refreshSwatches(clip) {
  if (!clip?.poster || lastSwatchClip===clip) return;
  lastSwatchClip = clip;
  const token = ++thumbnailsGeneration;
  const image = new Image();
  image.onload = ()=>{
    if (token!==thumbnailsGeneration) return;
    const swatches = el('looks').querySelectorAll('button');
    for (const button of swatches) {
      const thumbnail = button.querySelector('canvas');
      const context = thumbnail.getContext('2d',{willReadFrequently:true});
      const {width,height} = thumbnail;
      context.drawImage(image,0,0,width,height);
      if (button.dataset.look !== 'none') {
        const frame = context.getImageData(0,0,width,height);
        applyLutToPixels(frame.data,paletteLut(button.dataset.look),1);
        context.putImageData(frame,0,0);
      }
      thumbnail.hidden = false;
    }
  };
  image.src = clip.poster;
}

function validateIntervals(intervals,duration) {
  if (!Array.isArray(intervals)) throw new Error('Los cortes deben ser pares de tiempos.');
  const result = intervals.map(pair => {
    if (!Array.isArray(pair) || pair.length!==2) throw new Error('Cada tramo necesita entrada y salida.');
    const [a,b] = pair;
    if (!Number.isFinite(a) || !Number.isFinite(b) || a<0 || b>duration+.001 || Math.min(duration,b)-a<.019)
      throw new Error('Cada tramo debe durar al menos 20 ms y quedar dentro del clip.');
    return [a,Math.min(duration,b)];
  }).sort((x,y)=>x[0]-y[0]);
  if (result.some(([a],i)=>i && a<result[i-1][1]-.0005)) throw new Error('Dos tramos se cruzan. Ajusta sus tiempos.');
  return result;
}

async function exportVideo(download = true, fromBatch = false) {
  if (working==='export') { batchCancel=true; stop(); status('Cancelando exportación…'); return; }
  const plan = makeSequence('after');
  if (!plan.length || !formats.length || working || (batchRunning && !fromBatch)) return null;
  stop();
  const token = ++playback;
  const backTo = position;
  let recorder, stopped, failure, stream, muted = false;
  let exportError;
  busy('export');
  renderClips();
  renderEditor();
  el('result').hidden = true;
  const total = plan.at(-1).to;
  const [,mime,extension] = formats[Number(el('format').value)];
  const quality = exportQuality();
  exportBlob = null;
  exportExtension = '';
  const compareWas = showOriginalColor;
  showOriginalColor = false;
  try {
    await placement.catch(()=>{});
    setVoiceTreatment();
    resize(plan[0].clip,quality.size);
    {
      try {
        const fast = await encodeFast(plan,quality,extension==='mp4',()=>token!==playback);
        if (fast) {
          exportResult(fast.blob,fast.extension,download,fast.extension.toUpperCase()+' acelerado');
          return fast.blob;
        }
      } catch (error) {
        if (token!==playback) { status('Exportación cancelada.'); return null; }
        console.info('Exportación compatible:',error.message);
        status('Usando exportación compatible con este formato y navegador.');
      }
    }
    await within(audioGraph().resume(),4000,'Activa el audio del navegador y pulsa Exportar otra vez.');
    if (!canvas.captureStream) throw new Error('Este navegador no ofrece exportación compatible. Usa Chrome o Edge.');
    if (token!==playback) { status('Exportación cancelada.'); return null; }
    const supported=[mime,'video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'].find(type=>MediaRecorder.isTypeSupported(type));
    if (!supported) throw new Error('Este navegador no admite la exportación del video.');
    const compatibleExtension=supported.startsWith('video/mp4')?'mp4':'webm';
    stream = canvas.captureStream(30);
    stream.addTrack(destination.stream.getAudioTracks()[0]);
    const chunks = [];
    recorder = new MediaRecorder(stream,{mimeType:supported,videoBitsPerSecond:quality.bitrate,audioBitsPerSecond:quality.audio});
    stopped = new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
    recorder.ondataavailable = e=>{ if (e.data.size) chunks.push(e.data); };
    recorder.onerror = ()=>{ failure = new Error('El codificador falló. Prueba WebM o 720p.'); stop(); };
    gain.disconnect(audio.destination);
    muted = true;
    for (const [index,part] of plan.entries()) {
      if (token!==playback) break;
      await place(part,part.a,true);
      if (token!==playback) break;
      if (index===0) recorder.start(1000);
      else {
        const resumed = watch(recorder,'resume',5000);
        recorder.resume();
        await resumed;
      }
      if (index>0 && plan[index-1].clip!==part.clip) playAccent(audio,gain);
      stream.getVideoTracks()[0].requestFrame?.();
      status('Exportando video · '+Math.round(part.from/total*100)+' %',false,part.from/total);
      await within(video.play(),4000,'El navegador bloqueó la reproducción.');
      const started = performance.now();
      const budget = (part.b-part.a)*1000;
      while (token===playback && !video.ended && video.currentTime<part.b && performance.now()-started<budget) {
        const fraction = Math.min(1,(part.from+Math.max(0,video.currentTime-part.a))/total);
        status('Exportando video · '+Math.round(fraction*100)+' %',false,fraction);
        paint();
        await new Promise(resolve=>setTimeout(resolve,Math.min(15,Math.max(1,budget-(performance.now()-started)))));
      }
      video.pause();
      if (token!==playback) break;
      if (index < plan.length-1) {
        const paused = watch(recorder,'pause',5000);
        recorder.pause();
        await paused;
      }
    }
    if (recorder.state !== 'inactive') {
      recorder.stop();
      await within(stopped,10000,'El codificador no finalizó el archivo.');
    }
    if (failure) throw failure;
    if (token!==playback) { status('Exportación cancelada.'); return; }
    const file = new Blob(chunks,{type:recorder.mimeType});
    if (!file.size) throw new Error('La exportación quedó vacía. Prueba con otro formato.');
    exportResult(file,compatibleExtension,download,'Exportación compatible');
    return file;
  } catch (error) {
    exportError = error;
  } finally {
    if (recorder && recorder.state!=='inactive') recorder.stop();
    stream?.getVideoTracks().forEach(track=>track.stop());
    if (muted) gain.connect(audio.destination);
    showOriginalColor = compareWas;
    video.pause();
    if (clips.length) resize(clips[0],1080);
    busy('');
    renderClips();
    renderEditor();
    await seekTo(backTo).catch(fail);
  }
  if (exportError) throw exportError;
}

function bind(id,event,action) {
  el(id).addEventListener(event,e=>{
    try { Promise.resolve(action(e)).catch(fail); } catch (error) { fail(error); }
  });
}
for (const id of ['filesTop','files','filesCenter','folder']) {
  bind(id,'change',event=>{
    const files = Array.from(event.target.files);
    event.target.value = '';
    return receiveFiles(files);
  });
}
for (const id of ['drop','stage']) {
  const box = el(id);
  box.addEventListener('dragover',event=>{if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); box.classList.add('drag'); }});
  box.addEventListener('dragleave',()=>box.classList.remove('drag'));
  bind(id,'drop',event=>{
    event.preventDefault();
    box.classList.remove('drag');
    return receiveDrop(event.dataTransfer);
  });
}
bind('before','click',()=>changeMode('before'));
bind('after','click',()=>changeMode('after'));
bind('play','click',startPreview);
bind('rewind','click',()=>seekTo(0));
bind('position','input',()=>seekTo(Number(el('position').value)));
bind('analyse','click',analyseAgain);
bind('export','click',()=>exportVideo());
bind('exportQueue','click',exportProjectQueue);
bind('saveSettings','click',()=>{ captureProject(); renderQueue(); status('Ajustes guardados para este proyecto.'); });
bind('filter','change',()=>{paint();captureProject();});
bind('sound','change',()=>{setVoiceTreatment(mode==='before');captureProject();});
bind('strength','input',()=>{ el('amount').value=el('strength').value+' %';paint(); });
bind('compare','click',()=>{ showOriginalColor=!showOriginalColor;updateControls();paint(); });
bind('cube','change',async event=>{
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  userLut = parseCube(await file.text());
  const old = looks.findIndex(item=>item.id==='custom');
  if (old>=0) looks.splice(old,1);
  looks.push({id:'custom',name:file.name,swatch:'linear-gradient(125deg,#211743,#7459c0,#e7d9ff)'});
  look = 'custom';
  showOriginalColor = false;
  renderLooks();
  await changeMode('after');
  paint();
});
bind('add','click',()=>{
  stop();
  const intervals = [...selected.keep];
  const pair = [el('start').valueAsNumber,el('end').valueAsNumber];
  if (editIndex===null) intervals.push(pair);
  else intervals[editIndex] = pair;
  selected.keep = validateIntervals(intervals,selected.duration);
  selected.label = 'Corte manual';
  return changedCuts();
});
bind('restore','click',()=>{
  stop();
  selected.keep = [[0,selected.duration]];
  selected.label = 'Entero';
  return changedCuts();
});
bind('wave','click',event=>{
  const rect = wave.getBoundingClientRect();
  if (!selected) return;
  return seekTo(locationOf(selected,clamp((event.clientX-rect.left)/rect.width)*selected.duration));
});
bind('saveCuts','click',()=>{
  const data = {version:1,clips:clips.map(clip=>({file:clip.file.name,bytes:clip.file.size,duration:clip.duration,keep:clip.keep}))};
  const anchor = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  anchor.href=url;anchor.download='Emperador_Santiago_Cortes.json';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
});
bind('loadCuts','change',async event=>{
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const data = JSON.parse(await file.text());
  if (data?.version!==1 || !Array.isArray(data.clips) || data.clips.length!==clips.length)
    throw new Error('Carga los mismos clips que están en el archivo de cortes.');
  const remaining = [...clips];
  const ordered = data.clips.map(entry=>{
    const index = remaining.findIndex(clip=>clip.file.name===entry.file && clip.file.size===entry.bytes && Math.abs(clip.duration-entry.duration)<.02);
    if (index<0) throw new Error('Falta el clip '+entry.file+'.');
    const [clip] = remaining.splice(index,1);
    return {clip,keep:validateIntervals(entry.keep,clip.duration)};
  });
  stop();
  clips.splice(0,clips.length,...ordered.map(({clip,keep})=>{ clip.keep=keep;clip.label='Cortes cargados';return clip; }));
  mode='after';
  status('Orden y cortes restaurados.');
  await changedCuts();
});
document.addEventListener('keydown',event=>{
  if (event.code!=='Space' || event.target.closest('button,input,select,summary,a') || !duration || working) return;
  event.preventDefault();
  startPreview().catch(fail);
});
/* Initialization follows the V4 modules. */

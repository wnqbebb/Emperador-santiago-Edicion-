const fastYield = ()=>new Promise(resolve=>setTimeout(resolve,0));
function keepGoing(cancelled,error) {
  if (cancelled()) throw new Error('Exportación cancelada.');
  if (error) throw error;
}
function cloneChunk(chunk) {
  const data=new Uint8Array(chunk.byteLength);
  chunk.copyTo(data);
  return data;
}
function cloneDescription(description) {
  if (!description) return null;
  return description instanceof ArrayBuffer ? new Uint8Array(description).slice() :
    new Uint8Array(description.buffer,description.byteOffset,description.byteLength).slice();
}

function videoTargets(plan,fps) {
  const groups=[];
  let index=0;
  for (const part of plan) {
    if (groups.at(-1)?.clip!==part.clip) groups.push({clip:part.clip,frames:[]});
    const group=groups.at(-1);
    for (;index/fps<part.to-.00000001;index++) {
      const at=index/fps;
      group.frames.push({at:Math.round(at*1e6),take:(part.a+Math.max(0,at-part.from))*1e6});
    }
  }
  return groups;
}

async function decodeFrames(source,marks,consume,cancelled,encoder) {
  const {config,data,samples,timeScale,shift}=source;
  if (!(await VideoDecoder.isConfigSupported(config)).supported) throw new Error('Decodificador AVC no disponible.');
  let index=0, held=null, failure;
  const decoder=new VideoDecoder({
    error:error=>{failure=error;},
    output(frame) {
      try {
        if (!cancelled() && !failure) {
          while (index<marks.length && marks[index].take<=frame.timestamp+.5) {
            const selected=!held||Math.abs(marks[index].take-frame.timestamp)<Math.abs(marks[index].take-held.timestamp) ? frame : held;
            consume(selected,marks[index++].at);
          }
          held?.close();
          held=frame;
        } else frame.close();
      } catch (error) { frame.close();failure=error; }
    }
  });
  try {
    decoder.configure(config);
    for (let n=0;n<samples.length;n++) {
      keepGoing(cancelled,failure);
      const sample=samples[n];
      decoder.decode(new EncodedVideoChunk({type:sample.key?'key':'delta',
        timestamp:Math.round((sample.pts-shift)*1e6/timeScale),
        duration:Math.round(sample.duration*1e6/timeScale),
        data:data.subarray(sample.start,sample.start+sample.size)
      }));
      if (n%4===3) {
        while (decoder.decodeQueueSize>7 || encoder.encodeQueueSize>16) {
          keepGoing(cancelled,failure);
          await fastYield();
        }
      }
    }
    await decoder.flush();
    keepGoing(cancelled,failure);
    while (held && index<marks.length) consume(held,marks[index++].at);
    if (index!==marks.length) throw new Error('Este archivo no entregó todos sus fotogramas.');
  } finally {
    held?.close();
    if (decoder.state!=='closed') decoder.close();
  }
}

async function buildAudio(plan,rate,channels,cancelled) {
  const total=Math.max(1024,Math.round(plan.at(-1).to*rate));
  const output=new AudioBuffer({numberOfChannels:channels,length:total,sampleRate:rate});
  const targets=Array.from({length:channels},(_,index)=>output.getChannelData(index));
  const offline=new OfflineAudioContext(1,1,rate);
  let previous=null, decoded;
  const accent=el('sound').value==='accents' ? makeAccent(rate) : null;
  for (const part of plan) {
    keepGoing(cancelled);
    const next=previous!==part.clip;
    if (next) decoded=await offline.decodeAudioData(await part.clip.file.arrayBuffer());
    const a=Math.round(part.a*rate),b=Math.round(part.from*rate);
    const length=Math.min(total-b,Math.round(part.to*rate)-b);
    const source=Array.from({length:decoded.numberOfChannels},(_,index)=>decoded.getChannelData(index));
    const fade=Math.round(.004*rate);
    for (let ch=0;ch<channels;ch++) {
      const outputChannel=targets[ch];
      const left=source[ch]||source[0],right=source[1]||source[0];
      for (let i=0;i<length;i++) {
        const sample=channels===1 && source.length>1 ? ((left[a+i]||0)+(right[a+i]||0))*.5 : left[a+i]||0;
        const taper=Math.min(1,i/fade,(length-1-i)/fade);
        outputChannel[b+i]=sample*taper;
      }
      if (accent && next && previous) {
        for (let i=0;i<accent.length && b+i<total;i++) outputChannel[b+i]+=accent[i];
      }
    }
    previous=part.clip;
  }
  if (el('sound').value==='original') return output;
  const processing=new OfflineAudioContext(channels,total,rate);
  const signal=processing.createBufferSource();
  signal.buffer=output;
  const filter=processing.createBiquadFilter();
  filter.type='highpass';
  filter.frequency.value=86;
  filter.Q.value=.707;
  const compressor=processing.createDynamicsCompressor();
  compressor.threshold.value=-23;
  compressor.knee.value=17;
  compressor.ratio.value=2.25;
  compressor.attack.value=.008;
  compressor.release.value=.16;
  signal.connect(filter);
  filter.connect(compressor);
  compressor.connect(processing.destination);
  signal.start();
  return processing.startRendering();
}

async function encodeFast(plan,quality,preferMp4,cancelled) {
  if (typeof VideoDecoder==='undefined'||typeof VideoEncoder==='undefined'||typeof AudioEncoder==='undefined' || typeof AudioData==='undefined') return null;
  if (plan.some(part=>!/\.(mp4|m4v|mov)$/i.test(part.clip.file.name)) || plan.at(-1).to>1200) return null;
  const {width,height}=canvas;
  const fps=quality.fps;
  const duration=Math.round(plan.at(-1).to*1e6);
  const audioRate=48000;
  const channels=quality.audio<96000?1:2;
  const AVC={codec:Math.max(width,height)>1920?'avc1.640034':'avc1.420028',width,height,framerate:fps,bitrate:quality.bitrate,latencyMode:'realtime',avc:{format:'avc'}};
  const AAC={codec:'mp4a.40.2',sampleRate:audioRate,numberOfChannels:channels,bitrate:quality.audio};
  const videoBase={width,height,framerate:fps,bitrate:quality.bitrate,latencyMode:'realtime'};
  const opus={codec:'opus',sampleRate:audioRate,numberOfChannels:channels,bitrate:quality.audio};
  const candidates=[
    ...(preferMp4 ? [{video:AVC,audio:AAC,extension:'mp4'}] : []),
    {video:{...videoBase,codec:'vp09.00.40.08'},audio:opus,extension:'webm'},
    {video:{...videoBase,codec:'vp8'},audio:opus,extension:'webm'}
  ];
  let selected;
  for (const candidate of candidates) {
    try {
      const support=await Promise.all([VideoEncoder.isConfigSupported(candidate.video),AudioEncoder.isConfigSupported(candidate.audio)]);
      if (support.every(item=>item.supported)) { selected=candidate;break; }
    } catch (_) {}
  }
  if (!selected) return null;
  const videoTrack={id:1,width,height,scale:1000000,samples:[],description:null};
  const audioTrack={id:2,channels,scale:audioRate,samples:[],description:null,bitrate:quality.audio};
  let error;
  const encoder=new VideoEncoder({
    error:failure=>{error=failure;},
    output(chunk,meta) {
      if (!videoTrack.description) videoTrack.description=cloneDescription(meta?.decoderConfig?.description);
      videoTrack.samples.push({data:cloneChunk(chunk),timestamp:chunk.timestamp,key:chunk.type==='key'});
    }
  });
  const aEncoder=new AudioEncoder({
    error:failure=>{error=failure;},
    output(chunk,meta) {
      if (!audioTrack.description) audioTrack.description=cloneDescription(meta?.decoderConfig?.description);
      const ticks=chunk.duration ? Math.round(chunk.duration*audioRate/1e6) : 1024;
      audioTrack.samples.push({data:cloneChunk(chunk),duration:Math.max(1,ticks),timestamp:chunk.timestamp});
    }
  });
  try {
    encoder.configure(selected.video);
    aEncoder.configure(selected.audio);
    const groups=videoTargets(plan,fps);
    status('Exportación acelerada · preparando fotogramas',false,0);
    for (const group of groups) {
      keepGoing(cancelled,error);
      if (!group.frames.length) continue;
      const input=readMp4Video(await group.clip.file.arrayBuffer(),group.clip);
      await decodeFrames(input,group.frames,(frame,timestamp)=>{
        keepGoing(cancelled,error);
        paintSource(frame,frame.displayWidth,frame.displayHeight);
        const next=new VideoFrame(canvas,{timestamp,duration:Math.max(1,Math.min(Math.round(1e6/fps),duration-timestamp))});
        try {
          encoder.encode(next,{keyFrame:Math.round(timestamp*fps/1e6)%(2*fps)===0});
        } finally { next.close(); }
        status('Exportación acelerada · '+Math.floor(timestamp/duration*88)+' %',false,timestamp/duration*.88);
      },cancelled,encoder);
    }
    await encoder.flush();
    keepGoing(cancelled,error);
    const v=videoTrack.samples;
    if (!v.length || (selected.extension==='mp4' && !videoTrack.description) || v.length!==groups.reduce((sum,item)=>sum+item.frames.length,0) || v.some((x,i)=>i&&x.timestamp<=v[i-1].timestamp))
      throw new Error('El codificador no entregó la cadencia esperada.');
    v.forEach((sample,i)=>{sample.duration=(v[i+1]?.timestamp??duration)-sample.timestamp;});
    status('Exportación acelerada · mezcla de audio',false,.9);
    const mixed=await buildAudio(plan,audioRate,channels,cancelled);
    const slice=1024;
    for (let i=0;i<mixed.length;i+=slice) {
      keepGoing(cancelled,error);
      const length=Math.min(slice,mixed.length-i);
      const planes=new Float32Array(channels*length);
      for (let c=0;c<channels;c++) planes.set(mixed.getChannelData(c).subarray(i,i+length),c*length);
      const block=new AudioData({data:planes,format:'f32-planar',sampleRate:audioRate,
        numberOfFrames:length,numberOfChannels:channels,timestamp:Math.round(i*1e6/audioRate)});
      try { aEncoder.encode(block); }
      finally { block.close(); }
      if (aEncoder.encodeQueueSize>24) await fastYield();
    }
    await aEncoder.flush();
    keepGoing(cancelled,error);
    if (!audioTrack.samples.length) throw new Error('El codificador no entregó audio.');
    if (selected.extension==='webm') return {extension:'webm',blob:muxWebm(videoTrack,audioTrack,selected.video.codec,duration)};
    if (!audioTrack.description) audioTrack.description=channels===1?bytes(0x11,0x88):bytes(0x11,0x90);
    return {extension:'mp4',blob:muxMp4(videoTrack,audioTrack)};
  } finally {
    if (encoder.state!=='closed') encoder.close();
    if (aEncoder.state!=='closed') aEncoder.close();
  }
}

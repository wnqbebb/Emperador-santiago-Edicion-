const bytes = (...values)=>Uint8Array.of(...values);
const ascii = word=>Uint8Array.from(word,char=>char.charCodeAt(0));
function joinBytes(...parts) {
  const result=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));
  let offset=0;
  for (const p of parts) { result.set(p,offset);offset+=p.length; }
  return result;
}
function u16(n) {return bytes(n>>>8,n);}
function u24(n) {return bytes(n>>>16,n>>>8,n);}
function u32(n) {return bytes(n>>>24,n>>>16,n>>>8,n);}
function atom(type,...fields) {
  return joinBytes(u32(8+fields.reduce((sum,value)=>sum+value.length,0)),ascii(type),...fields);
}
function full(type,version,flags,...fields) { return atom(type,bytes(version),u24(flags),...fields); }
const matrix=joinBytes(u32(0x10000),u32(0),u32(0),u32(0),u32(0x10000),u32(0),u32(0),u32(0),u32(0x40000000));

function readMp4Video(array,expected) {
  const data=new Uint8Array(array);
  const view=new DataView(array);
  const uint=at=>view.getUint32(at);
  const sint=at=>view.getInt32(at);
  const text=at=>String.fromCharCode(...data.subarray(at,at+4));
  function children(start,end) {
    const result=[];
    for (let at=start;at+8<=end;) {
      let length=uint(at);
      let header=8;
      if (length===1) { length=Number(view.getBigUint64(at+8)); header=16; }
      if (length===0) length=end-at;
      if (length<header||at+length>end) throw new Error('Estructura MP4 incompatible.');
      result.push({type:text(at+4),from:at+header,to:at+length});
      at+=length;
    }
    return result;
  }
  const root={from:0,to:data.length};
  const find=(parent,type)=>parent && children(parent.from,parent.to).find(box=>box.type===type);
  const moov=find(root,'moov');
  if (!moov) throw new Error('La ruta rápida necesita un MP4 convencional.');
  const track=children(moov.from,moov.to).find(box=>{
    const head=find(find(box,'mdia'),'hdlr');
    return box.type==='trak'&&head&&text(head.from+8)==='vide';
  });
  const mdia=find(track,'mdia');
  const stbl=find(find(mdia,'minf'),'stbl');
  const mdhd=find(mdia,'mdhd');
  const desc=find(stbl,'stsd');
  if (!mdhd||!desc) throw new Error('No se encontró una pista de video compatible.');
  const timeScale=uint(mdhd.from+(data[mdhd.from]===1?20:12));
  const entries=children(desc.from+8,desc.to);
  const entry=entries[0];
  if (!entry||!['avc1','avc3'].includes(entry.type)) throw new Error('El MP4 rápido admite AVC/H.264 de entrada.');
  const avc=children(entry.from+78,entry.to).find(box=>box.type==='avcC');
  if (!avc) throw new Error('Falta la configuración AVC.');
  const width=view.getUint16(entry.from+24),height=view.getUint16(entry.from+26);
  if (Math.abs(width-expected.width)>16 || Math.abs(height-expected.height)>16) throw new Error('Este archivo usa rotación o recorte de presentación.');
  const description=data.slice(avc.from,avc.to);
  const codec='avc1.'+[description[1],description[2],description[3]].map(n=>n.toString(16).padStart(2,'0')).join('');
  const stsz=find(stbl,'stsz'), stsc=find(stbl,'stsc'), stts=find(stbl,'stts');
  const stco=find(stbl,'stco') || find(stbl,'co64');
  if (![stsz,stsc,stts,stco].every(Boolean)) throw new Error('MP4 fragmentado o incompleto.');
  const count=uint(stsz.from+8), constant=uint(stsz.from+4);
  if (!count||count>250000||!timeScale) throw new Error('Pista MP4 fuera del rango de la ruta rápida.');
  const chunkCount=uint(stco.from+4), mapCount=uint(stsc.from+4);
  const chunk64=stco.type==='co64';
  const samples=[];
  for (let chunk=1,run=0;chunk<=chunkCount;chunk++) {
    while (run+1<mapCount && chunk>=uint(stsc.from+8+12*(run+1))) run++;
    const per=uint(stsc.from+12+12*run);
    const off=stco.from+8+(chunk-1)*(chunk64?8:4);
    let start=chunk64 ? Number(view.getBigUint64(off)) : uint(off);
    for (let n=0;n<per;n++) {
      const size=constant || uint(stsz.from+12+samples.length*4);
      if (samples.length>=count||!size||start+size>data.length) throw new Error('Bloque MP4 incorrecto.');
      samples.push({start,size,dts:0,pts:0,duration:0,key:false});
      start+=size;
    }
  }
  if (samples.length!==count) throw new Error('MP4 con tabla de fotogramas incompleta.');
  function applyTable(box,fn) {
    const num=uint(box.from+4);
    let index=0;
    for (let e=0;e<num;e++) {
      const at=box.from+8+e*8;
      const values=uint(at);
      if (index+values>samples.length) throw new Error('Tabla de tiempos MP4 inválida.');
      const amount=data[box.from]===1 ? sint(at+4) : uint(at+4);
      for (let i=0;i<values;i++) fn(samples[index++],amount);
    }
  }
  let dts=0;
  applyTable(stts,(sample,t)=>{sample.dts=dts;sample.pts=dts;sample.duration=t;dts+=t;});
  const ctts=find(stbl,'ctts');
  if (ctts) applyTable(ctts,(sample,t)=>{sample.pts+=t;});
  const stss=find(stbl,'stss');
  if (!stss) samples.forEach(sample=>{sample.key=true;});
  else for (let i=0;i<uint(stss.from+4);i++) {
    const sample=samples[uint(stss.from+8+i*4)-1];
    if (sample) sample.key=true;
  }
  const edts=find(find(track,'edts'),'elst');
  let shift=edts && uint(edts.from+4) ? data[edts.from]===1 ? Number(view.getBigInt64(edts.from+16)) : sint(edts.from+12) : null;
  if (shift===-1) throw new Error('El MP4 tiene una lista de edición adelantada.');
  if (shift===null) shift=samples.reduce((first,sample)=>Math.min(first,sample.pts),samples[0].pts);
  return {data,samples,timeScale,shift,config:{codec,description,codedWidth:width,codedHeight:height}};
}

function runTable(values) {
  const entries=[];
  for (const value of values) {
    const tail=entries.at(-1);
    if (tail?.[1]===value) tail[0]++;
    else entries.push([1,value]);
  }
  return full('stts',0,0,u32(entries.length),...entries.map(([n,d])=>joinBytes(u32(n),u32(d))));
}
function descriptor(tag,...content) {
  const data=joinBytes(...content);
  let size=data.length;
  const encoded=[size&127];
  while (size>>=7) encoded.unshift((size&127)|128);
  return joinBytes(bytes(tag,...encoded),data);
}
function avcEntry(track) {
  const name=new Uint8Array(32);
  const color=atom('colr',ascii('nclx'),u16(1),u16(1),u16(1),bytes(0));
  return atom('avc1',new Uint8Array(6),u16(1),new Uint8Array(16),u16(track.width),u16(track.height),
    u32(0x00480000),u32(0x00480000),u32(0),u16(1),name,u16(24),u16(65535),atom('avcC',track.description),color);
}
function aacEntry(track) {
  const esds=full('esds',0,0,descriptor(3,u16(2),bytes(0),
    descriptor(4,bytes(0x40,0x15),u24(0),u32(track.bitrate),u32(track.bitrate),descriptor(5,track.description)),
    descriptor(6,bytes(2))));
  return atom('mp4a',new Uint8Array(6),u16(1),new Uint8Array(8),u16(track.channels),u16(16),u16(0),u16(0),u32(track.scale*65536),esds);
}
function movieTrack(track,offset) {
  const {id,scale,samples}=track;
  const isVideo=id===1;
  const total=samples.reduce((sum,sample)=>sum+sample.duration,0);
  const movieTicks=Math.round(total/scale*1000);
  const tkhd=full('tkhd',0,7,u32(0),u32(0),u32(id),u32(0),u32(movieTicks),new Uint8Array(8),
    u16(0),u16(0),u16(isVideo?0:256),u16(0),matrix,u32((track.width||0)*65536),u32((track.height||0)*65536));
  const mdhd=full('mdhd',0,0,u32(0),u32(0),u32(scale),u32(total),u16(0x55c4),u16(0));
  const hdlr=full('hdlr',0,0,u32(0),ascii(isVideo?'vide':'soun'),new Uint8Array(12),ascii(isVideo?'VideoHandler\0':'SoundHandler\0'));
  const mediaHeader=isVideo ? full('vmhd',0,1,new Uint8Array(8)) : full('smhd',0,0,new Uint8Array(4));
  const dinf=atom('dinf',full('dref',0,0,u32(1),full('url ',0,1)));
  const stsd=full('stsd',0,0,u32(1),isVideo?avcEntry(track):aacEntry(track));
  const stsc=full('stsc',0,0,u32(1),u32(1),u32(samples.length),u32(1));
  const sizes=new Uint8Array(samples.length*4);
  const sizeView=new DataView(sizes.buffer);
  samples.forEach((sample,index)=>sizeView.setUint32(index*4,sample.data.length));
  const stsz=full('stsz',0,0,u32(0),u32(samples.length),sizes);
  const stco=full('stco',0,0,u32(1),u32(offset));
  const keys=isVideo ? samples.flatMap((sample,i)=>sample.key?[u32(i+1)]:[]) : [];
  const sync=isVideo ? [full('stss',0,0,u32(keys.length),joinBytes(...keys))] : [];
  const stbl=atom('stbl',stsd,runTable(samples.map(sample=>sample.duration)),stsc,stsz,stco,...sync);
  return {duration:movieTicks,box:atom('trak',tkhd,atom('mdia',mdhd,hdlr,atom('minf',mediaHeader,dinf,stbl)))};
}
function muxMp4(videoTrack,audioTrack) {
  const ftyp=atom('ftyp',ascii('isom'),u32(512),ascii('isomiso2avc1mp41'));
  const lengthOf=track=>track.samples.reduce((sum,sample)=>sum+sample.data.length,0);
  const vBytes=lengthOf(videoTrack),aBytes=lengthOf(audioTrack);
  function moov(vOffset,aOffset) {
    const va=movieTrack(videoTrack,vOffset), aa=movieTrack(audioTrack,aOffset);
    const mvhd=full('mvhd',0,0,u32(0),u32(0),u32(1000),u32(Math.max(va.duration,aa.duration)),u32(65536),u16(256),
      new Uint8Array(10),matrix,new Uint8Array(24),u32(3));
    return atom('moov',mvhd,va.box,aa.box);
  }
  const start=ftyp.length+moov(0,0).length+8;
  if (start+vBytes+aBytes>=2**32) throw new Error('El resultado supera el límite de la ruta rápida.');
  const header=moov(start,start+vBytes);
  return new Blob([ftyp,header,u32(vBytes+aBytes+8),ascii('mdat'),...videoTrack.samples.map(s=>s.data),...audioTrack.samples.map(s=>s.data)],{type:'video/mp4'});
}

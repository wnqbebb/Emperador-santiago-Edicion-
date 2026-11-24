function ebmlId(id) {
  let length=1;
  while (id>=2**(8*length)) length++;
  return Uint8Array.from({length},(_,i)=>id>>>8*(length-1-i)&255);
}
function ebmlSize(size) {
  let width=1;
  while (size>=2**(7*width)-1) width++;
  const result=new Uint8Array(width);
  for (let i=width-1;i>=0;i--) {result[i]=size%256;size=Math.floor(size/256);}
  result[0]|=1<<(8-width);
  return result;
}
function elementBytes(id,...data) {
  const n=data.reduce((sum,array)=>sum+array.length,0);
  return joinBytes(ebmlId(id),ebmlSize(n),...data);
}
const ebmlUint=(id,n)=>elementBytes(id,ebmlId(n));
const ebmlText=(id,s)=>elementBytes(id,ascii(s));
function ebmlFloat(id,n) {
  const buffer=new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0,n);
  return elementBytes(id,new Uint8Array(buffer));
}
function muxWebm(v,a,codec,duration) {
  const header=elementBytes(0x1a45dfa3,ebmlUint(0x4286,1),ebmlUint(0x42f7,1),ebmlUint(0x42f2,4),
    ebmlUint(0x42f3,8),ebmlText(0x4282,'webm'),ebmlUint(0x4287,4),ebmlUint(0x4285,2));
  const info=elementBytes(0x1549a966,ebmlUint(0x2ad7b1,1000000),ebmlFloat(0x4489,duration/1000),
    ebmlText(0x4d80,'Emperador Santiago'),ebmlText(0x5741,'Emperador Santiago'));
  const video=elementBytes(0xae,ebmlUint(0xd7,1),ebmlUint(0x73c5,1),ebmlUint(0x83,1),
    ebmlText(0x86,codec==='vp8'?'V_VP8':'V_VP9'),
    elementBytes(0xe0,ebmlUint(0xb0,v.width),ebmlUint(0xba,v.height)));
  const codecPrivate=a.description ?? joinBytes(ascii('OpusHead'),bytes(1,a.channels,0x38,1,0x80,0xbb,0,0,0,0,0));
  const tracks=elementBytes(0x1654ae6b,video,
    elementBytes(0xae,ebmlUint(0xd7,2),ebmlUint(0x73c5,2),ebmlUint(0x83,2),
      ebmlText(0x86,'A_OPUS'),elementBytes(0x63a2,codecPrivate),
      ebmlUint(0x56aa,6500000),ebmlUint(0x56bb,80000000),
      elementBytes(0xe1,ebmlFloat(0xb5,a.scale),ebmlUint(0x9f,a.channels))));
  const frames=[...v.samples.map(frame=>({...frame,track:1})),...a.samples.map(frame=>({...frame,track:2,key:true}))]
    .sort((x,y)=>x.timestamp-y.timestamp || x.track-y.track);
  const groups=[];
  let group=null;
  for (const frame of frames) {
    const time=Math.max(0,Math.round(frame.timestamp/1000));
    if (!group||(time-group.time>1700&&frame.track===1&&frame.key)) {
      group={time,blocks:[]};groups.push(group);
    }
    group.blocks.push(elementBytes(0xa3,bytes(0x80+frame.track),u16(time-group.time),bytes(frame.key?0x80:0),frame.data));
  }
  const clusters=groups.map(group=>elementBytes(0x1f43b675,ebmlUint(0xe7,group.time),...group.blocks));
  const length=info.length+tracks.length+clusters.reduce((sum,blob)=>sum+blob.length,0);
  return new Blob([header,ebmlId(0x18538067),ebmlSize(length),info,tracks,...clusters],{type:'video/webm'});
}

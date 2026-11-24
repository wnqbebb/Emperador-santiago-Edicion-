const projects = [];
let currentProject = null;
let readingImports = false;
const collator = new Intl.Collator('es',{numeric:true,sensitivity:'base'});
const videoName = /\.(mp4|m4v|mov|webm|mkv|avi|ogv|3gp)$/i;
const zipName = /\.zip$/i;
const archiveLimit = 1500*1024**2;
const projectOptions = ['strength','filter','sound','compression','format','size','threshold','gap','pad','pace','shortPauses'];
const startingOptions = Object.fromEntries(projectOptions.map(id=>[id,el(id).type==='checkbox' ? el(id).checked : el(id).value]));

function setVoiceTreatment(original = false) {
  if (!voiceFilter || !voiceCompressor) return;
  const active = !original && el('sound').value!=='original';
  voiceFilter.frequency.value = active ? 86 : 10;
  voiceCompressor.threshold.value = active ? -23 : 0;
  voiceCompressor.knee.value = active ? 17 : 0;
  voiceCompressor.ratio.value = active ? 2.25 : 1;
  voiceCompressor.attack.value = .008;
  voiceCompressor.release.value = .16;
}
function makeAccent(sampleRate) {
  const length = Math.round(sampleRate*.105);
  const data = new Float32Array(length);
  for (let i=0;i<length;i++) {
    const t = i/sampleRate;
    const envelope = Math.min(1,t/.012)*Math.exp(-t*39)*(1-t/.105);
    data[i] = (Math.sin(2*Math.PI*(465*t+900*t*t))+.25*Math.sin(2*Math.PI*740*t))*.039*envelope;
  }
  return data;
}
function playAccent(context,target) {
  if (el('sound').value!=='accents') return;
  const samples=makeAccent(context.sampleRate);
  const buffer = context.createBuffer(1,samples.length,context.sampleRate);
  buffer.copyToChannel(samples,0);
  const cue = context.createBufferSource();
  cue.buffer=buffer;
  cue.connect(target);
  cue.onended=()=>cue.disconnect();
  cue.start();
}
const gradeCache = new WeakMap();
function combinedLut(id,filter) {
  const lut = paletteLut(id);
  if (filter==='clean') return lut;
  const original = id==='none';
  const key = filter+(original?'-original':'');
  if (!gradeCache.has(lut)) gradeCache.set(lut,new Map());
  const cache = gradeCache.get(lut);
  if (cache.has(key)) return cache.get(key);
  const {size,data} = lut;
  const mapped=new Float32Array(data.length);
  for (let i=0;i<data.length;i++) {
    const index=Math.floor(i/3);
    const neutral=original ? Math.floor(index/size**(i%3))%size/(size-1) : data[i];
    if (filter==='detail') mapped[i]=clamp(.5+(neutral-.5)*1.095);
    else mapped[i]=clamp(neutral+.045*4*neutral*(1-neutral)-.015*neutral**6);
  }
  const output = {...lut,data:mapped};
  cache.set(key,output);
  return output;
}

function readOptions() {
  return Object.fromEntries(projectOptions.map(id=>[id,el(id).type==='checkbox' ? el(id).checked : el(id).value]));
}
function writeOptions(options) {
  for (const [id,value] of Object.entries(options)) {
    if (el(id).type==='checkbox') el(id).checked = value;
    else el(id).value = value;
  }
  el('amount').value = el('strength').value+' %';
}
function newProject(name,seed = null) {
  const item = {name,clips:[],look:seed?.look ?? 'natural',options:{...(seed?.options ?? startingOptions)},lut:seed?.lut ?? null,place:0,label:'Pendiente',result:null};
  projects.push(item);
  return item;
}
function captureProject() {
  if (!currentProject) return null;
  currentProject.clips=[...clips];
  currentProject.look=look;
  currentProject.options=readOptions();
  currentProject.lut=userLut;
  currentProject.place=position;
  return currentProject;
}
function renderQueue() {
  const queue=el('queue');
  queue.replaceChildren();
  el('queueEmpty').hidden=Boolean(projects.length);
  for (const [index,item] of projects.entries()) {
    const row=document.createElement('div');
    row.className='queue-item'+(item===currentProject?' active':'');
    const open=control('',()=>openProject(item),'Abrir '+item.name);
    open.disabled=Boolean(working)||batchRunning||readingImports;
    const name=document.createElement('strong');
    name.textContent=(index+1)+'. '+item.name;
    const state=document.createElement('small');
    state.textContent=item.clips.length+' clips · '+item.label;
    open.append(name,state);
    row.append(open);
    if (item.result) {
      const link=document.createElement('a');
      link.href=item.result.url;
      link.download=item.result.name;
      link.textContent='Descargar';
      row.append(link);
    }
    queue.append(row);
  }
  updateControls();
}
let projectSwitch = 0;
async function openProject(item,internal = false) {
  if (!internal && (working || batchRunning || readingImports)) return;
  if (item===currentProject) return;
  const token = ++projectSwitch;
  stop();
  captureProject();
  await placement.catch(()=>{});
  if (token!==projectSwitch) return;
  currentProject=item;
  clips.splice(0,clips.length,...item.clips);
  look=item.look;
  userLut=item.lut;
  const custom=looks.findIndex(preset=>preset.id==='custom');
  if (custom>=0) looks.splice(custom,1);
  if (userLut) looks.push({id:'custom',name:'LUT personalizado',swatch:'linear-gradient(125deg,#352467,#c2adf9)'});
  writeOptions(item.options);
  showOriginalColor=false;
  mode='after';
  select(clips[0] ?? null);
  renderLooks();
  if (clips.length) resize(clips[0],1080);
  else { canvas.hidden=true;el('empty').hidden=false; }
  rebuild();
  await seekTo(item.place,false);
  renderClips();
  renderEditor();
  renderQueue();
  if (!internal) status(item.name+' · '+item.label+'.');
}

function groupByFolder(entries,fallback,skipRoot = false) {
  const groups=new Map();
  for (const entry of entries) {
    const nodes=entry.path.replaceAll('\\','/').split('/').filter(Boolean);
    if (nodes.some(node=>node.startsWith('.')||node==='__MACOSX')) continue;
    const folder=nodes.length>1 ? nodes[0] : fallback;
    const key=skipRoot ? fallback : folder;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(entry);
  }
  return [...groups].map(([name,list])=>({name,entries:list.sort((a,b)=>collator.compare(a.path,b.path))}))
    .sort((a,b)=>collator.compare(a.name,b.name));
}
async function readArchive(file,callback) {
  const zip=await JSZip.loadAsync(file);
  const valid=Object.values(zip.files).filter(entry=>!entry.dir&&videoName.test(entry.name));
  if (!valid.length) throw new Error('El ZIP no contiene videos reconocibles.');
  const total=valid.reduce((sum,entry)=>sum+(entry._data?.uncompressedSize??0),0);
  if (total>archiveLimit) throw new Error('Este ZIP expande más de 1,5 GB. Divídelo en archivos más pequeños.');
  const results=[];
  for (const [index,entry] of valid.entries()) {
    status('Extrayendo ZIP · '+(index+1)+' de '+valid.length+' · '+entry.name,false,index/valid.length);
    const blob=await entry.async('blob');
    results.push({path:entry.name,file:new File([blob],entry.name.split('/').at(-1),{type:contentType(entry.name)})});
  }
  const archiveName=file.name.replace(zipName,'');
  const top=new Set(results.map(entry=>entry.path.split('/')[0]));
  const isWrapped=top.size===1 && results.every(entry=>entry.path.includes('/'));
  const items=isWrapped ? results.map(entry=>({...entry,path:entry.path.split('/').slice(1).join('/')})) : results;
  await callback(groupByFolder(items,archiveName));
}
function contentType(name) {
  if (/\.mov$/i.test(name)) return 'video/quicktime';
  if (/\.webm$/i.test(name)) return 'video/webm';
  if (/\.(mp4|m4v)$/i.test(name)) return 'video/mp4';
  return '';
}
async function receiveFiles(files) {
  if (!files.length || working || batchRunning || readingImports) return;
  readingImports=true;
  const seed=captureProject();
  const optionsSnapshot=seed ? {look:seed.look,options:{...seed.options},lut:seed.lut} : {look,options:readOptions(),lut:userLut};
  const archives=files.filter(file=>zipName.test(file.name));
  const paths=files.filter(file=>(file.webkitRelativePath||file.virtualPath)&&videoName.test(file.name));
  const loose=files.filter(file=>!file.webkitRelativePath&&!file.virtualPath&&!zipName.test(file.name));
  const imported=[];
  const alerts=[];
  let lastProgress='';
  async function ingest(groups) {
    for (const group of groups) {
      const item=newProject(group.name,optionsSnapshot);
      await openProject(item,true);
      await importClips(group.entries.map(entry=>entry.file));
      captureProject();
      item.label=item.clips.length?'Analizado':'Sin clips compatibles';
      lastProgress=el('status').textContent;
      if (el('status').parentElement.dataset.error==='true') alerts.push(lastProgress);
      item.analysis=lastProgress;
      imported.push(item);
      renderQueue();
    }
  }
  try {
    if (loose.length) {
      const item=currentProject ?? newProject('Montaje '+(projects.length+1),optionsSnapshot);
      await openProject(item,true);
      await importClips(loose);
      captureProject();
      item.label=item.clips.length?'Analizado':'Sin clips compatibles';
      lastProgress=el('status').textContent;
      if (el('status').parentElement.dataset.error==='true') alerts.push(lastProgress);
      item.analysis=lastProgress;
      imported.push(item);
    }
    if (paths.length) {
      const given=paths.map(file=>({file,path:file.webkitRelativePath||file.virtualPath}));
      const buckets=groupByFolder(given,'Carpeta');
      await ingest(buckets);
    }
    for (const archive of archives) {
      try { await readArchive(archive,ingest); }
      catch (error) { alerts.push(archive.name+' · '+error.message); }
    }
    const valid=imported.filter(item=>item.clips.length);
    if (valid.length>1) await openProject(valid[0],true);
    if (alerts.length) status(alerts.join(' '),true);
    else if (imported.length>1) status(imported.length+' proyectos en cola · '+imported.reduce((sum,item)=>sum+item.clips.length,0)+' clips procesados.');
    else if (lastProgress) status(lastProgress);
    else status('La carpeta no contiene videos compatibles.',true);
  } finally {
    readingImports=false;
    renderQueue();
  }
}
function entryAsFile(entry) {
  return new Promise((resolve,reject)=>entry.file(file=>{
    Object.defineProperty(file,'virtualPath',{value:entry.fullPath.replace(/^\//,'')});
    resolve(file);
  },reject));
}
async function unpackEntries(entry) {
  if (entry.isFile) return [await entryAsFile(entry)];
  const reader=entry.createReader();
  const results=[];
  for (;;) {
    const items=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));
    if (!items.length) return results.flat();
    for (const child of items) results.push(await unpackEntries(child));
  }
}
async function receiveDrop(transfer) {
  const files=Array.from(transfer.files);
  const items=Array.from(transfer.items||[]).map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
  if (!items.some(entry=>entry.isDirectory)) return receiveFiles(files);
  const groups=[];
  for (const entry of items) {
    if (entry.isDirectory) groups.push(...await unpackEntries(entry));
    else groups.push(await new Promise((resolve,reject)=>entry.file(resolve,reject)));
  }
  return receiveFiles(groups.length ? groups : files);
}
function exportQuality() {
  const type=el('compression').value;
  const requested=el('size').value==='native' ? Infinity : Number(el('size').value);
  if (type==='maximum') return {size:Math.min(requested,540),bitrate:630000,audio:64000,fps:24};
  if (type==='balanced') return {size:Math.min(requested,720),bitrate:1450000,audio:96000,fps:24};
  return {size:requested,bitrate:4200000,audio:160000,fps:30};
}
function fileStem(name) {
  return name.normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').trim().slice(0,100)||'Montaje';
}
function exportResult(file,extension,download,engine) {
  const filename='Emperador_'+fileStem(currentProject?.name||'Montaje')+'.'+extension;
  exportBlob=file;
  exportExtension=extension;
  resultUrl=URL.createObjectURL(file);
  if (currentProject) {
    if (currentProject.result) URL.revokeObjectURL(currentProject.result.url);
    currentProject.result={url:resultUrl,name:filename};
    currentProject.label='Exportado · '+spanTime(file.size/1024**2)+' MB';
  }
  const anchor=el('result');
  anchor.href=resultUrl;
  anchor.download=filename;
  anchor.textContent='Descargar montaje ('+extension.toUpperCase()+')';
  anchor.hidden=false;
  if (download) anchor.click();
  status(engine+' listo · '+spanTime(file.size/1024**2)+' MB.');
  renderQueue();
}
async function exportProjectQueue() {
  if (batchRunning) { batchCancel=true;stop();return; }
  captureProject();
  const queue=projects.filter(item=>item.clips.some(clip=>clip.keep.length));
  const starting=currentProject;
  if (!queue.length || working) return;
  batchRunning=true;
  batchCancel=false;
  renderQueue();
  let done=0;
  const failures=[];
  try {
    for (const project of queue) {
      if (batchCancel) break;
      await openProject(project,true);
      project.label='Exportando';
      renderQueue();
      try {
        const blob=await exportVideo(false,true);
        if (blob) done++;
        else if (batchCancel) project.label='Cancelado';
        else failures.push(project.name);
      } catch (error) { project.label='Error de exportación';failures.push(project.name+' ('+error.message+')'); }
      renderQueue();
    }
  } finally {
    if (starting) await openProject(starting,true);
    batchRunning=false;
    renderQueue();
    status(done+' de '+queue.length+' proyectos exportados.'+(batchCancel?' Cola detenida.':'')+
      (failures.length?' Para revisar: '+failures.join(', ')+'.':''),Boolean(failures.length));
  }
}

const svg = document.getElementById('svgCanvas');
const resultsTable = document.querySelector('#resultsTable tbody');
const W = 1200, H = 700;

let nodes = [];
let edges = [];
let algSteps = [];
let stepIndex = -1;
let playing = false;
let playTimer = null;
let isDirected = false;
let lastPaths = [];
let lastDist = {}, lastPrev = {};

const newNodeName = document.getElementById('newNodeName');
const addNodeBtn = document.getElementById('addNodeBtn');
const edgeFrom = document.getElementById('edgeFrom');
const edgeTo = document.getElementById('edgeTo');
const edgeWeight = document.getElementById('edgeWeight');
const addEdgeBtn = document.getElementById('addEdgeBtn');
const genRand = document.getElementById('genRand');
const randN = document.getElementById('randN');
const directedToggle = document.getElementById('directedToggle');
const sourceSelect = document.getElementById('sourceSelect');
const runDijkstra = document.getElementById('runDijkstra');
const runBellman = document.getElementById('runBellman');
const statusEl = document.getElementById('status');
const stepBtn = document.getElementById('stepBtn');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');

function uid(prefix='id'){return prefix+Math.random().toString(36).slice(2,9);}
function make(tag){return document.createElementNS('http://www.w3.org/2000/svg',tag);}

function updateSelectors(){
  [edgeFrom, edgeTo, sourceSelect].forEach(sel=>{
    sel.innerHTML='';
    nodes.forEach(n=>{
      const opt=document.createElement('option');
      opt.value=n.id; opt.textContent=n.label; sel.appendChild(opt);
    });
  });
}

function addNode(label){
  if(!label)return;
  const id=uid('n');
  const radius=Math.min(W,H)/2.5;
  const angle=(nodes.length*2*Math.PI)/Math.max(8,nodes.length+6);
  const x=W/2+radius*Math.cos(angle);
  const y=H/2-150+radius*Math.sin(angle);
  nodes.push({id,label,x,y});
  rebuild();
}

function addEdge(from,to,w){
  if(!from||!to||from===to)return;
  edges.push({id:uid('e'),from,to,w:Number(w)});
  if(!isDirected) edges.push({id:uid('e'),from:to,to:from,w:Number(w)});
  rebuild();
}

function generateRandom(n){
  nodes=[]; edges=[];
  for(let i=0;i<n;i++) addNode(String.fromCharCode(65+i));
  const ids=nodes.map(x=>x.id);
  for(let i=0;i<ids.length;i++){
    const other=ids[Math.floor(Math.random()*ids.length)];
    if(other!==ids[i]){
      const w=Math.floor(Math.random()*9)+1;
      edges.push({id:uid('e'),from:ids[i],to:other,w});
      if(!isDirected) edges.push({id:uid('e'),from:other,to:ids[i],w});
    }
  }
  for(let i=0;i<ids.length;i++){
    for(let j=i+1;j<ids.length;j++){
      if(Math.random()<0.35){
        const w=Math.floor(Math.random()*9)+1;
        edges.push({id:uid('e'),from:ids[i],to:ids[j],w});
        if(!isDirected) edges.push({id:uid('e'),from:ids[j],to:ids[i],w});
      }
    }
  }
  rebuild();
}

function rebuild(){
  const defs=svg.querySelector('defs');
  svg.innerHTML=defs?defs.outerHTML:'';
  edges.forEach(e=>{
    const from=nodes.find(n=>n.id===e.from);
    const to=nodes.find(n=>n.id===e.to);
    if(!from||!to)return;
    const line=make('line');
    line.setAttribute('x1',from.x);
    line.setAttribute('y1',from.y);
    line.setAttribute('x2',to.x);
    line.setAttribute('y2',to.y);
    line.classList.add('edge-line');
    line.dataset.eid=e.id;
    if(isDirected) line.setAttribute('marker-end','url(#arrow)');
    svg.appendChild(line);

    const mx=(from.x+to.x)/2,my=(from.y+to.y)/2;
    const text=make('text');
    text.textContent=e.w;
    text.classList.add('weight-text');
    text.setAttribute('text-anchor','middle');
    text.setAttribute('x',mx);
    text.setAttribute('y',my-10);
    svg.appendChild(text);
  });
  nodes.forEach(n=>{
    const g=make('g');g.classList.add('node');
    g.setAttribute('transform',`translate(${n.x},${n.y})`);
    const c=make('circle');c.setAttribute('r',38);
    const t=make('text');t.textContent=n.label;
    t.classList.add('label');t.setAttribute('text-anchor','middle');t.setAttribute('dy','7');
    g.appendChild(c);g.appendChild(t);
    svg.appendChild(g);
  });
  updateSelectors();
}

function computeDijkstra(sourceId){
  const dist={},prev={};
  nodes.forEach(n=>{dist[n.id]=Infinity;prev[n.id]=null;});
  dist[sourceId]=0;
  const Q=new Set(nodes.map(n=>n.id));
  const steps=[];
  while(Q.size){
    let u=null,best=Infinity;
    for(const v of Q){if(dist[v]<best){best=dist[v];u=v;}}
    if(u===null)break;
    Q.delete(u);
    steps.push({type:'visit',node:u});
    edges.filter(e=>e.from===u).forEach(e=>{
      if(dist[u]+e.w<dist[e.to]){
        dist[e.to]=dist[u]+e.w;prev[e.to]=u;
        steps.push({type:'relax',edge:e.id});
      }
    });
  }
  const paths=[];
  for(const n of nodes){
    if(n.id!==sourceId && prev[n.id]){
      let cur=n.id;
      while(prev[cur]){
        const edge=edges.find(e=>e.from===prev[cur]&&e.to===cur);
        if(edge) paths.push(edge.id);
        cur=prev[cur];
      }
    }
  }
  lastDist=dist;lastPrev=prev;
  steps.push({type:'done',paths});
  return steps;
}

function computeBellmanFord(sourceId){
  const dist={},prev={};
  nodes.forEach(n=>{dist[n.id]=Infinity;prev[n.id]=null;});
  dist[sourceId]=0;
  const steps=[];const V=nodes.length;
  for(let i=0;i<V-1;i++){
    edges.forEach(e=>{
      if(dist[e.from]+e.w<dist[e.to]){
        dist[e.to]=dist[e.from]+e.w;prev[e.to]=e.from;
        steps.push({type:'relax',edge:e.id});
      }
    });
  }
  const paths=[];
  for(const n of nodes){
    if(n.id!==sourceId && prev[n.id]){
      let cur=n.id;
      while(prev[cur]){
        const edge=edges.find(e=>e.from===prev[cur]&&e.to===cur);
        if(edge) paths.push(edge.id);
        cur=prev[cur];
      }
    }
  }
  lastDist=dist;lastPrev=prev;
  steps.push({type:'done',paths});
  return steps;
}

function updateResultsTable(){
  resultsTable.innerHTML='';
  nodes.forEach(n=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${n.label}</td><td>${lastDist[n.id]===Infinity?'∞':lastDist[n.id]}</td><td>${lastPrev[n.id]?nodes.find(x=>x.id===lastPrev[n.id]).label:'-'}</td>`;
    resultsTable.appendChild(tr);
  });
}

function applyStep(s){
  svg.querySelectorAll('.edge-line').forEach(el=>{
    el.classList.remove('highlight','path');
    if(isDirected) el.setAttribute('marker-end','url(#arrow)');
  });
  svg.querySelectorAll('.node').forEach(el=>el.classList.remove('visited'));
  if(!s)return;
  if(s.type==='relax'){
    const line=svg.querySelector(`[data-eid='${s.edge}']`);
    if(line){
      line.classList.add('highlight');
      if(isDirected) line.setAttribute('marker-end','url(#arrowRed)');
    }
    updateStatus('Relaxing edge...');
  }else if(s.type==='visit'){
    const n=svg.querySelectorAll('.node')[nodes.findIndex(x=>x.id===s.node)];
    if(n) n.classList.add('visited');
    updateStatus('Visiting node...');
  }else if(s.type==='done'){
    lastPaths=s.paths;highlightFinalPaths();
    updateStatus('Algorithm finished. Shortest paths highlighted.');
    updateResultsTable();
  }
}

function highlightFinalPaths(){
  lastPaths.forEach(pid=>{
    const line=svg.querySelector(`[data-eid='${pid}']`);
    if(line) line.classList.add('path');
  });
}

function runAlgorithm(kind){
  const src=sourceSelect.value;if(!src)return updateStatus('Select source node');
  algSteps=kind==='dijkstra'?computeDijkstra(src):computeBellmanFord(src);
  stepIndex=-1;updateStatus(kind+' ready.');
}

function stepForward(){
  if(!algSteps.length)return;
  stepIndex++;if(stepIndex>=algSteps.length)stepIndex=algSteps.length-1;
  applyStep(algSteps[stepIndex]);
}

function playSteps(){
  if(playing){playing=false;clearInterval(playTimer);playBtn.textContent='Play';return;}
  playing=true;playBtn.textContent='Pause';
  playTimer=setInterval(()=>{
    stepForward();
    if(stepIndex>=algSteps.length-1){playing=false;clearInterval(playTimer);playBtn.textContent='Play';}
  },800);
}

function reset(){
  algSteps=[];stepIndex=-1;playing=false;clearInterval(playTimer);
  svg.querySelectorAll('.edge-line').forEach(l=>l.classList.remove('highlight','path'));
  svg.querySelectorAll('.node').forEach(n=>n.classList.remove('visited'));
  resultsTable.innerHTML='';
  updateStatus('Reset complete.');
}

function updateStatus(msg){statusEl.textContent='Status: '+msg;}

addNodeBtn.onclick=()=>{addNode(newNodeName.value.trim());newNodeName.value='';};
addEdgeBtn.onclick=()=>addEdge(edgeFrom.value,edgeTo.value,edgeWeight.value);
genRand.onclick=()=>generateRandom(parseInt(randN.value));
directedToggle.onchange=()=>{isDirected=directedToggle.checked;rebuild();};
runDijkstra.onclick=()=>runAlgorithm('dijkstra');
runBellman.onclick=()=>runAlgorithm('bellman');
stepBtn.onclick=stepForward;
playBtn.onclick=playSteps;
resetBtn.onclick=reset;

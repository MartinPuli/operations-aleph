/* One collision explains the product: a connected request meets an active rule. */
(function(g){
'use strict';
g.createWardenHookV12=function(canvas){
  const c=canvas.getContext('2d'),W=1920,H=1080;
  canvas.width=W;canvas.height=H;
  const C={bg:'#080f15',ink:'#f3f3eb',muted:'#9aadb7',coral:'#ff837c',mint:'#a3ebc9'};
  const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,p)=>a+(b-a)*p;
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)},out=x=>1-Math.pow(1-clamp(x),4);
  const hermite=(u,a,b,va,vb,seconds)=>{u=clamp(u);return (2*u*u*u-3*u*u+1)*a+(u*u*u-2*u*u+u)*va*seconds+(-2*u*u*u+3*u*u)*b+(u*u*u-u*u)*vb*seconds};
  const rr=(x,y,w,h,r,fill,stroke,width=1)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke()}};
  const text=(s,x,y,size=30,col=C.ink,weight=500)=>{c.fillStyle=col;c.font=`${Math.round(weight/100)*100} ${size}px WardenDisplay,Arial`;c.fillText(s,x,y)};
  const line=(x,y,x2,y2,col,width=2)=>{c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=width;c.stroke()};
  const poly=(points,fill)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill()};
  function check(x,y,size=18){c.beginPath();c.moveTo(x,y);c.lineTo(x+size*.36,y+size*.36);c.lineTo(x+size,y-size*.42);c.lineWidth=3.5;c.lineCap='round';c.strokeStyle=C.mint;c.stroke()}

  function clientFile(x,y,angle,compression,ghost=false){
    const w=610,h=330;
    c.save();c.translate(x+w,y+h*.5);c.rotate(angle);c.transform(compression,.018,0,1,0,0);c.translate(-w,-h*.5);
    if(ghost){rr(0,0,w,h,17,'#768891');c.restore();return}
    // Offset paper layers and a solid edge give the file a tangible leading surface.
    c.shadowColor='#000000aa';c.shadowBlur=35;c.shadowOffsetY=26;
    rr(16,15,w,h,17,'#172832');c.shadowColor='transparent';
    rr(10,9,w,h,17,'#3d515c','#536975');rr(5,4,w,h,17,'#182934','#5a727d');
    const face=c.createLinearGradient(0,0,w,h);face.addColorStop(0,'#2e424e');face.addColorStop(.55,'#20323d');face.addColorStop(1,'#13232d');
    rr(0,0,w,h,17,face,'#78909b',1.4);
    line(19,1,w-21,1,'#b8c7cb99',2);line(w-1,19,w-1,h-20,'#97aeb899',2);
    // The folded corner and file rows are data, rather than a miniature app screenshot.
    poly([[w-65,0],[w,65],[w-65,65]],'#435a65');poly([[w-65,0],[w,65],[w,0]],'#101b23');
    rr(27,25,195,36,7,'#492d33');text('CONFIDENTIAL',40,50,22,'#ffaaa0',650);
    text('client-export.csv',28,123,45,C.ink,590);
    line(28,151,w-31,151,'#6a828c66');
    text('Client contacts',29,202,32,'#e8eeee',530);
    text('Bank details',29,256,32,'#e8eeee',530);
    // Solid redaction bars reinforce that the private contents must stay in the workspace.
    rr(343,181,206,24,5,'#a8bbc44d');rr(343,235,161,24,5,'#a8bbc44d');
    text('Attached to your request',29,302,22,C.muted,450);
    c.restore();
  }

  function model(alpha){
    c.save();c.globalAlpha=alpha;
    const x=1297,y=410,w=405,h=220;
    rr(x+9,y+12,w,h,16,'#03090d');
    const metal=c.createLinearGradient(x,y,x+w,y+h);metal.addColorStop(0,'#233640');metal.addColorStop(1,'#111f28');
    rr(x,y,w,h,16,metal,'#60747e');
    // Three inlets identify a destination for the request, without another brand mark.
    for(let i=0;i<3;i++)rr(x+28+i*13,y+25,5,19,2,'#72919c');
    text('External AI',x+28,y+103,39,C.ink,560);
    text('No private data received',x+28,y+154,25,C.muted,450);
    line(x+28,y+185,x+w-29,y+185,'#46616d',2);
    c.restore();
  }

  function gate(t){
    const after=t-.30,pulse=after>=0&&after<.20?Math.pow(1-after/.20,2):0;
    const kick=after>=0&&after<.21?7*Math.sin(Math.PI*after/.21):0;
    const x=1138+kick,y=300,h=650;
    poly([[x+34,y+12],[x+54,y-3],[x+54,y+h-14],[x+34,y+h]],'#15232c');
    const metal=c.createLinearGradient(x,0,x+35,0);metal.addColorStop(0,'#3c5561');metal.addColorStop(.44,'#93a8b0');metal.addColorStop(.56,'#e9eff0');metal.addColorStop(.70,'#5d7580');metal.addColorStop(1,'#263b46');
    rr(x,y,35,h,8,metal);
    line(x-1,y+13,x-1,y+h-13,'#bdd1d8',2);
    // The active rule becomes a physical stop on the private lane.
    const active=out((t-.30)/.08);
    c.save();c.shadowColor=C.coral;c.shadowBlur=14+42*pulse;
    line(x-3,366,x-3,692,`rgba(255,131,124,${.22+.78*active})`,5+7*pulse);c.restore();
    // The lower public lane has a visible opening through the same boundary.
    rr(x-6,855,62,82,7,C.bg,'#598976',2);
    line(x-7,863,x-7,929,C.mint,3);line(x+53,863,x+53,929,C.mint,3);
    const label=out((t-.47)/.21);c.save();c.globalAlpha=label;
    text('CLIENT DATA RULE',988,268,24,C.muted,600);
    c.restore();
  }

  function publicRequest(t){
    const a=out((t-1.20)/.15),p=clamp((t-1.32)/.78);
    if(!a)return;
    // The centre crosses the gate at 1.80 s; the full request clears it before 2.10 s.
    const x=t<=1.80?hermite((t-1.32)/.48,467,983,0,1500,.48):hermite((t-1.80)/.30,983,1370,1500,0,.30),y=855,w=310,h=82;
    c.save();c.globalAlpha=a;
    const routeA=out((t-1.08)/.25);c.globalAlpha=a*routeA;
    line(483,896,1715,896,'#365d51',2);c.globalAlpha=a;
    rr(x+5,y+7,w,h,12,'#02070b');rr(x,y,w,h,12,'#162c27','#6b9d87',1.5);
    text('public-update.md',x+21,y+49,26,'#e7f7ec',550);
    if(t>1.88){c.globalAlpha=a*out((t-1.88)/.16);check(x+w-42,y+40,17);c.globalAlpha=a}
    if(p>0&&p<1){line(x-80,y+41,x-14,y+41,C.mint,3);line(x-116,y+41,x-95,y+41,'#5e987e',2)}
    const done=out((t-2.03)/.16);c.globalAlpha=done;
    text('Public work goes through.',1305,988,28,C.mint,520);
    c.restore();
  }

  function renderAt(time){
    const t=Math.max(0,Number.isFinite(time)?time:0);
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.shadowColor='transparent';c.lineCap='butt';c.textAlign='left';c.textBaseline='alphabetic';
    c.fillStyle=C.bg;c.fillRect(0,0,W,H);
    const studio=c.createRadialGradient(1160,525,20,940,530,1110);studio.addColorStop(0,'#20343e');studio.addColorStop(.55,'#0e1b24');studio.addColorStop(1,C.bg);c.fillStyle=studio;c.fillRect(0,0,W,H);
    const pull=out((t-.39)/.58),zoom=mix(1.43,1,pull),cameraX=mix(879,930,pull);
    c.save();c.translate(W*.5,H*.5);c.scale(zoom,zoom);c.translate(-cameraX,-560);
    // Route perspective is subordinate to the solid file and boundary.
    line(120,536,1740,536,'#324953',2);
    line(120,906,1780,906,'#1f333e',1);
    const sceneLabel=out((t-.54)/.25);c.save();c.globalAlpha=sceneLabel;
    text('Connected workspace',167,319,26,C.muted,500);c.restore();
    model(out((t-.40)/.38));
    const travel=clamp(t/.30),arrival=mix(225,510,Math.pow(travel,.86));
    const after=t-.30,rebound=after>=0&&after<.28?-22*Math.sin(Math.PI*after/.28):0;
    const press=after>=0&&after<.17?Math.sin(Math.PI*after/.17):0;
    const angle=mix(-.059,-.018,travel)-press*.007;
    // A short blank silhouette trail conveys velocity without duplicating the file text.
    if(t<.30){const speed=1-smooth((t-.23)/.07);for(let i=3;i>=1;i--){c.save();c.globalAlpha=.055*speed*(4-i);clientFile(arrival-i*28,366,angle,1,true);c.restore()}}
    clientFile(arrival+rebound,366,angle,1-.035*press);
    gate(t);
    publicRequest(t);
    c.restore();
    // One complete statement resolves after impact; it never types or breaks into letters.
    const title=out((t-.47)/.24);c.save();c.globalAlpha=title;
    text('That file stays here.',108,182+12*(1-title),86,C.ink,650);
    c.restore();
    const reason=out((t-.52)/.20);c.save();c.globalAlpha=reason;
    rr(539,721,550,59,10,'#412831','#8b5054',1.2);
    c.beginPath();c.arc(568,750,10,0,Math.PI*2);c.strokeStyle=C.coral;c.lineWidth=2.5;c.stroke();line(561,757,575,743,C.coral,2.5);
    text('Blocked by Warden',590,759,29,'#ffaaa0',610);
    c.restore();
    // A single finite colour impulse, never a repeating flash or random glitch.
    const flash=t>=.30&&t<.36?Math.pow(1-(t-.30)/.06,2):0;
    if(flash){c.fillStyle=`rgba(255,131,124,${flash*.105})`;c.fillRect(0,0,W,H)}
  }
  return {renderAt,duration:2.6,events:{impact:.30,reasonStart:.52,reasonReadable:.72,publicCrossing:1.80,publicComplete:2.10},geometry:{policyEdgeX:1138,privateLaneY:536,publicLaneY:896}};
};
})(window);

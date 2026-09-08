/* A request in motion: an active policy stops private data while public work passes. */
(function(g){
'use strict';
g.createWardenHookV11=function(canvas){
const c=canvas.getContext('2d'),W=1920,H=1080;
canvas.width=W;canvas.height=H;
const bg='#081119',ink='#f4f2eb',muted='#a2afb8',red='#f47c8d',green='#9ee4c7';
const clamp=x=>Math.max(0,Math.min(1,x)),out=x=>1-Math.pow(1-clamp(x),4),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},lerp=(a,b,t)=>a+(b-a)*t;
const rr=(x,y,w,h,r,fill,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke()}};
function text(s,x,y,size=30,col=ink,weight=500){c.fillStyle=col;c.font=`${weight} ${size}px WardenDisplay,Arial`;c.fillText(s,x,y)}
function line(x,y,x2,y2,col,width=2){c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke()}
function check(x,y,col=green){c.strokeStyle=col;c.lineWidth=4;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(x+9,y+9);c.lineTo(x+27,y-11);c.stroke()}
function file(x,y,w,h,title,subtitle,kind,angle=0){
 c.save();c.translate(x+w/2,y+h/2);c.rotate(angle);c.translate(-w/2,-h/2);
 rr(7,13,w,h,18,'#02070b');const fill=c.createLinearGradient(0,0,w,h);fill.addColorStop(0,'#233540');fill.addColorStop(1,'#14222d');
 rr(0,0,w,h,18,fill,'#52606b');line(26,70,w-26,70,'#3a4b57');text(kind,27,45,21,kind==='CONFIDENTIAL'?red:muted,600);
 text(title,27,116,30,ink,570);text(subtitle,27,153,23,muted);
 for(let j=0;j<3;j++){rr(27,188+j*22,(w-65)*[.85,1,.63][j],5,2,'#3d4e5a')}
 c.restore();
}
function shield(x,y,size){c.save();c.translate(x,y);const p=g.WARDEN_SYMBOL_PATHS||[];c.scale(size/400,size/400);c.translate(-335,-473);for(let depth=7;depth>=0;depth--){c.save();c.translate(depth,depth*.5);c.fillStyle=depth?'#354651':'#dce3e4';p.forEach(s=>c.fill(new Path2D(s),'evenodd'));c.restore()}c.restore()}
function renderAt(t){
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle=bg;c.fillRect(0,0,W,H);
 const focus=c.createRadialGradient(1010,610,30,1010,610,980);focus.addColorStop(0,'#172630');focus.addColorStop(1,bg);c.fillStyle=focus;c.fillRect(0,0,W,H);
 // One camera pullback starts in the sending workspace and exposes the policy gate.
 const pull=out(t/.85),z=lerp(1.04,1,pull);c.save();c.translate(960,560);c.scale(z,z);c.translate(-960,-560);
 text('Workspace',108,317,25,muted);text('Active team policy',1350,317,25,muted);
 // Architectural routes use one vanishing direction and carry both requests.
 line(117,504,1780,504,'#35444f');line(117,817,1780,817,'#35444f');
 const stop=.78,go=1.62;
 const privateX=lerp(102,687,out(t/stop));
 const recoil=t>=stop?Math.sin((t-stop)*31)*Math.exp(-(t-stop)*14)*12:0;
 const privateAngle=lerp(-.045,0,out(t/stop));
 file(privateX+recoil,366,426,253,'client-export.csv','Contacts · bank details','CONFIDENTIAL',privateAngle);
 // Narrow, extruded policy blade. Its edge becomes the match point for the next scene.
 const blade=c.createLinearGradient(1147,0,1190,0);blade.addColorStop(0,'#192a35');blade.addColorStop(.47,'#6d818d');blade.addColorStop(.60,'#dce3e4');blade.addColorStop(1,'#263743');
 rr(1147,360,42,579,12,blade);line(1147,397,1147,598,t>=stop?red:'#69818c',4);line(1147,693,1147,924,t>=go?green:'#69818c',4);
 shield(1088,377,100);
 const blocked=out((t-stop)/.18);
 c.globalAlpha=blocked;rr(1260,429,479,156,16,'#251d28','#6a3b46');text('Blocked by Warden',1293,490,34,red,600);text('Client contact details',1293,539,26,muted);c.globalAlpha=1;
 if(t>=stop){line(1111,504,1147,504,red,4);for(let j=0;j<3;j++){const p=clamp((t-stop-j*.035)/.26);c.globalAlpha=(1-p)*.55;line(1144-p*77,486-j*7,1140-p*92,479-j*9,red,2)}c.globalAlpha=1;}
 const travel=out((t-go)/.78),publicX=lerp(104,1270,travel);
 // A public request travels through; it becomes the resulting document in place.
 const done=out((t-2.45)/.24),fw=lerp(426,467,done);
 file(publicX,685,fw,253,done>.5?'Public update ready':'release-notes.md',done>.5?'Ready for your team':'Public product changes',done>.5?'COMPLETED':'PUBLIC',0);
 if(done>0){c.globalAlpha=done;check(publicX+fw-64,725);c.globalAlpha=1;}
 if(travel>0&&travel<1){line(publicX-120,818,publicX-28,818,green,4);line(publicX-205,818,publicX-148,818,'#56796b',2)}
 // The sender remains visible, distinguishing a policy stop from a generic error.
 if(t>1.1){c.globalAlpha=out((t-1.1)/.2);text('Private data stays here.',108,652,29,muted,500);c.globalAlpha=1}
 c.restore();
 text('Move fast.',98,158,100,ink,630);
 const control=out((t-1.2)/.28);c.save();c.beginPath();c.rect(674,60,1160*control,145);c.clip();text('Keep control.',680,158,100,ink,630);c.restore();
 text('Warden checks connected requests before they reach the model.',108,1024,27,muted);
}
return{renderAt};
};
})(window);

/* Editorial reconstruction of fictional business information leaving a workspace.
 * Complete records retain their identity while crossing the company boundary. */
(function(global){
'use strict';
global.createWardenRiskScene=function({canvas,width=1920,height=1080}){
  canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
  const P={bg:'#0b1018',pane:'#141b25',raised:'#1b2532',side:'#10161f',edge:'#354050',text:'#edf1f7',muted:'#a0adbe',dim:'#6f7e93',risk:'#ff857b',riskBg:'#39252b',blue:'#9cc4e8'};
  const clamp=n=>Math.min(1,Math.max(0,n));
  const ease=(t,a,b)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p)};
  const mix=(a,b,p)=>a+(b-a)*p;
  function box(x,y,w,h,r,fill,stroke,lw=2){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke()}}
  function text(s,x,y,size=48,color=P.text,weight=560,align='left'){c.fillStyle=color;c.font=weight+' '+size+'px WardenDisplay';c.textAlign=align;c.fillText(s,x,y)}
  function line(points,color=P.edge,lw=2){c.strokeStyle=color;c.lineWidth=lw;c.lineCap='round';c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke()}
  function cursor(x,y,press=0){c.save();c.translate(x,y);c.scale(1-press*.09,1-press*.09);c.beginPath();c.moveTo(0,0);c.lineTo(3,37);c.lineTo(13,26);c.lineTo(29,32);c.lineTo(33,24);c.lineTo(17,17);c.closePath();c.fillStyle=P.text;c.fill();c.lineWidth=3;c.strokeStyle=P.bg;c.stroke();c.restore()}
  function documentIcon(x,y,size,color=P.muted){c.save();c.translate(x,y);c.scale(size/46,size/46);line([[3,1],[29,1],[43,15],[43,53],[3,53],[3,1]],color,2.8);line([[28,2],[28,16],[42,16]],color,2.8);line([[12,29],[33,29]],color,2.5);line([[12,39],[29,39]],color,2.5);c.restore()}
  function check(x,y,color=P.text){line([[x-10,y],[x-2,y+8],[x+13,y-10]],color,3.5)}
  function clip(x,y,w,h,r,fn){c.save();c.beginPath();c.roundRect(x,y,w,h,r);c.clip();fn();c.restore()}
  function attachment(x,y,w,h,scale=1,alpha=1){
    c.save();c.globalAlpha=alpha;box(x,y,w,h,17,P.raised,P.edge);
    documentIcon(x+25,y+27,46*scale,P.blue);
    const tx=x+mix(79,123,scale),titleSize=mix(29,43,scale);
    text('Client brief',tx,y+49,titleSize,P.text,600);
    if(w>560){text('Confidential · client + billing details',tx,y+91,32,P.muted,470);box(x+w-225,y+21,196,39,8,P.riskBg);text('CONFIDENTIAL',x+w-127,y+48,23,P.risk,650,'center')}
    c.restore();
  }
  function composer(t){
    const sent=t>=.72,drop=ease(t,.09,.32),sendPress=Math.sin(Math.PI*ease(t,.685,.805));
    box(126,280,1668,674,28,P.pane,P.edge);
    clip(126,280,1668,674,28,()=>{
      box(126,280,360,674,0,P.side);box(486,280,1308,74,0,P.pane);
      line([[486,280],[486,954]]);line([[486,354],[1794,354]]);
      ['#7d5260','#87704a','#52766d'].forEach((color,i)=>{c.beginPath();c.arc(164+i*29,318,8,0,Math.PI*2);c.fillStyle=color;c.fill()});
      text('Workspace',268,331,35,P.text,650);text('Client operations',530,331,32,P.muted,540);
      box(151,390,309,68,12,P.raised);line([[178,424],[196,424]],P.text,2.6);line([[187,415],[187,433]],P.text,2.6);text('New task',214,436,31,P.text,570);
      text('Projects',163,520,29,P.dim,550);
      box(150,545,310,72,12,'#222d3c');line([[169,572],[181,572],[186,579],[196,579],[196,597],[169,597],[169,572]],P.muted,2.4);text('Client operations',208,592,31,P.text,560);
      line([[180,634],[180,681],[194,681]],P.edge,2);text('Client brief',209,688,30,P.muted,500);
      if(!sent){text('New task',552,449,51,P.text,590);text('Client operations',555,500,32,P.muted,470)}
      else{
        const response=ease(t,.76,.84);c.save();c.globalAlpha=response;
        box(552,385,31,31,8,P.raised,P.edge);line([[560,401],[575,401]],P.blue,2.8);
        text(t<1.28?'Drafting your update…':'Client update drafted.',603,412,34,P.blue,570);c.restore();
        const first=ease(t,.91,1.01);c.save();c.globalAlpha=first;text('“Hi Alex, here’s your renewal update.”',555,469,39,P.text,530);c.restore();
        const second=ease(t,1.10,1.20);c.save();c.globalAlpha=second;text('“Rate: $240,000. Account: •••• 4821.”',555,522,36,P.muted,490);c.restore();
      }
      box(534,566,1206,340,26,'#171f2b',sent?'#506077':P.edge);
      text('Draft a client update.',578,650,61,P.text,570);
      if(drop<1){c.save();c.globalAlpha=.40;box(578,691,910,113,17,null,P.blue,2);c.restore()}
      if(sent)text('Sent to external AI',578,863,33,P.risk,580);
      else{line([[580,851],[603,851]],P.muted,3);line([[591.5,839.5],[591.5,862.5]],P.muted,3)}
      text(sent?'Sent':'Send',1574,866,35,P.text,560,'right');
      c.beginPath();c.arc(1658,852,35-sendPress*2,0,Math.PI*2);c.fillStyle=sent?P.risk:P.text;c.fill();
      if(sent)check(1658,852,P.bg);else{line([[1658,866],[1658,838],[1647,849]],P.bg,4);line([[1658,838],[1669,849]],P.bg,4)}
    });
    // The whole file slots into the same anchor used by the camera transition.
    attachment(mix(158,578,drop),mix(648,691,drop),mix(304,910,drop),113,mix(.36,1,drop));
    if(t<.34)cursor(mix(334,1470,drop),mix(692,769,drop),0);
    else{
      const approach=ease(t,.39,.68),exit=ease(t,.84,1.02);
      cursor(mix(mix(1470,1658,approach),1737,exit),mix(mix(769,852,approach),930,exit),sendPress);
    }
  }
  const fields=[
    {label:'Contact',value:'alex@client.example',start:2.72,end:2.84},
    {label:'Bank details',value:'Account •••• 4821',start:3.14,end:3.26},
    {label:'Pricing',value:'Private rate · $240,000',start:3.46,end:3.58}
  ];
  function dataRow(x,y,w,field,active=0,alpha=1){
    c.save();c.globalAlpha=alpha;
    box(x,y,w,110,13,active?P.riskBg:P.raised,active?P.risk:P.edge,active?2.7:1.5);
    text(field.label,x+25,y+35,27,active?P.risk:P.muted,600);
    text(field.value,x+25,y+83,39,P.text,580);
    c.restore();
  }
  function leak(t){
    // Stable readable columns; copies cross a single visible company boundary.
    // The attachment aperture supplies the entrance. Its incoming pose already
    // contains the file, so the camera never opens into an empty loading panel.
    c.save();
    text('Company',130,328,42,P.text,610);text('External AI',1080,328,42,P.text,610);
    line([[968,366],[968,903]],'#64748a',2);
    box(128,370,752,542,21,P.pane,P.edge);box(1044,370,748,542,21,P.pane,P.edge);
    documentIcon(157,399,34,P.muted);text('Client brief',207,430,37,P.text,580);
    box(640,397,210,40,8,P.riskBg);text('Confidential',745,425,27,P.risk,600,'center');
    text('Outgoing request',1075,430,35,P.muted,550);
    fields.forEach((field,i)=>{
      const y=462+i*135,travel=ease(t,field.start,field.end);
      const moving=t>=field.start&&t<field.end,received=t>=field.end;
      dataRow(156,y,696,field,!received&&t>=field.start-.12?1:0,received?.43:1);
      // The destination grows by whole records; no skeletons masquerade as output.
      if(received)dataRow(1072,y,692,field,0,1);
      if(moving){
        const x=mix(156,1072,travel),lift=16*Math.sin(Math.PI*travel);
        c.save();c.shadowColor='#00000077';c.shadowBlur=22;c.shadowOffsetY=8;
        dataRow(x,y-lift,mix(696,692,travel),field,1,1);c.restore();
      }
    });
    c.restore();
    const shared=ease(t,3.58,3.70);
    if(shared>0){c.save();c.globalAlpha=shared;box(566,940,788,71,15,P.riskBg);check(610,975,P.risk);text('Confidential data shared',974,989,39,P.risk,610,'center');c.restore()}
    else{const count=fields.filter(field=>t>=field.end).length;text(count?count+' of 3 private fields sent':'Reading the attached file…',960,984,34,P.muted,500,'center')}
  }
  function secrets(t){
    // The same file/request logic continues into private pricing and internal plans.
    const isCode=t<5,u=t-(isCode?4:5),x=298,y=319;
    text('Company',x,y-28,32,P.muted,550);
    box(x,y,916,544,24,P.pane,P.edge);
    box(x,y,916,82,[24,24,0,0],P.raised);text('CONFIDENTIAL',x+42,y+55,31,P.risk,670);
    text(isCode?'Private pricing code':'Internal pricing plan',x+44,y+160,54,P.text,620);
    text(isCode?'pricing-engine.ts':'Renewal_Strategy.pdf',x+44,y+217,33,P.muted,500);
    const rows=isCode?['customer.bank = "•••• 4821"','pricing.privateRate = 240000','return renewalPrice;']:['Customer renewal terms','Private rate: $240,000','Internal negotiation notes'];
    rows.forEach((s,i)=>{
      const emphasis=i===1&&u<.66;box(x+43,y+257+i*66,828,52,8,emphasis?P.riskBg:P.raised,emphasis?P.risk:null,1.5);
      text(s,x+60,y+295+i*66,isCode?34:36,emphasis?P.risk:P.text,530);
    });
    text('External AI',1388,439,34,P.muted,560);
    box(1388,476,372,226,24,P.pane,P.edge);
    text('Request received',1574,530,28,P.muted,550,'center');
    const transfer=ease(u,.17,.40),received=u>=.40;
    line([[1228,589],[1364,589]],P.edge,3);
    line([[1348,576],[1364,589],[1348,602]],P.edge,3);
    if(received){box(1420,558,308,89,13,P.riskBg,P.risk);text('$240,000',1574,619,47,P.text,620,'center')}
    else if(u>=.17){
      const px=mix(888,1420,transfer),py=mix(633,558,transfer);
      box(px,py,308,89,13,P.riskBg,P.risk);text('$240,000',px+154,py+61,47,P.text,620,'center');
    }
    const state=ease(u,.43,.53);c.save();c.globalAlpha=state;text('Private pricing shared.',960,955,43,P.risk,590,'center');c.restore();
  }
  return {renderAt(time){
    const t=Number(time)||0;c.setTransform(width/1920,0,0,height/1080,0,0);c.clearRect(0,0,1920,1080);c.lineJoin='round';
    c.fillStyle=P.bg;c.fillRect(0,0,1920,1080);
    if(t<2)composer(t);else if(t<4)leak(t);else secrets(t);
  }};
};
})(window);

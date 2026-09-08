/* Full-frame editorial 3D. The request, boundary and decision retain physical
   identity. Every pose is derived from the composition time, including impacts. */
(function(global){
'use strict';
global.createWardenClientFilm=function({THREE:T,canvas,width,height}){
  const R=new T.WebGLRenderer({canvas,antialias:true,alpha:false});
  R.setSize(width,height,false);R.setPixelRatio(1);R.outputColorSpace=T.SRGBColorSpace;
  R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=1.15;
  R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),world=new T.Group();scene.add(world);
  const camera=new T.PerspectiveCamera(35,width/height,.1,120);
  const V=a=>new T.Vector3(...a),mix=(a,b,p)=>a+(b-a)*p,clamp=x=>Math.min(1,Math.max(0,x));
  const q=(t,a,b)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p)};
  const out=(t,a,b)=>1-Math.pow(1-clamp((t-a)/(b-a)),3);
  const ink=0x171b22,coral=0xf47583,mint=0x9ce9c6,gold=0xf1ca7e;
  const studio=new T.Scene();studio.background=new T.Color(0x232733);
  [[[-7,4,4],3,11,5],[[7,2,-3],2,12,3],[[0,8,2],9,2,4],[[0,0,10],6,9,1.1]].forEach(([p,w,h,intensity])=>{
    const mat=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});mat.color.multiplyScalar(intensity);
    const light=new T.Mesh(new T.PlaneGeometry(w,h),mat);light.position.copy(V(p));light.lookAt(0,0,0);studio.add(light);
  });
  const pm=new T.PMREMGenerator(R);scene.environment=pm.fromScene(studio,.02,.1,60).texture;pm.dispose();
  studio.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});
  const hemi=new T.HemisphereLight(0xf4f6ff,0x22232b,1);scene.add(hemi);
  const key=new T.DirectionalLight(0xffffff,3.4);key.position.set(-6,9,9);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:45});key.shadow.bias=-.0003;key.shadow.normalBias=.015;key.shadow.radius=4;scene.add(key);
  const rim=new T.DirectionalLight(0xc5d6fa,3);rim.position.set(6,4,-7);scene.add(rim);
  const bounce=new T.PointLight(coral,0,20,2);bounce.position.set(2,0,5);scene.add(bounce);
  const metal=new T.MeshPhysicalMaterial({color:0x9cacbf,metalness:.68,roughness:.38,clearcoat:.15,envMapIntensity:.85});
  const graphite=new T.MeshPhysicalMaterial({color:0x182235,metalness:.18,roughness:.58,clearcoat:.06,envMapIntensity:.55});
  const paper=new T.MeshPhysicalMaterial({color:0xefede7,metalness:.02,roughness:.66});
  const accents=c=>new T.MeshPhysicalMaterial({color:c,metalness:.52,roughness:.26,emissive:c,emissiveIntensity:.1});
  const cm=accents(coral),gm=accents(mint),am=accents(gold);
  const cache=new Map();
  function rounded(w,h,d,r=.1){
    const key=[w,h,d,r].join(':');if(cache.has(key))return cache.get(key);
    r=Math.min(r,w*.18,h*.18,d*.5);const s=new T.Shape(),x=-w/2,y=-h/2;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    const g=new T.ExtrudeGeometry(s,{depth:Math.max(.01,d-r),bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:r*.6,bevelThickness:r/2,curveSegments:12});g.center();cache.set(key,g);return g;
  }
  function block(parent,w,h,d,mat,pos=[0,0,0],r=.1){const o=new T.Mesh(rounded(w,h,d,r),mat);o.position.copy(V(pos));o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=R.capabilities.getMaxAnisotropy();return tx}
  function face(parent,w,h,z,map){const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map,transparent:true,alphaTest:.01,depthWrite:false,toneMapped:false}));o.position.z=z;parent.add(o);return o}
  function label(ctx,text,x,y,size,color='#171b22',weight=500){ctx.fillStyle=color;ctx.font=weight+' '+size+'px WardenDisplay';ctx.fillText(text,x,y)}
  function fitLabel(ctx,text,x,y,size,maxWidth,color='#171b22',weight=600,align='left'){
    while(size>24){ctx.font=weight+' '+size+'px WardenDisplay';if(ctx.measureText(text).width<=maxWidth)break;size-=1}
    ctx.save();ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,x,y);ctx.restore();
  }
  function brand(ctx,x,y,size,color){ctx.save();ctx.translate(x,y);ctx.scale(size/395.73,size/395.73);ctx.translate(-338,-473.9);ctx.fillStyle=color;for(const path of global.WARDEN_SYMBOL_PATHS)ctx.fill(new Path2D(path),'evenodd');ctx.restore()}
  const symbolTexture=texture(768,768,c=>{c.translate(384,384);c.scale(2.7,2.7);c.translate(-536,-677);c.fillStyle='#e8edf6';c.fill(new Path2D(global.WARDEN_SYMBOL_PATHS[1]));});
  function shieldPath(scale=1,hole=false){
    const s=hole?new T.Path():new T.Shape(),a=scale;
    s.moveTo(0,2.7*a);s.bezierCurveTo(.64*a,2.35*a,1.39*a,2.09*a,2.08*a,1.88*a);
    s.lineTo(2.08*a,.15*a);s.bezierCurveTo(2.08*a,-1.2*a,1.09*a,-2.21*a,0,-2.87*a);
    s.bezierCurveTo(-1.09*a,-2.21*a,-2.08*a,-1.2*a,-2.08*a,.15*a);s.lineTo(-2.08*a,1.88*a);
    s.bezierCurveTo(-1.39*a,2.09*a,-.64*a,2.35*a,0,2.7*a);return s;
  }
  function makeGate(){
    const root=new T.Group(),body=new T.Group();root.add(body);world.add(root);
    const ring=shieldPath();ring.holes.push(shieldPath(.83,true));
    const geo=new T.ExtrudeGeometry(ring,{depth:.38,bevelEnabled:true,bevelSegments:10,steps:1,bevelSize:.10,bevelThickness:.115,curveSegments:64});geo.translate(0,0,-.21);
    const rings=[];const rimMesh=new T.Mesh(geo,metal);rimMesh.castShadow=true;rimMesh.receiveShadow=true;body.add(rimMesh);rings.push(rimMesh);
    const fill=new T.Mesh(new T.ExtrudeGeometry(shieldPath(.76),{depth:.14,bevelEnabled:false,curveSegments:64}),graphite);fill.position.z=-.28;body.add(fill);fill.castShadow=true;
    const symbol=face(fill,2.66,2.66,.19,symbolTexture);symbol.position.y=.02;
    const guard=new T.Mesh(new T.ShapeGeometry(shieldPath(.81),64),new T.MeshStandardMaterial({color:coral,metalness:0,roughness:.82,emissive:coral,emissiveIntensity:.04,side:T.DoubleSide}));guard.position.z=.14;body.add(guard);
    const rail=block(body,4.3,.16,1.5,graphite,[0,-3.02,-.3]);
    return{root,body,fill,symbol,guard,rings,rail};
  }
  const gate=makeGate();
  // The field belongs to the shield surface: one scan, one impact, then a hold.
  // Absolute composition time drives every shader uniform, including reverse seeks.
  const fieldUniforms={u_scan:{value:-4},u_radius:{value:0},u_impact:{value:0},u_strength:{value:0},u_color:{value:new T.Color(coral)}};
  const energyField=new T.Mesh(new T.ShapeGeometry(shieldPath(.82),64),new T.ShaderMaterial({
    uniforms:fieldUniforms,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
    vertexShader:`varying vec2 vPoint; void main(){vPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 vPoint;
      uniform float u_scan,u_radius,u_impact,u_strength;
      uniform vec3 u_color;
      void main(){
        float scan=exp(-pow((vPoint.y-u_scan)*9.0,2.0));
        float distanceToRing=abs(length(vPoint-vec2(-1.45,.15))-u_radius);
        float edge=max(fwidth(distanceToRing),.012);
        float ripple=1.0-smoothstep(.027,.027+edge*2.0,distanceToRing);
        vec2 grid=abs(fract(vPoint*3.0-.5)-.5)/max(fwidth(vPoint*3.0),vec2(.001));
        float mesh=1.0-min(min(grid.x,grid.y),1.0);
        float a=clamp((scan*.76+ripple*u_impact*.92+mesh*.065)*u_strength,0.0,.94);
        gl_FragColor=vec4(mix(u_color,vec3(1.0),scan*.52+ripple*u_impact*.32),a);
        #include <colorspace_fragment>
      }`
  }));
  energyField.position.z=.205;gate.body.add(energyField);
  function makeCard({title,subtitle,tag='REQUEST',tone='white',w=5.4,h=3.25,status='',color='#ed747b'}){
    const root=new T.Group();world.add(root);const dark=tone==='dark',bg=dark?'#161d26':'#efeee9',fg=dark?'#f4f3ee':'#15191f';
    block(root,w,h,.18,dark?graphite:paper,[0,0,0],.16);
    const texHeight=Math.round(1600*(h*.955)/(w*.973));
    const tx=texture(1600,texHeight,c=>{
      const Y=v=>v*texHeight/960;
      c.fillStyle=bg;c.fillRect(0,0,1600,texHeight);c.fillStyle=color;c.fillRect(0,0,1600,18);
      label(c,tag,83,Y(138),42,dark?'#afbac8':'#646b73',600);
      // File shape and title stay on the physical request throughout the film.
      c.strokeStyle=fg;c.lineWidth=6;c.beginPath();c.moveTo(84,Y(237));c.lineTo(155,Y(237));c.lineTo(184,Y(270));c.lineTo(184,Y(354));c.lineTo(84,Y(354));c.closePath();c.stroke();c.beginPath();c.moveTo(153,Y(239));c.lineTo(153,Y(273));c.lineTo(182,Y(273));c.stroke();
      fitLabel(c,title,224,Y(287),149,1280,fg,600);fitLabel(c,subtitle,86,Y(461),61,1428,dark?'#c8d1dc':'#565e69',400);
      c.fillStyle=dark?'#343e4c':'#c9cdd0';c.fillRect(86,Y(571),1428,2);
      if(status){c.fillStyle=color;c.fillRect(85,Y(655),1428,Y(171));fitLabel(c,status,799,Y(741),98,1300,'#13191b',700,'center')}
      else{label(c,'REQUEST → AI',86,Y(786),44,dark?'#aebbc9':'#737a83',600);c.strokeStyle=color;c.lineWidth=13;c.beginPath();c.moveTo(1370,Y(749));c.lineTo(1492,Y(749));c.lineTo(1460,Y(714));c.moveTo(1492,Y(749));c.lineTo(1460,Y(784));c.stroke()}
    });face(root,w*.973,h*.955,.115,tx);return root;
  }
  const colors={ivory:0xf1ede3,lavender:0xc9baff,ink:0x101522,coral,mint,amber:gold};
  const dossier=global.createWardenClientDossier({THREE:T,fontFamily:'WardenDisplay'});world.add(dossier.root);
  const dossierFields=[dossier.highlights.contact,dossier.highlights.contract,dossier.highlights.bank];
  const dossierFieldColor=dossierFields[0].children[0].material.color.clone();
  // Two flat packets carry the selected printed field to the existing receiver.
  const dataPackets=[0,1].map(()=>{
    const packet=new T.Mesh(new T.PlaneGeometry(.46,.13),new T.MeshBasicMaterial({color:0x17244d,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
    world.add(packet);return packet;
  });
  const request=makeCard({title:'Client_Record.pdf',subtitle:'Include the client’s contact details.',tag:'AI REQUEST',w:7.5,h:3.65,color:'#f47583'});
  const publicDoc=makeCard({title:'Public docs',subtitle:'Summarize the published page.',tag:'PUBLIC INFORMATION',status:'ALLOWED',w:5.8,h:3.35,color:'#9ce9c6'});
  const reviewRequest=makeCard({title:'Sensitive request',subtitle:'Waiting for your decision.',tag:'YOUR RULE · REVIEW',status:'HELD FOR REVIEW',w:7.3,h:3.65,color:'#f1ca7e'});
  const receiver=new T.Group();world.add(receiver);
  block(receiver,1.65,1.65,.75,graphite);
  const aiTexture=texture(600,600,c=>{c.fillStyle='#172338';c.fillRect(0,0,600,600);label(c,'AI',119,391,245,'#e6eef8',620)});face(receiver,1.59,1.59,.40,aiTexture);
  const floorMat=new T.ShadowMaterial({color:0x000000,opacity:.17});
  const floor=new T.Mesh(new T.PlaneGeometry(120,120),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-4.15;floor.receiveShadow=true;scene.add(floor);

  // Three physical rules. Their colors carry through selection and outcomes.
  const ruleBoard=new T.Group();world.add(ruleBoard);
  const board=block(ruleBoard,10.65,5.9,.36,graphite,[0,0,-.23],.15);
  const boardHeader=texture(1800,250,c=>{label(c,'YOUR TEAM’S AI RULES',75,157,78,'#d7e2f2',620);label(c,'03',1555,157,94,'#91a3c0',500)});
  const boardHeaderFace=face(ruleBoard,9.9,1.35,.0,boardHeader);boardHeaderFace.position.y=2.22;
  function rule(index,title,action,color){
    const root=new T.Group();ruleBoard.add(root);root.position.set(0,1.05-index*1.57,.12);
    const surface=block(root,9.7,1.32,.18,graphite,[0,0,0],.10);
    const tx=texture(2250,300,c=>{
      c.fillStyle='#243044';c.fillRect(0,0,2250,300);c.fillStyle=color;c.fillRect(0,0,20,300);
      label(c,'0'+(index+1),62,182,75,'#a6b6ca',530);fitLabel(c,title,215,150,116,1230,'#f5f3ed',590);
      c.fillStyle=color;c.beginPath();c.roundRect(1530,48,450,204,24);c.fill();fitLabel(c,action,1755,150,84,354,'#152033',670,'center');
    });face(root,9.60,1.28,.11,tx);
    const accentMaterial=accents(new T.Color(color));
    const toggleBase=block(root,.71,.37,.12,accentMaterial,[4.16,0,.16],.12);
    const knob=new T.Mesh(new T.CylinderGeometry(.166,.166,.12,40),new T.MeshBasicMaterial({color:0xf4f3ef,toneMapped:false}));knob.rotation.x=Math.PI/2;knob.position.set(4.37,0,.30);root.add(knob);
    return{root,knob,surface,toggleBase,index};
  }
  const rules=[rule(0,'Client data','BLOCK','#f47583'),rule(1,'Sensitive requests','REVIEW','#f1ca7e'),rule(2,'Public information','ALLOW','#9ce9c6')];
  // A matching outcome plaque stays attached to the boundary, not the corner.
  function badge(title,color){const root=new T.Group();world.add(root);block(root,5.8,.88,.13,graphite);const tx=texture(1600,230,c=>{c.fillStyle=color;c.fillRect(0,0,1600,230);fitLabel(c,title,800,115,100,1444,'#142037',650,'center')});face(root,5.7,.82,.09,tx);return root}
  const blockedBadge=badge('BLOCK · Client data','#f47583');
  const blockedBadgeMaterials=[];
  blockedBadge.traverse(o=>{if(o.isMesh){o.material=o.material.clone();blockedBadgeMaterials.push(o.material)}});
  const reviewBadge=badge('REVIEW · Your decision','#f1ca7e');
  const allowBadge=badge('ALLOW · Public information','#9ce9c6');
  const toolsRoot=new T.Group();world.add(toolsRoot);
  function tool(name,x){const root=new T.Group();toolsRoot.add(root);root.position.set(x,-1.6,2.4);block(root,4.6,2.23,.32,graphite);
    const tx=texture(1600,740,c=>{c.fillStyle='#1b2840';c.fillRect(0,0,1600,740);label(c,name,82,335,name==='Compatible tools'?146:190,'#f4f2ed',620);label(c,'YOUR TEAM’S WORKFLOW',86,574,54,'#b0c2d7',550);c.fillStyle='#9ce9c6';c.beginPath();c.arc(1460,127,22,0,Math.PI*2);c.fill()});face(root,4.48,2.15,.18,tx);return root}
  const toolCards=[tool('Claude Code',-5.1),tool('Codex CLI',0),tool('Compatible tools',5.1)];
  function route(points,mat,r=.026,parent=world){const curve=new T.CatmullRomCurve3(points.map(V));const geometry=new T.TubeGeometry(curve,100,r,8,false);const mesh=new T.Mesh(geometry,mat);parent.add(mesh);return{mesh,curve,reveal(p){geometry.setDrawRange(0,Math.ceil(clamp(p)*100)*48)}}}
  const neutralRoute=route([[-8.5,-3.37,1.2],[-2,-3.37,1.2],[3,-3.37,.4],[8,-3.37,-1]],new T.MeshBasicMaterial({color:0x647995}),.025);
  const greenRoute=route([[-8,-3.35,1.2],[-2,-3.35,1.2],[3,-3.35,.4],[8,-3.35,-1]],gm,.04);
  const toolRoutes=[-5.1,0,5.1].map(x=>route([[x,-1.6,2.4],[x*.83,-1.45,1.1],[x*.3,-.85,-.4],[0,-.2,-1.5]],gm,.038,toolsRoot));
  const spark=new T.Mesh(new T.SphereGeometry(.13,20,20),gm);toolsRoot.add(spark);
  const pulse=new T.Mesh(new T.TorusGeometry(3.4,.024,12,160),new T.MeshBasicMaterial({color:coral,transparent:true,opacity:.8,toneMapped:false,depthWrite:false}));world.add(pulse);
  const protectedFrame=new T.Group();world.add(protectedFrame);
  const edgeMaterial=new T.MeshPhysicalMaterial({color:0x94edcd,metalness:.28,roughness:.19,transparent:true,opacity:.8,emissive:0x71dcaf,emissiveIntensity:.3});
  [[0,3.0,7.5,.045], [0,-3,7.5,.045],[-3.75,0,.045,6],[3.75,0,.045,6]].forEach(([x,y,w,h])=>block(protectedFrame,w,h,.05,edgeMaterial,[x,y,0],.01));
  const privateFields=new T.Group();world.add(privateFields);
  const fieldTags=['CLIENT EMAIL','CONTRACT','BANK DETAILS'].map((title,i)=>{
    const node=new T.Group();privateFields.add(node);block(node,3.5,.7,.12,graphite);
    const tx=texture(1300,230,c=>{c.fillStyle='#f47583';c.fillRect(0,0,1300,230);label(c,title,68,156,82,'#192033',650)});face(node,3.43,.66,.08,tx);node.position.set(-4.7+i*.25,.35-i*.91,2.9);return node;
  });
  const all=[dossier.root,request,publicDoc,reviewRequest,receiver,gate.root,ruleBoard,blockedBadge,reviewBadge,allowBadge,toolsRoot,neutralRoute.mesh,greenRoute.mesh,pulse,protectedFrame,privateFields,...dataPackets];
  function view(pos,target,zoom=1){camera.position.copy(V(pos));camera.lookAt(V(target));camera.zoom=zoom;camera.updateProjectionMatrix()}
  function pose(o,p,r=[0,0,0],scale=1){o.visible=true;o.position.copy(V(p));o.rotation.set(...r);o.scale.setScalar(scale)}
  function setTheme(name){scene.background=new T.Color(colors[name]);hemi.intensity=name==='ink'?.92:1.55;key.intensity=3.35;rim.intensity=name==='ink'?3:1.8;floorMat.opacity=name==='ink'?.14:.16}
  function showRuleBoard(selected=-1){
    pose(ruleBoard,[0,-.7,0],[.06,-.09,0],1);board.visible=boardHeaderFace.visible=true;
    rules.forEach((r,i)=>{r.root.visible=true;r.root.position.set(0,1.05-i*1.57,.12);r.root.scale.setScalar(1);r.knob.position.set(4.37,0,.30)});
  }
  function activateRule(r,t,start){
    const elapsed=t-start,travel=out(t,start+.08,start+.30);
    const settle=elapsed>.30?Math.exp(-(elapsed-.30)*22)*Math.sin((elapsed-.30)*39)*.018:0;
    r.knob.position.x=mix(3.94,4.37,travel)+settle;
    r.knob.position.z=.30-.052*(q(t,start,start+.08)-q(t,start+.24,start+.39));
  }
  function ruleMacro(index,t,start){
    showRuleBoard();board.visible=boardHeaderFace.visible=false;
    rules.forEach((r,i)=>{r.root.visible=i===index;r.root.position.set(0,0,.12)});
    pose(ruleBoard,[0,-.25,0],[.025,mix(-.055,.025,q(t,start,start+2)),0],1.38);
    activateRule(rules[index],t,start+.15);
  }
  function reset(){
    all.forEach(o=>o.visible=false);world.position.set(0,0,0);world.rotation.set(0,0,0);world.scale.setScalar(1);
    gate.fill.visible=true;gate.guard.visible=false;gate.body.rotation.set(0,0,0);gate.guard.material.opacity=.65;gate.guard.material.color.set(coral);gate.guard.material.emissive.set(coral);
    gate.rings.forEach((ring,i)=>ring.position.z=-i*.39);gate.rail.visible=false;
    energyField.visible=false;fieldUniforms.u_scan.value=-4;fieldUniforms.u_radius.value=0;fieldUniforms.u_impact.value=0;fieldUniforms.u_strength.value=0;fieldUniforms.u_color.value.set(coral);
    dossier.setSensitiveFocus(0);dossierFields.forEach(field=>field.children[0].material.color.copy(dossierFieldColor));
    bounce.intensity=0;bounce.color.set(coral);pulse.material.opacity=.8;
    blockedBadgeMaterials.forEach(material=>{material.opacity=1;material.transparent=false;material.depthWrite=true});
    setTheme('ink');neutralRoute.reveal(1);greenRoute.reveal(1);
  }
  function renderAt(seconds){
    const t=Math.min(32,Math.max(0,Number(seconds)||0));reset();
    const beat=Math.min(15,Math.floor(t/2)),u=t-beat*2,p=q(u,0,2);
    if(beat===0){
      setTheme('ivory');pose(dossier.root,[.35,-.95,0],[.015,-.13,-.055],1.13);
      view([.25,1.0,mix(17.2,16,p)],[0,.40,0],1.03);dossier.setSensitiveFocus(.25+out(u,.4,1.3)*.75);
    }else if(beat===1){
      setTheme('coral');pose(dossier.root,[mix(-3.4,-2.25,p),-.70,0],[.01,-.11,-.035],.93);
      pose(receiver,[5.25,-.85,-.3],[0,-.10,0],1.55);neutralRoute.mesh.visible=true;
      const emailFocus=q(t,2.58,2.74)*(1-q(t,3.14,3.26)),bankFocus=q(t,3.12,3.30);
      [emailFocus,0,bankFocus].forEach((alpha,i)=>{
        const field=dossierFields[i];field.visible=alpha>.001;
        field.children[0].material.opacity=alpha;field.children[0].material.color.set(0x9e3443);
      });
      dossier.root.updateMatrixWorld(true);
      [[2.90,3.17,.322],[3.37,3.80,-1.394]].forEach(([start,end,fieldY],i)=>{
        const travel=clamp((t-start)/(end-start)),packet=dataPackets[i];
        packet.visible=t>start&&t<end;
        if(packet.visible){
          const from=dossier.root.localToWorld(V([3.40,fieldY,.12])),to=V([4.03,-.85,.55]);
          const direction=to.clone().sub(from);
          packet.position.copy(from).lerp(to,travel);
          packet.rotation.set(0,0,Math.atan2(direction.y,direction.x));
          packet.material.opacity=q(t,start,start+.035)*(1-q(t,end-.035,end));
        }
      });
      const inspectEmail=q(t,2.45,2.94),inspectBank=q(t,3.14,3.70);
      view([.2,1.4,20.5],[mix(0,-.18,inspectEmail),mix(.25,.08,inspectBank),0],1.02+.065*inspectEmail+.025*inspectBank);
    }else if(beat===2){
      showRuleBoard();ruleBoard.rotation.y=mix(-.075,.025,p);ruleBoard.rotation.x=.035;
      rules.forEach((r,i)=>activateRule(r,u,.18+i*.35));
      view([.1,1.25,mix(19.5,19,p)],[0,.28,0],1.02);
    }else if(beat===3){
      setTheme('coral');ruleMacro(0,t,6);view([0,1.2,20],[0,.1,0],1.08);
    }else if(beat===4){
      setTheme('amber');ruleMacro(1,t,8);view([0,1.2,20],[0,.1,0],1.08);
    }else if(beat===5){
      setTheme('mint');ruleMacro(2,t,10);view([0,1.2,20],[0,.1,0],1.08);
    }else if(beat===6){
      pose(gate.root,[1.5,-.80,0],[0,mix(-.52,.03,p),-.015],1.10);
      gate.rings.forEach((ring,i)=>ring.position.z=-i*.39);
      pose(blockedBadge,[-3.45,.30,1.6],[0,.14,0],.87);pose(reviewBadge,[-3.45,-.70,1.6],[0,.14,0],.87);pose(allowBadge,[-3.45,-1.70,1.6],[0,.14,0],.87);
      view([mix(2.8,.5,p),1.6,19.5],[0,.1,0],1.03);bounce.intensity=5;
    }else if(beat===7||beat===8){
      // One shot: the request approaches, stops at the boundary, then settles.
      // All poses share absolute time so seeking either side of 16 s is continuous.
      const arrival=q(t,14.04,16),settle=q(t,16.03,16.66),cameraSettle=q(t,16,17.8);
      const impactTime=Math.max(0,t-16),impact=q(t,16,16.065)*(1-q(t,16.3,17.05));
      const theme=q(t,16.03,16.38),recoil=Math.exp(-impactTime*8)*Math.sin(impactTime*30)*q(t,16,16.055);
      scene.background=new T.Color(colors.ink).lerp(new T.Color(colors.coral),theme);
      hemi.intensity=mix(.92,1.55,theme);rim.intensity=mix(3,1.8,theme);floorMat.opacity=mix(.14,.16,theme);
      pose(dossier.root,[mix(-3.35,-1.20,arrival)-.4*settle+recoil*.07,mix(-.70,-.60,settle),1.3],
        [mix(0,.01,settle),mix(-.14,-.20,settle),mix(-.03,-.045,settle)],mix(.81,.82,settle));
      dossier.setSensitiveFocus(1);
      pose(gate.root,[mix(3.1,2.95,settle),mix(-.85,-.67,settle),0],[0,mix(-.36,-.45,settle),0],mix(.91,1.06,settle));
      gate.fill.visible=false;gate.guard.visible=true;gate.guard.material.opacity=mix(.18,.75,q(t,14.8,15.85));
      gate.body.rotation.y=Math.exp(-impactTime*8)*Math.sin(impactTime*25)*.035*q(t,16,16.055);
      energyField.visible=true;fieldUniforms.u_strength.value=q(t,14.1,14.5);
      fieldUniforms.u_scan.value=mix(2.4,-2.4,q(t,14.1,15.75));
      fieldUniforms.u_radius.value=5.5*out(t,16,17.1);fieldUniforms.u_impact.value=impact;
      pose(receiver,[mix(7.8,7.65,settle),mix(-.65,-.70,settle),mix(-1.1,-1.8,settle)],
        [0,mix(-.12,-.14,settle),0],mix(.7,.76,settle));
      neutralRoute.mesh.visible=true;
      // Inspection belongs to the shield surface; no floating strip crosses the record header.
      const badgeIn=q(t,16.19,16.46);
      if(badgeIn>0){
        pose(blockedBadge,[-1.75,-3.43,2],[0,-.10,0],1.1);
        blockedBadgeMaterials.forEach(material=>{material.opacity=badgeIn;material.transparent=badgeIn<1;material.depthWrite=badgeIn===1});
      }
      view([mix(.9,1.3,cameraSettle),mix(2.0,2.1,cameraSettle),22],[0,mix(.1,.18,cameraSettle),0],mix(1.05,1.02,cameraSettle));
      bounce.intensity=6*impact+2*settle;
    }else if(beat===9){
      setTheme('amber');pose(reviewRequest,[-1.3,-.60,1.1],[.025,mix(-.21,-.07,p),-.025],1.1);
      pose(gate.root,[4.2,-.5,-.9],[0,-.37,0],.81);gate.fill.visible=false;gate.guard.visible=true;gate.guard.material.color.set(gold);gate.guard.material.emissive.set(gold);gate.guard.material.opacity=.5;
      energyField.visible=true;fieldUniforms.u_strength.value=.65;fieldUniforms.u_color.value.set(gold);
      view([.7,1.8,21],[0,.08,0],1.02);bounce.color.set(gold);bounce.intensity=5;
    }else if(beat===10){
      setTheme('mint');pose(gate.root,[0,-.82,0],[0,-.28,0],.93);gate.fill.visible=false;
      const travel=q(u,0,1.8);pose(publicDoc,[mix(-5.6,5.5,travel),-.84,mix(1.7,-.9,travel)],[0,-.1,-.025],.78);
      pose(receiver,[7.7,-.8,-1.6],[0,-.1,0],.72);greenRoute.mesh.visible=true;greenRoute.reveal(out(u,0,1.7));
      view([.9,1.9,22],[0,.1,0],1.06);
    }else if(beat===11){
      setTheme('ivory');showRuleBoard();ruleBoard.position.set(0,-.55,0);ruleBoard.rotation.set(.035,mix(.05,-.025,p),0);
      rules.forEach((r,i)=>activateRule(r,u,.12+i*.32));
      view([0,1.2,19.5],[0,.15,0],1.02);
    }else if(beat===12){
      setTheme('lavender');pose(toolsRoot,[0,0,0],[0,mix(.06,-.06,p),0],1);
      pose(gate.root,[0,-.1,-2.3],[0,mix(-.17,.15,p),0],.61);
      toolCards.forEach((card,i)=>{card.rotation.y=[.18,0,-.18][i];card.position.z=mix(3.1,2.4,out(u,i*.10,.8+i*.10))});
      toolRoutes.forEach((route,i)=>route.reveal(out(u,.05+i*.1,1.1+i*.1)));spark.position.copy(toolRoutes[1].curve.getPointAt(out(u,.6,1.8)));
      view([mix(.8,-.8,p),3.4,20],[0,.02,0],1.02);
    }else if(beat===13){
      pose(gate.root,[0,-.55,0],[0,mix(-.15,.14,p),0],1.1);
      pose(dossier.root,[-5.5,-.55,0],[0,.18,-.04],.48);dossier.setSensitiveFocus(1);
      pose(publicDoc,[mix(3.5,6.5,p),-.30,-.4],[0,-.2,0],.54);pose(reviewRequest,[5.1,-2.5,1.0],[0,-.1,0],.48);
      pose(blockedBadge,[-5.4,-2.37,1],[0,.12,0],.58);pose(allowBadge,[5.4,1.02,1],[0,-.12,0],.57);
      view([mix(1.5,-1,p),1.7,22],[0,.15,0],1.0);bounce.intensity=6;
    }else{
      const closing=q(t,28,32);setTheme('ink');
      pose(gate.root,[4.95,-.10,0],[0,mix(-.26,-.17,closing),0],1.20);
      view([.35,1.5,mix(20.5,20.25,closing)],[0,0,0],1.02);
    }
    R.render(scene,camera);
  }
  renderAt(0);return{renderAt,scene,camera,world,gate,dossier,rules};
};
})(window);

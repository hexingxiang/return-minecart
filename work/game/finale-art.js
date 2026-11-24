/* Original 320×128 pixel scenes. All motion is sampled from caller-supplied progress. */
(() => {
  'use strict';
  const W=320, H=128;
  const clamp=n=>Math.max(0,Math.min(1,n));
  const ease=t=>t*t*(3-2*t);
  const mix=(a,b,t)=>a+(b-a)*t;
  const snap=Math.round;
  function rect(c,x,y,w,h,ink) {
    c.fillStyle=ink;c.fillRect(snap(x),snap(y),w,h);
  }
  function polygon(c,points,ink) {
    c.fillStyle=ink;
    const lo=Math.ceil(Math.min(...points.map(p=>p[1])));
    const hi=Math.ceil(Math.max(...points.map(p=>p[1])));
    for(let y=lo;y<hi;y++){
      const cuts=[],scan=y+.5;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[j],b=points[i];
        if((a[1]>scan)!==(b[1]>scan))
          cuts.push(a[0]+(b[0]-a[0])*(scan-a[1])/(b[1]-a[1]));
      }
      cuts.sort((a,b)=>a-b);
      for(let n=0;n<cuts.length;n+=2){
        const x=snap(cuts[n]),w=snap(cuts[n+1])-x;
        if(w>0)c.fillRect(x,y,w,1);
      }
    }
  }
  function line(c,ax,ay,bx,by,ink,width=1) {
    let x=snap(ax),y=snap(ay);
    const tx=snap(bx),ty=snap(by),dx=Math.abs(tx-x),dy=-Math.abs(ty-y);
    const sx=x<tx?1:-1,sy=y<ty?1:-1;let err=dx+dy;
    c.fillStyle=ink;
    while(true){
      c.fillRect(x,y,width,width);
      if(x===tx && y===ty)break;
      const e=2*err;
      if(e>=dy){err+=dy;x+=sx;}
      if(e<=dx){err+=dx;y+=sy;}
    }
  }
  function disc(c,x,y,r,color) {
    c.fillStyle=color;
    for(let k=-r;k<=r;k++){
      const d=Math.floor(Math.sqrt(r*r-k*k));c.fillRect(snap(x)-d,snap(y)+k,2*d+1,1);
    }
  }
  function sparkle(c,x,y,length,color) {
    rect(c,x-length,y,length*2+1,1,color);rect(c,x,y-length,1,length*2+1,color);
  }
  function crate(c,x,y,w,h,dark=false) {
    const edge=dark?'#42414b':'#7b4a3d',oak=dark?'#6c6262':'#c98c57',shine=dark?'#93816e':'#f0bd78';
    rect(c,x,y,w,h,edge);rect(c,x+1,y+1,w-2,h-2,oak);
    for(let xx=x+5;xx<x+w-1;xx+=5)rect(c,xx,y+1,1,h-2,edge);
    line(c,x+2,y+h-3,x+w-3,y+2,shine,2);
    rect(c,x,y,w,2,shine);rect(c,x,y+h-3,w,2,edge);
    rect(c,x+2,y+2,1,1,edge);rect(c,x+w-3,y+2,1,1,edge);
  }
  function mineCart(c,x,y,large,cold,full=false) {
    c.save();c.translate(snap(x),snap(y));c.scale(large,large);
    const trim=cold?'#829292':'#d4ae70',front=cold?'#516473':'#936b4b';
    for(const wx of [-9,8]) {
      disc(c,wx,-2,3,'#182333');rect(c,wx-1,-3,3,2,'#71818a');
    }
    polygon(c,[[-15,-15],[-13,-18],[12,-18],[15,-15],[11,-3],[-10,-3]],'#243142');
    polygon(c,[[-14,-15],[14,-15],[10,-5],[-9,-5]],front);
    polygon(c,[[7,-14],[13,-14],[9,-5],[5,-5]],cold?'#394b60':'#705344');
    rect(c,-15,-16,30,3,trim);
    polygon(c,[[-12,-16],[-10,-18],[10,-18],[12,-16]],'#1c293a');
    if(full) {
      polygon(c,[[-11,-17],[-9,-21],[-5,-22],[-2,-19],[1,-23],[7,-24],[11,-18]],'#c48e61');
      rect(c,3,-22,4,2,'#f6c77d');rect(c,-8,-21,3,2,'#ead4a3');
    }
    rect(c,-10,-12,2,2,trim);rect(c,8,-12,2,2,trim);
    rect(c,-7,-7,12,1,cold?'#71808b':'#bd9562');c.restore();
  }

  function sky(c,t) {
    // Stepped colour bands, mountain facets and isolated clouds at different depths.
    const bands=[[0,13,'#426889'],[13,14,'#547c98'],[27,12,'#7395a4'],[39,15,'#94afac'],
      [54,14,'#c4c4a9'],[68,18,'#e6cfaa'],[86,42,'#f2d9b4']];
    for(const [y,h,ink] of bands)rect(c,0,y,W,h,ink);
    disc(c,252,29,20,'#e9cfa3');disc(c,252,29,15,'#ffe6ab');
    const drift=snap(t*4);
    for(const [x,y,w] of [[25,18,36],[100,11,20],[165,24,32],[202,8,20],[276,46,34]]){
      rect(c,x+drift,y,w,2,'#b7c5bd');rect(c,x+drift+6,y-2,w-11,2,'#c4cec0');
      rect(c,x+drift-6,y+2,w+8,1,'#a5bdb9');
    }
    polygon(c,[[-5,76],[19,56],[29,58],[54,38],[68,51],[91,31],[107,49],[119,47],[140,64],
      [170,39],[182,48],[200,35],[222,60],[234,51],[258,70],[285,41],[300,54],[322,37],[322,91],[-5,91]],'#7792a2');
    polygon(c,[[37,52],[54,38],[63,47],[57,44],[54,46],[52,44],[47,49]],'#d5d7c7');
    polygon(c,[[73,47],[91,31],[102,44],[94,39],[91,43],[89,38],[84,42]],'#e1e0ca');
    polygon(c,[[91,31],[107,49],[119,47],[132,58],[111,55],[97,46]],'#6f879b');
    polygon(c,[[184,51],[200,35],[211,48],[203,44],[199,47],[197,42]],'#dedfc8');
    polygon(c,[[0,66],[13,61],[30,74],[47,69],[59,76],[82,55],[99,65],[111,56],[138,75],
      [157,61],[174,64],[190,52],[217,71],[230,65],[252,79],[278,59],[297,71],[320,58],[320,99],[0,99]],'#536f83');
    polygon(c,[[82,55],[78,69],[70,75],[83,67],[95,66]],'#718b99');
    polygon(c,[[190,52],[184,62],[185,66],[177,69],[194,61]],'#718b99');
    // A fog bank below the summit makes the height read even in the still frame.
    for(const [x,y,w] of [[0,79,45],[40,84,42],[108,77,41],[139,85,54],[250,83,66],[277,88,44]]){
      rect(c,x,y,w,2,'#b0b9b4');rect(c,x+7,y-2,Math.max(3,w-20),2,'#c1c8ba');
    }
    polygon(c,[[0,97],[21,83],[35,86],[49,79],[70,92],[94,80],[112,92],[141,82],[172,98],
      [212,89],[236,95],[256,88],[280,97],[303,86],[320,94],[320,128],[0,128]],'#40576b');
    for(let i=0;i<37;i++){
      const x=(i*47+19)%320, y=98-(i*13%8), h=4+(i*11%8);
      polygon(c,[[x-2,y],[x,y-h],[x+3,y]],'#384e62');
    }
  }

  function roadY(x) {
    if(x<43)return 112;
    if(x<181)return 112-(x-43)*.333;
    return 66;
  }
  function summit(c,t) {
    const cliff=[[0,112],[43,112],[181,66],[298,66],[304,70],[301,74],[303,79],[296,84],[295,100],
      [287,107],[284,119],[278,128],[0,128]];
    polygon(c,cliff,'#333e51');
    polygon(c,[[45,118],[181,72],[295,72],[296,80],[263,87],[249,103],[227,106],[222,121],[214,128],[24,128]],'#4f5362');
    polygon(c,[[171,80],[193,73],[230,73],[221,77],[202,78],[189,85],[178,86],[162,94],[150,96]],'#646475');
    polygon(c,[[246,84],[278,77],[297,75],[290,84],[275,92],[263,110],[252,111],[243,124],[231,128]],'#626171');
    polygon(c,[[270,97],[281,88],[277,99],[265,112],[263,124],[251,128]],'#434c60');
    polygon(c,[[91,112],[139,94],[131,102],[117,109],[111,119],[98,125],[86,128],[78,128]],'#41495b');
    for(const [x,y,l] of [[198,86,17],[217,79,12],[228,88,15],[273,87,9],[255,101,9],[167,97,12],[109,116,13],[191,117,17],[66,120,10]]){
      line(c,x,y,x+l,y-3,'#72707c');rect(c,x-4,y+2,4,1,'#636371');
    }
    // High-country roadside bollards are behind the moving car.
    for(const x of [5,60,92,125,158,186,205,277,295]){
      const y=snap(roadY(x));rect(c,x,y-8,3,8,'#52656a');rect(c,x,y-8,3,3,'#e1b267');
      rect(c,x+1,y-5,1,4,'#9e9576');
    }
    for(let x=0;x<301;x++){
      const y=snap(roadY(x));
      rect(c,x,y,1,3,'#739078');rect(c,x,y+2,1,4,'#a48c72');
      rect(c,x,y+3,1,2,'#e6c79a');rect(c,x,y+6,1,2,'#574f58');
    }
    for(const [x,y] of [[195,66],[272,66],[286,66],[165,72],[40,112]]){
      rect(c,x,y-3,1,3,'#a9b57c');rect(c,x+2,y-2,1,2,'#94aa7d');
    }
    // Summit pennant and gold brass finial.
    rect(c,285,36,2,30,'#64524c');rect(c,285,36,1,29,'#dfc084');rect(c,284,34,3,3,'#ffd58a');
    const wave=Math.sin(t*16)>0?1:0;
    polygon(c,[[287,37],[295,36+wave],[306,38],[302,41],[306,44],[297,43+wave],[287,45]],'#b64e45');
    polygon(c,[[287,37],[295,36+wave],[306,38],[300,40],[294,39+wave],[287,41]],'#f08a66');
  }

  function wheel(c,x,y,spin) {
    disc(c,x,y,6,'#202d3c');disc(c,x,y,4,'#526472');disc(c,x,y,3,'#d3bb8b');
    for(let i=0;i<4;i++){
      const a=spin+i*Math.PI/2;
      line(c,x,y,x+2.7*Math.cos(a),y+2.7*Math.sin(a),'#606a70');
    }
    rect(c,x,y,2,1,'#f9db9b');
  }

  function driver(c,x,y,wave) {
    c.save();c.translate(snap(x),snap(y));
    polygon(c,[[-5,0],[-4,-7],[-1,-9],[3,-8],[5,-4],[9,-4],[9,-1],[3,-1],[1,1]],'#314958');
    rect(c,-3,-7,5,6,'#3e6870');rect(c,3,-5,3,2,'#edb976');rect(c,6,-5,3,2,'#ffd79c');
    polygon(c,[[-4,-14],[-2,-16],[3,-16],[5,-14],[5,-12],[6,-11],[4,-10],[3,-8],[-1,-8],[-4,-10]],'#9a634d');
    rect(c,-2,-15,6,5,'#e5aa76');rect(c,0,-11,4,2,'#f1ba83');rect(c,3,-14,1,1,'#352d36');
    rect(c,-5,-16,10,2,'#775440');rect(c,-4,-18,7,3,'#dd9e44');rect(c,-2,-19,3,2,'#ffd078');
    rect(c,3,-16,4,2,'#f6c97e');rect(c,3,-17,2,2,'#fff0b2');
    if(wave>0){
      line(c,-2,-5,-7,-9,'#41636a',3);line(c,-7,-9,-7-wave,-13,'#efbb87',2);
      rect(c,-8-wave,-14,3,2,'#ffe0a1');
    }
    c.restore();
  }

  function sportsCar(c,x,ground,pitch,spin,presence,wave) {
    c.save();c.translate(snap(x),snap(ground-1));c.rotate(pitch);
    // Wide low nose, open passenger compartment and a split windshield.
    polygon(c,[[-34,-4],[-38,-7],[-38,-12],[-33,-15],[-25,-16],[-20,-19],[-12,-19],
      [-8,-15],[2,-15],[10,-20],[14,-19],[19,-15],[31,-13],[38,-10],[39,-6],[34,-3],[-26,-2]],'#242c3b');
    polygon(c,[[-37,-12],[-29,-15],[-20,-16],[-12,-17],[-7,-12],[4,-12],[10,-15],[25,-13],[34,-11],
      [38,-8],[37,-6],[20,-5],[-23,-5],[-36,-7]],'#d65248');
    polygon(c,[[-37,-11],[-26,-14],[-17,-14],[-12,-12],[-23,-10],[-33,-10]],'#f08a61');
    polygon(c,[[-10,-12],[3,-12],[10,-14],[26,-12],[33,-10],[12,-10],[6,-8],[-5,-8]],'#f06c51');
    polygon(c,[[-9,-9],[8,-10],[13,-12],[10,-8],[4,-6],[-6,-6]],'#a43c43');
    boxCarTrim(c);
    // Rear deck carries a gold ore case with two steel fasteners.
    rect(c,-32,-19,11,5,'#7d5642');rect(c,-31,-20,9,4,'#e1a752');
    rect(c,-30,-20,2,5,'#f8d592');rect(c,-24,-20,1,5,'#f1d39a');
    polygon(c,[[-19,-17],[-19,-21],[-15,-21],[-12,-17]],'#475663');
    polygon(c,[[-11,-16],[-10,-21],[-6,-21],[-6,-15]],'#65484c');
    if(presence)driver(c,-5,-14,wave);
    // The miner's steering wheel appears in front of his hands.
    line(c,4,-16,7,-18,'#394351',2);rect(c,5,-18,3,1,'#dbc8a0');
    polygon(c,[[8,-16],[12,-23],[14,-23],[17,-16]],'#294353');
    polygon(c,[[10,-16],[13,-22],[14,-21],[15,-16]],'#a6d0c4');
    rect(c,12,-23,3,1,'#f2d8a5');
    rect(c,-37,-12,4,2,'#f6b995');rect(c,33,-10,5,2,'#fff1b9');
    rect(c,29,-6,8,1,'#192b39');rect(c,31,-5,6,1,'#ceb78b');
    wheel(c,-23,-5,spin);wheel(c,23,-5,spin);
    c.restore();
  }

  function boxCarTrim(c) {
    rect(c,-35,-7,66,1,'#e8b77d');rect(c,-9,-5,25,2,'#724248');
    rect(c,-6,-12,8,1,'#efab77');rect(c,0,-11,3,1,'#ffe1a4');
    for(let i=0;i<3;i++)line(c,14+i*2,-12,15+i*2,-11,'#7d4647');
  }

  function burst(c,x,y,r,phase,palette) {
    if(phase<=0)return;
    const spread=r*Math.min(1,phase*1.5);
    for(let i=0;i<11;i++){
      const a=i*Math.PI*2/11-.2;
      const dx=Math.cos(a),dy=Math.sin(a);
      const xx=x+dx*spread,yy=y+dy*spread+phase*phase*2;
      line(c,xx-dx*(phase>.7?1:3),yy-dy*(phase>.7?1:3),xx,yy,palette[i%palette.length]);
      if((i%3)===0 && phase>.65)sparkle(c,xx,yy,1,palette[0]);
    }
  }

  function victory(c,t) {
    sky(c,t);summit(c,t);
    const ride=ease(clamp((t-.19)/.61));
    const x=mix(57,235,ride),ground=roadY(x);
    const tilt=Math.atan((roadY(x+23)-roadY(x-23))/46);
    // Rail wheels and ore crates remain at the loading siding as the convertible departs.
    for(let tx=0;tx<30;tx+=5)rect(c,tx,113,2,2,'#765c5a');
    rect(c,0,112,31,1,'#b5b2a0');crate(c,1,99,12,11);
    mineCart(c,17,110,.77,false,t<.1);
    const bounce=t>.21 && t<.77 ? Math.sin(ride*56)*.55 : 0;
    sportsCar(c,x,ground+bounce,tilt,ride*22,t>=.19,t>.85?1+(Math.sin(t*60)>0?1:0):0);
    if(t<.19){
      const j=clamp(t/.19),path=ease(j);
      const mx=mix(17,x-5,path),my=mix(94,ground-15,path)-Math.sin(j*Math.PI)*12;
      driver(c,mx,my,0);
    }
    if(t>.22 && t<.8){
      for(let i=0;i<5;i++){
        const a=(ride*12+i*.22)%1;
        const px=x-35-a*14,py=roadY(px)-3-a*6;
        rect(c,px,py,(i%3)+1,1,'#c4ad86');
      }
    }
    const finish=clamp((t-.73)/.27);
    burst(c,173,21,14,clamp(finish*1.25),['#ffd492','#e99c79','#f8dea4']);
    burst(c,278,19,11,clamp((finish-.18)*1.3),['#f5db9e','#e99582','#f5cca1']);
    if(finish>.16){
      for(let i=0;i<18;i++){
        const px=188+(i*23)%83+Math.sin(i+finish*5)*2;
        const py=10+(i*7)%27+finish*(5+i%8);
        rect(c,px,py,1+(i%3===0),1+(i%4===0),['#efb67e','#bfd5bd','#dd8b7d','#f6dc9a'][i%4]);
      }
    }
  }

  function warehouse(c,t) {
    rect(c,0,0,W,H,'#1f283a');
    for(let y=7;y<86;y+=12){
      rect(c,0,y,W,1,'#273244');
      for(let x=(y%24===7?4:20);x<W;x+=31)rect(c,x,y,1,11,'#253144');
    }
    // Rain-streaked loading window and distant low skyline.
    rect(c,10,11,56,42,'#111d2c');rect(c,13,14,50,35,'#50637b');
    polygon(c,[[13,42],[18,39],[23,39],[23,34],[29,34],[29,41],[33,41],[33,32],[37,32],[37,38],[45,38],[45,29],[49,29],[49,39],[53,39],[53,34],[60,34],[63,41],[63,49],[13,49]],'#35485d');
    for(let n=0;n<18;n++){
      const x=15+(n*13)%46,y=16+(n*11+t*18)%28;
      line(c,x,y,x-1,y+3,'#70808d');
    }
    rect(c,35,14,3,35,'#253345');rect(c,13,31,50,3,'#2b394a');rect(c,7,50,62,3,'#45505f');
    // Bare, dusty shelves with pale rectangles where stock used to stand.
    for(const [x,y,w,h] of [[88,28,21,19],[115,31,23,16],[147,29,22,18],[91,61,31,14],[131,60,19,15],[155,62,18,13]]){
      rect(c,x,y,w,h,'#2e394a');rect(c,x+1,y+1,w-2,h-2,'#2b3546');
    }
    for(const x of [79,176]){
      rect(c,x,17,4,72,'#181f2e');rect(c,x+1,17,2,71,'#48505c');
    }
    for(const y of [19,46,75]){
      rect(c,75,y,109,4,'#474958');rect(c,76,y,107,1,'#77716d');rect(c,78,y+4,103,2,'#171f2e');
    }
    // Empty hooks, a hanging inventory tag and its red audit seal.
    rect(c,111,50,1,5,'#66636a');rect(c,110,55,3,1,'#707076');
    rect(c,160,49,1,6,'#766354');rect(c,157,54,8,10,'#a59c83');rect(c,162,59,2,3,'#955f57');
    // Corrugated warehouse shutter and a crooked bureaucratic notice.
    rect(c,211,15,97,75,'#293242');rect(c,215,19,89,66,'#323c4c');
    for(let y=22;y<85;y+=6){rect(c,216,y,87,1,'#46505b');rect(c,216,y+2,86,1,'#283343');}
    rect(c,209,13,101,4,'#4c5461');rect(c,209,17,3,74,'#444d5c');
    rect(c,227,32,16,21,'#272f3e');rect(c,226,30,16,21,'#a99f88');
    rect(c,228,33,11,1,'#655e61');rect(c,228,36,8,1,'#736a68');rect(c,228,40,9,1,'#736a68');
    rect(c,234,43,5,5,'#986359');rect(c,235,44,3,3,'#c19e87');rect(c,236,45,1,1,'#986359');
    // Worn plank floor, receding seams and a small drain for the last coin.
    polygon(c,[[0,84],[320,84],[320,128],[0,128]],'#374152');
    for(const [y,ink] of [[87,'#263443'],[93,'#303d4d'],[102,'#283443'],[116,'#293544']])rect(c,0,y,320,1,ink);
    for(const [x,y,l] of [[18,98,16],[59,112,27],[93,104,13],[130,121,31],[185,116,12],[243,113,19],[278,99,12],[23,124,24]]){
      rect(c,x,y,l,1,'#4c5360');rect(c,x+5,y+1,Math.max(2,l-9),1,'#323b4b');
    }
    for(const x of [8,48,106,167,222,268,306]){
      line(c,x,84,1.3*x-35,127,'#303b4b');
    }
    polygon(c,[[226,114],[248,114],[253,117],[226,118]],'#192a39');
    for(let x=229;x<248;x+=4)line(c,x,114,x+2,117,'#5c6570');
    // A single overhead work lamp casts a deliberately narrow, cold cone of light.
    line(c,158,0,158,10,'#1d2634',2);
    polygon(c,[[153,11],[157,8],[161,8],[166,12],[166,14],[151,14]],'#68717c');
    rect(c,153,14,11,2,'#b7b4a4');
    c.save();c.globalAlpha=.075;
    polygon(c,[[152,16],[165,16],[211,101],[108,101]],'#d0c8a6');c.restore();
  }

  function receipt(c,x,y,slant) {
    c.save();c.translate(snap(x),snap(y));c.rotate(slant);
    polygon(c,[[-6,-9],[6,-9],[6,9],[4,8],[2,9],[0,8],[-2,9],[-4,8],[-6,9]],'#c7bca4');
    rect(c,-4,-6,9,1,'#796d69');rect(c,-4,-3,6,1,'#93816e');rect(c,-4,0,7,1,'#93816e');
    rect(c,0,2,5,5,'#a45e57');rect(c,1,3,3,3,'#d9b4a0');rect(c,2,4,1,1,'#a45e57');
    c.restore();
  }

  function wearyMiner(c,t) {
    const slump=ease(clamp((t-.2)/.62));
    const drop=snap(3*slump);
    crate(c,142,93,27,20,true);
    // Legs and heavy work boots: one flat on the floor, one turned inward.
    polygon(c,[[148,88],[159,88],[162,95],[172,99],[172,110],[167,110],[165,103],[153,101],[147,97]],'#314552');
    polygon(c,[[145,91],[153,95],[147,101],[143,110],[137,109],[139,99]],'#455766');
    polygon(c,[[136,107],[144,108],[145,113],[142,115],[131,115],[131,112]],'#242e3a');
    polygon(c,[[166,108],[173,108],[177,112],[180,113],[180,115],[166,114]],'#232e39');
    rect(c,132,114,13,1,'#8b7a69');rect(c,167,114,12,1,'#807366');
    // Jacket seam, elbow on knee, head weighed down toward the upturned wallet.
    polygon(c,[[145,77+drop],[151,74+drop],[160,77+drop],[165,87+drop],[159,94],[147,95],[141,91]],'#243b49');
    polygon(c,[[146,78+drop],[151,75+drop],[157,78+drop],[160,83+drop],[155,87],[155,92],[145,91]],'#526975');
    rect(c,146,83+drop,2,7,'#71818a');rect(c,148,91,8,2,'#344a58');
    polygon(c,[[157,80+drop],[161,83+drop],[166,89],[172,86],[175,88],[166,96],[162,95],[156,88]],'#66777c');
    polygon(c,[[170,86],[176,84],[179,86],[177,89],[172,90]],'#b09179');
    c.save();c.translate(153+snap(slump*2),75+drop);c.rotate(.12+slump*.13);
    polygon(c,[[-8,-10],[-4,-14],[6,-13],[9,-9],[9,-6],[12,-3],[9,-2],[8,3],[3,6],[-4,3],[-8,-1]],'#795f58');
    polygon(c,[[-5,-10],[5,-11],[7,-8],[7,-4],[10,-3],[7,-2],[7,2],[3,3],[-2,0],[-5,-4]],'#ba9983');
    line(c,3,-5,7,-4,'#5b504e');rect(c,4,0,3,1,'#7b6660');
    rect(c,-9,-10,18,3,'#7f674f');
    polygon(c,[[-8,-10],[-8,-15],[-5,-18],[2,-19],[7,-16],[8,-12],[11,-10]],'#b49560');
    polygon(c,[[-7,-13],[-5,-16],[0,-17],[2,-16],[-2,-15],[-4,-12]],'#d6b67c');
    rect(c,6,-13,6,4,'#596472');rect(c,9,-13,3,3,'#a5b4b3');
    c.restore();
    // Wallet is held open; both pockets show their empty pale lining.
    polygon(c,[[181,83],[187,80],[188,88],[182,91],[177,88],[175,82]],'#5c4c4b');
    polygon(c,[[176,82],[181,84],[181,88],[177,86]],'#ac9780');
    polygon(c,[[182,84],[186,82],[186,87],[182,88]],'#bbab91');
    rect(c,180,89,4,1,'#c4a378');
  }

  function defeat(c,t) {
    warehouse(c,t);
    // The final loaded crate rolls through the shutter before the till is empty.
    if(t<.36){
      const x=mix(248,337,ease(t/.36));
      crate(c,snap(x),79,24,16,true);rect(c,x-2,95,28,2,'#505a66');
      for(const dx of [3,18])disc(c,x+dx,98,3,'#242e3c');
    }
    for(let x=0;x<122;x+=9)rect(c,x,101,4,3,'#5c5559');
    rect(c,0,101,128,1,'#8c9093');rect(c,0,104,119,1,'#6c737e');
    mineCart(c,61,101,1.7,true);
    // Loose empty crate on its side, including its dark open end.
    polygon(c,[[261,85],[281,85],[293,91],[293,106],[270,108],[259,101]],'#766d66');
    polygon(c,[[262,87],[279,87],[286,91],[272,93]],'#948477');
    polygon(c,[[272,95],[289,93],[289,103],[272,105]],'#272f3a');
    rect(c,263,91,2,8,'#a18f79');rect(c,271,104,19,2,'#857365');
    wearyMiner(c,t);
    const fly=ease(clamp((t-.05)/.72));
    receipt(c,mix(230,203,fly)+Math.sin(fly*Math.PI*2)*6,mix(49,109,fly),mix(-.15,.40,fly));
    if(t<.12)receipt(c,197,95,.18);
    else receipt(c,195+Math.sin(t*3)*2,98+ease(clamp((t-.12)/.45))*15,-.53);
    if(t>.18 && t<.79){
      const phase=(t-.18)/.61;
      const x=mix(180,238,phase),y=92+20*phase-Math.sin(phase*Math.PI*2)*4;
      rect(c,x,y,phase>.28?2:3,4,'#bf9c63');rect(c,x,y,1,2,'#e5c789');
    }
    if(t>.78 && t<.93)sparkle(c,238,114,1,'#b9b5a1');
    // A low desk drawer is open in the shaded foreground.
    rect(c,0,115,20,13,'#282e3b');rect(c,0,115,23,3,'#655b59');
    rect(c,0,122,15,5,'#1c2734');rect(c,2,126,13,2,'#635956');
  }

  function draw(canvas,outcome,progress) {
    if(canvas.width!==W)canvas.width=W;if(canvas.height!==H)canvas.height=H;
    const c=canvas.getContext('2d'),t=clamp(Number.isFinite(progress)?progress:0);
    c.save();c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=false;
    if(outcome==='win')victory(c,t);else defeat(c,t);
    c.restore();
  }
  window.MineFinaleArt={draw};
})();

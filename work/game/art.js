/* Original canvas pixel artwork for the return railway. */
(() => {
  "use strict";
  const TILE = 40, COLS = 8, ROWS = 7;
  const W = COLS * TILE, H = ROWS * TILE;
  const groundPalettes = [
    ["#202a32","#202831","#222c34","#212a32"],
    ["#2a2731","#292631","#2b2934","#292832"],
    ["#212638","#212439","#24283c","#222638"]
  ];
  const rockPalettes = [
    ["#454c59","#4b505e","#414a55","#444d5a"],
    ["#514955","#564c57","#4a454f","#514954"],
    ["#484a64","#4c4e68","#44495f","#494b65"]
  ];

  function box(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  // Integer scanlines keep every diagonal edge crisp at mobile pixel scales.
  function face(ctx, points, color) {
    const lower = Math.ceil(Math.min(...points.map(p => p[1])));
    const upper = Math.ceil(Math.max(...points.map(p => p[1])));
    ctx.fillStyle = color;
    for (let y = lower; y < upper; y++) {
      const scan = y + 0.5;
      const cuts = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] > scan) !== (b[1] > scan)) {
          cuts.push(a[0] + (b[0] - a[0]) * (scan - a[1]) / (b[1] - a[1]));
        }
      }
      cuts.sort((a, b) => a - b);
      for (let i = 0; i < cuts.length; i += 2) {
        const l = Math.round(cuts[i]), r = Math.round(cuts[i + 1]);
        if (r > l) ctx.fillRect(l, y, r - l, 1);
      }
    }
  }

  function seedAt(x, y, salt = 0) {
    let n = Math.imul(x + 47, 73856093) ^ Math.imul(y + 179, 19349663) ^ Math.imul(salt + 5, 83492791);
    n ^= n >>> 15;
    return (Math.imul(n, 2246822519) >>> 0);
  }

  function floor(ctx, x, y, zone) {
    const bx = x * TILE, by = y * TILE, seed = seedAt(x, y);
    box(ctx, bx, by, TILE, TILE, groundPalettes[zone][seed % 4]);
    // Layer low-contrast flakes on the cave floor without competing with ore.
    ctx.save();
    ctx.translate(bx, by);
    face(ctx, [[1,12],[7,8],[16,8],[12,11],[6,12]], "#272e3b");
    for (let i = 0; i < 11; i++) {
      const r = seedAt(x, y, i + 1), px = 2 + r % 35, py = 3 + (r >>> 10) % 33;
      const colors = ["#29303b", "#1b2330", "#2e3340", "#252d38"];
      box(ctx, px, py, 1 + ((r >>> 20) % 3), 1, colors[i % 4]);
      if (i === 2 || i === 7) {
        box(ctx, px - 1, py + 1, 3, 1, "#1a212c");
        box(ctx, px, py - 1, 2, 1, "#353a47");
      }
    }
    // A tiny survey mark helps the player read the grid without a heavy border.
    box(ctx, 0, 0, 3, 1, "#343b48");
    box(ctx, 0, 1, 1, 2, "#343b48");
    ctx.restore();
  }

  function rock(ctx, bx, by, width, height, variation, zone) {
    ctx.save();
    ctx.translate(bx, by);
    const w = width, h = height;
    face(ctx, [[2,7],[6,2],[w-8,0],[w-2,4],[w,9],[w-1,h-3],[w-6,h],[5,h],[0,h-5]], "#151c2b");
    face(ctx, [[1,8],[6,3],[w-9,1],[w-3,5],[w-1,9],[w-5,h-4],[6,h-2],[1,h-6]], "#303347");
    face(ctx, [[2,7],[7,3],[w-9,1],[w-3,5],[w-4,h-9],[w-9,h-6],[6,h-5],[2,h-8]], rockPalettes[zone][variation % 4]);
    face(ctx, [[3,7],[7,3],[w-9,1],[w-5,3],[w-11,3],[9,5],[6,7]], "#66647a");
    face(ctx, [[w-4,6],[w-1,9],[w-4,h-4],[w-9,h-1],[w-9,h-6],[w-5,h-9]], "#36394f");
    box(ctx, 5, h-6, Math.max(2, w-15), 1, "#535368");
    if (w > 18) {
      face(ctx, [[8,7],[15,5],[19,6],[14,7],[11,9]], "#515468");
      box(ctx, 9, h-3, 4, 1, "#252c3e");
    }
    ctx.restore();
  }

  function wall(ctx, x, y, zone) {
    const bx = x*TILE, by = y*TILE, s = seedAt(x, y);
    ctx.save(); ctx.translate(bx, by);
    face(ctx, [[0,10],[6,3],[21,0],[33,2],[39,9],[40,33],[35,39],[2,39],[0,34]], "#161d2b");
    if ((s & 1) === 0) {
      rock(ctx, 0, 2, 26, 22, s, zone);
      rock(ctx, 24, 5, 16, 18, s + 2, zone);
      rock(ctx, 2, 21, 17, 16, s + 1, zone);
      rock(ctx, 17, 18, 22, 20, s, zone);
    } else {
      rock(ctx, 2, 5, 17, 19, s, zone);
      rock(ctx, 15, 1, 24, 22, s + 1, zone);
      rock(ctx, 0, 20, 26, 18, s + 3, zone);
      rock(ctx, 24, 21, 15, 15, s + 2, zone);
    }
    // These tiny inclusions sit on the face of blocked rocks, keeping the
    // biome character distinct from collectible ore in a walkable corridor.
    if(seedAt(x,y,29)%4===0) {
      if(zone===0) {
        box(ctx,6,8,5,2,"#565f59");box(ctx,10,7,6,2,"#697462");
        box(ctx,13,9,2,2,"#54645b");box(ctx,9,10,1,2,"#647365");
      } else if(zone===1) {
        face(ctx,[[4,15],[10,11],[15,11],[19,8],[17,11],[12,13],[9,13]],"#896854");
        box(ctx,14,11,2,1,"#a77c59");box(ctx,6,16,4,1,"#705949");
      } else {
        box(ctx,8,12,4,1,"#6c7789");box(ctx,12,10,2,2,"#70869b");
        box(ctx,14,10,3,1,"#66778f");box(ctx,16,9,2,1,"#78799d");
      }
    }
    ctx.restore();
  }

  function copperChunk(ctx,x,y,size,alt) {
    ctx.save(); ctx.translate(x,y); ctx.scale(size,size);
    const top = alt ? "#ffd78c" : "#f6bd74";
    const mid = alt ? "#cf9055" : "#d18452";
    face(ctx, [[0,4],[3,1],[7,0],[11,3],[10,8],[7,10],[2,9],[0,7]], "#493143");
    face(ctx, [[1,4],[4,1],[7,1],[10,3],[8,5],[4,6]], top);
    face(ctx, [[1,4],[4,6],[8,5],[7,9],[2,8]], mid);
    face(ctx, [[8,5],[10,3],[10,7],[7,10],[7,8]], "#9b5d45");
    box(ctx, 3, 3, 3, 1, "#ffe5a9");
    ctx.restore();
  }

  function crystalBlade(ctx,x,y,w,h,lean,light) {
    ctx.save(); ctx.translate(x,y);
    face(ctx, [[0,-2],[lean-1,-h+4],[lean+2,-h],[lean+w-1,-h+4],[w+1,-4],[w-2,1],[2,1]], "#1c455c");
    face(ctx, [[1,-3],[lean,-h+4],[lean+2,-h+1],[lean+w-2,-h+4],[w,-5],[w-2,-1],[2,-1]], light ? "#7ad5d4" : "#49a6bc");
    face(ctx, [[lean+2,-h+1],[lean+w-2,-h+4],[w,-5],[w-2,-1],[w-3,-4]], light ? "#529eb8" : "#34748e");
    face(ctx, [[1,-4],[lean,-h+4],[lean+2,-h+1],[lean+2,-h+5],[3,-4]], light ? "#d2f7e7" : "#a8ece1");
    ctx.restore();
  }

  function oreLevel(value) {
    return value === 3 ? 3 : value === 2 ? 2 : 1;
  }

  const gradeDigits = {
    2: ["01110","10001","00001","00010","00100","01000","11111"],
    3: ["11110","00001","00001","01110","00001","00001","11110"]
  };
  function quantityLabel(ctx, left, top, amount, tint) {
    const rows = gradeDigits[amount];
    if (!rows) return;
    box(ctx,left-2,top-1,9,9,"#141e28");
    rows.forEach((row,y) => {
      for (let x=0; x<row.length; x++) {
        if (row[x]==="1") box(ctx,left+x,top+y,1,1,tint);
      }
    });
  }

  function oreSilhouette(ctx, type, amount, variant) {
    const copper=type==="copper";
    if (amount===1) {
      if (copper) copperChunk(ctx,13,17,1.35,true);
      else crystalBlade(ctx,16,29,8,17,1,true);
      return;
    }
    if (amount===2) {
      if (copper) {
        copperChunk(ctx,8,17,1.15,false);
        copperChunk(ctx,20,12,1.35,true);
      } else {
        crystalBlade(ctx,12,29,7,17,-3,false);
        crystalBlade(ctx,20,27,8,21,3,true);
      }
      return;
    }
    if (copper) {
      copperChunk(ctx,12,9,1.25,false);
      copperChunk(ctx,19,5,1.1,true);
      copperChunk(ctx,4,18,1.3,false);
      copperChunk(ctx,15,13,1.5,true);
      copperChunk(ctx,25,20,1.05,(variant & 8)===8);
      copperChunk(ctx,13,24,0.86,false);
      box(ctx,7,29,3,1,"#c48760");
    } else {
      crystalBlade(ctx,9,27,6,14+variant%3,-5,false);
      crystalBlade(ctx,14,27,6,21,-3,true);
      crystalBlade(ctx,19,26,7,25,3,true);
      crystalBlade(ctx,25,29,6,17,6,false);
      crystalBlade(ctx,15,30,5,11,-2,true);
      box(ctx,8,31,3,1,"#5693aa");
    }
  }

  function ore(ctx, x, y, type, spent, amount) {
    ctx.save(); ctx.translate(x*TILE,y*TILE);
    const copper = type === "copper";
    const variant=seedAt(x,y,14);
    ctx.save();
    if ((variant & 1)===1) { ctx.translate(TILE,0); ctx.scale(-1,1); }
    if ((variant & 4)===4) ctx.translate(1,-1);
    const baseColor = spent ? "#303543" : copper ? "#65505a" : "#354b60";
    if(amount===3) {
      box(ctx,6,32,28,3,"#171f2a");
      face(ctx,[[2,24],[7,18],[14,18],[20,12],[29,15],[35,21],[38,29],[34,33],[24,35],[9,32],[3,29]],"#242939");
      face(ctx,[[3,24],[8,19],[16,19],[21,14],[29,17],[35,24],[33,28],[25,31],[11,30],[4,28]],baseColor);
    } else if(amount===2) {
      box(ctx,7,30,26,3,"#171f2a");
      face(ctx,[[5,24],[12,19],[23,18],[31,21],[35,27],[30,31],[19,33],[8,30]],"#242939");
      face(ctx,[[6,24],[14,20],[23,20],[31,23],[32,27],[25,30],[10,28]],baseColor);
    } else {
      box(ctx,11,29,18,2,"#171f2a");
      face(ctx,[[9,26],[14,22],[22,20],[28,23],[31,27],[27,30],[15,31],[10,29]],"#242939");
      face(ctx,[[10,26],[17,22],[25,23],[29,26],[26,28],[14,29]],baseColor);
    }
    if(spent) {
      box(ctx,16,26,3,1,copper?"#876657":"#4c747e");
      box(ctx,23,24,2,1,copper?"#876657":"#4c747e");
    } else {
      oreSilhouette(ctx,type,amount,variant);
    }
    ctx.restore();
    if(!spent && amount>1) {
      quantityLabel(ctx,4,4,amount,copper?"#f2b980":"#9ad9df");
    }
    ctx.restore();
  }

  function lantern(ctx,x,y,time) {
    box(ctx,x-2,y-6,4,2,"#544033");
    box(ctx,x-4,y-4,8,2,"#e7aa54");
    box(ctx,x-4,y-2,8,7,"#654a40");
    box(ctx,x-3,y-2,6,6,"#f5a455");
    box(ctx,x-1,y-1,3,4,Math.sin(time/250) > 0.6 ? "#fff5bf" : "#ffe098");
    box(ctx,x-4,y+4,8,2,"#825c40");
  }

  function station(ctx, pt, express) {
    const x = pt.x*TILE, y = pt.y*TILE;
    ctx.save(); ctx.translate(x,y);
    face(ctx, [[0,4],[6,2],[24,2],[31,6],[35,11],[35,33],[31,36],[0,36]], "#111924");
    face(ctx, [[0,8],[9,5],[23,5],[29,9],[31,13],[31,32],[0,32]], "#131b26");
    face(ctx, [[0,27],[30,27],[35,32],[35,36],[0,36]], "#473e3b");
    box(ctx, 0, 31, 34, 2, "#877058");
    box(ctx, 2, 7, 5, 23, "#714b3c"); box(ctx, 3, 8, 2, 21, "#a37552");
    box(ctx, 27, 7, 5, 25, "#56403a"); box(ctx, 27, 8, 2, 22, "#8d674e");
    box(ctx, 1, 4, 31, 5, "#87634b"); box(ctx, 3, 4, 26, 1, "#c19567");
    box(ctx, 5, 6, 1, 1, "#342f31"); box(ctx, 27, 6, 1, 1, "#342f31");
    box(ctx, 5, 11, 1, 6, "#70513f");
    lantern(ctx,8,16,0);
    if(express){
      // The pennant is mounted above the right post, clear of the track bed.
      box(ctx,33,2,2,14,"#624c3e");
      box(ctx,33,1,1,12,"#f1be75");
      face(ctx,[[33,2],[30,2],[27,3],[20,2],[23,5],[20,8],[27,9],[30,7],[33,7]],"#b45f4b");
      face(ctx,[[33,2],[29,3],[27,4],[22,3],[23,5],[28,6],[31,4],[33,4]],"#ea9b61");
      box(ctx,32,0,3,2,"#f9d391");
    }
    ctx.restore();
  }

  const pos = p => ({x:p.x*TILE+20,y:p.y*TILE+21});
  function appendLine(result,a,b) {
    const dx=b.x-a.x, dy=b.y-a.y, steps=Math.ceil(Math.hypot(dx,dy));
    for (let i=1;i<=steps;i++) {
      const t=i/steps;
      result.push({x:a.x+dx*t,y:a.y+dy*t});
    }
  }
  function railPoints(path) {
    const pts=path.map(pos), samples=[];
    if (pts.length<2) return samples;
    samples.push(pts[0]);
    for(let i=1;i<pts.length-1;i++){
      const a=pts[i-1],b=pts[i],c=pts[i+1];
      const inx=(b.x-a.x)/TILE,iny=(b.y-a.y)/TILE;
      const outx=(c.x-b.x)/TILE,outy=(c.y-b.y)/TILE;
      if (inx===outx && iny===outy) { appendLine(samples,samples[samples.length-1],b); continue; }
      const p={x:b.x-8*inx,y:b.y-8*iny},q={x:b.x+8*outx,y:b.y+8*outy};
      appendLine(samples,samples[samples.length-1],p);
      for(let j=1;j<=14;j++){
        const t=j/14,s=1-t;
        samples.push({x:s*s*p.x+2*t*s*b.x+t*t*q.x,y:s*s*p.y+2*t*s*b.y+t*t*q.y});
      }
    }
    appendLine(samples,samples[samples.length-1],pts[pts.length-1]);
    return samples;
  }
  function rail(ctx, path) {
    const points=railPoints(path);
    if(!points.length)return;
    const normals=points.map((p,i)=>{
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const len=Math.hypot(b.x-a.x,b.y-a.y)||1;
      return {x:(b.y-a.y)/len,y:(a.x-b.x)/len};
    });
    for(let i=0;i<points.length;i+=7) {
      const p=points[i],n=normals[i];
      for(let t=-8;t<=8;t++)box(ctx,p.x+n.x*t-1,p.y+n.y*t,3,3,"#151c27");
      for(let t=-8;t<=8;t++)box(ctx,p.x+n.x*t-1,p.y+n.y*t-1,3,2,"#8c6b53");
    }
    for(const side of [-1,1]) {
      for(let i=0;i<points.length;i++){
        const p=points[i],n=normals[i],x=p.x+n.x*5*side,y=p.y+n.y*5*side;
        box(ctx,x-1,y,3,3,"#293641");
      }
      for(let i=0;i<points.length;i++){
        const p=points[i],n=normals[i],x=p.x+n.x*5*side,y=p.y+n.y*5*side;
        box(ctx,x-1,y-1,2,2,"#a0a4a4");
      }
    }
  }

  function marker(ctx,p,now) {
    const x=p.x*TILE,y=p.y*TILE;
    const pulse=Math.sin(now/450+p.x*0.09+p.y*0.13)>.5;
    box(ctx,x+3,y+3,34,34,"rgba(112,202,158,0.07)");
    const color=pulse?"#698b7c":"#506f68";
    for(const [cx,cy,dx,dy] of [[4,4,1,1],[35,4,-1,1],[4,35,1,-1],[35,35,-1,-1]]) {
      box(ctx,x+cx+(dx<0?-4:0),y+cy,5,1,color);
      box(ctx,x+cx,y+cy+(dy<0?-4:0),1,5,color);
    }
    box(ctx,x+18,y+20,5,1,"#69877a"); box(ctx,x+20,y+18,1,5,"#69877a");
  }

  function markedOre(ctx,p,type) {
    const left=p.x*TILE,top=p.y*TILE;
    const copper=type==="copper";
    // A mineral-coloured bracket hugs the base, distinct from the four green
    // corners around a square that can receive the next rail.
    const rim=copper?"#dc9d62":"#7ebec5", dim=copper?"#725849":"#425f70";
    box(ctx,left+6,top+32,2,2,dim); box(ctx,left+8,top+34,5,1,rim);
    box(ctx,left+13,top+35,14,1,rim); box(ctx,left+27,top+34,5,1,rim);
    box(ctx,left+32,top+32,2,2,dim);
    // An etched tick on its own rivet signals that this vein is in the cargo plan.
    box(ctx,left+29,top+3,8,7,"#19242c");
    box(ctx,left+29,top+2,8,1,dim);box(ctx,left+29,top+10,8,1,dim);
    box(ctx,left+30,top+6,1,1,rim); box(ctx,left+31,top+7,2,1,rim);
    box(ctx,left+33,top+6,1,1,rim); box(ctx,left+34,top+5,1,1,rim);
    box(ctx,left+35,top+4,1,1,rim);
  }

  const surveyColors = {
    copper: {rim:"#f4bd73", light:"#ffebaf", dim:"#997344", ink:"#342a25"},
    crystal: {rim:"#8be0dc", light:"#d5fff4", dim:"#538b91", ink:"#1c313a"}
  };

  function inspectedOre(ctx, pick, tiles) {
    const color=surveyColors[tiles[pick.y]?.[pick.x]];
    if (!color) return;
    for (const p of pick.approaches || []) {
      if (tiles[p.y]?.[p.x]!=="floor") continue;
      const dx=Math.sign(pick.x-p.x), dy=Math.sign(pick.y-p.y);
      // Set each stud on the side facing the vein. Leave the centre for rails
      // and the lower-right corner for a broken tile's two-rail price.
      const cx=p.x*TILE+20+dx*(dy?12:14), cy=p.y*TILE+20+dy*(dx?5:14);
      box(ctx,cx-2,cy-3,5,7,"#17252b"); box(ctx,cx-3,cy-2,7,5,"#17252b");
      box(ctx,cx-1,cy-2,3,5,color.dim); box(ctx,cx-2,cy-1,5,3,color.rim);
      box(ctx,cx-1,cy-1,3,2,color.light); box(ctx,cx,cy+1,1,1,color.rim);
      box(ctx,cx+dx*4,cy+dy*4,1,1,color.rim);
    }
    // Corners occupy the tile border, outside both the grade and cargo ticks.
    const left=pick.x*TILE, top=pick.y*TILE;
    for (const [ox,oy,dx,dy] of [[0,0,1,1],[39,0,-1,1],[0,39,1,-1],[39,39,-1,-1]]) {
      const x=left+ox, y=top+oy;
      box(ctx,x+(dx<0?-7:0),y+(dy<0?-1:0),8,2,color.rim);
      box(ctx,x+(dx<0?-1:0),y+(dy<0?-7:0),2,8,color.rim);
      box(ctx,x+(dx<0?-2:0),y+(dy<0?-2:0),3,3,color.light);
    }
  }

  const gainOne=["00100","01100","00100","00100","00100","00100","01110"];
  function oreGains(ctx, pulse, tiles) {
    const t=pulse.progress;
    if (!Number.isFinite(t) || t<0 || t>=1) return;
    ctx.save();
    if (t>.72) ctx.globalAlpha*=(1-t)/.28;
    for (const p of pulse.ores || []) {
      const color=surveyColors[tiles[p.y]?.[p.x]];
      if (!color) continue;
      const left=p.x*TILE+12, top=p.y*TILE+11-Math.round(9*t);
      if (t<.58) {
        const drift=Math.round(3*t/.58);
        sparkle(ctx,left-3-drift,top+12,1,color.rim);
        sparkle(ctx,left+17+drift,top+5,1,color.light);
      }
      box(ctx,left+1,top,14,11,color.ink); box(ctx,left,top+1,16,9,color.ink);
      box(ctx,left+2,top,12,1,color.dim);
      box(ctx,left+2,top+5,5,1,color.rim); box(ctx,left+4,top+3,1,5,color.rim);
      const digit=gradeDigits[oreLevel(p.amount)] || gainOne;
      for (let y=0;y<digit.length;y++) for (let x=0;x<digit[y].length;x++) {
        if (digit[y][x]==="1") box(ctx,left+9+x,top+2+y,1,1,color.light);
      }
    }
    ctx.restore();
  }

  // All carriage bodies use the same axle origin. Their surrounding space is
  // 40×32 pixels, including equipment such as the crane's hook and dragon tail.
  function axle(ctx,x,y,r,spin,rim) {
    const shape=[[x-r+1,y-r+1],[x-1,y-r],[x+2,y-r],[x+r,y-2],[x+r,y+1],
      [x+r-2,y+r],[x-2,y+r],[x-r,y+1],[x-r,y-1]];
    face(ctx,shape,"#1e2935");
    box(ctx,x-r+2,y-1,2*r-3,3,rim);
    box(ctx,x-1,y-r+1,2,2*r-2,rim);
    box(ctx,x,y,1,1,"#e0d4ad");
    if(r>3)box(ctx,x+Math.round(Math.cos(spin)*2),y+Math.round(Math.sin(spin)*2),1,1,"#485764");
  }

  function roundCab(ctx,spin) {
    axle(ctx,-9,6,4,spin,"#a5b9b1");axle(ctx,9,6,4,spin,"#a5b9b1");
    face(ctx,[[-14,2],[-11,-2],[12,-2],[15,1],[12,6],[-11,6]],"#3f635f");
    box(ctx,-11,3,23,2,"#87b8a3");
    // Polished spherical pressure cabin on a shallow rolling platform.
    face(ctx,[[-12,-3],[-11,-10],[-7,-15],[-3,-17],[4,-17],[9,-14],[12,-8],[12,-2],[8,2],[-7,2]],"#345a59");
    face(ctx,[[-11,-5],[-9,-11],[-6,-14],[-2,-16],[4,-16],[8,-13],[11,-8],[11,-3],[7,0],[-7,0]],"#74aa96");
    face(ctx,[[-10,-8],[-7,-13],[-2,-15],[3,-15],[0,-13],[-4,-12],[-7,-8]],"#bedbc0");
    face(ctx,[[-7,-7],[-5,-11],[-1,-13],[4,-12],[7,-9],[7,-5],[4,-2],[-3,-2],[-6,-4]],"#415b60");
    face(ctx,[[-5,-7],[-3,-10],[0,-11],[4,-10],[5,-8],[4,-5],[2,-4],[-3,-4]],"#75b8b7");
    box(ctx,-3,-9,3,2,"#c2e9d2");box(ctx,1,-6,3,1,"#52949c");
    box(ctx,-2,-18,5,2,"#d1c18c");box(ctx,-1,-19,3,1,"#f6d797");
    box(ctx,11,-5,4,4,"#596b5e");box(ctx,12,-5,3,2,"#ffdf94");
    box(ctx,-9,0,3,1,"#c5d4b7");box(ctx,5,0,3,1,"#c5d4b7");
  }

  function craneCart(ctx,spin) {
    axle(ctx,-10,6,4,spin,"#ab9990");axle(ctx,8,6,4,spin,"#ab9990");
    box(ctx,-15,0,28,4,"#873f3b");box(ctx,-15,0,28,1,"#e99c6c");
    face(ctx,[[-15,0],[-15,-6],[-12,-11],[-7,-12],[-3,-9],[-3,0]],"#af5b48");
    face(ctx,[[-12,-6],[-10,-9],[-6,-9],[-5,-6],[-5,-4],[-12,-4]],"#98c1ba");
    box(ctx,-14,-4,3,3,"#d98962");box(ctx,-4,-3,1,2,"#f4c088");
    box(ctx,0,-7,8,7,"#bb6752");box(ctx,1,-6,6,3,"#794a44");box(ctx,1,-1,8,1,"#df996b");
    // Open triangular lattice boom, hanging line, and steel J-hook.
    face(ctx,[[-1,-6],[1,-10],[13,-20],[16,-19],[14,-16],[3,-5]],"#8c4b40");
    face(ctx,[[0,-8],[12,-19],[14,-19],[1,-6]],"#e39767");
    face(ctx,[[2,-7],[12,-16],[13,-16],[3,-6]],"#d67a54");
    for(const [x,y] of [[4,-11],[7,-13],[10,-16]])box(ctx,x,y,2,3,"#c17957");
    box(ctx,13,-19,3,3,"#b9a17a");box(ctx,14,-18,1,11,"#a4a7a1");
    box(ctx,13,-7,3,2,"#7d8c92");box(ctx,15,-5,1,2,"#aab5b2");box(ctx,12,-4,3,1,"#c5c6b7");
    box(ctx,12,-5,1,1,"#b8c6c0");box(ctx,10,0,3,2,"#ffe0a0");
  }

  function drillCart(ctx,spin) {
    // Continuous tracks and separate overlapping scales produce a low wedge.
    face(ctx,[[-17,1],[-13,-1],[9,-1],[13,2],[12,6],[9,9],[-13,9],[-17,6]],"#243a39");
    box(ctx,-13,6,22,2,"#52796b");
    for(const wx of [-11,-5,1,7])axle(ctx,wx,4,3,spin,"#748f78");
    face(ctx,[[-16,0],[-15,-6],[-11,-11],[-5,-15],[1,-15],[7,-12],[11,-6],[13,-1],[9,2],[-12,2]],"#284f46");
    const scales=[
      [[-16,-2],[-14,-9],[-10,-12],[-9,-10],[-12,-3]],
      [[-11,-3],[-9,-12],[-5,-15],[-2,-15],[-4,-11],[-7,-3]],
      [[-6,-3],[-2,-13],[1,-14],[5,-12],[1,-8],[-2,-3]],
      [[0,-3],[4,-10],[7,-9],[10,-5],[6,-4],[4,-2]]
    ];
    scales.forEach((points,i)=>{
      face(ctx,points,["#467d67","#639781","#4c8974","#3f7667"][i]);
      const top=points[2];box(ctx,top[0]-1,top[1],3,1,"#a0c5a1");
    });
    box(ctx,5,-4,5,2,"#b7dfb1");box(ctx,9,-4,2,1,"#f6e5a7");
    face(ctx,[[10,-6],[13,-6],[19,-2],[19,0],[13,2],[10,2]],"#a1b0a1");
    face(ctx,[[11,-5],[14,-4],[18,-2],[14,-2],[11,-1]],"#d5d9b7");
    face(ctx,[[12,-6],[14,-5],[12,1],[10,1]],"#506c69");
    face(ctx,[[15,-4],[16,-3],[14,1],[13,1]],"#69847a");
    box(ctx,-14,0,21,1,"#367266");
  }

  function steamPost(ctx,spin,moving) {
    // Tall cab, separate boiler and narrow chimney make the locomotive silhouette.
    axle(ctx,-10,6,4,spin,"#a599b7");axle(ctx,2,5,5,spin,"#b4a4bc");axle(ctx,12,6,3,spin,"#ac9db5");
    box(ctx,-16,0,31,3,"#55405f");box(ctx,-15,0,30,1,"#d4b886");
    box(ctx,-14,-13,12,13,"#665081");box(ctx,-15,-15,14,3,"#524364");
    face(ctx,[[-17,-15],[-16,-17],[-4,-17],[0,-15],[-1,-14],[-17,-14]],"#b29cba");
    box(ctx,-12,-12,8,5,"#3b4b64");box(ctx,-11,-12,6,3,"#a1bac3");
    box(ctx,-8,-12,1,5,"#655375");
    // Cream envelope on the cab door.
    box(ctx,-12,-5,7,4,"#ddccae");box(ctx,-11,-5,1,1,"#927385");box(ctx,-10,-4,3,1,"#927385");box(ctx,-7,-5,1,1,"#927385");
    face(ctx,[[-2,-7],[1,-9],[11,-9],[14,-7],[14,-2],[11,0],[-2,0]],"#765989");
    box(ctx,0,-8,11,2,"#aa84a9");box(ctx,7,-9,2,9,"#cba876");box(ctx,14,-6,2,3,"#ffdda1");
    box(ctx,9,-16,4,8,"#51455f");box(ctx,8,-18,6,3,"#826887");box(ctx,8,-18,6,1,"#dcc29c");
    box(ctx,10,-15,1,7,"#aa8a99");box(ctx,0,-12,4,4,"#b7a176");
    face(ctx,[[12,1],[15,1],[18,4],[13,4]],"#8b7794");
    box(ctx,-10,5+Math.round(Math.sin(spin)),13,1,"#cbb798");
    if(moving){box(ctx,9,-20,3,1,"#94919a");box(ctx,5,-21,3,1,"#737584");}
  }

  function dragonCart(ctx,spin) {
    axle(ctx,-9,6,4,spin,"#bc975a");axle(ctx,8,6,4,spin,"#bc975a");
    face(ctx,[[-15,0],[-11,-2],[10,-2],[15,0],[10,4],[-10,4]],"#9a743d");
    box(ctx,-11,1,22,2,"#e4bb69");box(ctx,-8,3,16,1,"#584c38");
    // Raised articulated tail, crowned ceremonial canopy and dragon's neck.
    face(ctx,[[-9,1],[-14,-2],[-17,-6],[-18,-11],[-16,-16],[-15,-12],[-12,-16],[-14,-8],[-13,-5],[-9,-5]],"#c5964d");
    box(ctx,-16,-9,2,4,"#f2c771");box(ctx,-12,-3,3,1,"#88bc83");
    box(ctx,-9,-10,15,9,"#873f40");box(ctx,-8,-8,12,5,"#b25e45");
    box(ctx,-8,-11,2,11,"#e4b76e");box(ctx,4,-11,2,10,"#e4b76e");
    face(ctx,[[-12,-10],[-10,-12],[-7,-12],[-7,-14],[-2,-15],[3,-14],[5,-12],[9,-12],[9,-10]],"#c59752");
    box(ctx,-9,-11,16,1,"#f3cd7b");box(ctx,-3,-16,3,2,"#76ba86");
    box(ctx,-6,-7,3,6,"#663e41");box(ctx,0,-7,2,6,"#65383c");
    face(ctx,[[5,0],[7,-6],[6,-12],[9,-16],[13,-16],[15,-13],[18,-13],[19,-11],[18,-8],[14,-8],[11,-9],[11,-6],[13,-3],[11,1]],"#ad7e3e");
    face(ctx,[[7,-11],[8,-15],[12,-15],[14,-12],[18,-12],[18,-10],[14,-9],[11,-11],[10,-7],[9,-4]],"#efc574");
    face(ctx,[[8,-14],[6,-17],[6,-20],[8,-19],[9,-16],[11,-17],[12,-20],[14,-21],[13,-17],[12,-15]],"#e1bd78");
    box(ctx,11,-14,3,2,"#263e39");box(ctx,12,-14,1,1,"#e5e1ac");
    box(ctx,15,-11,3,1,"#f9e1a2");box(ctx,17,-12,1,1,"#684c38");
    box(ctx,14,-8,2,3,"#cd674e");box(ctx,15,-6,2,1,"#cd674e");
    box(ctx,-1,-2,3,2,"#75c894");box(ctx,12,-5,2,2,"#ffdf99");
  }

  const vehicleBodies={celadon:roundCab,cinnabar:craneCart,inkjade:drillCart,nightmail:steamPost,gilt:dragonCart};

  function cart(ctx,x,y,t,moving,dir,paint) {
    ctx.save(); ctx.translate(Math.round(x),Math.round(y));
    const bob=moving&&Math.floor(t/95)%2 ? -1:0;
    box(ctx,-12,9,25,3,"#151c25");
    ctx.translate(0,bob);
    if(Object.prototype.hasOwnProperty.call(vehicleBodies,paint)){
      if(dir==="left")ctx.scale(-1,1);
      vehicleBodies[paint](ctx,moving?t/110:0,moving);
      ctx.restore();
      return;
    }
    box(ctx,-9,5,5,6,"#19232d"); box(ctx,5,5,5,6,"#19232d");
    box(ctx,-8,6,3,3,"#a9a7a0"); box(ctx,6,6,3,3,"#a9a7a0");
    box(ctx,-6,5,14,3,"#373b40");
    face(ctx,[[-13,-7],[-10,-11],[9,-11],[13,-7],[11,3],[7,6],[-8,6],[-12,2]],"#252a33");
    face(ctx,[[-11,-6],[11,-6],[9,2],[6,4],[-7,4],[-10,1]],"#d48b48");
    face(ctx,[[-11,-6],[-7,-5],[-5,3],[-8,3],[-10,1]],"#9f6949");
    face(ctx,[[6,-6],[11,-6],[9,2],[6,4],[3,4]],"#a46b46");
    box(ctx,-12,-7,25,3,"#f9c36c");
    face(ctx,[[-10,-8],[-8,-10],[8,-10],[11,-8]],"#e0a75a");
    face(ctx,[[-7,-8],[-6,-10],[6,-10],[8,-8]],"#714d41");
    box(ctx,-5,-12,10,4,"#3a424a");
    box(ctx,-3,-13,5,2,"#76818a");
    box(ctx,-9,-2,2,2,"#ffe0a0"); box(ctx,7,-2,2,2,"#eac181");
    box(ctx,-4,0,7,1,"#f8b760"); box(ctx,-3,2,5,1,"#b57640");
    const lampX=dir==="left"?-11:10;
    box(ctx,lampX,-6,4,7,"#815b3e"); box(ctx,lampX+1,-5,2,4,"#fff0aa");
    ctx.restore();
  }

  const vehicleSprites=new Map();
  function vehicleSprite(id) {
    // Rasterise first. Fractional size garage thumbnails keep the crisp silhouette.
    const key=Object.prototype.hasOwnProperty.call(vehicleBodies,id)?id:"standard";
    if(!vehicleSprites.has(key)){
      const canvas=typeof OffscreenCanvas==="function"?new OffscreenCanvas(40,32):document.createElement("canvas");
      canvas.width=40;canvas.height=32;
      cart(canvas.getContext("2d"),20,21,0,false,"right",key);
      vehicleSprites.set(key,canvas);
    }
    return vehicleSprites.get(key);
  }

  function drawVehicle(ctx,id,width=ctx.canvas.width,height=ctx.canvas.height) {
    ctx.save();ctx.clearRect(0,0,width,height);
    ctx.imageSmoothingEnabled=false;
    const scale=Math.min(width/40,height/32),w=40*scale,h=32*scale;
    ctx.drawImage(vehicleSprite(id),Math.round((width-w)/2),Math.round((height-h)/2),w,h);
    ctx.restore();
  }

  function sparkle(ctx,x,y,size,color) {
    box(ctx,x-size,y,2*size+1,1,color); box(ctx,x,y-size,1,2*size+1,color);
  }

  // Each museum specimen fits the same 16-pixel drawer in the collection.
  // Outer facets and the motif use separate tones to stay legible on a phone.
  const specimens = {
    fern: {
      colors: {o:"#504943",d:"#7b6e57",s:"#ab9673",g:"#598777",m:"#95b696",h:"#d7ddb1"},
      rows: [
        "         ooo    ","       omsdho   ","     oosgssho   ","    omddsmsmo m ",
        "   ossgssshdmg  ","   ossmgssmgdo  ","  msdssmghssdgo ","  ogmsssmssgmdo ",
        " ossgmssmgmsddo "," omssgmhsssdddo ","ossgmsmssssgdo  ","osdsgmmssgmdo   ",
        " ossshsgmdd o   ","  osmdssddo     ","  shossdoo      ","  m   oo        "
      ]
    },
    amber: {
      colors: {o:"#764b38",d:"#ac613b",a:"#ce843e",g:"#e7a54c",h:"#ffce72",i:"#ffe2a2",w:"#724e48",b:"#463b41"},
      rows: [
        "      oooo      ","    ooghhgdo    ","   ohiiihagdo   ","  ohihwhgwgaao  ",
        " ogwwhgwwggwwdo "," owwawgbbhwawwdo","ohhwdwwbbwwdwadd","ohhwwawbbwawwgad",
        "ohhgwwwbbwwwggad","ohhggwgbbgwgggdo"," oghwagbbgawhado"," oghwwgbbgwwaddo",
        "  oghhgbbggaaddo","   ooghbggaaddo ","     oogaaaddo  ","       ooooo    "
      ]
    },
    shell: {
      colors: {o:"#704e4d",d:"#a86f60",s:"#c38f76",m:"#e0ae8c",h:"#f4d2a8",k:"#855f58"},
      rows: [
        "      oooo      ","    ooshhmmoo   ","   oshhmmmmhsoo ","  oShmmmkkmmhso ",
        " osmmskkssksmmoo"," osmksmhhmsksmdo","oshksmhkkhmsksdo","ohhksmhkkmmsksdo",
        "ohmksmhhmmmsksdo","ommksmsssmsksmso"," ommskksskksmhso"," osmmmkkkkmmhsdo",
        "  ossmmmmmhhsdoo","    osssssshmsdo","       oooosmdo ","            oo  "
      ].map(line=>line.toLowerCase())
    }
  };
  function specimen(ctx, id) {
    const art=specimens[id];
    if (!art) return;
    art.rows.forEach((row,y)=>{
      for (let x=0;x<row.length;x++) {
        const ink=art.colors[row[x]];
        if(ink) box(ctx,x,y,1,1,ink);
      }
    });
  }

  function rubbleTile(ctx, p) {
    ctx.save();ctx.translate(p.x*TILE,p.y*TILE);
    // A broad, low-profile slab splits along three seams. The dark seams stay
    // visible beside the straight track after the sleepers have been laid.
    face(ctx,[[1,8],[8,3],[29,2],[38,7],[37,29],[29,36],[4,34]],"#302e38");
    face(ctx,[[3,14],[8,6],[19,5],[17,11],[19,16],[12,20],[5,19]],"#4b4350");
    face(ctx,[[22,5],[32,4],[36,9],[34,17],[24,14],[21,14],[20,10]],"#514650");
    face(ctx,[[3,22],[11,22],[18,18],[17,24],[10,30],[5,32],[2,29]],"#49404a");
    face(ctx,[[20,18],[24,17],[34,20],[34,27],[27,31],[20,29],[13,31],[19,25]],"#49434e");
    box(ctx,9,6,8,1,"#70606a");box(ctx,25,5,6,1,"#776568");
    box(ctx,5,22,5,1,"#66565e");box(ctx,24,18,5,1,"#675961");
    box(ctx,1,28,3,2,"#675661");box(ctx,12,34,4,2,"#4c424d");
    // A double sleeper next to the numeral marks track cost (ore amounts are upper-left).
    box(ctx,22,29,15,9,"#221f2b");
    box(ctx,23,31,1,6,"#c89064");box(ctx,27,31,1,6,"#c89064");
    for (const y of [32,35]) box(ctx,22,y,7,1,"#c89064");
    quantityLabel(ctx,31,30,2,"#f0b47c");
    ctx.restore();
  }

  function relicWall(ctx, p, collected) {
    ctx.save();ctx.translate(p.x*TILE,p.y*TILE);
    // A single exposed fault face spans several small ordinary rock blocks.
    face(ctx,[[1,10],[6,4],[15,1],[28,2],[37,7],[39,16],[37,32],[30,38],[8,38],[1,31]],"#222534");
    face(ctx,[[2,11],[8,5],[17,3],[28,4],[35,8],[36,23],[29,32],[9,34],[3,29]],collected?"#444656":"#625257");
    face(ctx,[[4,11],[9,7],[18,5],[26,5],[32,8],[22,7],[13,9],[7,13]],collected?"#666370":"#968175");
    face(ctx,[[7,31],[23,30],[31,27],[34,23],[32,30],[25,34],[11,35]],"#3c3949");
    const seam=collected?"#777070":"#bd8653", shine=collected?"#958783":"#f9c979";
    face(ctx,[[8,4],[11,5],[8,11],[10,16],[7,19],[8,23],[5,25],[6,18],[8,15],[6,11]],seam);
    box(ctx,6,12,2,3,shine);
    face(ctx,[[35,16],[34,22],[30,26],[31,29],[26,32],[20,33],[19,35],[13,35],[17,32],[23,31],[28,28],[28,25],[32,21]],seam);
    box(ctx,26,29,3,1,shine);box(ctx,20,32,3,1,shine);
    ctx.save();ctx.translate(10,7);ctx.scale(1.35,1.35);
    if(collected)ctx.globalAlpha=.55;
    specimen(ctx,p.id);
    ctx.restore();
    if(collected) {
      box(ctx,29,3,8,8,"#262e38");box(ctx,30,7,2,1,"#8eac9e");
      box(ctx,32,8,1,1,"#8eac9e");box(ctx,33,6,1,2,"#8eac9e");box(ctx,34,5,2,1,"#8eac9e");
    }
    ctx.restore();
  }

  function reachableRelic(ctx, p, now) {
    const x=p.x*TILE,y=p.y*TILE;
    const rim=(now%1400)<850?"#ffdc89":"#e1b66d";
    // Two gold prospecting stakes flag this accessible dig site.
    for(const offset of [3,34]) {
      box(ctx,x+offset,y+26,2,10,"#443e37");box(ctx,x+offset+1,y+26,1,8,rim);
      box(ctx,x+offset-1,y+25,4,2,"#b98c59");
    }
    box(ctx,x+6,y+36,6,1,rim);box(ctx,x+27,y+36,6,1,rim);
    sparkle(ctx,x+31,y+7,(now%1400)<630?3:2,rim);
  }

  function terrainIcon(ctx,name) {
    if(name==="rubble"){
      face(ctx,[[1,6],[3,3],[11,2],[15,6],[14,13],[2,14]],"#574b56");
      face(ctx,[[2,6],[5,4],[9,3],[7,7],[8,8],[5,9],[2,8]],"#a98d85");
      face(ctx,[[10,4],[13,5],[14,8],[10,7],[9,8],[9,6]],"#947b78");
      face(ctx,[[1,11],[5,10],[8,9],[6,13],[2,14]],"#78666b");
      box(ctx,7,10,8,5,"#302c39");box(ctx,8,10,1,6,"#e1b681");box(ctx,13,10,1,6,"#e1b681");
      box(ctx,7,11,8,1,"#d59c70");box(ctx,7,14,8,1,"#d59c70");
    } else {
      face(ctx,[[0,6],[4,2],[11,1],[15,5],[15,12],[10,15],[3,14],[1,11]],"#615662");
      face(ctx,[[1,6],[5,3],[11,2],[14,5],[11,4],[6,4],[3,7]],"#a18d7b");
      face(ctx,[[10,3],[8,6],[9,8],[7,10],[8,12],[4,13],[6,10],[6,8],[7,7]],"#f5c27a");
      box(ctx,11,7,3,1,"#a68e72");box(ctx,12,6,1,3,"#d5ba87");
    }
  }

  function jadeIcon(ctx, cut) {
    // Rough jade keeps its weathered rind. A thin, bright vein in an exposed
    // fissure becomes a broad green window on the sawn specimen.
    face(ctx,[[0,9],[2,5],[7,1],[11,1],[15,4],[16,10],[13,14],[6,16],[2,14]],"#49494c");
      face(ctx,[[1,8],[4,4],[7,2],[11,2],[14,5],[14,9],[11,12],[5,14],[2,12]],cut?"#668977":"#8f8071");
    face(ctx,[[1,8],[4,4],[7,2],[11,2],[8,4],[6,4],[4,7]],"#b2a08c");
    face(ctx,[[1,9],[3,10],[5,13],[10,13],[12,11],[14,10],[12,14],[7,15],[3,14]],"#665f58");
    if(cut){
      face(ctx,[[3,7],[6,4],[10,3],[13,5],[14,8],[11,11],[6,13],[3,11]],"#54aa88");
      face(ctx,[[3,6],[7,3],[10,3],[7,5],[5,6],[4,9],[2,9]],"#a7e2ad");
      face(ctx,[[4,8],[8,5],[10,5],[13,6],[11,8],[8,8],[6,10],[4,10]],"#79cf9c");
      face(ctx,[[7,10],[11,8],[14,7],[14,9],[11,12],[6,13]],"#32927d");
      box(ctx,5,6,3,1,"#daf2be");box(ctx,4,7,2,1,"#c3e9b5");
      box(ctx,9,9,2,1,"#82ce9e");box(ctx,11,8,1,1,"#c1ebab");
    } else {
      face(ctx,[[2,5],[6,3],[9,3],[7,5],[5,5],[3,7]],"#a49a87");
      face(ctx,[[2,12],[3,9],[6,8],[7,6],[10,7],[12,4],[14,4],[13,7],[11,8],[8,8],[7,10],[5,10],[4,13]],"#265e58");
      face(ctx,[[2,11],[5,8],[7,8],[8,6],[10,7],[12,5],[14,4],[13,6],[11,8],[8,8],[6,10],[4,10]],"#78d496");
      box(ctx,5,8,2,1,"#c1e9ab");box(ctx,11,6,2,1,"#a6dfa3");
      box(ctx,10,11,2,1,"#a99a83");box(ctx,2,6,1,1,"#c1ac8d");
    }
  }

  function embeddedJade(ctx,p) {
    ctx.save();ctx.translate(p.x*TILE+1,p.y*TILE+17);
    box(ctx,2,15,12,2,"#242d36");
    jadeIcon(ctx,false);
    box(ctx,1,16,2,1,"#6a7e70");
    ctx.restore();
  }

  function rebarIcon(ctx) {
    // Rolled steel has a dark cylindrical underside and regularly pitched ribs.
    face(ctx,[[0,12],[11,2],[14,1],[16,3],[16,5],[4,15],[2,15]],"#34414a");
    face(ctx,[[1,12],[12,2],[14,2],[15,4],[3,14]],"#748994");
    face(ctx,[[1,12],[12,2],[14,2],[13,3],[3,13]],"#c1d4ce");
    for(const [x,y] of [[3,11],[6,8],[9,6],[12,3]]) {
      face(ctx,[[x-1,y-1],[x+1,y-1],[x+3,y+1],[x+2,y+3],[x+1,y+2]],"#536873");
      box(ctx,x-1,y-1,2,1,"#e3e3cc");box(ctx,x+1,y,1,2,"#b1c3c2");
    }
    box(ctx,1,12,2,2,"#9eafb1");box(ctx,2,14,2,1,"#697b85");
  }

  function embeddedRebar(ctx,p) {
    ctx.save();ctx.translate(p.x*TILE+22,p.y*TILE+14);
    face(ctx,[[-3,13],[1,10],[5,11],[6,14],[2,16],[-2,16]],"#5b4340");
    rebarIcon(ctx);
    box(ctx,-1,13,2,2,"#bc8358");box(ctx,2,15,3,1,"#9f6e50");
    ctx.restore();
  }

  function coinIcon(ctx) {
    // A milled brass rim and square punch distinguish these coins from copper ore.
    face(ctx,[[5,1],[11,1],[11,2],[13,2],[13,3],[15,4],[15,6],[16,6],[16,10],[15,10],[15,12],[13,13],[12,15],[10,15],[10,16],[5,16],[3,14],[2,14],[1,12],[1,10],[0,10],[0,6],[1,6],[1,4],[3,3],[3,2],[5,2]],"#8c603d");
    face(ctx,[[5,1],[10,1],[12,3],[14,4],[14,6],[15,6],[15,9],[14,9],[14,11],[12,13],[10,14],[5,14],[3,12],[2,10],[1,9],[1,6],[2,6],[2,4]],"#dcab5b");
    face(ctx,[[5,2],[10,2],[13,4],[12,5],[10,4],[5,4],[3,7],[2,7],[3,4]],"#f7d98b");
    face(ctx,[[5,5],[10,4],[12,6],[12,10],[10,12],[6,12],[4,10],[3,7]],"#c58f49");
    box(ctx,6,6,4,4,"#714e37");box(ctx,7,7,3,3,"#363137");
    box(ctx,6,10,5,1,"#f6d284");box(ctx,10,6,1,4,"#eec17b");
    box(ctx,4,13,1,1,"#835d3c");box(ctx,11,14,1,1,"#8e633b");
  }

  function voucherIcon(ctx) {
    face(ctx,[[1,3],[15,2],[16,5],[14,7],[16,9],[15,12],[1,14],[0,11],[2,9],[0,7]],"#9a6c50");
    face(ctx,[[1,3],[14,2],[15,5],[13,7],[15,9],[14,11],[1,13],[1,11],[3,9],[1,7]],"#e8bb84");
    box(ctx,2,4,7,1,"#ffe3b0");
    for(const y of [4,7,10]) box(ctx,11,y,1,2,"#a97e5e");
    // A stamped upward arrow marks the price premium.
    face(ctx,[[3,8],[6,4],[9,7],[7,7],[7,10],[5,11],[5,8]],"#9e5043");
  }

  function spareIcon(ctx) {
    for(const [x,y] of [[3,1],[1,4],[3,6]]){
      face(ctx,[[x,y+7],[x+8,y],[x+11,y],[x+12,y+2],[x+3,y+9],[x,y+9]],"#53616a");
      face(ctx,[[x,y+7],[x+8,y],[x+11,y],[x+3,y+7]],"#b9c6c3");
      box(ctx,x,y+8,3,1,"#8b999e");
    }
    // Leather tie across all three bars.
    face(ctx,[[5,5],[7,4],[12,9],[10,11]],"#845946");
    face(ctx,[[6,5],[7,5],[11,9],[10,10]],"#e4ad70");
    box(ctx,8,7,2,2,"#f2c98b");
  }

  function bellIcon(ctx) {
    box(ctx,6,1,4,3,"#80593a");box(ctx,7,0,2,2,"#eac087");
    face(ctx,[[3,6],[5,3],[10,3],[12,5],[13,10],[15,12],[14,14],[2,14],[1,12],[3,10]],"#93633e");
    face(ctx,[[4,6],[6,4],[10,4],[12,7],[12,10],[14,12],[3,12],[4,10]],"#d89650");
    face(ctx,[[4,8],[5,5],[8,4],[7,6],[6,10],[4,10]],"#f4ca82");
    box(ctx,2,11,12,2,"#f1bf72");box(ctx,4,13,8,1,"#b77943");
    box(ctx,6,14,4,1,"#d69b5d");box(ctx,7,15,2,1,"#a06b4d");
  }

  function icon(ctx,name,x=0,y=0,scale=1) {
    ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
    const oreName=/^(copper|crystal)([1-3])$/.exec(name);
    if(oreName){
      // Render to the centre of the 16-pixel icon, keeping all growth stages
      // at the same scale so the silhouettes remain meaningful in a legend.
      ctx.scale(.4,.4);
      oreSilhouette(ctx,oreName[1],Number(oreName[2]),0);
    } else if(Object.prototype.hasOwnProperty.call(specimens,name)){
      specimen(ctx,name);
    } else if(name==="rubble" || name==="relic"){
      terrainIcon(ctx,name);
    } else if(name==="jade" || name==="jade-cut"){
      jadeIcon(ctx,name==="jade-cut");
    } else if(name==="rebar"){
      rebarIcon(ctx);
    } else if(name==="coin"){
      coinIcon(ctx);
    } else if(name==="voucher"){
      voucherIcon(ctx);
    } else if(name==="spare"){
      spareIcon(ctx);
    } else if(name==="bell"){
      bellIcon(ctx);
    } else if(name==="cart" || name==="standard" || name==="default" || Object.prototype.hasOwnProperty.call(vehicleBodies,name)){
      ctx.imageSmoothingEnabled=false;
      if(Object.prototype.hasOwnProperty.call(vehicleBodies,name))ctx.drawImage(vehicleSprite(name),0,1,16,13);
      else ctx.drawImage(vehicleSprite(name),4,6,32,26,0,1,16,13);
    } else if(name==="copper"){
      copperChunk(ctx,0,6,0.86,false);copperChunk(ctx,5,2,0.90,true);
    } else if(name==="crystal"){
      crystalBlade(ctx,4,14,5,13,2,true);crystalBlade(ctx,9,14,3,8,3,false);
    } else if(name==="rail"){
      for(let i=0;i<3;i++)box(ctx,1,3+i*4,14,2,"#a48163");
      box(ctx,3,1,2,14,"#c6c5ae");box(ctx,11,1,2,14,"#c6c5ae");
    } else if(name==="ticket"){
      box(ctx,2,3,12,10,"#aa7648");box(ctx,3,2,10,10,"#e7bb76");
      box(ctx,5,4,6,1,"#825e47");box(ctx,5,6,5,1,"#825e47");box(ctx,5,9,3,1,"#825e47");
    } else if(name==="lamp"){
      lantern(ctx,8,8,0);
    }
    ctx.restore();
  }

  let cachedTracks=null, cachedPath="";
  function makeLayer() {
    const canvas=typeof OffscreenCanvas==="function"?new OffscreenCanvas(W,H):document.createElement("canvas");
    canvas.width=W;canvas.height=H;
    return canvas;
  }
  function prepareTracks(path) {
    const key=path.map(p=>p.y*COLS+p.x).join(",");
    if(cachedTracks && key===cachedPath)return cachedTracks;
    cachedTracks=makeLayer();
    rail(cachedTracks.getContext("2d"),path);
    cachedPath=key;
    return cachedTracks;
  }

  let cached=null, cachedKey="";
  function prepareBackdrop(tiles,start,spent,amounts,rubble,relic,collectedRelic,zone,express,oddity,jade) {
    const key=JSON.stringify([tiles,start,spent,amounts,rubble,relic,collectedRelic,zone,express,oddity,jade]);
    if(cached && key===cachedKey)return cached;
    const canvas=makeLayer();
    const ctx=canvas.getContext("2d"),removed=new Set(spent.map(p=>p.x+","+p.y));
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)floor(ctx,x,y,zone);
    for(const p of rubble || [])if(tiles[p.y]?.[p.x]==="floor")rubbleTile(ctx,p);
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const tile=tiles[y]?.[x];
      if(tile==="wall"){
        if(relic && relic.x===x && relic.y===y)relicWall(ctx,relic,collectedRelic);
        else wall(ctx,x,y,zone);
      }
      if(tile==="copper"||tile==="crystal")ore(ctx,x,y,tile,removed.has(x+","+y),oreLevel(amounts?.[y]?.[x]));
    }
    if(oddity?.kind==="rebar" && tiles[oddity.y]?.[oddity.x]==="copper" && !removed.has(oddity.x+","+oddity.y)) {
      embeddedRebar(ctx,oddity);
    }
    const jadeTile=jade && tiles[jade.y]?.[jade.x];
    if(jade?.kind==="jade" && (jadeTile==="copper" || jadeTile==="crystal") && !removed.has(jade.x+","+jade.y)){
      embeddedJade(ctx,jade);
    }
    station(ctx,start,express); cached=canvas; cachedKey=key; return cached;
  }

  function drawBoard(ctx, view, timeMs = 0) {
    const start=view.start||{x:0,y:3},path=view.path?.length?view.path:[start];
    const spent=view.collected||[],tiles=view.tiles||[],now=Number(timeMs)||0;
    const zone=view.zone===1 || view.zone===2 ? view.zone : 0;
    const base=prepareBackdrop(tiles,start,spent,view.amounts,view.rubble,view.relic,view.relicCollected,zone,Boolean(view.express),view.oddity,view.jade);
    ctx.save();
    ctx.setTransform(ctx.canvas.width/W,0,0,ctx.canvas.height/H,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(base,0,0);
    for(const p of view.moves||[])marker(ctx,p,now);
    for(const p of view.targets||[]){
      const type=tiles[p.y]?.[p.x];
      if(type==="copper"||type==="crystal")markedOre(ctx,p,type);
    }
    if(view.inspect)inspectedOre(ctx,view.inspect,tiles);
    if(view.relic && view.relicInReach && !view.relicCollected)reachableRelic(ctx,view.relic,now);
    ctx.drawImage(prepareTracks(path),0,0);
    const car=view.cart||path[path.length-1];
    const cx=car.x*TILE+20,cy=car.y*TILE+21;
    let facing=car.dir;
    if(!facing && path.length>1){
      const previous=path[path.length-2];
      facing=car.x<previous.x?"left":"right";
    }
    cart(ctx,cx,cy,now,view.returning,facing,view.paint);
    for(const fx of view.effects||[]){
      const t=Math.max(0,Math.min(1,fx.progress)),e=1-(1-t)*(1-t);
      const x=20+(fx.from.x+(fx.to.x-fx.from.x)*e)*TILE;
      const y=20+(fx.from.y+(fx.to.y-fx.from.y)*e)*TILE-8*Math.sin(t*Math.PI);
      const tint=fx.type==="crystal"?"#a6efe5":"#ffd491";
      box(ctx,x-2,y-2,5,4,tint);box(ctx,x-1,y-3,2,1,"#fff0c4");
      if(t<0.7)sparkle(ctx,x-4,y+3,1,tint);
      if(oreLevel(fx.amount)>1 && t<0.88) quantityLabel(ctx,Math.round(x)+4,Math.round(y)-10,fx.amount,tint);
    }
    // Slow single-pixel glints, offset per vein, keep the board quietly alive.
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      if(tiles[y]?.[x]!=="crystal"&&tiles[y]?.[x]!=="copper")continue;
      if(spent.some(p=>p.x===x&&p.y===y))continue;
      const phase=(now+(seedAt(x,y)%3600))%3900;
      if(phase<250) {
        const copper=tiles[y][x]==="copper";
        const amount=oreLevel(view.amounts?.[y]?.[x]);
        const glintX=(copper?[19,27,24]:[20,25,24])[amount-1];
        const variant=seedAt(x,y,14);
        const px=(variant & 1)===1 ? TILE-glintX : glintX;
        const py=(copper?[19,14,7]:[13,8,4])[amount-1];
        sparkle(ctx,x*TILE+px,y*TILE+py,phase>75&&phase<175?2:1,copper?"#fff1bb":"#d4f8ee");
      }
    }
    if(view.pulse)oreGains(ctx,view.pulse,tiles);
    ctx.restore();
  }
  window.MineArt={drawBoard,drawVehicle,drawIcon:icon,width:W,height:H,tileSize:TILE};
})();

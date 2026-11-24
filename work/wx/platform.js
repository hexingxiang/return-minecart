function storage(wx) {
  return {
    getItem(key){try {const s=wx.getStorageSync(key);return typeof s==='string' && s!==''?s:null;}catch{return null;}},
    setItem(key,value){wx.setStorageSync(key,value);}
  };
}
function windowMetrics(wx, measured) {
  const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();
  const rect=measured?.() || {};
  const width=rect.width||info.windowWidth,height=rect.height||info.windowHeight;
  let capsule=null;
  try{capsule=wx.getMenuButtonBoundingClientRect?.();}catch{}
  const top=Math.max(0, (info.safeArea?.top||info.statusBarHeight||0)-(rect.top||0));
  const bottom=info.safeArea?Math.max(0,(rect.top||0)+height-info.safeArea.bottom):0;
  return {width,height,ratio:info.pixelRatio||1,top,bottom,
    capsule:capsule?.bottom>0?{bottom:capsule.bottom-(rect.top||0)}:null};
}
function makePlatform(wx,canvas,kind,measured) {
  const raf=canvas.requestAnimationFrame?.bind(canvas) ||
    (typeof requestAnimationFrame==='function'?requestAnimationFrame:fn=>setTimeout(fn,33));
  const caf=canvas.cancelAnimationFrame?.bind(canvas) ||
    (typeof cancelAnimationFrame==='function'?cancelAnimationFrame:clearTimeout);
  let lastBuzz=0,lastRail=0;
  const voices=new Map();
  return {
    canvas,raf,caf,storage:storage(wx),metrics:()=>windowMetrics(wx,measured),
    makeCanvas(width,height){
      const surface=kind==='game'?wx.createCanvas():wx.createOffscreenCanvas({type:'2d',width,height});
      surface.width=width;surface.height=height;return surface;
    },
    haptic(){const t=Date.now();if(t-lastBuzz>=90){lastBuzz=t;wx.vibrateShort?.({type:'light',fail(){}});}},
    sound(name){
      if(!wx.createInnerAudioContext)return;
      if(name==='rail' && Date.now()-lastRail<85)return;
      if(name==='rail')lastRail=Date.now();
      try{
        let voice=voices.get(name);
        if(!voice){
          voice=wx.createInnerAudioContext();
          voice.src=(kind==='game'?'':'/')+'assets/'+name+'.wav';voice.volume=.36;voices.set(name,voice);
        }else voice.stop();
        voice.play();
      }catch{}
    },
    quiet(){for(const v of voices.values())v.stop();},
    release(){for(const v of voices.values())v.destroy();voices.clear();}
  };
}
function touches(runtime,kind,event,origin) {
  if(!runtime)return;
  const list=event.changedTouches?.length?event.changedTouches:event.touches;
  if(!list?.length){if(kind==='cancel')runtime.cancel?.();return;}
  for(let i=0;i<list.length;i++){
    const t=list[i];
    const x=t.clientX!=null?t.clientX-(origin?.left||0):t.pageX!=null?t.pageX-(origin?.left||0):t.x;
    const y=t.clientY!=null?t.clientY-(origin?.top||0):t.pageY!=null?t.pageY-(origin?.top||0):t.y;
    runtime.touch(kind,{x,y,id:t.identifier??0});
  }
}
module.exports={makePlatform,touches};

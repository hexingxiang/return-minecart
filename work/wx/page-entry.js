const createHost=require('../../lib/host');
const {makePlatform,touches}=require('../../lib/platform');
Page({
  data:{error:''},
  onLoad(){this.visible=true;this.closed=false;},
  onReady(){this.measure(true);},
  measure(init){
    wx.createSelectorQuery().in(this).select('#mine').fields({node:true,size:true,rect:true}).exec(rows=>{
      if(this.closed)return;
      const rect=rows[0];
      if(!rect || !rect.node || !wx.createOffscreenCanvas){
        this.setData({error:'请更新微信后重新打开矿区。'});return;
      }
      this.rect={left:rect.left||0,top:rect.top||0,width:rect.width,height:rect.height};
      if(!this.runtime && init)this.runtime=createHost(makePlatform(wx,rect.node,'page',()=>this.rect));
      if(this.visible){this.runtime?.resize();this.runtime?.show();}
    });
  },
  onResize(){if(this.runtime)this.measure(false);},
  onShow(){this.visible=true;this.runtime?.show();},
  onHide(){this.visible=false;this.runtime?.hide();},
  onUnload(){this.closed=true;this.runtime?.destroy();this.runtime=null;},
  start(e){touches(this.runtime,'start',e,this.rect);},
  move(e){touches(this.runtime,'move',e,this.rect);},
  end(e){touches(this.runtime,'end',e,this.rect);},
  cancel(e){touches(this.runtime,'cancel',e,this.rect);}
});

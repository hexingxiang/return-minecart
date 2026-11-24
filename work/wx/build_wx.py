from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import json, math, shutil, struct, wave

root=Path(__file__).resolve().parent
game=root.parent/'game'
output=root.parents[1]/'outputs'
target=root/'build'
target.mkdir(parents=True,exist_ok=True)
output.mkdir(parents=True,exist_ok=True)
archive_files=[]
def put(folder,name,data):
    p=folder/name
    archive_files.append(p)
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(data if isinstance(data,str) else json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

sources=['levels.js','express-maps.js','engine.js','express.js','feedback.js','art.js','finale-art.js']
shared='\n'.join((game/n).read_text() for n in sources).replace('window.','scope.')
for size in ('40,32','W,H'):
    shared=shared.replace('typeof OffscreenCanvas==="function"?new OffscreenCanvas('+size+'):document.createElement("canvas")','makeCanvas('+size+')')
# Native board and survey surfaces always have the logical resolution of the board.
shared=shared.replace('ctx.setTransform(ctx.canvas.width/W,0,0,ctx.canvas.height/H,0,0);','ctx.setTransform(1,0,0,1,0,0);')
assert 'document.' not in shared and 'window.' not in shared
core='module.exports = function loadCore(makeCanvas) {\nconst scope={};\n'+shared+'\nreturn scope;\n};\n'

def copy_source(source,destination):
    shutil.copyfile(source,destination)
    archive_files.append(destination)

def write_tone(path,notes):
    archive_files.append(path)
    rate=12000
    samples=bytearray()
    for hz,seconds in notes:
        length=round(rate*seconds)
        for index in range(length):
            t=index/rate
            envelope=max(0,min(1,t/.008,(seconds-t)/.035))
            tone=math.sin(2*math.pi*hz*t)+.18*math.sin(4*math.pi*hz*t)
            samples.extend(struct.pack('<h',round(tone*envelope*10500)))
    with wave.open(str(path),'wb') as out:
        out.setparams((1,2,rate,0,'NONE','not compressed'))
        out.writeframes(samples)

for name,kind in [('mini-program','miniprogram'),('mini-game','game')]:
    folder=target/name
    folder.mkdir(parents=True,exist_ok=True)
    put(folder,'lib/core.js',core)
    (folder/'assets').mkdir(exist_ok=True)
    for effect,notes in {'rail':[(380,.065)],'win':[(523,.10),(659,.10),(784,.19)],'loss':[(294,.15),(185,.20)]}.items():
        write_tone(folder/'assets'/(effect+'.wav'),notes)
    for src in ('host','platform','campaign','express-mode','library'):
        copy_source(root/(src+'.js'),folder/'lib'/(src+'.js'))
    put(folder,'project.config.json',{'description':'回程矿车 · 手机竖屏像素采矿','compileType':kind,'appid':'touristappid',
        'projectname':'minecart-'+kind,'setting':{'es6':True,'enhance':True,'minified':True,'urlCheck':True}})
    if kind=='game':
        copy_source(root/'game-entry.js',folder/'game.js')
        put(folder,'game.json',{'deviceOrientation':'portrait','showStatusBar':False})
    else:
        put(folder,'app.js','App({});\n')
        put(folder,'app.json',{'pages':['pages/mine/index'],'window':{'navigationStyle':'custom','navigationBarTextStyle':'white','backgroundColor':'#151d25','pageOrientation':'portrait'},'style':'v2','sitemapLocation':'sitemap.json'})
        put(folder,'sitemap.json',{'rules':[{'action':'allow','page':'*'}]})
        put(folder,'pages/mine/index.json',{'navigationBarTitleText':'回程矿车','disableScroll':True})
        put(folder,'pages/mine/index.wxml','<canvas id="mine" type="2d" catchtouchstart="start" catchtouchmove="move" catchtouchend="end" catchtouchcancel="cancel"></canvas>\n<view wx:if="{{error}}" class="error">{{error}}</view>\n')
        put(folder,'pages/mine/index.wxss','page{height:100%;overflow:hidden;background:#151d25}#mine{display:block;position:fixed;top:0;left:0;width:100%;height:100%;}.error{position:fixed;top:40%;width:100%;text-align:center;color:#f4d59a;}\n')
        copy_source(root/'page-entry.js',folder/'pages/mine/index.js')
put(target,'导入说明.txt','''回程矿车 · 微信手机版

解压本包，打开微信开发者工具，选择「导入项目」。
普通微信小程序选择 mini-program 文件夹；微信小游戏选择 mini-game 文件夹。
两份项目各自独立，使用本地 Canvas 渲染。可直接编译，自带矿图、美术和规则，无需安装依赖或配置服务器。
项目中的 touristappid 用于本地体验。要在自己的微信上预览或提交审核，请使用对应项目类型的 AppID，并用有开发权限的帐号登录开发者工具。
游戏进度保存在当前微信应用的本机存储中，两个项目及离线网页版各自保存。

竖屏操作
点亮格或从一格连续滑到相邻格铺轨；沿来路滑回可以撤轨。货单收齐后点发车。
轻点矿脉可以查看产量和采矿位置。铺轨首次覆盖一处矿脉时，浮出的数字表示这条线多收了多少矿。
底栏可切换矿井主线、三站快运、勘探和车库。快运首步开始计时，查看面板或切入后台会暂停。

微信官方项目示例
小程序 Canvas 2D https://github.com/wechat-miniprogram/miniprogram-demo/tree/master/miniprogram/packageComponent/pages/canvas/canvas-2d
微信小游戏 https://github.com/wechat-miniprogram/minigame-demo
''')
zip_path=output/'回程矿车-微信手机版.zip'
tmp=zip_path.with_suffix('.tmp')
with ZipFile(tmp,'w',compression=ZIP_DEFLATED,compresslevel=9) as z:
    # A fixed release timestamp and file mode make clean builds match the distributed archive.
    for p in sorted(archive_files):
        entry=ZipInfo(p.relative_to(target).as_posix(),date_time=(2026,11,23,18,57,52))
        entry.create_system=3
        entry.external_attr=0o100644 << 16
        z.writestr(entry,p.read_bytes(),compress_type=ZIP_DEFLATED,compresslevel=9)
tmp.replace(zip_path)
print(zip_path.name,zip_path.stat().st_size,'bytes')

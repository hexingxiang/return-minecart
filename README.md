# 回程矿车

一款竖屏像素采矿游戏。点矿脉查看产量与采矿位置，从车头铺出一条线，再发车把沿途的矿石带回站台。主线有十座矿井、可收集的装备卡和化石。三站快运有倒计时，可以在站间落袋，也可以继续押运本趟货款。

## 试玩

下载并用浏览器打开 [离线网页版](outputs/回程矿车.html)。手机可点格或连续滑动铺轨，沿来路滑回能撤轨。桌面可用方向键铺轨、退格键撤轨、空格发车。进度保存在当前浏览器或微信应用的本机存储。

[微信竖屏截图](outputs/回程矿车-微信竖屏.png) · [铺轨与收矿短片](outputs/回程矿车-铺轨试玩.mp4) · [快运双结局短片](outputs/回程矿车-试玩.mp4)

## 导入微信开发者工具

下载并解压 [微信手机版](outputs/回程矿车-微信手机版.zip)，在微信开发者工具中选择「导入项目」。体验微信小游戏时选择解压后的 `mini-game/`，体验普通小程序时选择 `mini-program/`。两个目录分别有自己的 `project.config.json`。本地体验使用内置测试 AppID，真机预览或提交审核时换成自己对应类型的 AppID。

## 从源码构建

在仓库根目录运行以下命令。构建只用 Python 3 标准库，回归测试使用 Node.js 18 或更新版本。

```sh
python3 work/game/build.py
python3 work/wx/build_wx.py
```

网页版和微信压缩包生成在 `outputs/`。微信工程还会分别输出到 `work/wx/build/mini-game/` 和 `work/wx/build/mini-program/`，可直接导入开发者工具。

## 回归测试

```sh
node work/game/verify-engine.cjs
node work/game/verify-express.cjs
node work/qa/feedback_rules.cjs
node work/qa/verify-wx-express.cjs
```

四组测试分别覆盖主线与旧存档迁移、快运订单与结算、矿脉勘察与铺轨反馈、微信快运操作流程。

## 源码入口

| 功能 | 文件 |
| --- | --- |
| 主线关卡与采矿规则 | [levels.js](work/game/levels.js)、[engine.js](work/game/engine.js) |
| 快运地图、计时与结算 | [express-maps.js](work/game/express-maps.js)、[express.js](work/game/express.js) |
| 网页界面 | [page.html](work/game/page.html)、[ui.js](work/game/ui.js)、[express-ui.js](work/game/express-ui.js) |
| 像素画与结局动画 | [art.js](work/game/art.js)、[finale-art.js](work/game/finale-art.js) |
| 微信小游戏与小程序 | [game-entry.js](work/wx/game-entry.js)、[page-entry.js](work/wx/page-entry.js) |

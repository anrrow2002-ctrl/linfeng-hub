# 林锋手帐 · 自动推送完整插件 v2.0.1

本仓库同时包含酒馆前端扩展和后台服务。前端在“扩展”设置中显示后台连接状态；后台自动寻找、匹配、解析公开帖子，供手帐直接展示。玩家不用粘贴链接。

## 上传到 Git

解压“完整插件 Git 仓库包”，将下面 **7个文件直接放在仓库根目录**，不要再多套一层文件夹。GitHub、GitCode 都可以，不需要上传 node_modules。

```text
manifest.json   前端扩展清单
index.js        浏览器入口与连接状态面板
style.css       状态面板样式
package.json    后台入口声明，main 指向 index.mjs
index.mjs       后台入口
core.mjs        自动搜索、匹配和解析
README.md       本安装说明
```

## 第一步：酒馆中安装前端扩展

1. 打开酒馆“扩展 → 安装扩展”。
2. 粘贴这个插件仓库的 HTTPS 克隆地址并安装。
3. 刷新酒馆，在扩展设置中找到“林锋手帐 · 自动推送”。

面板会自动检查后台连接。只有前端装好时，提示“后台尚未安装或未启用”是正常的，继续安装下面的后台。

## 第二步：在运行酒馆的 VPS 安装后台

要求运行酒馆的 Node.js 为20.3或更高，无额外npm依赖。在 **SillyTavern根目录**执行，地址换成同一个插件仓库的克隆地址：

```sh
git clone '你的插件仓库HTTPS克隆地址' plugins/linfeng-notes
```

接着在酒馆 `config.yaml` 中设置：

```yaml
enableServerPlugins: true
```

保存后重启酒馆。后台应出现日志：“[linfeng-notes] 自动帖子推送后端已加载”。普通“安装扩展”仅安装前端文件，不能将后台Node服务装入plugins目录，因此这一步仍需在VPS完成。

如果不使用Git，也可以把这7个文件放入 `SillyTavern/plugins/linfeng-notes/`，不要多套一层目录。后台加载器根据package.json的main读取index.mjs，前端加载器根据manifest.json读取index.js，两者入口分开。

后台目录应是：

```text
SillyTavern/
  config.yaml
  plugins/
    linfeng-notes/
      manifest.json
      index.js
      style.css
      package.json
      index.mjs
      core.mjs
      README.md
```

## 第三步：更新手帐资源与世界书

原手帐仓库仍只需上传修复包中的 `notebook.json`，原酒馆助手加载器点击“立刻拉取最新手帐”后刷新。原显示正则保持启用。

用修复包中的“世界书浏览段-v2.0.1.txt”替换原浏览段规则。角色给出站点、关键词、记录标题、时间和备注；后台自己找真实链接并解析，玩家翻到浏览页就会自动展示。

前端扩展的状态面板只用于检查连接，自动推送由后台和手帐负责，不会代发聊天消息。电脑、手机访问同一台酒馆，共用这台VPS的后台，手机无需单独部署服务。

## 检查与更新

- 在扩展设置点“检查后台连接”，应显示“后台已连接 · v2.0.1”。这只证明后台接口可用，不代表所有网站都能读取。
- 登录酒馆后，同域访问 `/api/plugins/linfeng-notes/health` 应得到 `{"ok":true,"version":"2.0.1"}`。
- 后台404：检查目录层级、enableServerPlugins、是否重启。
- 登录页或其他错误：确认酒馆登录和服务器日志。
- 服务已连接但帖子占位：检查VPS网络；站点需要登录、反爬或没有可读搜索结果也会占位。
- 前端通过酒馆扩展管理更新；后台在 `plugins/linfeng-notes` 中执行 `git pull` 后重启酒馆。只更新前端不会更新后台目录中的另一份代码。

## 能力与限制

后台使用公开搜索和目标站点公开页面/数据；只允许预设来源域名和HTTPS，逐次校验跳转，不提供任意URL代理，不使用登录Cookie。插件继承酒馆本身的访问保护，不另开公网端口。

同一进程最多同时匹配两条，相同请求合并；成功缓存15分钟，未匹配缓存1分钟；请求有超时。前端排队期间不消耗读取超时，换帖排除已展示地址。摘要会标注，视频使用单条真实编号。

受限或未读取到内容时，手帐显示对应网站占位，不伪造全文。视频嵌入仍受原站限制。

规范依据：[酒馆前端扩展](https://docs.sillytavern.app/for-contributors/writing-extensions/)、[酒馆服务器插件](https://docs.sillytavern.app/for-contributors/server-plugins/)。

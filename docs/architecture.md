# 架构与后端对接

## 实现结构

React 19 + TypeScript + Vite + React Router；按路由懒加载，移动优先，桌面居中呈现。

```text
src/app       启动配置、会话、路由、导航和错误边界
src/features  Feed / Player / Community / Composer / Assets
              Generation / WorkPage / Profile / Login / Settings
src/shared    API 类型、请求、Apple SDK、共用 UI
server        同源会话网关与 SPA 静态服务
scripts       隔离本地 API + H5 启动器
 tests        网关边界测试、真实本地 API 契约验收
```

浏览器通过同源 `/v1/*` 访问网关，业务逻辑仍在 `pulse-api`。H5 不运行自己的 Agent、不调用模型提供商。API Origin 仅从服务器环境读取，不允许分享 URL 覆盖。

桌面创作台 `pulse-editor` 构建后由本服务挂载在 `/editor/`（默认静态目录 `dist/editor`，或 `PULSE_EDITOR_DIST`）。它使用本服务的 `/session`、`/api/v1` 与 `/play`，因此与 H5 共用消费者账号和私有候选 Artifact 的沙箱授权。模型调用与密钥仍仅在 `pulse-api`；部署必须将编辑器构建产物与 H5 配在同一站点，不通过另一个浏览器 Origin 共享会话。

参照 API `35a0dbfb2749b0ff586add106f3cd3bc1b7cba9d` 与 iOS `8995d3900677ab21eebbce788754b3f2875e98f2`。

## 会话与授权

`/session/apple` 将 Apple identity token 与原始 nonce 交给消费者 `/v1/auth/apple`。上游 access/refresh token 保留在 Node 内存；浏览器只有随机、HttpOnly、SameSite=Lax Cookie，生产使用 Secure 和 `__Host-` 前缀。过期前合并刷新请求；退出撤销上游会话并清除本地草稿。网关拦截跨站请求及非匹配 Origin 的写请求，不转发浏览器传入的用户/管理员/Authorization header。`/v1/auth`、`/v1/admin`、`/v1/agent-runs` 不对浏览器代理开放。

开发身份仅在开发模式且 API/H5 都是 loopback 时启用，必须显式设置 `PULSE_DEV_USER`；本地启动脚本使用独立数据目录。正式登录仍需后端接受消费者 Web Services ID audience。现有管理端 Apple Web 接口不是消费者入口。

会话与播放授权均为单进程内存存储，有过期和数量上限。重启失效，多实例需共享存储，当前不宣称支持无状态横向扩展。

## Artifact 播放

1. `/session/artifact` 先用当前身份读取上游 Artifact 元信息并验证入口文件。
2. 返回只绑定单个 Artifact 的短期 `/play/<随机授权>/` 地址，有效期 30 分钟；成员授权同时绑定当前会话，退出即失效。
3. 每个文件请求继续向上游鉴权，使用 `private, no-store`，保留上游 CSP。授权不是账号 token，不能用于调用其他业务 API。
4. iframe 仅 `sandbox="allow-scripts"`，不授予同源、导航或弹窗能力。短期文件授权允许 opaque origin 加载相对模块，解决私有 iframe 不携带浏览器 Cookie 的问题。
5. 父页面验证消息来源窗口、opaque origin、play-v1 事件类型及分数范围。仅当前作品运行，后台发送暂停信号，切页卸载。

公开作品播放创建 play-session、传递服务端 seed，按顺序发送事件并创建挑战。挑战先核对 workId/artifactId；成绩标注为作品报告，不宣称防作弊。已加载到内存中的作品不能被远程瞬间收回；后续授权和文件读取重新检查服务端状态。

## 业务契约

| 模块 | 已接入的接口族 |
| --- | --- |
| 启动 | client-configuration、generation-capabilities |
| 发现与社区 | feed、works、like、comments、save、reports、users/block |
| 创作 | works、assets/library、assets/uploads、generations、plan、verifications |
| 发布 | publish、unpublish、versions、remix-permission |
| 个人与账号 | me、me/works、me/saved、me/recent、me/reports、me/blocked-users、me/export、terms |
| 公开传播 | public/works、play-sessions/events/challenge、public/challenges、growth |

请求类型按当前后端运行代码核对。原创不含父作品；Remix 提交明确的 parentWorkId/parentArtifactId，血缘由后端派生。编辑读取 `isCurrent` 版本并携带 baseArtifactId；发布始终指定 Artifact。

草稿按同源环境、账号和创作路由隔离，保存输入、素材、创建/生成幂等键。任务 ID 位于路由，刷新后继续读取服务端状态；失败不伪装成功。素材能力中的 materialUploads 决定是否展示上传，当前 API 未返回限制字段，因此客户端集中使用现有 iOS/API 契约的 8 项/4 MiB 限制，待后端扩展后改为动态读取。

## 部署与未验证项

Node 托管 `dist` 并为深链返回 index.html。HTTPS 宿主、API 的 PUBLIC_WEB_ORIGIN、Apple 返回地址和上传 Bucket CORS 需要一致。独立社交爬虫 OG 适配器尚未迁入，当前公开链接是可游玩的 SPA，不能宣称已有动态社交卡片。

真实 Apple 认证/重新认证/删除账号、OSS 上传完成、真实模型生成、手机 Safari/Android/微信专项验收尚未完成。前端代码存在不等于这些外部服务已配置或验证。

## 作品封面

`PATCH works/:id/cover` 接受 `assetId`，空字符串移除。只允许作者选择已完成校验的图片或视频素材。`work.cover` 包含 `assetId/kind/url`；媒体通过 `GET works/:id/cover` 在作品可见性边界内读取，支持 Range 和 no-store，不暴露存储签名或其他私有素材。H5 为媒体 URL 附加 asset ID，确保更换同类型封面后重新加载。

首页有封面时延迟挂载 Player；首次进入后保持同一 iframe，退出时隐藏并发送暂停信号。封面出错自动恢复实时预览。视频封面尊重减少动态效果偏好并在页面后台暂停。

## 邮箱认证

`/session/email/register` 与 `/session/email/login` 由同源网关转发到独立的消费者 API，令牌只留在服务端，浏览器接收 HttpOnly Cookie。读取 `/v1/auth-configuration` 的 `emailEnabled` 决定是否显示入口。失败登录不会触发全局会话过期跳转。密码不进入 localStorage、URL 或日志。

API 使用随机盐和 PBKDF2-SHA256（600000 次）保存私有凭据，重启后仍可登录；注册、欢迎积分与邮箱唯一性在持久化事务内处理。公开注册只创建普通作者，不复用管理员或 Apple 身份。身份与 IP 限流、密码校验并发上限限制猜测与资源消耗。

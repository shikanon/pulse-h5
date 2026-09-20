# Pulse H5

Pulse 的完整移动 Web 前端，对应 `pulse-ios` 的 Home / Create / Profile。复用 `pulse-api` 的作品、素材、生成、发布与社区能力。公开播放器是其中一个模块。

## 已实现

- **Home**：精选/最新 Feed、分页与滑动切换、沉浸游玩、点赞、评论、收藏、分享、举报。
- **Create / Remix**：原创输入、来源归因、素材库与上传、按账号保存草稿、多轮修改、幂等提交。
- **生成与发布**：真实任务进度、Plan、自动验收结果、取消/重试、刷新恢复、私有预览、版本历史、指定版本发布和撤销。
- **Profile / 设置**：作品、草稿、收藏、最近游玩、资料编辑、屏蔽、举报记录、数据导出、隐私选择和退出。
- **公开分享**：`/a/:slug`、沙箱播放器、play-v1 结果与挑战、结果卡下载。
- **会话**：同源 HttpOnly Cookie 网关、Apple Web 登录适配、本地隔离开发登录。

已通过本地真实 `pulse-api` 的确定性生成闭环及浏览器操作验收。**尚未部署；正式消费者 Apple Web 登录、真实模型生成、OSS 上传和真机兼容仍需上线联调。** 详见 [验收记录](docs/acceptance.md)。

## 本地开发

需要 Node.js 22.6+、npm；完整本地闭环还需要 Go 1.26+ 和相邻目录中的 `pulse-api`（以其 go.mod 为准，该仓库的访问权限单独管理）。

```sh
npm ci
npm run dev:local
```

打开 <http://127.0.0.1:8080>。脚本同时启动独立本地 API（18887）与 H5（8080）；数据写入忽略提交的 `.data/local-api/`。登录页提供明确标记的本地测试登录，生成采用 `deterministic-local`，不会调用真实模型。Ctrl-C 会停止这次启动的两个服务。

可通过 `GO_BINARY`、`PULSE_API_REPO`、`PULSE_LOCAL_API_PORT` 和 `PORT` 调整运行环境。开发 HMR 端口默认 `PORT + 10000`，可用 `PULSE_HMR_PORT` 修改。不要将本地测试登录连到共享或生产数据。

连接已有 API 时：

```sh
PULSE_API_ORIGIN=http://127.0.0.1:8787 \
PULSE_H5_ORIGIN=http://127.0.0.1:8080 npm run dev
```

环境变量由进程注入，**不会自动读取 `.env`**。参考 [.env.example](.env.example)。API 的 `PUBLIC_WEB_ORIGIN` 需匹配 H5，保证 Artifact CSP 允许嵌入。

## 检查与构建

```sh
npm run typecheck
npm test
npm run build
# 仅对隔离的 deterministic-local API 写入合成验收数据
PULSE_E2E_API=http://127.0.0.1:18887 npm run test:integration
```

生产启动示例（替换为实际域名）：

```sh
PULSE_API_ORIGIN=https://api.example.com \
PULSE_H5_ORIGIN=https://pulse.example.com \
PULSE_APPLE_WEB_CLIENT_ID=your.consumer.services.id \
PORT=8080 npm start
```

由 HTTPS 反向代理转发到 Node 服务；不能只部署 `dist/`，应用依赖同源会话网关。生产拒绝 `PULSE_DEV_USER` 和非 HTTPS 公网 Origin（同机 API 允许 loopback HTTP）。当前会话存储在单进程内存中，重启需重新登录；多实例部署前应接共享会话存储。

Apple Services ID 必须在 Apple Developer 配置返回地址 `https://实际域名/login`，并由后端消费者认证接受其 audience；不能使用管理员登录代替。仅设置前端 Client ID 不代表登录联调完成。

## 文档与参照

- [产品与页面范围](docs/product.md)
- [架构与认证、播放器边界](docs/architecture.md)
- [验收记录与限制](docs/acceptance.md)
- [设计参照](docs/design/README.md)
- [实施状态与后续工作](docs/roadmap.md)
- [开发约定](AGENTS.md)

参照 [`pulse-ios`](https://github.com/shikanon/pulse-ios)，对接 [`pulse-api`](https://github.com/shikanon/pulse-api)，与 [`pulse-admin`](https://github.com/shikanon/pulse-admin) 保持独立。未指定开源许可证。

部署：浏览器业务请求使用 `/api/v1/`，为原生客户端保留 `/v1/`。生产进程默认仅监听 `127.0.0.1`，可通过 `PULSE_H5_BIND_HOST` 显式设置；`/healthz` 仅表示 H5 存活。完整部署与回滚由私有 `pulse-deployment` 仓库管理。

积分功能：Profile → 我的积分，支持余额、卡券兑换和流水。新注册用户获赠 10000 积分，1 积分对应人民币 0.01 元；重复兑换不会重复入账。卡券在独立的 Pulse Admin 后台生成。生成扣费规则尚未指定，因此未自行设置积分扣费。Apple 登录是否启用由后端管理配置决定，未配置时不会阻止游客浏览和服务启动。

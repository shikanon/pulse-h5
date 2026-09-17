# 架构与后端对接

## 状态

本文为实施基线，尚无前端代码。架构覆盖完整 H5；旧 `pulse-ios/web-player` 只提供 Player、安全策略和分享逻辑的参考。

## 分层

计划采用 React + TypeScript + Vite 的移动优先 SPA，使用路由划分页面、统一 API 层处理会话与错误、业务模块管理交互。依赖版本在脚手架提交时锁定。

```text
浏览器 H5
├── App：启动门禁、路由、Home/Create/Profile、错误边界
├── Features：Feed / Player / Composer / Remix / Assets
│             Generation / Publish / Profile / Auth / Settings
└── Shared：API 契约、状态恢复、UI、语言、隐私选择
       │
       └── pulse-api /v1
           ├── 用户、作品、互动、素材权限、发布状态
           └── Agent、隔离构建、验收、对象存储

独立沙箱 iframe ← 服务端授权的 Artifact
```

建议代码目录为 `src/app`、`src/features/<feature>`、`src/shared/api`、`src/shared/ui`、`src/shared/lib`；未来实现时再创建实际模块，避免空目录假装完成。

## API 是业务事实来源

参照 `pulse-api` 版本 `35a0dbfb2749b0ff586add106f3cd3bc1b7cba9d` 的契约与 iOS `PulseAPIClient`。实现时须重新核对当前后端；下表是对接清单，不是所有端点均已通过浏览器调用的声明。

| 业务 | 既有接口参照 |
| --- | --- |
| 启动 | `GET /v1/client-configuration`、`GET /v1/generation-capabilities` |
| 发现 | `GET /v1/feed`、`GET /v1/works/:id` |
| 社区 | `/v1/works/:id/like`、`/comments`、`/save`、`POST /v1/reports` |
| 作品创建 | `POST /v1/works`，显式原创或 Remix 模式 |
| 素材 | `GET /v1/assets/library`、`POST /v1/assets/uploads`、上传完成与取消 |
| 生成 | `POST /v1/works/:id/generations`、`GET /v1/generations/:id`、取消、重试、Plan |
| 验收和预览 | `/v1/verifications/:id`、`/v1/artifacts/:id/files/*` |
| 发布 | `POST /v1/works/:id/publish`、`POST /v1/works/:id/unpublish` |
| 个人 | `/v1/me`、`/v1/me/works`、`/v1/works/:id/versions`、`/v1/me/saved`、`/v1/me/recent` |
| 分享和挑战 | `/v1/public/works/:slug`、`/v1/play-sessions`、`/v1/public/challenges/:id` |
| 账号与设置 | 条款、屏蔽、举报记录、数据导出、账号删除、会话退出与刷新 |

DTO 以 OpenAPI 和运行代码为准，新增字段优先保持兼容。创建与重试复用后端幂等契约；取消和失败重试遵循服务端状态机。错误需按认证、权限、下架、限流、维护和临时故障分别处理。

## 必须先解决的 Web 差异

### 消费者登录

当前原生消费者 `POST /v1/auth/apple` 与管理端浏览器 `POST /v1/auth/apple/admin` 使用不同身份 audience；后者还有管理角色限制。因此不能把已有管理端浏览器登录直接接到 H5 普通用户。

完整 H5 需要在 `pulse-api` 中定义并验收消费者 Web 认证、回调、会话刷新与撤销、重新认证和账号删除契约。是否通过同源会话代理承载 HttpOnly Cookie，需与后端一起确定；若采用 Cookie，须同时实现 CSRF 防护。不在 H5 中伪造用户 header、签发 token 或引入管理员密钥。

### 部署与跨域

公开 API Origin 在构建或受控部署中配置，不能由分享 URL 任意覆盖。生产使用 HTTPS，明确 API 的 CORS allowlist、上传 Bucket CORS、私有预览认证及 Artifact 的 CSP/frame 策略。私有 Artifact 不能简单假设跨域 iframe 会自动携带 Bearer Token，需先验证后端交付方案。

SPA 宿主需要深链 fallback；`/a/:slug` 社交爬虫由独立边缘适配器读取当前公开作品并生成元信息。不得把私有草稿返回给爬虫。此仓库创建不自动部署或修改现有线上域名。

### 生命周期与本地状态

浏览器刷新与后台挂起都可能中断轮询或上传。用服务端任务 ID 恢复生成，避免自动重复创建任务；在 `visibilitychange` 后重新读取状态。本地草稿按用户和 API 环境隔离，退出清除私有状态。下架、认证和终态重新向服务端确认。

## Player 边界

复用旧 Web Player 的发布状态校验、CSP 思路、隔离 iframe、play-v1 消息校验、挑战校验和社交预览逻辑时，需要逐项迁移测试。来源中指向 `pulse://` 的消费者操作应适配成 H5 路由；可选“在 App 打开”不能成为唯一完成路径。

生成内容与主应用处于不同信任边界。默认保持 `sandbox="allow-scripts"`，不为了方便增加同源、顶层导航或弹窗能力。消息验证来源窗口、协议与字段；不可让生成内容访问主应用凭据。一次只运行当前作品。

## 与 iOS 的模块对应

| iOS 参照 | H5 模块 |
| --- | --- |
| `App/PulseApp.swift` | 启动门禁、三入口导航、待恢复意图 |
| `Features/Feed` | Feed、互动、沉浸游玩 |
| `Features/Player` 与 `web-player` | 通用 Player、私有预览、公开分享 |
| `Features/Composer` | 原创、Remix、素材、生成、发布 |
| `Features/Profile` | 个人作品、草稿、版本、设置 |
| `Domain/PulseAPIClient.swift` 及 DTO | 统一 API 客户端与契约类型 |

## 公开仓库边界

只提交前端源码、公共契约、占位配置及合成测试夹具。不复制关联仓库的 Git 历史、私有环境文件、真实用户内容、签名 URL、凭据或内部运行记录。公开可见性与软件许可证选择是不同决定；许可证尚未指定。

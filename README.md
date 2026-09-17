# Pulse H5

Pulse 的完整移动 Web 前端，与 `pulse-ios` 对应，复用 `pulse-api` 的业务与生成能力。用户可以在浏览器中发现和游玩互动作品、通过一句话与素材创作、Remix 他人的作品、预览发布，并管理自己的作品与账号。

**项目形态：移动优先的 H5 应用。主导航为 Home / Create / Profile。公开 Web Player 是应用中的分享与游玩模块，不是整个项目。**

## 当前状态

仓库已初始化产品范围、架构、接口对接清单和开发路线。应用代码、页面、账号登录及真实 API 联调尚未实现；本仓库目前没有可启动的前端，也未部署网站。以下能力是目标范围，不代表已交付。

## 产品范围

| 模块 | H5 目标能力 |
| --- | --- |
| Home | Featured / Latest Feed、分页、作品详情、点赞、评论、收藏、分享、举报 |
| Player | Feed 内游玩、沉浸模式与退出、私有预览、公开链接、结果与挑战 |
| Create | 独立原创、一句话输入、素材选择与上传、连续多轮修改 |
| Remix | 原作入口、来源与作者归因、权限校验、素材继承 |
| Generation | Plan、生成与验收进度、取消、重试、刷新后恢复任务 |
| Publish | 私有预览、发布、更新已发布版本、撤销公开链接 |
| Profile | 个人资料、作品、草稿、版本、收藏、最近游玩 |
| Account & Settings | Web 登录、会话恢复、条款、隐私、屏蔽、举报记录、数据与账号管理 |

## 文档

- [产品定义与页面范围](docs/product.md)
- [架构与后端对接](docs/architecture.md)
- [实施路线与验收](docs/roadmap.md)
- [开发约定](AGENTS.md)

## 与其他项目的关系

- [`pulse-ios`](https://github.com/shikanon/pulse-ios)：产品流程、状态语义和交互参照；按浏览器特性适配，不直接移植 SwiftUI。
- [`pulse-api`](https://github.com/shikanon/pulse-api)：共享用户、作品、素材、生成、发布和互动数据；H5 不另建业务后端或 Agent。
- [`pulse-admin`](https://github.com/shikanon/pulse-admin)：运营与审核后台，保持独立，不作为 H5 消费者登录入口。

以上关联仓库的访问受各自权限控制，克隆本公开仓库不保证能访问它们。

## 技术方向

计划使用 React + TypeScript + Vite，按业务模块组织移动端 SPA。正式脚手架阶段再锁定依赖和运行命令。浏览器客户端仅持有公开配置；模型、存储和服务端密钥均由 `pulse-api` 管理。

上线前必须完成消费者 Web 认证、API/CORS 配置和真实浏览器核心链路验收。公开仓库创建不代表线上应用已发布。

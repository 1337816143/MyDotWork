# AI工作台公开目录

目录源为 `data/workbench-catalog.json`，编辑器 schema 为同目录 `workbench-catalog.schema.json`。`scripts/build_catalog.py` 仅读取这份明确清单及已公开的 `data/projects.json`，没有目录扫描、Library 检索或聊天导入。生成 `dist/dashboard/catalog.json` 与工作台内嵌目录；研究 `data.json` 独立保留。

## 加入明确成果

每项成果或网站必须提供稳定 `id`、准确公开标题 `title`、`type`、所属 `task`、公开可用 `url`、真实 `updatedAt`（未知为 null）、`summary`、`access` 和明确的 `metadataApproved: true`。不把当前构建时间写成资料更新时间，不生成占位报告或网站。`access` 为 `public` 或 `login`，表示目标访问条件；需登录的元数据本身仍必须得到明确公开许可。当前没有需登录条目。

私有标题、Library 链接、签名 URL、账户操作、内部资料和秘密不能先写进这份公开仓库清单再指望构建器隐藏。未授权资料留在独立个人待审位置，不进入仓库、发布 JSON 或网页。构建拒绝未获准元数据、未知字段、凭据、查询 URL、非 HTTPS 外链和 Library 链接。`metadataApproved` 必须来自真实许可，不能批量把私人文件改为 true。

`artifacts` 包括报告、数据、教程、排障和归档；`websites` 只放有确切 URL 的网站，不从项目名字猜域名。缺失网站不制造入口。目录数字分别表示成果、网站和任务，不代表所有历史产出已被完整收录。

## 任务进度

当前 `tasks` 是明确获准的公开项目引用：`projectIndex` 与 `expectedTitle` 同时校验，项目顺序或名称改变时构建停止，要求检查映射。状态、进展、缺口和观察日期来自既有公开项目快照；新进度需先更新经审核的公开源。没有进度百分比或自动完成判定。

`project-1` 等 ID 对应既有公开项目顺序，**不是当前对话的任务3、任务5编号**。接入后续研究和报告时，应按父任务提供的明确主题和公开清单映射，不能按对话序号自动对应项目行。

## 验证与发布

运行 `PYTHONUTF8=1 python scripts/build.py`、`python scripts/validate.py`、`python scripts/validate_catalog.py`、`node scripts/test_dashboard.cjs`、`node scripts/test_catalog.cjs` 和 `node scripts/browser_dashboard.cjs`。目录验证检查批准范围、来源、深链接、无未知字段、更新时间和构建一致性；浏览器覆盖搜索、组合筛选、空结果、重置、深浅及A布局、手机导航和原生键盘。数据日期为源文件真实日期，日期过滤使用 UTC，未知日期排末尾且不进入日期范围。

父任务统一整合新清单、发布 MyDotWork，并通过既有流程同步 My-Evolution / Evolution 镜像。镜像必须包含 `dashboard/catalog.json`；发布源以最终上游提交 SHA 重建。没有增加外部账号、遥测或付费依赖。

## v1.7.1 历史研究扩展

- 第3—8轮上游补充的报告与JSON属于 `project-1`，保留稳定路径 `research/round3-7/`。旧7章、30条历史报价及原修正记录经过语义哈希保留检查。
- 副业调研v1.3的报告、JSON和 `sample-v0.1.zip` 属于独立 `project-17`，路径为 `research/ai-side-income/`，不是农业平台project-5。
- `scripts/build_publications.py`逐一固定五项文件及审核SHA，按原始字节复制；不会扫描目录。来源观察日期与目录更新时间分开。
- ZIP是66,163字节外层成果包，内含53,012字节核心样品、执行清单和产品规格；`data/publication-archives.json`固定42个递归成员的路径、字节数和SHA，验证拒绝路径穿越、链接、加密、外部OOXML关系、秘密和未审阅成员。
- 14项成果、4个网站、17个项目是本次明确公开清单，聊天仍为既有355条。仅C10窄范围原创评估样品已完成，正式商品、独立用户、销售与提现验证尚未完成。
- Farm和Paper沿用既有项目身份；发布状态须以各自真实部署结果核验，不能由项目名称或本地测试猜测上线。

Paper与Farm独立网站地址按实际部署核验，映射任务6与5，更新时间为2026-10-03；旧工作台和镜像入口仍保留未知更新时间。项目数据更新时间必须与目录关联一致。

## v1.8 有时间标记的七项状态

目录schema升级为2，增加明确审核的 `statusSnapshot`。它包含时间、四种枚举状态、当前动作、等待对象、结果链接、发布说明、需求完成边界及当前dot可见原文的消息引用。没有实时后端，页面必须写清快照时间，不从“已上线”自动推断任务已完成。

当前对话任务1/2对应历史项目4，任务3对应项目1，任务4对应项目2/3，任务5对应项目17，任务6对应项目6，任务7对应项目5。`task-1`至`task-7`是新的工作任务编号，不能替换历史 `project-*` 身份。七项状态不增减15份成果、4个网站与17项历史项目计数。

快照中的每项仍要求明确公开许可；私有接管仅公开数量、缺口和用户向状态，禁止复制私有原文、部署路径或内部任务引用。`evidenceMessageIds`只引用本公开归档中的用户/助手可见消息。当前方向与较早建议分别链接，原文不改写。

本批归档保留355条并增加79条，合计434条、424条有文字。三页均为部分返回，`readApiHistoryExhausted`必须为false；不能仅凭最早/最晚时间、7条重叠或成功ID去重声称区间完整。`data/chat-integrity.json`固定已审原文数组及旧355条前缀的规范化哈希。

`node scripts/test_status.cjs`检查状态、等待、发布与需求完成的分离，以及日期/角色/项目关键词筛选。CI必须运行该测试；真实视口与三种外观在云端托管Linux浏览器检查，网站发布不使用用户电脑。旧两份研究报告与两个样品包保持原字节。

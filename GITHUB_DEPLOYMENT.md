# GitHub 独立部署说明

这套系统不需要 ChatGPT、OpenAI Sites、独立数据库或后端服务器。网站由 GitHub Pages 提供，复盘数据通过 GitHub Contents API 直接保存到你自己的私有数据仓库。

## 推荐的双仓库结构

1. `dragon-review-app`：网站源码。可以设为公开仓库，以使用免费的 GitHub Pages；仓库中没有复盘数据和令牌。
2. `dragon-review-data`：复盘数据。设为私有仓库，仅保存 `data/records.json` 及其完整提交历史。

## 第一次部署

1. 在 GitHub 新建 `dragon-review-app`，把本项目全部文件推送到 `main` 分支。
2. 打开该仓库的 **Settings → Pages → Build and deployment**，Source 选择 **GitHub Actions**。
3. 等待 `Deploy GitHub Pages` 工作流完成，访问工作流给出的 Pages 地址。
4. 新建私有仓库 `dragon-review-data`，勾选 **Add a README file** 以建立 `main` 分支。数据文件可以不预建，网站第一次保存时会自动创建。

## 每台设备的连接

每台设备各自创建一个 Fine-grained personal access token：

- Repository access：只选择 `dragon-review-data`。
- Repository permissions：只把 **Contents** 设为 **Read and write**。
- 其余权限保持 **No access**。

打开网站，填写 GitHub 用户名、数据仓库、分支、设备名称和令牌，然后连接。建议三台设备分别建立令牌，丢失某台设备时只撤销那一枚令牌。

## 同步和回溯规则

- 打开网页时从 GitHub 拉取。
- 页面保持打开时每 30 秒拉取一次。
- 修改停止 6 秒后自动保存；也可点击“立即提交”。
- 每次保存之前再次拉取最新版，避免覆盖其他日期的更新。
- 同一交易日被另一台设备修改时停止自动覆盖，并要求选择版本。
- 每次保存、删除和恢复都会生成 GitHub commit。
- “历史统计 → 提交历史与恢复”可把当前交易日恢复到任意旧提交；恢复操作本身也会生成新提交，所以历史不会被改写。

## 安全边界

- 令牌不会进入源码或数据文件，只保存在选择“记住令牌”的浏览器中。
- 不勾选“记住令牌”时，关闭页面后需要重新输入。
- 不要在公共电脑上记住令牌。
- 复盘数据仓库必须保持私有。
- 定期在 GitHub 账户设置中检查和撤销不再使用的令牌。

## 账号独立性

ChatGPT 账号丢失不影响网站、GitHub Pages、源码、数据或历史版本。真正需要保护的是 GitHub 账号：启用双重验证，保存恢复码，并保留一份定期下载的 JSON 快照。

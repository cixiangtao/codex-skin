# 安全策略

## 支持范围

安全修复面向当前最新的 macOS 桌面预览版和 npm `latest` 版本。旧版本可能需要先升级才能获得
修复。

## 私密报告漏洞

请通过 GitHub 的
[私密漏洞报告](https://github.com/cixiangtao/codex-skin/security/advisories/new)
提交安全问题，不要创建公开 Issue。

报告时请尽量包含：

- 受影响的 Codex Skin 版本、发布标签和使用入口
- macOS、芯片架构与 Codex 桌面端版本
- 可复现的最小步骤和实际影响
- 已去除令牌、用户名、路径和个人数据的日志或截图
- 你已经尝试过的缓解方式

请不要在未经允许的情况下访问他人设备、数据或账户。项目不会在公开文档中承诺固定响应时限，
确认问题后会通过私密报告线程同步进展。

## 安全边界

Codex Skin 会在本机使用仅回环可访问的设置服务和 Chrome DevTools Protocol。请勿把相关端口
暴露到局域网或互联网。桌面预览版目前未使用 Apple Developer ID 签名或 Apple 公证，安装前应从
项目 GitHub Release 下载，并核对随 Release 提供的 SHA-256 校验值。

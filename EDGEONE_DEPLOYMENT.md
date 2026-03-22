# EdgeOne 部署指南

## 概述

EdgeOne 是腾讯云提供的边缘计算和静态网站托管服务，可以帮助您快速部署学生日程管理系统。

## 部署前准备

### 1. 准备配置文件

在部署前，需要创建 `config.js` 文件：

```javascript
window.APP_CONFIG = {
    SUPABASE_URL: 'https://lmvmctknyfmnukfsqbig.supabase.co',
    SUPABASE_ANON_KEY: 'your_supabase_anon_key_here',
    ZHIPU_API_KEY: 'your_public_zhipu_api_key_here'
};
```

**注意**：
- 将 `your_supabase_anon_key_here` 替换为实际的 Supabase 匿名密钥
- 将 `your_public_zhipu_api_key_here` 替换为公用的智谱AI API密钥

### 2. 检查文件结构

确保项目包含以下文件：

```
e:\TRAE_CODE\
├── index.html          # 主页面
├── styles.css          # 样式文件
├── app.js             # 应用逻辑
├── config.js           # 配置文件（需要创建）
├── supabase_schema.sql # 数据库结构（可选）
└── .gitignore         # Git忽略文件
```

### 3. 测试本地运行

在部署前，建议先在本地测试：

1. 双击 `index.html` 文件在浏览器中打开
2. 测试登录功能
3. 测试课程管理功能
4. 测试待办事项功能
5. 测试智能规划功能

## EdgeOne 部署步骤

### 方式一：通过 EdgeOne 控制台部署（推荐）

#### 步骤 1：注册/登录 EdgeOne

1. 访问 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 使用腾讯云账号登录
3. 如果没有账号，点击"注册"创建新账号

#### 步骤 2：创建站点

1. 登录后，点击"创建应用"或"新建站点"
2. 选择"静态网站托管"类型
3. 填写站点信息：
   - 站点名称：例如 `student-schedule-manager`
   - 域名：可以选择使用默认域名或绑定自定义域名
4. 点击"创建"

#### 步骤 3：上传文件

1. 进入站点管理页面
2. 点击"上传文件"或"部署"
3. 有以下几种上传方式：

**方式 A：直接上传文件**
1. 点击"上传文件"
2. 选择以下文件：
   - `index.html`
   - `styles.css`
   - `app.js`
   - `config.js`
3. 确认上传

**方式 B：拖拽上传**
1. 将项目文件夹拖拽到上传区域
2. 等待上传完成

**方式 C：ZIP 压缩包上传**
1. 将项目文件打包为 ZIP 文件
2. 上传 ZIP 文件
3. 系统会自动解压

#### 步骤 4：配置环境变量（可选）

如果需要在 EdgeOne 中配置环境变量：

1. 进入站点设置
2. 找到"环境变量"或"配置管理"
3. 添加以下变量：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ZHIPU_API_KEY`
4. 保存配置

**注意**：由于本项目使用 `config.js` 文件，环境变量主要用于构建时生成配置文件。

#### 步骤 5：部署完成

1. 等待文件上传完成
2. 系统会自动部署
3. 部署完成后，会提供访问 URL
4. 访问提供的 URL 测试站点

### 方式二：通过 Git 仓库部署

#### 步骤 1：准备 Git 仓库

1. 确保项目已推送到 GitHub/GitLab 等代码仓库
2. 确保仓库中包含 `config.js` 文件（或使用构建脚本生成）

#### 步骤 2：在 EdgeOne 中连接仓库

1. 在 EdgeOne 控制台创建站点
2. 选择"从 Git 仓库部署"
3. 填写仓库信息：
   - Git 提供商：GitHub / GitLab / Gitee
   - 仓库地址：例如 `https://github.com/username/student-schedule-manager`
   - 分支：`main` 或 `master`
4. 点击"连接"

#### 步骤 3：配置部署设置

1. 配置构建命令（如果需要）：
   - 本项目是静态网站，无需构建命令
2. 配置输出目录：
   - 通常为 `/` 或 `/dist`
3. 配置自动部署：
   - 启用"推送时自动部署"

#### 步骤 4：部署

1. 点击"立即部署"
2. 等待部署完成
3. 访问提供的 URL 测试站点

### 方式三：使用 EdgeOne CLI 工具部署

#### 步骤 1：安装 EdgeOne CLI

```bash
npm install -g @tencent/edgeone-cli
```

#### 步骤 2：登录 EdgeOne

```bash
edgeone login
```

按照提示输入腾讯云账号和密码。

#### 步骤 3：初始化项目

```bash
cd e:\TRAE_CODE
edgeone init
```

按照提示选择或创建站点。

#### 步骤 4：部署项目

```bash
edgeone deploy
```

等待部署完成。

## 部署后配置

### 1. 配置自定义域名（可选）

如果需要使用自定义域名：

1. 在 EdgeOne 控制台进入站点设置
2. 找到"域名管理"
3. 点击"添加域名"
4. 填写自定义域名，例如 `schedule.yourdomain.com`
5. 按照提示配置 DNS 解析：
   - 添加 CNAME 记录
   - 记录值：EdgeOne 提供的域名
6. 等待 DNS 生效（通常需要 10-30 分钟）

### 2. 配置 HTTPS（推荐）

EdgeOne 默认提供 HTTPS 证书：

1. 确认站点已启用 HTTPS
2. 如果使用自定义域名，需要配置 SSL 证书
3. EdgeOne 提供免费 Let's Encrypt 证书

### 3. 配置 CDN 加速（可选）

EdgeOne 默认提供 CDN 加速：

1. 确认 CDN 已启用
2. 配置缓存规则（如果需要）
3. 设置缓存过期时间

## 常见问题

### 1. 部署后无法访问

**可能原因**：
- 文件上传不完整
- `config.js` 文件未上传
- DNS 解析未完成

**解决方法**：
1. 检查文件列表，确认所有文件都已上传
2. 确认 `config.js` 文件存在且配置正确
3. 检查浏览器控制台是否有错误
4. 如果使用自定义域名，检查 DNS 解析

### 2. 登录功能无法使用

**可能原因**：
- Supabase 配置错误
- CORS 配置问题

**解决方法**：
1. 检查 `config.js` 中的 Supabase URL 和密钥是否正确
2. 在 Supabase 控制台检查 CORS 设置
3. 确认 Supabase 项目已启用 Email/Password 登录

### 3. 智能规划功能无法使用

**可能原因**：
- 智谱AI API 密钥未配置
- API 密钥无效或已过期
- 网络问题导致 API 调用失败

**解决方法**：
1. 检查 `config.js` 中的 `ZHIPU_API_KEY` 是否正确
2. 在智谱AI控制台确认密钥状态
3. 检查浏览器控制台的错误信息
4. 确认智谱AI 服务是否正常运行

### 4. 页面样式异常

**可能原因**：
- `styles.css` 文件未正确加载
- 文件路径错误

**解决方法**：
1. 检查 `index.html` 中的 CSS 引用路径
2. 确认 `styles.css` 文件已上传
3. 清除浏览器缓存后重试

### 5. 数据库连接失败

**可能原因**：
- Supabase 数据库未初始化
- 表结构未创建

**解决方法**：
1. 在 Supabase 控制台的 SQL 编辑器中
2. 执行 `supabase_schema.sql` 文件中的 SQL 命令
3. 确认所有表都已创建
4. 检查 RLS 策略是否正确配置

## 监控和维护

### 1. 监控站点状态

在 EdgeOne 控制台可以：
- 查看站点访问日志
- 监控流量和带宽使用
- 查看错误日志
- 设置告警通知

### 2. 监控 API 使用

定期检查：
- 智谱AI API 使用量
- Supabase 数据库使用情况
- 发现异常及时处理

### 3. 备份数据

建议定期备份：
- Supabase 数据库备份
- 导出重要数据

### 4. 更新部署

当需要更新功能时：

1. 修改代码
2. 测试本地版本
3. 更新 `config.js`（如果需要）
4. 重新部署到 EdgeOne
5. 验证新功能正常工作

## 性能优化

### 1. 启用压缩

EdgeOne 默认启用 Gzip 压缩，可以：
- 减少文件传输大小
- 加快页面加载速度

### 2. 配置缓存

在 EdgeOne 控制台可以配置：
- 静态资源缓存时间
- HTML 页面缓存策略
- API 响应缓存

### 3. 使用 CDN

EdgeOne 提供全球 CDN 加速：
- 内容分发到全球节点
- 用户访问最近的节点
- 降低延迟

## 安全建议

### 1. 启用 HTTPS

- 确保所有连接都使用 HTTPS
- 配置正确的 SSL 证书
- 强制 HTTPS 重定向

### 2. 配置安全头

在 EdgeOne 控制台可以配置：
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options

### 3. 限制访问

- 配置 IP 白名单（如果需要）
- 设置访问频率限制
- 监控异常访问

## 成本估算

EdgeOne 静态网站托管通常提供：
- 免费额度：每月一定的流量和请求次数
- 付费套餐：超出免费额度后按量计费

建议：
1. 监控使用量
2. 设置用量告警
3. 根据实际需求选择合适的套餐

## 联系支持

如果遇到部署问题：

1. 查看 [EdgeOne 文档](https://cloud.tencent.com/document/product/edgeone)
2. 提交工单到腾讯云
3. 联系项目维护者

## 快速部署检查清单

部署前请确认：

- [ ] 已创建 `config.js` 文件
- [ ] 配置文件中的密钥已替换为实际值
- [ ] 本地测试功能正常
- [ ] 所有必需文件已准备
- [ ] 已注册 EdgeOne 账号
- [ ] 已阅读 EdgeOne 部署文档

部署后请确认：

- [ ] 站点可以正常访问
- [ ] 登录功能正常
- [ ] 课程管理功能正常
- [ ] 待办事项功能正常
- [ ] 智能规划功能正常
- [ ] 页面样式正常显示
- [ ] 数据库连接正常
- [ ] HTTPS 已启用
- [ ] 自定义域名已配置（如需要）

## 总结

EdgeOne 部署学生日程管理系统的关键步骤：

1. 准备配置文件 `config.js`
2. 在 EdgeOne 控制台创建站点
3. 上传项目文件或连接 Git 仓库
4. 配置自定义域名（可选）
5. 测试所有功能
6. 配置监控和告警
7. 定期维护和更新

通过以上步骤，您可以成功将学生日程管理系统部署到 EdgeOne，并享受其提供的全球加速和高可用性。

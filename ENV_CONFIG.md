# 环境变量配置说明

## 概述

本项目使用配置文件来存储敏感配置信息，包括Supabase连接信息和智谱AI API密钥。

## 配置步骤

### 1. 创建配置文件

在项目根目录下创建 `config.js` 文件：

```javascript
window.APP_CONFIG = {
    SUPABASE_URL: 'https://lmvmctknyfmnukfsqbig.supabase.co',
    SUPABASE_ANON_KEY: 'your_supabase_anon_key_here',
    ZHIPU_API_KEY: 'your_public_zhipu_api_key_here'
};
```

### 2. 编辑配置文件

将 `config.js` 文件中的占位符替换为实际的配置值：
- `your_supabase_anon_key_here`: 替换为实际的Supabase匿名密钥
- `your_public_zhipu_api_key_here`: 替换为公用的智谱API密钥

### 3. 在代码中使用

在 `app.js` 中通过 `window.APP_CONFIG` 访问配置：

```javascript
const supabaseClient = createClient(
    window.APP_CONFIG.SUPABASE_URL, 
    window.APP_CONFIG.SUPABASE_ANON_KEY
);

async callZhipuAPI(planScope, planType) {
    const apiKey = window.APP_CONFIG.ZHIPU_API_KEY;
    // ...
}
```

## 配置说明

### Supabase配置

- `SUPABASE_URL`: Supabase项目的URL
- `SUPABASE_ANON_KEY`: Supabase的匿名访问密钥

### 智谱AI配置

- `ZHIPU_API_KEY`: 智谱AI的API密钥（公用密钥）

## 公用密钥说明

本项目使用公用的智谱AI API密钥，具有以下特点：

1. **无需用户输入**：用户不需要在界面上输入API密钥
2. **统一管理**：密钥由管理员统一配置和管理
3. **简化使用**：降低用户使用门槛，提升用户体验
4. **监控需求**：需要监控API使用情况，防止滥用

## 部署配置

### Vercel部署

在Vercel项目设置中添加环境变量：
1. 进入项目设置
2. 点击 "Environment Variables"
3. 添加 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`ZHIPU_API_KEY` 变量
4. 重新部署项目

**注意**：Vercel会自动将环境变量注入到构建过程中，需要在构建时生成 `config.js` 文件。

### Netlify部署

在Netlify项目设置中添加环境变量：
1. 进入项目设置
2. 点击 "Build & deploy" -> "Environment"
3. 添加 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`ZHIPU_API_KEY` 变量
4. 重新部署项目

**注意**：Netlify会自动将环境变量注入到构建过程中，需要在构建时生成 `config.js` 文件。

### EdgeOne部署

在EdgeOne部署时，需要在服务器环境变量中配置：
1. 在服务器上创建 `config.js` 文件
2. 填入实际的配置值
3. 确保 `config.js` 在正确的位置

### 构建时生成配置文件

如果使用构建工具（如Vite、Webpack），可以在构建时自动生成 `config.js`：

**Vite示例**：
```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'window.APP_CONFIG': JSON.stringify({
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      ZHIPU_API_KEY: process.env.ZHIPU_API_KEY
    })
  }
});
```

**Webpack示例**：
```javascript
// webpack.config.js
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'window.APP_CONFIG': JSON.stringify({
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        ZHIPU_API_KEY: process.env.ZHIPU_API_KEY
      })
    })
  ]
};
```

## 安全注意事项

### 配置文件管理

1. **永远不要提交 config.js 文件到版本控制系统**
   - `config.js` 文件已在 `.gitignore` 中配置
   - 只提交 `config.js.example` 模板文件

2. **使用 config.js.example 作为模板**
   - 不要在示例文件中包含真实密钥
   - 提供清晰的配置说明

3. **分离开发和生产配置**
   - 开发环境：使用本地 `config.js` 文件
   - 生产环境：使用构建时注入的环境变量

### 公用密钥管理

1. **使用限制**：
   - 设置API调用频率限制
   - 设置每日/每月调用次数限制
   - 设置IP白名单（如需要）

2. **监控机制**：
   - 定期检查API使用情况
   - 监控异常调用模式
   - 设置使用量告警

3. **密钥轮换**：
   - 定期更换API密钥
   - 发现异常立即更换
   - 保留密钥更换记录

4. **访问控制**：
   - 限制密钥的访问权限
   - 记录密钥的使用日志
   - 定期审计密钥使用情况

### 生产环境

1. **使用环境变量管理工具**：
   - Vercel/Netlify等平台的环境变量功能
   - AWS Secrets Manager
   - HashiCorp Vault

2. **构建时生成配置文件**：
   - 不要在代码仓库中包含真实配置
   - 使用构建工具从环境变量生成配置
   - 确保配置文件不被提交到版本控制

3. **定期更换密钥**：
   - 提高安全性
   - 降低密钥泄露风险

4. **监控API使用情况**：
   - 在智谱AI控制台监控API调用
   - 发现异常及时处理

## 故障排除

### 配置文件未加载

如果遇到配置文件未加载的错误：
1. 确认 `config.js` 文件存在于项目根目录
2. 检查 `index.html` 中是否正确引用了 `config.js`
3. 确认 `config.js` 在 `app.js` 之前加载
4. 检查浏览器控制台是否有加载错误

### API密钥无效

如果遇到API密钥无效的错误：
1. 检查 `config.js` 中的密钥是否正确
2. 确认密钥是否已激活
3. 检查密钥是否有足够的配额
4. 检查是否达到使用限制

### API调用失败

如果遇到API调用失败：
1. 检查网络连接
2. 查看浏览器控制台错误信息
3. 确认配置文件是否正确加载
4. 检查智谱AI服务状态

## 当前实现

本项目采用配置文件方案：

1. **配置存储**：
   - 开发环境：`config.js` 文件
   - 生产环境：构建时从环境变量生成

2. **代码实现**：
   - 创建 `config.js` 文件，定义 `window.APP_CONFIG` 对象
   - 在 `app.js` 中通过 `window.APP_CONFIG` 访问配置
   - 所有敏感信息都存储在配置文件中

3. **安全性**：
   - `config.js` 文件在 `.gitignore` 中，不会被提交
   - 开发环境使用本地配置文件
   - 生产环境使用环境变量构建

4. **用户体验**：
   - 用户无需配置API密钥
   - 直接使用智能规划功能
   - 简化使用流程

## 配置文件示例

创建 `config.js.example` 文件作为模板：

```javascript
window.APP_CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your_supabase_anon_key_here',
    ZHIPU_API_KEY: 'your_public_zhipu_api_key_here'
};
```

## 联系支持

如果遇到其他问题，请：
1. 查看项目文档
2. 提交Issue
3. 联系项目维护者

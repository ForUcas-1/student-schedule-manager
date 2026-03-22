# EdgeOne Pages 部署配置

## 环境变量配置

在 EdgeOne Pages 控制台中配置以下环境变量：

### 步骤

1. 登录 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 进入你的项目
3. 点击 **项目设置** → **环境变量**
4. 添加以下变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `eyJhbGciOiJIUzI1NiIs...` |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `sk-xxxxxx` |

### 构建配置

在 EdgeOne Pages 项目设置中：

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `/` |
| Node.js 版本 | 18.x 或更高 |

### 部署流程

1. EdgeOne 从 GitHub 拉取代码（不包含 config.js）
2. 读取环境变量
3. 执行 `npm run build`
4. `build.js` 从环境变量生成 `config.js`
5. 部署完成

## 本地开发

```bash
# 1. 复制环境变量示例文件
cp .env.example .env

# 2. 编辑 .env 文件，填入实际密钥

# 3. 运行构建脚本生成 config.js
npm run build

# 4. 打开 index.html 测试
```

## 注意事项

- `config.js` 已在 `.gitignore` 中，不会被提交到 GitHub
- `.env` 文件也不会被提交到 GitHub
- 部署时 EdgeOne 会从环境变量生成 `config.js`

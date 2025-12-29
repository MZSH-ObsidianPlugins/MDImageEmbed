# MD Image Embed

MDImageEmbed 是一个 Obsidian 插件，可将 Markdown 文件中的本地图片转换为 Base64 内嵌格式。适用于导出笔记、发布博客或分享文档，无需依赖外部图片文件。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-7c3aed)](https://obsidian.md)

## 功能特性

- **一键转换**：右键菜单 → 复制为 Base64 格式到剪贴板
- **智能路径解析**：支持 Obsidian 的各种图片路径格式
- **防转载保护**：从模板文件添加自定义前缀/后缀（v1.1.0）
- **格式支持**：PNG、JPG、JPEG、GIF、WebP、SVG、BMP
- **Wiki 链接支持**：将 `![[image.png]]` 转换为带 Base64 的标准 Markdown

## 安装方法

### 手动安装

1. 从最新 Release 下载 `main.js`、`manifest.json` 和 `styles.css`
2. 创建文件夹 `<Vault>/.obsidian/plugins/md-image-embed/`
3. 将文件复制到该文件夹
4. 重启 Obsidian，在 设置 → 第三方插件 中启用插件

### 从源码构建

```bash
git clone https://github.com/MZSH-ObsidianPlugins/MDImageEmbed.git
cd MDImageEmbed
npm install
npm run build
```

## 使用方法

1. 在 Obsidian 文件浏览器中右键点击任意 `.md` 文件
2. 选择 **复制为 Base64 格式**
3. 将转换后的内容粘贴到任意位置

### 设置选项

在 **设置 → 第三方插件 → MD Image Embed** 中配置：

- **显示转换日志**：在通知中显示转换摘要信息
- **显示详细日志**：在通知中显示每个图片的状态
- **转换 Wiki 链接**：将 `![[image.png]]` 转换为标准 Markdown
- **跳过 Base64 图片**：跳过已转换的 Base64 图片
- **前缀/后缀文件路径**：在文章前后添加自定义内容（用于防转载保护）

### 防转载保护

添加版权声明或作者信息：

1. 创建模板文件（如 `templates/prefix.md`、`templates/suffix.md`）
2. 在插件设置中输入文件路径
3. 复制时会自动添加内容

## 注意事项

- 仅支持本地图片（网络 URL 会被跳过）
- Base64 编码会使文件体积增加约 33%
- 建议仅用于导出/分享场景

## 许可证

MIT License

## 联系方式

邮箱：mengzhishanghun@outlook.com

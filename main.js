/*
MDImageEmbed - Obsidian Plugin
将 Markdown 图片转换为 Base64 内嵌格式
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MDImageEmbedPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  showConversionLog: true,
  showDetailedLog: false,
  convertWikiLinks: true,
  skipBase64Images: true,
  prefixFilePath: "",
  suffixFilePath: ""
};
var MDImageEmbedPlugin = class extends import_obsidian.Plugin {
  // ========== 插件生命周期 ==========
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MDImageEmbedSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof import_obsidian.TFile && file.extension === "md") {
          this.addFileMenuItems(menu, file);
        }
      })
    );
    console.log("MD Image Embed plugin loaded");
  }
  onunload() {
    console.log("MD Image Embed plugin unloaded");
  }
  // ========== 设置管理 ==========
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  // ========== 右键菜单 ==========
  addFileMenuItems(menu, file) {
    menu.addItem((item) => {
      item.setTitle("Copy as Base64 format").setIcon("clipboard-copy").onClick(async () => {
        await this.copyAsBase64(file);
      });
    });
  }
  // ========== 辅助方法: 读取前缀/后缀文件内容 ==========
  async readTemplateFile(filePath) {
    if (!filePath || filePath.trim() === "") {
      return "";
    }
    try {
      const file = this.app.vault.getAbstractFileByPath(filePath.trim());
      if (file instanceof import_obsidian.TFile) {
        const content = await this.app.vault.read(file);
        if (this.settings.showConversionLog) {
          console.log(`[MDImageEmbed] \u6210\u529F\u8BFB\u53D6\u6A21\u677F\u6587\u4EF6: ${filePath}`);
        }
        return content;
      } else {
        if (this.settings.showConversionLog) {
          console.warn(`[MDImageEmbed] \u6A21\u677F\u6587\u4EF6\u672A\u627E\u5230: ${filePath}`);
        }
        return "";
      }
    } catch (error) {
      if (this.settings.showConversionLog) {
        console.error(`[MDImageEmbed] \u8BFB\u53D6\u6A21\u677F\u6587\u4EF6\u5931\u8D25: ${filePath}`, error);
      }
      return "";
    }
  }
  // ========== 功能 1: 复制到剪贴板 ==========
  async copyAsBase64(file) {
    try {
      let content = await this.app.vault.read(file);
      const prefix = await this.readTemplateFile(this.settings.prefixFilePath);
      if (prefix) {
        content = prefix + "\n\n" + content;
      }
      const suffix = await this.readTemplateFile(this.settings.suffixFilePath);
      if (suffix) {
        content = content + "\n\n" + suffix;
      }
      const result = await this.convertMarkdownToBase64(content, file);
      await navigator.clipboard.writeText(result.content);
      if (this.settings.showConversionLog) {
        this.showDetailedResults(result);
      } else {
        new import_obsidian.Notice("\u2705 Copied as Base64 format");
      }
    } catch (error) {
      new import_obsidian.Notice("\u274C Failed to copy: " + error.message);
      console.error("Copy failed:", error);
    }
  }
  // ========== 显示详细处理结果 ==========
  showDetailedResults(result) {
    const total = result.convertedCount + result.skippedCount;
    let message = "\u2705 Copied to clipboard\n\n";
    message += `\u{1F4CA} Summary: ${total} images
`;
    message += `   \u2022 Converted: ${result.convertedCount}
`;
    message += `   \u2022 Skipped: ${result.skippedCount}`;
    if (this.settings.showDetailedLog) {
      message += "\n\n";
      const maxDisplay = 8;
      const detailsToShow = result.details.slice(0, maxDisplay);
      for (const detail of detailsToShow) {
        const fileName = detail.path.split("/").pop() || detail.path;
        const shortName = fileName.length > 35 ? fileName.substring(0, 32) + "..." : fileName;
        if (detail.status === "success") {
          message += `\u2713 ${shortName}
`;
        } else if (detail.status === "failed") {
          message += `\u2717 ${shortName}
  \u2192 ${detail.reason}
`;
        } else if (detail.status === "skipped") {
          message += `\u2298 ${shortName}
  \u2192 ${detail.reason}
`;
        }
      }
      if (result.details.length > maxDisplay) {
        const remaining = result.details.length - maxDisplay;
        message += `
... and ${remaining} more`;
      }
    }
    message += `

\u{1F4A1} Console (Ctrl+Shift+I) for full details`;
    new import_obsidian.Notice(message, 8e3);
  }
  // ========== 核心转换逻辑 ==========
  async convertMarkdownToBase64(content, sourceFile) {
    const imgRegex = /!\[([^\]]*)\]\(<?([^)">]+)>?\)|!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\]\]/gi;
    let result = content;
    let convertedCount = 0;
    let skippedCount = 0;
    const details = [];
    const matches = [...content.matchAll(imgRegex)];
    if (this.settings.showConversionLog) {
      console.log(`[MDImageEmbed] \u5F00\u59CB\u5904\u7406\u6587\u6863\uFF0C\u5171\u627E\u5230 ${matches.length} \u4E2A\u56FE\u7247`);
    }
    for (const match of matches) {
      const fullMatch = match[0];
      if (match[1] !== void 0) {
        const altText = match[1];
        const imagePath = match[2];
        if (this.settings.skipBase64Images && imagePath.startsWith("data:image")) {
          skippedCount++;
          const displayPath = imagePath.substring(0, 30) + "...";
          details.push({ path: displayPath, status: "skipped", reason: "Already Base64" });
          if (this.settings.showConversionLog) {
            console.log(`[\u8DF3\u8FC7] ${displayPath} - \u539F\u56E0: \u5DF2\u662F Base64 \u683C\u5F0F`);
          }
          continue;
        }
        if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
          skippedCount++;
          details.push({ path: imagePath, status: "skipped", reason: "Network image (not supported)" });
          if (this.settings.showConversionLog) {
            console.log(`[\u8DF3\u8FC7] ${imagePath} - \u539F\u56E0: \u7F51\u7EDC\u56FE\u7247\u4E0D\u652F\u6301\u8F6C\u6362`);
          }
          continue;
        }
        const base64 = await this.imageToBase64(imagePath, sourceFile);
        if (base64) {
          result = result.replace(fullMatch, `![${altText}](${base64})`);
          convertedCount++;
          details.push({ path: imagePath, status: "success" });
          if (this.settings.showConversionLog) {
            console.log(`[\u6210\u529F] ${imagePath} - \u5DF2\u8F6C\u6362\u4E3A Base64`);
          }
        } else {
          skippedCount++;
          details.push({ path: imagePath, status: "failed", reason: "File not found" });
          if (this.settings.showConversionLog) {
            console.log(`[\u5931\u8D25] ${imagePath} - \u539F\u56E0: \u6587\u4EF6\u672A\u627E\u5230\u6216\u8BFB\u53D6\u5931\u8D25`);
          }
        }
      } else if (match[3] !== void 0) {
        const imageName = match[3];
        const displayPath = `![[${imageName}]]`;
        if (!this.settings.convertWikiLinks) {
          skippedCount++;
          details.push({ path: displayPath, status: "skipped", reason: "Wiki link conversion disabled" });
          if (this.settings.showConversionLog) {
            console.log(`[\u8DF3\u8FC7] ${displayPath} - \u539F\u56E0: Wiki \u94FE\u63A5\u8F6C\u6362\u5DF2\u7981\u7528`);
          }
          continue;
        }
        const base64 = await this.imageToBase64(imageName, sourceFile);
        if (base64) {
          result = result.replace(fullMatch, `![${imageName}](${base64})`);
          convertedCount++;
          details.push({ path: displayPath, status: "success" });
          if (this.settings.showConversionLog) {
            console.log(`[\u6210\u529F] ${displayPath} - \u5DF2\u8F6C\u6362\u4E3A Base64`);
          }
        } else {
          skippedCount++;
          details.push({ path: displayPath, status: "failed", reason: "File not found" });
          if (this.settings.showConversionLog) {
            console.log(`[\u5931\u8D25] ${displayPath} - \u539F\u56E0: \u6587\u4EF6\u672A\u627E\u5230\u6216\u8BFB\u53D6\u5931\u8D25`);
          }
        }
      }
    }
    if (this.settings.showConversionLog) {
      console.log(`[MDImageEmbed] \u5904\u7406\u5B8C\u6210: ${convertedCount} \u4E2A\u6210\u529F, ${skippedCount} \u4E2A\u8DF3\u8FC7`);
    }
    return { content: result, convertedCount, skippedCount, details };
  }
  // ========== 图片转 Base64 ==========
  async imageToBase64(imagePath, sourceFile) {
    try {
      const imageFile = this.resolveImagePath(imagePath, sourceFile);
      if (!imageFile) {
        if (this.settings.showConversionLog) {
          console.warn(`  \u2514\u2500 \u8DEF\u5F84\u89E3\u6790\u5931\u8D25: \u5728\u4EE5\u4E0B\u4F4D\u7F6E\u90FD\u672A\u627E\u5230\u6587\u4EF6`);
          console.warn(`     - Vault \u6839\u76EE\u5F55: ${imagePath}`);
          if (sourceFile.parent) {
            console.warn(`     - \u76F8\u5BF9\u8DEF\u5F84: ${sourceFile.parent.path}/${imagePath}`);
          }
        }
        return null;
      }
      if (this.settings.showConversionLog) {
        console.log(`  \u2514\u2500 \u6587\u4EF6\u5DF2\u627E\u5230: ${imageFile.path}`);
      }
      const arrayBuffer = await this.app.vault.readBinary(imageFile);
      const base64 = this.arrayBufferToBase64(arrayBuffer);
      const mimeType = this.getMimeType(imageFile.extension);
      if (this.settings.showConversionLog) {
        const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(2);
        console.log(`  \u2514\u2500 \u6587\u4EF6\u5927\u5C0F: ${sizeKB} KB, MIME: ${mimeType}`);
      }
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      if (this.settings.showConversionLog) {
        console.error(`  \u2514\u2500 \u8BFB\u53D6\u6216\u8F6C\u6362\u5931\u8D25: ${error.message}`);
      }
      return null;
    }
  }
  // ========== 路径解析 ==========
  resolveImagePath(imagePath, sourceFile) {
    let cleanPath = imagePath.replace(/^<|>$/g, "").trim();
    try {
      const decoded = decodeURIComponent(cleanPath);
      if (decoded !== cleanPath) {
        if (this.settings.showConversionLog) {
          console.log(`  \u2514\u2500 URL \u89E3\u7801: "${cleanPath}" \u2192 "${decoded}"`);
        }
      }
      cleanPath = decoded;
    } catch (e) {
      if (this.settings.showConversionLog) {
        console.warn(`  \u2514\u2500 URL \u89E3\u7801\u5931\u8D25\uFF0C\u4F7F\u7528\u539F\u8DEF\u5F84: ${cleanPath}`);
      }
    }
    let file = this.app.vault.getAbstractFileByPath(cleanPath);
    if (file instanceof import_obsidian.TFile) {
      if (this.settings.showConversionLog) {
        console.log(`  \u2514\u2500 \u89E3\u6790\u65B9\u6CD5: Vault \u6839\u76EE\u5F55`);
      }
      return file;
    }
    if (sourceFile.parent) {
      const relativePath = `${sourceFile.parent.path}/${cleanPath}`;
      file = this.app.vault.getAbstractFileByPath(relativePath);
      if (file instanceof import_obsidian.TFile) {
        if (this.settings.showConversionLog) {
          console.log(`  \u2514\u2500 \u89E3\u6790\u65B9\u6CD5: \u76F8\u5BF9\u8DEF\u5F84 (${sourceFile.parent.path}/)`);
        }
        return file;
      }
    }
    const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
    if (resolvedFile instanceof import_obsidian.TFile) {
      if (this.settings.showConversionLog) {
        console.log(`  \u2514\u2500 \u89E3\u6790\u65B9\u6CD5: Obsidian \u94FE\u63A5\u89E3\u6790`);
      }
      return resolvedFile;
    }
    return null;
  }
  // ========== ArrayBuffer 转 Base64 ==========
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  // ========== 获取 MIME 类型 ==========
  getMimeType(extension) {
    const mimeTypes = {
      "png": "image/png",
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "gif": "image/gif",
      "webp": "image/webp",
      "svg": "image/svg+xml",
      "bmp": "image/bmp"
    };
    return mimeTypes[extension.toLowerCase()] || "image/png";
  }
};
var MDImageEmbedSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "MD Image Embed Settings" });
    new import_obsidian.Setting(containerEl).setName("Show conversion log").setDesc("Display summary information in notifications").addToggle((toggle) => toggle.setValue(this.plugin.settings.showConversionLog).onChange(async (value) => {
      this.plugin.settings.showConversionLog = value;
      await this.plugin.saveSettings();
      this.display();
    }));
    if (this.plugin.settings.showConversionLog) {
      new import_obsidian.Setting(containerEl).setName("Show detailed log").setDesc('Show individual image status in notifications (requires "Show conversion log")').addToggle((toggle) => toggle.setValue(this.plugin.settings.showDetailedLog).onChange(async (value) => {
        this.plugin.settings.showDetailedLog = value;
        await this.plugin.saveSettings();
      }));
    }
    new import_obsidian.Setting(containerEl).setName("Convert Wiki links").setDesc("Convert Obsidian Wiki links (![[image.png]]) to standard Markdown with Base64").addToggle((toggle) => toggle.setValue(this.plugin.settings.convertWikiLinks).onChange(async (value) => {
      this.plugin.settings.convertWikiLinks = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Skip Base64 images").setDesc("Skip images that are already in Base64 format").addToggle((toggle) => toggle.setValue(this.plugin.settings.skipBase64Images).onChange(async (value) => {
      this.plugin.settings.skipBase64Images = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Anti-reprint Protection" });
    new import_obsidian.Setting(containerEl).setName("Prefix file path").setDesc('Path to markdown file to prepend (e.g., "templates/prefix.md"). Leave empty to disable.').addText((text) => text.setPlaceholder("templates/prefix.md").setValue(this.plugin.settings.prefixFilePath).onChange(async (value) => {
      this.plugin.settings.prefixFilePath = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Suffix file path").setDesc('Path to markdown file to append (e.g., "templates/suffix.md"). Leave empty to disable.').addText((text) => text.setPlaceholder("templates/suffix.md").setValue(this.plugin.settings.suffixFilePath).onChange(async (value) => {
      this.plugin.settings.suffixFilePath = value.trim();
      await this.plugin.saveSettings();
    }));
  }
};
/**
 * MDImageEmbed - Obsidian Plugin
 * Convert local images in Markdown to Base64 embedded format
 *
 * @author mengzhishanghun
 * @license MIT
 */
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBNREltYWdlRW1iZWQgLSBPYnNpZGlhbiBQbHVnaW5cbiAqIENvbnZlcnQgbG9jYWwgaW1hZ2VzIGluIE1hcmtkb3duIHRvIEJhc2U2NCBlbWJlZGRlZCBmb3JtYXRcbiAqXG4gKiBAYXV0aG9yIG1lbmd6aGlzaGFuZ2h1blxuICogQGxpY2Vuc2UgTUlUXG4gKi9cbmltcG9ydCB7IFBsdWdpbiwgVEZpbGUsIE5vdGljZSwgTWVudSwgUGx1Z2luU2V0dGluZ1RhYiwgQXBwLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vLyA9PT09PT09PT09IFx1OEJCRVx1N0Y2RVx1NjNBNVx1NTNFMyA9PT09PT09PT09XG5pbnRlcmZhY2UgTURJbWFnZUVtYmVkU2V0dGluZ3Mge1xuXHRzaG93Q29udmVyc2lvbkxvZzogYm9vbGVhbjsgICAgICAgIC8vIFx1NjYyRlx1NTQyNlx1NjYzRVx1NzkzQVx1OEY2Q1x1NjM2Mlx1NjVFNVx1NUZEN1xuXHRzaG93RGV0YWlsZWRMb2c6IGJvb2xlYW47ICAgICAgICAgICAvLyBcdTY2MkZcdTU0MjZcdTY2M0VcdTc5M0FcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdUZGMDhcdTZCQ0ZcdTRFMkFcdTU2RkVcdTcyNDdcdTc2ODRcdTcyQjZcdTYwMDFcdUZGMDlcblx0Y29udmVydFdpa2lMaW5rczogYm9vbGVhbjsgICAgICAgICAgLy8gXHU2NjJGXHU1NDI2XHU4RjZDXHU2MzYyIFdpa2kgXHU5NEZFXHU2M0E1XG5cdHNraXBCYXNlNjRJbWFnZXM6IGJvb2xlYW47ICAgICAgICAgIC8vIFx1NjYyRlx1NTQyNlx1OERGM1x1OEZDN1x1NURGMlx1NjcwOSBCYXNlNjRcblx0cHJlZml4RmlsZVBhdGg6IHN0cmluZzsgICAgICAgICAgICAgLy8gXHU1MjREXHU3RjAwXHU2NTg3XHU0RUY2XHU4REVGXHU1Rjg0XHVGRjA4XHU2REZCXHU1MkEwXHU1MjMwXHU2NTg3XHU3QUUwXHU1RjAwXHU1OTM0XHVGRjA5XG5cdHN1ZmZpeEZpbGVQYXRoOiBzdHJpbmc7ICAgICAgICAgICAgIC8vIFx1NTQwRVx1N0YwMFx1NjU4N1x1NEVGNlx1OERFRlx1NUY4NFx1RkYwOFx1NkRGQlx1NTJBMFx1NTIzMFx1NjU4N1x1N0FFMFx1N0VEM1x1NUMzRVx1RkYwOVxufVxuXG5jb25zdCBERUZBVUxUX1NFVFRJTkdTOiBNREltYWdlRW1iZWRTZXR0aW5ncyA9IHtcblx0c2hvd0NvbnZlcnNpb25Mb2c6IHRydWUsXG5cdHNob3dEZXRhaWxlZExvZzogZmFsc2UsXG5cdGNvbnZlcnRXaWtpTGlua3M6IHRydWUsXG5cdHNraXBCYXNlNjRJbWFnZXM6IHRydWUsXG5cdHByZWZpeEZpbGVQYXRoOiAnJyxcblx0c3VmZml4RmlsZVBhdGg6ICcnXG59XG5cbi8vID09PT09PT09PT0gXHU0RTNCXHU2M0QyXHU0RUY2XHU3QzdCID09PT09PT09PT1cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ESW1hZ2VFbWJlZFBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG5cdHNldHRpbmdzOiBNREltYWdlRW1iZWRTZXR0aW5ncztcblxuXHQvLyA9PT09PT09PT09IFx1NjNEMlx1NEVGNlx1NzUxRlx1NTQ3RFx1NTQ2OFx1NjcxRiA9PT09PT09PT09XG5cdGFzeW5jIG9ubG9hZCgpIHtcblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG5cdFx0Ly8gXHU2Q0U4XHU1MThDXHU4QkJFXHU3RjZFXHU5NzYyXHU2NzdGXG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNREltYWdlRW1iZWRTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cblx0XHQvLyBcdTZDRThcdTUxOENcdTY1ODdcdTRFRjZcdTgzRENcdTUzNTVcdTRFOEJcdTRFRjZcdUZGMDhcdTUzRjNcdTk1MkVcdTgzRENcdTUzNTVcdUZGMDlcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtbWVudScsIChtZW51LCBmaWxlKSA9PiB7XG5cdFx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09ICdtZCcpIHtcblx0XHRcdFx0XHR0aGlzLmFkZEZpbGVNZW51SXRlbXMobWVudSwgZmlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdGNvbnNvbGUubG9nKCdNRCBJbWFnZSBFbWJlZCBwbHVnaW4gbG9hZGVkJyk7XG5cdH1cblxuXHRvbnVubG9hZCgpIHtcblx0XHRjb25zb2xlLmxvZygnTUQgSW1hZ2UgRW1iZWQgcGx1Z2luIHVubG9hZGVkJyk7XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1OEJCRVx1N0Y2RVx1N0JBMVx1NzQwNiA9PT09PT09PT09XG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdTUzRjNcdTk1MkVcdTgzRENcdTUzNTUgPT09PT09PT09PVxuXHRhZGRGaWxlTWVudUl0ZW1zKG1lbnU6IE1lbnUsIGZpbGU6IFRGaWxlKSB7XG5cdFx0Ly8gXHU4M0RDXHU1MzU1XHU5ODc5OiBcdTU5MERcdTUyMzZcdTRFM0EgQmFzZTY0IFx1NjgzQ1x1NUYwRlx1NTIzMFx1NTI2QVx1OEQzNFx1Njc3RlxuXHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0aXRlbVxuXHRcdFx0XHQuc2V0VGl0bGUoJ0NvcHkgYXMgQmFzZTY0IGZvcm1hdCcpXG5cdFx0XHRcdC5zZXRJY29uKCdjbGlwYm9hcmQtY29weScpXG5cdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvcHlBc0Jhc2U2NChmaWxlKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1OEY4NVx1NTJBOVx1NjVCOVx1NkNENTogXHU4QkZCXHU1M0Q2XHU1MjREXHU3RjAwL1x1NTQwRVx1N0YwMFx1NjU4N1x1NEVGNlx1NTE4NVx1NUJCOSA9PT09PT09PT09XG5cdGFzeW5jIHJlYWRUZW1wbGF0ZUZpbGUoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKCFmaWxlUGF0aCB8fCBmaWxlUGF0aC50cmltKCkgPT09ICcnKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdC8vIFx1NUMxRFx1OEJENVx1NEVDRSBWYXVsdCBcdTRFMkRcdThCRkJcdTUzRDZcdTY1ODdcdTRFRjZcblx0XHRcdGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZmlsZVBhdGgudHJpbSgpKTtcblx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coYFtNREltYWdlRW1iZWRdIFx1NjIxMFx1NTI5Rlx1OEJGQlx1NTNENlx1NkEyMVx1Njc3Rlx1NjU4N1x1NEVGNjogJHtmaWxlUGF0aH1gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY29udGVudDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKGBbTURJbWFnZUVtYmVkXSBcdTZBMjFcdTY3N0ZcdTY1ODdcdTRFRjZcdTY3MkFcdTYyN0VcdTUyMzA6ICR7ZmlsZVBhdGh9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKGBbTURJbWFnZUVtYmVkXSBcdThCRkJcdTUzRDZcdTZBMjFcdTY3N0ZcdTY1ODdcdTRFRjZcdTU5MzFcdThEMjU6ICR7ZmlsZVBhdGh9YCwgZXJyb3IpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0fVxuXG5cdC8vID09PT09PT09PT0gXHU1MjlGXHU4MEZEIDE6IFx1NTkwRFx1NTIzNlx1NTIzMFx1NTI2QVx1OEQzNFx1Njc3RiA9PT09PT09PT09XG5cdGFzeW5jIGNvcHlBc0Jhc2U2NChmaWxlOiBURmlsZSkge1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cblx0XHRcdC8vIFx1NkRGQlx1NTJBMFx1NTI0RFx1N0YwMFx1NTE4NVx1NUJCOVxuXHRcdFx0Y29uc3QgcHJlZml4ID0gYXdhaXQgdGhpcy5yZWFkVGVtcGxhdGVGaWxlKHRoaXMuc2V0dGluZ3MucHJlZml4RmlsZVBhdGgpO1xuXHRcdFx0aWYgKHByZWZpeCkge1xuXHRcdFx0XHRjb250ZW50ID0gcHJlZml4ICsgJ1xcblxcbicgKyBjb250ZW50O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBcdTZERkJcdTUyQTBcdTU0MEVcdTdGMDBcdTUxODVcdTVCQjlcblx0XHRcdGNvbnN0IHN1ZmZpeCA9IGF3YWl0IHRoaXMucmVhZFRlbXBsYXRlRmlsZSh0aGlzLnNldHRpbmdzLnN1ZmZpeEZpbGVQYXRoKTtcblx0XHRcdGlmIChzdWZmaXgpIHtcblx0XHRcdFx0Y29udGVudCA9IGNvbnRlbnQgKyAnXFxuXFxuJyArIHN1ZmZpeDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jb252ZXJ0TWFya2Rvd25Ub0Jhc2U2NChjb250ZW50LCBmaWxlKTtcblxuXHRcdFx0Ly8gXHU1OTBEXHU1MjM2XHU1MjMwXHU1MjZBXHU4RDM0XHU2NzdGXG5cdFx0XHRhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChyZXN1bHQuY29udGVudCk7XG5cblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdC8vIFx1NjYzRVx1NzkzQVx1OEJFNlx1N0VDNlx1NzY4NFx1NTkwNFx1NzQwNlx1N0VEM1x1Njc5Q1xuXHRcdFx0XHR0aGlzLnNob3dEZXRhaWxlZFJlc3VsdHMocmVzdWx0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5ldyBOb3RpY2UoJ1x1MjcwNSBDb3BpZWQgYXMgQmFzZTY0IGZvcm1hdCcpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRuZXcgTm90aWNlKCdcdTI3NEMgRmFpbGVkIHRvIGNvcHk6ICcgKyBlcnJvci5tZXNzYWdlKTtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0NvcHkgZmFpbGVkOicsIGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1NjYzRVx1NzkzQVx1OEJFNlx1N0VDNlx1NTkwNFx1NzQwNlx1N0VEM1x1Njc5QyA9PT09PT09PT09XG5cdHNob3dEZXRhaWxlZFJlc3VsdHMocmVzdWx0OiB7Y29udGVudDogc3RyaW5nLCBjb252ZXJ0ZWRDb3VudDogbnVtYmVyLCBza2lwcGVkQ291bnQ6IG51bWJlciwgZGV0YWlsczogQXJyYXk8e3BhdGg6IHN0cmluZywgc3RhdHVzOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZ30+fSkge1xuXHRcdGNvbnN0IHRvdGFsID0gcmVzdWx0LmNvbnZlcnRlZENvdW50ICsgcmVzdWx0LnNraXBwZWRDb3VudDtcblxuXHRcdC8vIFx1NEUzQlx1OTAxQVx1NzdFNVxuXHRcdGxldCBtZXNzYWdlID0gJ1x1MjcwNSBDb3BpZWQgdG8gY2xpcGJvYXJkXFxuXFxuJztcblxuXHRcdG1lc3NhZ2UgKz0gYFx1RDgzRFx1RENDQSBTdW1tYXJ5OiAke3RvdGFsfSBpbWFnZXNcXG5gO1xuXHRcdG1lc3NhZ2UgKz0gYCAgIFx1MjAyMiBDb252ZXJ0ZWQ6ICR7cmVzdWx0LmNvbnZlcnRlZENvdW50fVxcbmA7XG5cdFx0bWVzc2FnZSArPSBgICAgXHUyMDIyIFNraXBwZWQ6ICR7cmVzdWx0LnNraXBwZWRDb3VudH1gO1xuXG5cdFx0Ly8gXHU1OTgyXHU2NzlDXHU1NDJGXHU3NTI4XHU0RTg2XHU4QkU2XHU3RUM2XHU2NUU1XHU1RkQ3XHVGRjBDXHU2NjNFXHU3OTNBXHU2QkNGXHU0RTJBXHU1NkZFXHU3MjQ3XHU3Njg0XHU3MkI2XHU2MDAxXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0RldGFpbGVkTG9nKSB7XG5cdFx0XHRtZXNzYWdlICs9ICdcXG5cXG4nO1xuXG5cdFx0XHQvLyBcdTY2M0VcdTc5M0FcdTZCQ0ZcdTRFMkFcdTU2RkVcdTcyNDdcdTc2ODRcdThCRTZcdTdFQzZcdTcyQjZcdTYwMDFcblx0XHRcdGNvbnN0IG1heERpc3BsYXkgPSA4OyAvLyBcdTY3MDBcdTU5MUFcdTY2M0VcdTc5M0E4XHU0RTJBXHU1NkZFXHU3MjQ3XHU3Njg0XHU4QkU2XHU2MEM1XG5cdFx0XHRjb25zdCBkZXRhaWxzVG9TaG93ID0gcmVzdWx0LmRldGFpbHMuc2xpY2UoMCwgbWF4RGlzcGxheSk7XG5cblx0XHRcdGZvciAoY29uc3QgZGV0YWlsIG9mIGRldGFpbHNUb1Nob3cpIHtcblx0XHRcdFx0Y29uc3QgZmlsZU5hbWUgPSBkZXRhaWwucGF0aC5zcGxpdCgnLycpLnBvcCgpIHx8IGRldGFpbC5wYXRoO1xuXHRcdFx0XHRjb25zdCBzaG9ydE5hbWUgPSBmaWxlTmFtZS5sZW5ndGggPiAzNSA/IGZpbGVOYW1lLnN1YnN0cmluZygwLCAzMikgKyAnLi4uJyA6IGZpbGVOYW1lO1xuXG5cdFx0XHRcdGlmIChkZXRhaWwuc3RhdHVzID09PSAnc3VjY2VzcycpIHtcblx0XHRcdFx0XHRtZXNzYWdlICs9IGBcdTI3MTMgJHtzaG9ydE5hbWV9XFxuYDtcblx0XHRcdFx0fSBlbHNlIGlmIChkZXRhaWwuc3RhdHVzID09PSAnZmFpbGVkJykge1xuXHRcdFx0XHRcdG1lc3NhZ2UgKz0gYFx1MjcxNyAke3Nob3J0TmFtZX1cXG4gIFx1MjE5MiAke2RldGFpbC5yZWFzb259XFxuYDtcblx0XHRcdFx0fSBlbHNlIGlmIChkZXRhaWwuc3RhdHVzID09PSAnc2tpcHBlZCcpIHtcblx0XHRcdFx0XHRtZXNzYWdlICs9IGBcdTIyOTggJHtzaG9ydE5hbWV9XFxuICBcdTIxOTIgJHtkZXRhaWwucmVhc29ufVxcbmA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gXHU1OTgyXHU2NzlDXHU4RkQ4XHU2NzA5XHU2NkY0XHU1OTFBXHU1NkZFXHU3MjQ3XHU2NzJBXHU2NjNFXHU3OTNBXG5cdFx0XHRpZiAocmVzdWx0LmRldGFpbHMubGVuZ3RoID4gbWF4RGlzcGxheSkge1xuXHRcdFx0XHRjb25zdCByZW1haW5pbmcgPSByZXN1bHQuZGV0YWlscy5sZW5ndGggLSBtYXhEaXNwbGF5O1xuXHRcdFx0XHRtZXNzYWdlICs9IGBcXG4uLi4gYW5kICR7cmVtYWluaW5nfSBtb3JlYDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBcdTY2M0VcdTc5M0FcdTYzQTdcdTUyMzZcdTUzRjBcdTYzRDBcdTc5M0Fcblx0XHRtZXNzYWdlICs9IGBcXG5cXG5cdUQ4M0RcdURDQTEgQ29uc29sZSAoQ3RybCtTaGlmdCtJKSBmb3IgZnVsbCBkZXRhaWxzYDtcblxuXHRcdC8vIFx1NjYzRVx1NzkzQVx1NjVGNlx1OTVGNFx1NjZGNFx1OTU3Rlx1NzY4NFx1OTAxQVx1NzdFNVx1RkYwODhcdTc5RDJcdUZGMDlcblx0XHRuZXcgTm90aWNlKG1lc3NhZ2UsIDgwMDApO1xuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdTY4MzhcdTVGQzNcdThGNkNcdTYzNjJcdTkwM0JcdThGOTEgPT09PT09PT09PVxuXHRhc3luYyBjb252ZXJ0TWFya2Rvd25Ub0Jhc2U2NChjb250ZW50OiBzdHJpbmcsIHNvdXJjZUZpbGU6IFRGaWxlKTogUHJvbWlzZTx7Y29udGVudDogc3RyaW5nLCBjb252ZXJ0ZWRDb3VudDogbnVtYmVyLCBza2lwcGVkQ291bnQ6IG51bWJlciwgZGV0YWlsczogQXJyYXk8e3BhdGg6IHN0cmluZywgc3RhdHVzOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZ30+fT4ge1xuXHRcdC8vIFx1NTMzOVx1OTE0RCBNYXJrZG93biBcdTU2RkVcdTcyNDdcdThCRURcdTZDRDU6ICFbYWx0XShwYXRoKSBcdTYyMTYgIVthbHRdKDxwYXRoPilcblx0XHQvLyBcdTY1MkZcdTYzMDEgT2JzaWRpYW4gXHU3Njg0ICFbW2ltYWdlLnBuZ11dIFx1OEJFRFx1NkNENVxuXHRcdGNvbnN0IGltZ1JlZ2V4ID0gLyFcXFsoW15cXF1dKilcXF1cXCg8PyhbXilcIj5dKyk+P1xcKXwhXFxbXFxbKFteXFxdXStcXC4ocG5nfGpwZ3xqcGVnfGdpZnx3ZWJwfHN2Z3xibXApKVxcXVxcXS9naTtcblxuXHRcdGxldCByZXN1bHQgPSBjb250ZW50O1xuXHRcdGxldCBjb252ZXJ0ZWRDb3VudCA9IDA7XG5cdFx0bGV0IHNraXBwZWRDb3VudCA9IDA7XG5cdFx0Y29uc3QgZGV0YWlsczogQXJyYXk8e3BhdGg6IHN0cmluZywgc3RhdHVzOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZ30+ID0gW107XG5cblx0XHRjb25zdCBtYXRjaGVzID0gWy4uLmNvbnRlbnQubWF0Y2hBbGwoaW1nUmVnZXgpXTtcblxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhgW01ESW1hZ2VFbWJlZF0gXHU1RjAwXHU1OUNCXHU1OTA0XHU3NDA2XHU2NTg3XHU2ODYzXHVGRjBDXHU1MTcxXHU2MjdFXHU1MjMwICR7bWF0Y2hlcy5sZW5ndGh9IFx1NEUyQVx1NTZGRVx1NzI0N2ApO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgbWF0Y2ggb2YgbWF0Y2hlcykge1xuXHRcdFx0Y29uc3QgZnVsbE1hdGNoID0gbWF0Y2hbMF07XG5cblx0XHRcdC8vIFx1NTkwNFx1NzQwNlx1NjgwN1x1NTFDNiBNYXJrZG93biBcdThCRURcdTZDRDU6ICFbYWx0XShwYXRoKVxuXHRcdFx0aWYgKG1hdGNoWzFdICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29uc3QgYWx0VGV4dCA9IG1hdGNoWzFdO1xuXHRcdFx0XHRjb25zdCBpbWFnZVBhdGggPSBtYXRjaFsyXTtcblxuXHRcdFx0XHQvLyBcdThERjNcdThGQzdcdTVERjJcdTdFQ0ZcdTY2MkYgYmFzZTY0IFx1NzY4NFx1NTZGRVx1NzI0N1xuXHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5za2lwQmFzZTY0SW1hZ2VzICYmIGltYWdlUGF0aC5zdGFydHNXaXRoKCdkYXRhOmltYWdlJykpIHtcblx0XHRcdFx0XHRza2lwcGVkQ291bnQrKztcblx0XHRcdFx0XHRjb25zdCBkaXNwbGF5UGF0aCA9IGltYWdlUGF0aC5zdWJzdHJpbmcoMCwgMzApICsgJy4uLic7XG5cdFx0XHRcdFx0ZGV0YWlscy5wdXNoKHtwYXRoOiBkaXNwbGF5UGF0aCwgc3RhdHVzOiAnc2tpcHBlZCcsIHJlYXNvbjogJ0FscmVhZHkgQmFzZTY0J30pO1xuXHRcdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgW1x1OERGM1x1OEZDN10gJHtkaXNwbGF5UGF0aH0gLSBcdTUzOUZcdTU2RTA6IFx1NURGMlx1NjYyRiBCYXNlNjQgXHU2ODNDXHU1RjBGYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gXHU4REYzXHU4RkM3XHU3RjUxXHU3RURDXHU1NkZFXHU3MjQ3XHVGRjA4XHU0RTBEXHU2NTJGXHU2MzAxXHVGRjA5XG5cdFx0XHRcdGlmIChpbWFnZVBhdGguc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IGltYWdlUGF0aC5zdGFydHNXaXRoKCdodHRwczovLycpKSB7XG5cdFx0XHRcdFx0c2tpcHBlZENvdW50Kys7XG5cdFx0XHRcdFx0ZGV0YWlscy5wdXNoKHtwYXRoOiBpbWFnZVBhdGgsIHN0YXR1czogJ3NraXBwZWQnLCByZWFzb246ICdOZXR3b3JrIGltYWdlIChub3Qgc3VwcG9ydGVkKSd9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFtcdThERjNcdThGQzddICR7aW1hZ2VQYXRofSAtIFx1NTM5Rlx1NTZFMDogXHU3RjUxXHU3RURDXHU1NkZFXHU3MjQ3XHU0RTBEXHU2NTJGXHU2MzAxXHU4RjZDXHU2MzYyYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gXHU4RjZDXHU2MzYyXHU2NzJDXHU1NzMwXHU1NkZFXHU3MjQ3XG5cdFx0XHRcdGNvbnN0IGJhc2U2NCA9IGF3YWl0IHRoaXMuaW1hZ2VUb0Jhc2U2NChpbWFnZVBhdGgsIHNvdXJjZUZpbGUpO1xuXHRcdFx0XHRpZiAoYmFzZTY0KSB7XG5cdFx0XHRcdFx0cmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoZnVsbE1hdGNoLCBgIVske2FsdFRleHR9XSgke2Jhc2U2NH0pYCk7XG5cdFx0XHRcdFx0Y29udmVydGVkQ291bnQrKztcblx0XHRcdFx0XHRkZXRhaWxzLnB1c2goe3BhdGg6IGltYWdlUGF0aCwgc3RhdHVzOiAnc3VjY2Vzcyd9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFtcdTYyMTBcdTUyOUZdICR7aW1hZ2VQYXRofSAtIFx1NURGMlx1OEY2Q1x1NjM2Mlx1NEUzQSBCYXNlNjRgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2tpcHBlZENvdW50Kys7XG5cdFx0XHRcdFx0ZGV0YWlscy5wdXNoKHtwYXRoOiBpbWFnZVBhdGgsIHN0YXR1czogJ2ZhaWxlZCcsIHJlYXNvbjogJ0ZpbGUgbm90IGZvdW5kJ30pO1xuXHRcdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgW1x1NTkzMVx1OEQyNV0gJHtpbWFnZVBhdGh9IC0gXHU1MzlGXHU1NkUwOiBcdTY1ODdcdTRFRjZcdTY3MkFcdTYyN0VcdTUyMzBcdTYyMTZcdThCRkJcdTUzRDZcdTU5MzFcdThEMjVgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIFx1NTkwNFx1NzQwNiBPYnNpZGlhbiBXaWtpIFx1OEJFRFx1NkNENTogIVtbaW1hZ2UucG5nXV1cblx0XHRcdGVsc2UgaWYgKG1hdGNoWzNdICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29uc3QgaW1hZ2VOYW1lID0gbWF0Y2hbM107XG5cdFx0XHRcdGNvbnN0IGRpc3BsYXlQYXRoID0gYCFbWyR7aW1hZ2VOYW1lfV1dYDtcblxuXHRcdFx0XHQvLyBcdTU5ODJcdTY3OUNcdTRFMERcdThGNkNcdTYzNjIgV2lraSBcdTk0RkVcdTYzQTVcdUZGMENcdThERjNcdThGQzdcblx0XHRcdFx0aWYgKCF0aGlzLnNldHRpbmdzLmNvbnZlcnRXaWtpTGlua3MpIHtcblx0XHRcdFx0XHRza2lwcGVkQ291bnQrKztcblx0XHRcdFx0XHRkZXRhaWxzLnB1c2goe3BhdGg6IGRpc3BsYXlQYXRoLCBzdGF0dXM6ICdza2lwcGVkJywgcmVhc29uOiAnV2lraSBsaW5rIGNvbnZlcnNpb24gZGlzYWJsZWQnfSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbXHU4REYzXHU4RkM3XSAke2Rpc3BsYXlQYXRofSAtIFx1NTM5Rlx1NTZFMDogV2lraSBcdTk0RkVcdTYzQTVcdThGNkNcdTYzNjJcdTVERjJcdTc5ODFcdTc1MjhgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBcdThGNkNcdTYzNjJcdTRFM0EgYmFzZTY0XG5cdFx0XHRcdGNvbnN0IGJhc2U2NCA9IGF3YWl0IHRoaXMuaW1hZ2VUb0Jhc2U2NChpbWFnZU5hbWUsIHNvdXJjZUZpbGUpO1xuXHRcdFx0XHRpZiAoYmFzZTY0KSB7XG5cdFx0XHRcdFx0Ly8gXHU4RjZDXHU2MzYyXHU0RTNBXHU2ODA3XHU1MUM2IE1hcmtkb3duIFx1OEJFRFx1NkNENVxuXHRcdFx0XHRcdHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKGZ1bGxNYXRjaCwgYCFbJHtpbWFnZU5hbWV9XSgke2Jhc2U2NH0pYCk7XG5cdFx0XHRcdFx0Y29udmVydGVkQ291bnQrKztcblx0XHRcdFx0XHRkZXRhaWxzLnB1c2goe3BhdGg6IGRpc3BsYXlQYXRoLCBzdGF0dXM6ICdzdWNjZXNzJ30pO1xuXHRcdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgW1x1NjIxMFx1NTI5Rl0gJHtkaXNwbGF5UGF0aH0gLSBcdTVERjJcdThGNkNcdTYzNjJcdTRFM0EgQmFzZTY0YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNraXBwZWRDb3VudCsrO1xuXHRcdFx0XHRcdGRldGFpbHMucHVzaCh7cGF0aDogZGlzcGxheVBhdGgsIHN0YXR1czogJ2ZhaWxlZCcsIHJlYXNvbjogJ0ZpbGUgbm90IGZvdW5kJ30pO1xuXHRcdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgW1x1NTkzMVx1OEQyNV0gJHtkaXNwbGF5UGF0aH0gLSBcdTUzOUZcdTU2RTA6IFx1NjU4N1x1NEVGNlx1NjcyQVx1NjI3RVx1NTIzMFx1NjIxNlx1OEJGQlx1NTNENlx1NTkzMVx1OEQyNWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhgW01ESW1hZ2VFbWJlZF0gXHU1OTA0XHU3NDA2XHU1QjhDXHU2MjEwOiAke2NvbnZlcnRlZENvdW50fSBcdTRFMkFcdTYyMTBcdTUyOUYsICR7c2tpcHBlZENvdW50fSBcdTRFMkFcdThERjNcdThGQzdgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHsgY29udGVudDogcmVzdWx0LCBjb252ZXJ0ZWRDb3VudCwgc2tpcHBlZENvdW50LCBkZXRhaWxzIH07XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1NTZGRVx1NzI0N1x1OEY2QyBCYXNlNjQgPT09PT09PT09PVxuXHRhc3luYyBpbWFnZVRvQmFzZTY0KGltYWdlUGF0aDogc3RyaW5nLCBzb3VyY2VGaWxlOiBURmlsZSk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyBcdTg5RTNcdTY3OTBcdTU2RkVcdTcyNDdcdThERUZcdTVGODRcblx0XHRcdGNvbnN0IGltYWdlRmlsZSA9IHRoaXMucmVzb2x2ZUltYWdlUGF0aChpbWFnZVBhdGgsIHNvdXJjZUZpbGUpO1xuXHRcdFx0aWYgKCFpbWFnZUZpbGUpIHtcblx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oYCAgXHUyNTE0XHUyNTAwIFx1OERFRlx1NUY4NFx1ODlFM1x1Njc5MFx1NTkzMVx1OEQyNTogXHU1NzI4XHU0RUU1XHU0RTBCXHU0RjREXHU3RjZFXHU5MEZEXHU2NzJBXHU2MjdFXHU1MjMwXHU2NTg3XHU0RUY2YCk7XG5cdFx0XHRcdFx0Y29uc29sZS53YXJuKGAgICAgIC0gVmF1bHQgXHU2ODM5XHU3NkVFXHU1RjU1OiAke2ltYWdlUGF0aH1gKTtcblx0XHRcdFx0XHRpZiAoc291cmNlRmlsZS5wYXJlbnQpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUud2FybihgICAgICAtIFx1NzZGOFx1NUJGOVx1OERFRlx1NUY4NDogJHtzb3VyY2VGaWxlLnBhcmVudC5wYXRofS8ke2ltYWdlUGF0aH1gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGAgIFx1MjUxNFx1MjUwMCBcdTY1ODdcdTRFRjZcdTVERjJcdTYyN0VcdTUyMzA6ICR7aW1hZ2VGaWxlLnBhdGh9YCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFx1OEJGQlx1NTNENlx1NTZGRVx1NzI0N1x1NEUzQSBBcnJheUJ1ZmZlclxuXHRcdFx0Y29uc3QgYXJyYXlCdWZmZXIgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkQmluYXJ5KGltYWdlRmlsZSk7XG5cblx0XHRcdC8vIFx1OEY2Q1x1NjM2Mlx1NEUzQSBCYXNlNjRcblx0XHRcdGNvbnN0IGJhc2U2NCA9IHRoaXMuYXJyYXlCdWZmZXJUb0Jhc2U2NChhcnJheUJ1ZmZlcik7XG5cblx0XHRcdC8vIFx1ODNCN1x1NTNENiBNSU1FIFx1N0M3Qlx1NTc4QlxuXHRcdFx0Y29uc3QgbWltZVR5cGUgPSB0aGlzLmdldE1pbWVUeXBlKGltYWdlRmlsZS5leHRlbnNpb24pO1xuXG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRjb25zdCBzaXplS0IgPSAoYXJyYXlCdWZmZXIuYnl0ZUxlbmd0aCAvIDEwMjQpLnRvRml4ZWQoMik7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGAgIFx1MjUxNFx1MjUwMCBcdTY1ODdcdTRFRjZcdTU5MjdcdTVDMEY6ICR7c2l6ZUtCfSBLQiwgTUlNRTogJHttaW1lVHlwZX1gKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGBkYXRhOiR7bWltZVR5cGV9O2Jhc2U2NCwke2Jhc2U2NH1gO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKGAgIFx1MjUxNFx1MjUwMCBcdThCRkJcdTUzRDZcdTYyMTZcdThGNkNcdTYzNjJcdTU5MzFcdThEMjU6ICR7ZXJyb3IubWVzc2FnZX1gKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fVxuXG5cdC8vID09PT09PT09PT0gXHU4REVGXHU1Rjg0XHU4OUUzXHU2NzkwID09PT09PT09PT1cblx0cmVzb2x2ZUltYWdlUGF0aChpbWFnZVBhdGg6IHN0cmluZywgc291cmNlRmlsZTogVEZpbGUpOiBURmlsZSB8IG51bGwge1xuXHRcdC8vIFx1NzlGQlx1OTY2NCBPYnNpZGlhbiBcdThERUZcdTVGODRcdTUyNERcdTdGMDBcblx0XHRsZXQgY2xlYW5QYXRoID0gaW1hZ2VQYXRoLnJlcGxhY2UoL148fD4kL2csICcnKS50cmltKCk7XG5cblx0XHQvLyBVUkwgXHU4OUUzXHU3ODAxXHVGRjA4XHU1OTA0XHU3NDA2ICUyMCBcdTdCNDlcdTdGMTZcdTc4MDFcdTVCNTdcdTdCMjZcdUZGMDlcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZGVjb2RlZCA9IGRlY29kZVVSSUNvbXBvbmVudChjbGVhblBhdGgpO1xuXHRcdFx0aWYgKGRlY29kZWQgIT09IGNsZWFuUGF0aCkge1xuXHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGAgIFx1MjUxNFx1MjUwMCBVUkwgXHU4OUUzXHU3ODAxOiBcIiR7Y2xlYW5QYXRofVwiIFx1MjE5MiBcIiR7ZGVjb2RlZH1cImApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjbGVhblBhdGggPSBkZWNvZGVkO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIFx1NTk4Mlx1Njc5Q1x1ODlFM1x1NzgwMVx1NTkzMVx1OEQyNVx1RkYwQ1x1NEY3Rlx1NzUyOFx1NTM5Rlx1OERFRlx1NUY4NFxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGAgIFx1MjUxNFx1MjUwMCBVUkwgXHU4OUUzXHU3ODAxXHU1OTMxXHU4RDI1XHVGRjBDXHU0RjdGXHU3NTI4XHU1MzlGXHU4REVGXHU1Rjg0OiAke2NsZWFuUGF0aH1gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBcdTY1QjlcdTZDRDUgMTogXHU3NkY0XHU2M0E1XHU0RUNFIFZhdWx0IFx1NjgzOVx1NzZFRVx1NUY1NVx1NjdFNVx1NjI3RVxuXHRcdGxldCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNsZWFuUGF0aCk7XG5cdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYCAgXHUyNTE0XHUyNTAwIFx1ODlFM1x1Njc5MFx1NjVCOVx1NkNENTogVmF1bHQgXHU2ODM5XHU3NkVFXHU1RjU1YCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmlsZTtcblx0XHR9XG5cblx0XHQvLyBcdTY1QjlcdTZDRDUgMjogXHU3NkY4XHU1QkY5XHU0RThFXHU1RjUzXHU1MjREXHU2NTg3XHU0RUY2XHU2N0U1XHU2MjdFXG5cdFx0aWYgKHNvdXJjZUZpbGUucGFyZW50KSB7XG5cdFx0XHRjb25zdCByZWxhdGl2ZVBhdGggPSBgJHtzb3VyY2VGaWxlLnBhcmVudC5wYXRofS8ke2NsZWFuUGF0aH1gO1xuXHRcdFx0ZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChyZWxhdGl2ZVBhdGgpO1xuXHRcdFx0aWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGAgIFx1MjUxNFx1MjUwMCBcdTg5RTNcdTY3OTBcdTY1QjlcdTZDRDU6IFx1NzZGOFx1NUJGOVx1OERFRlx1NUY4NCAoJHtzb3VyY2VGaWxlLnBhcmVudC5wYXRofS8pYCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZpbGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gXHU2NUI5XHU2Q0Q1IDM6IFx1NEY3Rlx1NzUyOCBPYnNpZGlhbiBcdTc2ODRcdTk0RkVcdTYzQTVcdTg5RTNcdTY3OTBcblx0XHRjb25zdCByZXNvbHZlZEZpbGUgPSB0aGlzLmFwcC5tZXRhZGF0YUNhY2hlLmdldEZpcnN0TGlua3BhdGhEZXN0KGNsZWFuUGF0aCwgc291cmNlRmlsZS5wYXRoKTtcblx0XHRpZiAocmVzb2x2ZWRGaWxlIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGAgIFx1MjUxNFx1MjUwMCBcdTg5RTNcdTY3OTBcdTY1QjlcdTZDRDU6IE9ic2lkaWFuIFx1OTRGRVx1NjNBNVx1ODlFM1x1Njc5MGApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc29sdmVkRmlsZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8vID09PT09PT09PT0gQXJyYXlCdWZmZXIgXHU4RjZDIEJhc2U2NCA9PT09PT09PT09XG5cdGFycmF5QnVmZmVyVG9CYXNlNjQoYnVmZmVyOiBBcnJheUJ1ZmZlcik6IHN0cmluZyB7XG5cdFx0Y29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheShidWZmZXIpO1xuXHRcdGxldCBiaW5hcnkgPSAnJztcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRiaW5hcnkgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSk7XG5cdFx0fVxuXHRcdHJldHVybiBidG9hKGJpbmFyeSk7XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1ODNCN1x1NTNENiBNSU1FIFx1N0M3Qlx1NTc4QiA9PT09PT09PT09XG5cdGdldE1pbWVUeXBlKGV4dGVuc2lvbjogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCBtaW1lVHlwZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG5cdFx0XHQncG5nJzogJ2ltYWdlL3BuZycsXG5cdFx0XHQnanBnJzogJ2ltYWdlL2pwZWcnLFxuXHRcdFx0J2pwZWcnOiAnaW1hZ2UvanBlZycsXG5cdFx0XHQnZ2lmJzogJ2ltYWdlL2dpZicsXG5cdFx0XHQnd2VicCc6ICdpbWFnZS93ZWJwJyxcblx0XHRcdCdzdmcnOiAnaW1hZ2Uvc3ZnK3htbCcsXG5cdFx0XHQnYm1wJzogJ2ltYWdlL2JtcCdcblx0XHR9O1xuXHRcdHJldHVybiBtaW1lVHlwZXNbZXh0ZW5zaW9uLnRvTG93ZXJDYXNlKCldIHx8ICdpbWFnZS9wbmcnO1xuXHR9XG59XG5cbi8vID09PT09PT09PT0gXHU4QkJFXHU3RjZFXHU5NzYyXHU2NzdGID09PT09PT09PT1cbmNsYXNzIE1ESW1hZ2VFbWJlZFNldHRpbmdUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcblx0cGx1Z2luOiBNREltYWdlRW1iZWRQbHVnaW47XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTURJbWFnZUVtYmVkUGx1Z2luKSB7XG5cdFx0c3VwZXIoYXBwLCBwbHVnaW4pO1xuXHRcdHRoaXMucGx1Z2luID0gcGx1Z2luO1xuXHR9XG5cblx0ZGlzcGxheSgpOiB2b2lkIHtcblx0XHRjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuXHRcdGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cblx0XHRjb250YWluZXJFbC5jcmVhdGVFbCgnaDInLCB7IHRleHQ6ICdNRCBJbWFnZSBFbWJlZCBTZXR0aW5ncycgfSk7XG5cblx0XHQvLyBcdThCQkVcdTdGNkUgMTogXHU2NjNFXHU3OTNBXHU4RjZDXHU2MzYyXHU2NUU1XHU1RkQ3XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnU2hvdyBjb252ZXJzaW9uIGxvZycpXG5cdFx0XHQuc2V0RGVzYygnRGlzcGxheSBzdW1tYXJ5IGluZm9ybWF0aW9uIGluIG5vdGlmaWNhdGlvbnMnKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZylcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nID0gdmFsdWU7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0Ly8gXHU5MUNEXHU2NUIwXHU2RTMyXHU2N0QzXHU4QkJFXHU3RjZFXHU5NzYyXHU2NzdGXHU0RUU1XHU2NkY0XHU2NUIwXHU4QkU2XHU3RUM2XHU2NUU1XHU1RkQ3XHU5MDA5XHU5ODc5XHU3Njg0XHU1M0VGXHU4OUMxXHU2MDI3XG5cdFx0XHRcdFx0dGhpcy5kaXNwbGF5KCk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdC8vIFx1OEJCRVx1N0Y2RSAxLjU6IFx1NjYzRVx1NzkzQVx1OEJFNlx1N0VDNlx1NjVFNVx1NUZEN1x1RkYwOFx1NEY5RFx1OEQ1Nlx1NEU4RSBzaG93Q29udmVyc2lvbkxvZ1x1RkYwOVxuXHRcdGlmICh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHRcdC5zZXROYW1lKCdTaG93IGRldGFpbGVkIGxvZycpXG5cdFx0XHRcdC5zZXREZXNjKCdTaG93IGluZGl2aWR1YWwgaW1hZ2Ugc3RhdHVzIGluIG5vdGlmaWNhdGlvbnMgKHJlcXVpcmVzIFwiU2hvdyBjb252ZXJzaW9uIGxvZ1wiKScpXG5cdFx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93RGV0YWlsZWRMb2cpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0RldGFpbGVkTG9nID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0Ly8gXHU4QkJFXHU3RjZFIDI6IFx1OEY2Q1x1NjM2MiBXaWtpIFx1OTRGRVx1NjNBNVxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ0NvbnZlcnQgV2lraSBsaW5rcycpXG5cdFx0XHQuc2V0RGVzYygnQ29udmVydCBPYnNpZGlhbiBXaWtpIGxpbmtzICghW1tpbWFnZS5wbmddXSkgdG8gc3RhbmRhcmQgTWFya2Rvd24gd2l0aCBCYXNlNjQnKVxuXHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb252ZXJ0V2lraUxpbmtzKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuY29udmVydFdpa2lMaW5rcyA9IHZhbHVlO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHQvLyBcdThCQkVcdTdGNkUgMzogXHU4REYzXHU4RkM3IEJhc2U2NCBcdTU2RkVcdTcyNDdcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdTa2lwIEJhc2U2NCBpbWFnZXMnKVxuXHRcdFx0LnNldERlc2MoJ1NraXAgaW1hZ2VzIHRoYXQgYXJlIGFscmVhZHkgaW4gQmFzZTY0IGZvcm1hdCcpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcblx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNraXBCYXNlNjRJbWFnZXMpXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5za2lwQmFzZTY0SW1hZ2VzID0gdmFsdWU7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdC8vIFx1NTIwNlx1OTY5NFx1N0VCRlxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMycsIHsgdGV4dDogJ0FudGktcmVwcmludCBQcm90ZWN0aW9uJyB9KTtcblxuXHRcdC8vIFx1OEJCRVx1N0Y2RSA0OiBcdTUyNERcdTdGMDBcdTY1ODdcdTRFRjZcdThERUZcdTVGODRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdQcmVmaXggZmlsZSBwYXRoJylcblx0XHRcdC5zZXREZXNjKCdQYXRoIHRvIG1hcmtkb3duIGZpbGUgdG8gcHJlcGVuZCAoZS5nLiwgXCJ0ZW1wbGF0ZXMvcHJlZml4Lm1kXCIpLiBMZWF2ZSBlbXB0eSB0byBkaXNhYmxlLicpXG5cdFx0XHQuYWRkVGV4dCh0ZXh0ID0+IHRleHRcblx0XHRcdFx0LnNldFBsYWNlaG9sZGVyKCd0ZW1wbGF0ZXMvcHJlZml4Lm1kJylcblx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnByZWZpeEZpbGVQYXRoKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MucHJlZml4RmlsZVBhdGggPSB2YWx1ZS50cmltKCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdC8vIFx1OEJCRVx1N0Y2RSA1OiBcdTU0MEVcdTdGMDBcdTY1ODdcdTRFRjZcdThERUZcdTVGODRcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdTdWZmaXggZmlsZSBwYXRoJylcblx0XHRcdC5zZXREZXNjKCdQYXRoIHRvIG1hcmtkb3duIGZpbGUgdG8gYXBwZW5kIChlLmcuLCBcInRlbXBsYXRlcy9zdWZmaXgubWRcIikuIExlYXZlIGVtcHR5IHRvIGRpc2FibGUuJylcblx0XHRcdC5hZGRUZXh0KHRleHQgPT4gdGV4dFxuXHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoJ3RlbXBsYXRlcy9zdWZmaXgubWQnKVxuXHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc3VmZml4RmlsZVBhdGgpXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zdWZmaXhGaWxlUGF0aCA9IHZhbHVlLnRyaW0oKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBT0Esc0JBQTRFO0FBWTVFLElBQU0sbUJBQXlDO0FBQUEsRUFDOUMsbUJBQW1CO0FBQUEsRUFDbkIsaUJBQWlCO0FBQUEsRUFDakIsa0JBQWtCO0FBQUEsRUFDbEIsa0JBQWtCO0FBQUEsRUFDbEIsZ0JBQWdCO0FBQUEsRUFDaEIsZ0JBQWdCO0FBQ2pCO0FBR0EsSUFBcUIscUJBQXJCLGNBQWdELHVCQUFPO0FBQUE7QUFBQSxFQUl0RCxNQUFNLFNBQVM7QUFDZCxVQUFNLEtBQUssYUFBYTtBQUd4QixTQUFLLGNBQWMsSUFBSSx1QkFBdUIsS0FBSyxLQUFLLElBQUksQ0FBQztBQUc3RCxTQUFLO0FBQUEsTUFDSixLQUFLLElBQUksVUFBVSxHQUFHLGFBQWEsQ0FBQyxNQUFNLFNBQVM7QUFDbEQsWUFBSSxnQkFBZ0IseUJBQVMsS0FBSyxjQUFjLE1BQU07QUFDckQsZUFBSyxpQkFBaUIsTUFBTSxJQUFJO0FBQUEsUUFDakM7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBRUEsWUFBUSxJQUFJLDhCQUE4QjtBQUFBLEVBQzNDO0FBQUEsRUFFQSxXQUFXO0FBQ1YsWUFBUSxJQUFJLGdDQUFnQztBQUFBLEVBQzdDO0FBQUE7QUFBQSxFQUdBLE1BQU0sZUFBZTtBQUNwQixTQUFLLFdBQVcsT0FBTyxPQUFPLENBQUMsR0FBRyxrQkFBa0IsTUFBTSxLQUFLLFNBQVMsQ0FBQztBQUFBLEVBQzFFO0FBQUEsRUFFQSxNQUFNLGVBQWU7QUFDcEIsVUFBTSxLQUFLLFNBQVMsS0FBSyxRQUFRO0FBQUEsRUFDbEM7QUFBQTtBQUFBLEVBR0EsaUJBQWlCLE1BQVksTUFBYTtBQUV6QyxTQUFLLFFBQVEsQ0FBQyxTQUFTO0FBQ3RCLFdBQ0UsU0FBUyx1QkFBdUIsRUFDaEMsUUFBUSxnQkFBZ0IsRUFDeEIsUUFBUSxZQUFZO0FBQ3BCLGNBQU0sS0FBSyxhQUFhLElBQUk7QUFBQSxNQUM3QixDQUFDO0FBQUEsSUFDSCxDQUFDO0FBQUEsRUFDRjtBQUFBO0FBQUEsRUFHQSxNQUFNLGlCQUFpQixVQUFtQztBQUN6RCxRQUFJLENBQUMsWUFBWSxTQUFTLEtBQUssTUFBTSxJQUFJO0FBQ3hDLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSTtBQUVILFlBQU0sT0FBTyxLQUFLLElBQUksTUFBTSxzQkFBc0IsU0FBUyxLQUFLLENBQUM7QUFDakUsVUFBSSxnQkFBZ0IsdUJBQU87QUFDMUIsY0FBTSxVQUFVLE1BQU0sS0FBSyxJQUFJLE1BQU0sS0FBSyxJQUFJO0FBQzlDLFlBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNwQyxrQkFBUSxJQUFJLG9FQUE0QixVQUFVO0FBQUEsUUFDbkQ7QUFDQSxlQUFPO0FBQUEsTUFDUixPQUFPO0FBQ04sWUFBSSxLQUFLLFNBQVMsbUJBQW1CO0FBQ3BDLGtCQUFRLEtBQUssOERBQTJCLFVBQVU7QUFBQSxRQUNuRDtBQUNBLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRCxTQUFTLE9BQVA7QUFDRCxVQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFDcEMsZ0JBQVEsTUFBTSxvRUFBNEIsWUFBWSxLQUFLO0FBQUEsTUFDNUQ7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFBQTtBQUFBLEVBR0EsTUFBTSxhQUFhLE1BQWE7QUFDL0IsUUFBSTtBQUNILFVBQUksVUFBVSxNQUFNLEtBQUssSUFBSSxNQUFNLEtBQUssSUFBSTtBQUc1QyxZQUFNLFNBQVMsTUFBTSxLQUFLLGlCQUFpQixLQUFLLFNBQVMsY0FBYztBQUN2RSxVQUFJLFFBQVE7QUFDWCxrQkFBVSxTQUFTLFNBQVM7QUFBQSxNQUM3QjtBQUdBLFlBQU0sU0FBUyxNQUFNLEtBQUssaUJBQWlCLEtBQUssU0FBUyxjQUFjO0FBQ3ZFLFVBQUksUUFBUTtBQUNYLGtCQUFVLFVBQVUsU0FBUztBQUFBLE1BQzlCO0FBRUEsWUFBTSxTQUFTLE1BQU0sS0FBSyx3QkFBd0IsU0FBUyxJQUFJO0FBRy9ELFlBQU0sVUFBVSxVQUFVLFVBQVUsT0FBTyxPQUFPO0FBRWxELFVBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUVwQyxhQUFLLG9CQUFvQixNQUFNO0FBQUEsTUFDaEMsT0FBTztBQUNOLFlBQUksdUJBQU8sZ0NBQTJCO0FBQUEsTUFDdkM7QUFBQSxJQUNELFNBQVMsT0FBUDtBQUNELFVBQUksdUJBQU8sNEJBQXVCLE1BQU0sT0FBTztBQUMvQyxjQUFRLE1BQU0sZ0JBQWdCLEtBQUs7QUFBQSxJQUNwQztBQUFBLEVBQ0Q7QUFBQTtBQUFBLEVBR0Esb0JBQW9CLFFBQTBJO0FBQzdKLFVBQU0sUUFBUSxPQUFPLGlCQUFpQixPQUFPO0FBRzdDLFFBQUksVUFBVTtBQUVkLGVBQVcsc0JBQWU7QUFBQTtBQUMxQixlQUFXLHdCQUFtQixPQUFPO0FBQUE7QUFDckMsZUFBVyxzQkFBaUIsT0FBTztBQUduQyxRQUFJLEtBQUssU0FBUyxpQkFBaUI7QUFDbEMsaUJBQVc7QUFHWCxZQUFNLGFBQWE7QUFDbkIsWUFBTSxnQkFBZ0IsT0FBTyxRQUFRLE1BQU0sR0FBRyxVQUFVO0FBRXhELGlCQUFXLFVBQVUsZUFBZTtBQUNuQyxjQUFNLFdBQVcsT0FBTyxLQUFLLE1BQU0sR0FBRyxFQUFFLElBQUksS0FBSyxPQUFPO0FBQ3hELGNBQU0sWUFBWSxTQUFTLFNBQVMsS0FBSyxTQUFTLFVBQVUsR0FBRyxFQUFFLElBQUksUUFBUTtBQUU3RSxZQUFJLE9BQU8sV0FBVyxXQUFXO0FBQ2hDLHFCQUFXLFVBQUs7QUFBQTtBQUFBLFFBQ2pCLFdBQVcsT0FBTyxXQUFXLFVBQVU7QUFDdEMscUJBQVcsVUFBSztBQUFBLFdBQWtCLE9BQU87QUFBQTtBQUFBLFFBQzFDLFdBQVcsT0FBTyxXQUFXLFdBQVc7QUFDdkMscUJBQVcsVUFBSztBQUFBLFdBQWtCLE9BQU87QUFBQTtBQUFBLFFBQzFDO0FBQUEsTUFDRDtBQUdBLFVBQUksT0FBTyxRQUFRLFNBQVMsWUFBWTtBQUN2QyxjQUFNLFlBQVksT0FBTyxRQUFRLFNBQVM7QUFDMUMsbUJBQVc7QUFBQSxVQUFhO0FBQUEsTUFDekI7QUFBQSxJQUNEO0FBR0EsZUFBVztBQUFBO0FBQUE7QUFHWCxRQUFJLHVCQUFPLFNBQVMsR0FBSTtBQUFBLEVBQ3pCO0FBQUE7QUFBQSxFQUdBLE1BQU0sd0JBQXdCLFNBQWlCLFlBQThKO0FBRzVNLFVBQU0sV0FBVztBQUVqQixRQUFJLFNBQVM7QUFDYixRQUFJLGlCQUFpQjtBQUNyQixRQUFJLGVBQWU7QUFDbkIsVUFBTSxVQUFrRSxDQUFDO0FBRXpFLFVBQU0sVUFBVSxDQUFDLEdBQUcsUUFBUSxTQUFTLFFBQVEsQ0FBQztBQUU5QyxRQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFDcEMsY0FBUSxJQUFJLCtFQUE2QixRQUFRLDJCQUFZO0FBQUEsSUFDOUQ7QUFFQSxlQUFXLFNBQVMsU0FBUztBQUM1QixZQUFNLFlBQVksTUFBTSxDQUFDO0FBR3pCLFVBQUksTUFBTSxDQUFDLE1BQU0sUUFBVztBQUMzQixjQUFNLFVBQVUsTUFBTSxDQUFDO0FBQ3ZCLGNBQU0sWUFBWSxNQUFNLENBQUM7QUFHekIsWUFBSSxLQUFLLFNBQVMsb0JBQW9CLFVBQVUsV0FBVyxZQUFZLEdBQUc7QUFDekU7QUFDQSxnQkFBTSxjQUFjLFVBQVUsVUFBVSxHQUFHLEVBQUUsSUFBSTtBQUNqRCxrQkFBUSxLQUFLLEVBQUMsTUFBTSxhQUFhLFFBQVEsV0FBVyxRQUFRLGlCQUFnQixDQUFDO0FBQzdFLGNBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNwQyxvQkFBUSxJQUFJLGtCQUFRLDhEQUFnQztBQUFBLFVBQ3JEO0FBQ0E7QUFBQSxRQUNEO0FBR0EsWUFBSSxVQUFVLFdBQVcsU0FBUyxLQUFLLFVBQVUsV0FBVyxVQUFVLEdBQUc7QUFDeEU7QUFDQSxrQkFBUSxLQUFLLEVBQUMsTUFBTSxXQUFXLFFBQVEsV0FBVyxRQUFRLGdDQUErQixDQUFDO0FBQzFGLGNBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNwQyxvQkFBUSxJQUFJLGtCQUFRLGtGQUEyQjtBQUFBLFVBQ2hEO0FBQ0E7QUFBQSxRQUNEO0FBR0EsY0FBTSxTQUFTLE1BQU0sS0FBSyxjQUFjLFdBQVcsVUFBVTtBQUM3RCxZQUFJLFFBQVE7QUFDWCxtQkFBUyxPQUFPLFFBQVEsV0FBVyxLQUFLLFlBQVksU0FBUztBQUM3RDtBQUNBLGtCQUFRLEtBQUssRUFBQyxNQUFNLFdBQVcsUUFBUSxVQUFTLENBQUM7QUFDakQsY0FBSSxLQUFLLFNBQVMsbUJBQW1CO0FBQ3BDLG9CQUFRLElBQUksa0JBQVEsNkNBQXlCO0FBQUEsVUFDOUM7QUFBQSxRQUNELE9BQU87QUFDTjtBQUNBLGtCQUFRLEtBQUssRUFBQyxNQUFNLFdBQVcsUUFBUSxVQUFVLFFBQVEsaUJBQWdCLENBQUM7QUFDMUUsY0FBSSxLQUFLLFNBQVMsbUJBQW1CO0FBQ3BDLG9CQUFRLElBQUksa0JBQVEsd0ZBQTRCO0FBQUEsVUFDakQ7QUFBQSxRQUNEO0FBQUEsTUFDRCxXQUVTLE1BQU0sQ0FBQyxNQUFNLFFBQVc7QUFDaEMsY0FBTSxZQUFZLE1BQU0sQ0FBQztBQUN6QixjQUFNLGNBQWMsTUFBTTtBQUcxQixZQUFJLENBQUMsS0FBSyxTQUFTLGtCQUFrQjtBQUNwQztBQUNBLGtCQUFRLEtBQUssRUFBQyxNQUFNLGFBQWEsUUFBUSxXQUFXLFFBQVEsZ0NBQStCLENBQUM7QUFDNUYsY0FBSSxLQUFLLFNBQVMsbUJBQW1CO0FBQ3BDLG9CQUFRLElBQUksa0JBQVEsNkVBQWdDO0FBQUEsVUFDckQ7QUFDQTtBQUFBLFFBQ0Q7QUFHQSxjQUFNLFNBQVMsTUFBTSxLQUFLLGNBQWMsV0FBVyxVQUFVO0FBQzdELFlBQUksUUFBUTtBQUVYLG1CQUFTLE9BQU8sUUFBUSxXQUFXLEtBQUssY0FBYyxTQUFTO0FBQy9EO0FBQ0Esa0JBQVEsS0FBSyxFQUFDLE1BQU0sYUFBYSxRQUFRLFVBQVMsQ0FBQztBQUNuRCxjQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFDcEMsb0JBQVEsSUFBSSxrQkFBUSwrQ0FBMkI7QUFBQSxVQUNoRDtBQUFBLFFBQ0QsT0FBTztBQUNOO0FBQ0Esa0JBQVEsS0FBSyxFQUFDLE1BQU0sYUFBYSxRQUFRLFVBQVUsUUFBUSxpQkFBZ0IsQ0FBQztBQUM1RSxjQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFDcEMsb0JBQVEsSUFBSSxrQkFBUSwwRkFBOEI7QUFBQSxVQUNuRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNwQyxjQUFRLElBQUksNENBQXdCLHNDQUF1QixpQ0FBa0I7QUFBQSxJQUM5RTtBQUNBLFdBQU8sRUFBRSxTQUFTLFFBQVEsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLEVBQ2pFO0FBQUE7QUFBQSxFQUdBLE1BQU0sY0FBYyxXQUFtQixZQUEyQztBQUNqRixRQUFJO0FBRUgsWUFBTSxZQUFZLEtBQUssaUJBQWlCLFdBQVcsVUFBVTtBQUM3RCxVQUFJLENBQUMsV0FBVztBQUNmLFlBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNwQyxrQkFBUSxLQUFLLHlIQUEwQjtBQUN2QyxrQkFBUSxLQUFLLG9DQUFxQixXQUFXO0FBQzdDLGNBQUksV0FBVyxRQUFRO0FBQ3RCLG9CQUFRLEtBQUssb0NBQWdCLFdBQVcsT0FBTyxRQUFRLFdBQVc7QUFBQSxVQUNuRTtBQUFBLFFBQ0Q7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUVBLFVBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNwQyxnQkFBUSxJQUFJLGtEQUFlLFVBQVUsTUFBTTtBQUFBLE1BQzVDO0FBR0EsWUFBTSxjQUFjLE1BQU0sS0FBSyxJQUFJLE1BQU0sV0FBVyxTQUFTO0FBRzdELFlBQU0sU0FBUyxLQUFLLG9CQUFvQixXQUFXO0FBR25ELFlBQU0sV0FBVyxLQUFLLFlBQVksVUFBVSxTQUFTO0FBRXJELFVBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNwQyxjQUFNLFVBQVUsWUFBWSxhQUFhLE1BQU0sUUFBUSxDQUFDO0FBQ3hELGdCQUFRLElBQUksNENBQWMsb0JBQW9CLFVBQVU7QUFBQSxNQUN6RDtBQUVBLGFBQU8sUUFBUSxtQkFBbUI7QUFBQSxJQUNuQyxTQUFTLE9BQVA7QUFDRCxVQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFDcEMsZ0JBQVEsTUFBTSw4REFBaUIsTUFBTSxTQUFTO0FBQUEsTUFDL0M7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFBQTtBQUFBLEVBR0EsaUJBQWlCLFdBQW1CLFlBQWlDO0FBRXBFLFFBQUksWUFBWSxVQUFVLFFBQVEsVUFBVSxFQUFFLEVBQUUsS0FBSztBQUdyRCxRQUFJO0FBQ0gsWUFBTSxVQUFVLG1CQUFtQixTQUFTO0FBQzVDLFVBQUksWUFBWSxXQUFXO0FBQzFCLFlBQUksS0FBSyxTQUFTLG1CQUFtQjtBQUNwQyxrQkFBUSxJQUFJLHFDQUFpQixzQkFBaUIsVUFBVTtBQUFBLFFBQ3pEO0FBQUEsTUFDRDtBQUNBLGtCQUFZO0FBQUEsSUFDYixTQUFTLEdBQVA7QUFFRCxVQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFDcEMsZ0JBQVEsS0FBSyxvRkFBd0IsV0FBVztBQUFBLE1BQ2pEO0FBQUEsSUFDRDtBQUdBLFFBQUksT0FBTyxLQUFLLElBQUksTUFBTSxzQkFBc0IsU0FBUztBQUN6RCxRQUFJLGdCQUFnQix1QkFBTztBQUMxQixVQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFDcEMsZ0JBQVEsSUFBSSxtRUFBc0I7QUFBQSxNQUNuQztBQUNBLGFBQU87QUFBQSxJQUNSO0FBR0EsUUFBSSxXQUFXLFFBQVE7QUFDdEIsWUFBTSxlQUFlLEdBQUcsV0FBVyxPQUFPLFFBQVE7QUFDbEQsYUFBTyxLQUFLLElBQUksTUFBTSxzQkFBc0IsWUFBWTtBQUN4RCxVQUFJLGdCQUFnQix1QkFBTztBQUMxQixZQUFJLEtBQUssU0FBUyxtQkFBbUI7QUFDcEMsa0JBQVEsSUFBSSxzRUFBb0IsV0FBVyxPQUFPLFFBQVE7QUFBQSxRQUMzRDtBQUNBLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUdBLFVBQU0sZUFBZSxLQUFLLElBQUksY0FBYyxxQkFBcUIsV0FBVyxXQUFXLElBQUk7QUFDM0YsUUFBSSx3QkFBd0IsdUJBQU87QUFDbEMsVUFBSSxLQUFLLFNBQVMsbUJBQW1CO0FBQ3BDLGdCQUFRLElBQUksNEVBQTBCO0FBQUEsTUFDdkM7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUdBLG9CQUFvQixRQUE2QjtBQUNoRCxVQUFNLFFBQVEsSUFBSSxXQUFXLE1BQU07QUFDbkMsUUFBSSxTQUFTO0FBQ2IsYUFBUyxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSztBQUN0QyxnQkFBVSxPQUFPLGFBQWEsTUFBTSxDQUFDLENBQUM7QUFBQSxJQUN2QztBQUNBLFdBQU8sS0FBSyxNQUFNO0FBQUEsRUFDbkI7QUFBQTtBQUFBLEVBR0EsWUFBWSxXQUEyQjtBQUN0QyxVQUFNLFlBQW9DO0FBQUEsTUFDekMsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLElBQ1I7QUFDQSxXQUFPLFVBQVUsVUFBVSxZQUFZLENBQUMsS0FBSztBQUFBLEVBQzlDO0FBQ0Q7QUFHQSxJQUFNLHlCQUFOLGNBQXFDLGlDQUFpQjtBQUFBLEVBR3JELFlBQVksS0FBVSxRQUE0QjtBQUNqRCxVQUFNLEtBQUssTUFBTTtBQUNqQixTQUFLLFNBQVM7QUFBQSxFQUNmO0FBQUEsRUFFQSxVQUFnQjtBQUNmLFVBQU0sRUFBRSxZQUFZLElBQUk7QUFDeEIsZ0JBQVksTUFBTTtBQUVsQixnQkFBWSxTQUFTLE1BQU0sRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBRzlELFFBQUksd0JBQVEsV0FBVyxFQUNyQixRQUFRLHFCQUFxQixFQUM3QixRQUFRLDhDQUE4QyxFQUN0RCxVQUFVLFlBQVUsT0FDbkIsU0FBUyxLQUFLLE9BQU8sU0FBUyxpQkFBaUIsRUFDL0MsU0FBUyxPQUFPLFVBQVU7QUFDMUIsV0FBSyxPQUFPLFNBQVMsb0JBQW9CO0FBQ3pDLFlBQU0sS0FBSyxPQUFPLGFBQWE7QUFFL0IsV0FBSyxRQUFRO0FBQUEsSUFDZCxDQUFDLENBQUM7QUFHSixRQUFJLEtBQUssT0FBTyxTQUFTLG1CQUFtQjtBQUMzQyxVQUFJLHdCQUFRLFdBQVcsRUFDckIsUUFBUSxtQkFBbUIsRUFDM0IsUUFBUSxnRkFBZ0YsRUFDeEYsVUFBVSxZQUFVLE9BQ25CLFNBQVMsS0FBSyxPQUFPLFNBQVMsZUFBZSxFQUM3QyxTQUFTLE9BQU8sVUFBVTtBQUMxQixhQUFLLE9BQU8sU0FBUyxrQkFBa0I7QUFDdkMsY0FBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLE1BQ2hDLENBQUMsQ0FBQztBQUFBLElBQ0w7QUFHQSxRQUFJLHdCQUFRLFdBQVcsRUFDckIsUUFBUSxvQkFBb0IsRUFDNUIsUUFBUSwrRUFBK0UsRUFDdkYsVUFBVSxZQUFVLE9BQ25CLFNBQVMsS0FBSyxPQUFPLFNBQVMsZ0JBQWdCLEVBQzlDLFNBQVMsT0FBTyxVQUFVO0FBQzFCLFdBQUssT0FBTyxTQUFTLG1CQUFtQjtBQUN4QyxZQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsSUFDaEMsQ0FBQyxDQUFDO0FBR0osUUFBSSx3QkFBUSxXQUFXLEVBQ3JCLFFBQVEsb0JBQW9CLEVBQzVCLFFBQVEsK0NBQStDLEVBQ3ZELFVBQVUsWUFBVSxPQUNuQixTQUFTLEtBQUssT0FBTyxTQUFTLGdCQUFnQixFQUM5QyxTQUFTLE9BQU8sVUFBVTtBQUMxQixXQUFLLE9BQU8sU0FBUyxtQkFBbUI7QUFDeEMsWUFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLElBQ2hDLENBQUMsQ0FBQztBQUdKLGdCQUFZLFNBQVMsTUFBTSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFHOUQsUUFBSSx3QkFBUSxXQUFXLEVBQ3JCLFFBQVEsa0JBQWtCLEVBQzFCLFFBQVEseUZBQXlGLEVBQ2pHLFFBQVEsVUFBUSxLQUNmLGVBQWUscUJBQXFCLEVBQ3BDLFNBQVMsS0FBSyxPQUFPLFNBQVMsY0FBYyxFQUM1QyxTQUFTLE9BQU8sVUFBVTtBQUMxQixXQUFLLE9BQU8sU0FBUyxpQkFBaUIsTUFBTSxLQUFLO0FBQ2pELFlBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxJQUNoQyxDQUFDLENBQUM7QUFHSixRQUFJLHdCQUFRLFdBQVcsRUFDckIsUUFBUSxrQkFBa0IsRUFDMUIsUUFBUSx3RkFBd0YsRUFDaEcsUUFBUSxVQUFRLEtBQ2YsZUFBZSxxQkFBcUIsRUFDcEMsU0FBUyxLQUFLLE9BQU8sU0FBUyxjQUFjLEVBQzVDLFNBQVMsT0FBTyxVQUFVO0FBQzFCLFdBQUssT0FBTyxTQUFTLGlCQUFpQixNQUFNLEtBQUs7QUFDakQsWUFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLElBQ2hDLENBQUMsQ0FBQztBQUFBLEVBQ0w7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K

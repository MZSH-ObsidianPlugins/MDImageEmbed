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
  skipBase64Images: true
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
  // ========== 功能 1: 复制到剪贴板 ==========
  async copyAsBase64(file) {
    try {
      const content = await this.app.vault.read(file);
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
  }
};
/**
 * MDImageEmbed - Obsidian Plugin
 * Convert local images in Markdown to Base64 embedded format
 *
 * @author mengzhishanghun
 * @license MIT
 */
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBNREltYWdlRW1iZWQgLSBPYnNpZGlhbiBQbHVnaW5cbiAqIENvbnZlcnQgbG9jYWwgaW1hZ2VzIGluIE1hcmtkb3duIHRvIEJhc2U2NCBlbWJlZGRlZCBmb3JtYXRcbiAqXG4gKiBAYXV0aG9yIG1lbmd6aGlzaGFuZ2h1blxuICogQGxpY2Vuc2UgTUlUXG4gKi9cbmltcG9ydCB7IFBsdWdpbiwgVEZpbGUsIE5vdGljZSwgTWVudSwgUGx1Z2luU2V0dGluZ1RhYiwgQXBwLCBTZXR0aW5nIH0gZnJvbSAnb2JzaWRpYW4nO1xuXG4vLyA9PT09PT09PT09IFx1OEJCRVx1N0Y2RVx1NjNBNVx1NTNFMyA9PT09PT09PT09XG5pbnRlcmZhY2UgTURJbWFnZUVtYmVkU2V0dGluZ3Mge1xuXHRzaG93Q29udmVyc2lvbkxvZzogYm9vbGVhbjsgICAgICAgIC8vIFx1NjYyRlx1NTQyNlx1NjYzRVx1NzkzQVx1OEY2Q1x1NjM2Mlx1NjVFNVx1NUZEN1xuXHRzaG93RGV0YWlsZWRMb2c6IGJvb2xlYW47ICAgICAgICAgICAvLyBcdTY2MkZcdTU0MjZcdTY2M0VcdTc5M0FcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdUZGMDhcdTZCQ0ZcdTRFMkFcdTU2RkVcdTcyNDdcdTc2ODRcdTcyQjZcdTYwMDFcdUZGMDlcblx0Y29udmVydFdpa2lMaW5rczogYm9vbGVhbjsgICAgICAgICAgLy8gXHU2NjJGXHU1NDI2XHU4RjZDXHU2MzYyIFdpa2kgXHU5NEZFXHU2M0E1XG5cdHNraXBCYXNlNjRJbWFnZXM6IGJvb2xlYW47ICAgICAgICAgIC8vIFx1NjYyRlx1NTQyNlx1OERGM1x1OEZDN1x1NURGMlx1NjcwOSBCYXNlNjRcbn1cblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogTURJbWFnZUVtYmVkU2V0dGluZ3MgPSB7XG5cdHNob3dDb252ZXJzaW9uTG9nOiB0cnVlLFxuXHRzaG93RGV0YWlsZWRMb2c6IGZhbHNlLFxuXHRjb252ZXJ0V2lraUxpbmtzOiB0cnVlLFxuXHRza2lwQmFzZTY0SW1hZ2VzOiB0cnVlXG59XG5cbi8vID09PT09PT09PT0gXHU0RTNCXHU2M0QyXHU0RUY2XHU3QzdCID09PT09PT09PT1cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1ESW1hZ2VFbWJlZFBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG5cdHNldHRpbmdzOiBNREltYWdlRW1iZWRTZXR0aW5ncztcblxuXHQvLyA9PT09PT09PT09IFx1NjNEMlx1NEVGNlx1NzUxRlx1NTQ3RFx1NTQ2OFx1NjcxRiA9PT09PT09PT09XG5cdGFzeW5jIG9ubG9hZCgpIHtcblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG5cdFx0Ly8gXHU2Q0U4XHU1MThDXHU4QkJFXHU3RjZFXHU5NzYyXHU2NzdGXG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBNREltYWdlRW1iZWRTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cblx0XHQvLyBcdTZDRThcdTUxOENcdTY1ODdcdTRFRjZcdTgzRENcdTUzNTVcdTRFOEJcdTRFRjZcdUZGMDhcdTUzRjNcdTk1MkVcdTgzRENcdTUzNTVcdUZGMDlcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtbWVudScsIChtZW51LCBmaWxlKSA9PiB7XG5cdFx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZpbGUgJiYgZmlsZS5leHRlbnNpb24gPT09ICdtZCcpIHtcblx0XHRcdFx0XHR0aGlzLmFkZEZpbGVNZW51SXRlbXMobWVudSwgZmlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdGNvbnNvbGUubG9nKCdNRCBJbWFnZSBFbWJlZCBwbHVnaW4gbG9hZGVkJyk7XG5cdH1cblxuXHRvbnVubG9hZCgpIHtcblx0XHRjb25zb2xlLmxvZygnTUQgSW1hZ2UgRW1iZWQgcGx1Z2luIHVubG9hZGVkJyk7XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1OEJCRVx1N0Y2RVx1N0JBMVx1NzQwNiA9PT09PT09PT09XG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdTUzRjNcdTk1MkVcdTgzRENcdTUzNTUgPT09PT09PT09PVxuXHRhZGRGaWxlTWVudUl0ZW1zKG1lbnU6IE1lbnUsIGZpbGU6IFRGaWxlKSB7XG5cdFx0Ly8gXHU4M0RDXHU1MzU1XHU5ODc5OiBcdTU5MERcdTUyMzZcdTRFM0EgQmFzZTY0IFx1NjgzQ1x1NUYwRlx1NTIzMFx1NTI2QVx1OEQzNFx1Njc3RlxuXHRcdG1lbnUuYWRkSXRlbSgoaXRlbSkgPT4ge1xuXHRcdFx0aXRlbVxuXHRcdFx0XHQuc2V0VGl0bGUoJ0NvcHkgYXMgQmFzZTY0IGZvcm1hdCcpXG5cdFx0XHRcdC5zZXRJY29uKCdjbGlwYm9hcmQtY29weScpXG5cdFx0XHRcdC5vbkNsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvcHlBc0Jhc2U2NChmaWxlKTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1NTI5Rlx1ODBGRCAxOiBcdTU5MERcdTUyMzZcdTUyMzBcdTUyNkFcdThEMzRcdTY3N0YgPT09PT09PT09PVxuXHRhc3luYyBjb3B5QXNCYXNlNjQoZmlsZTogVEZpbGUpIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNvbnZlcnRNYXJrZG93blRvQmFzZTY0KGNvbnRlbnQsIGZpbGUpO1xuXG5cdFx0XHQvLyBcdTU5MERcdTUyMzZcdTUyMzBcdTUyNkFcdThEMzRcdTY3N0Zcblx0XHRcdGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHJlc3VsdC5jb250ZW50KTtcblxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0Ly8gXHU2NjNFXHU3OTNBXHU4QkU2XHU3RUM2XHU3Njg0XHU1OTA0XHU3NDA2XHU3RUQzXHU2NzlDXG5cdFx0XHRcdHRoaXMuc2hvd0RldGFpbGVkUmVzdWx0cyhyZXN1bHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3IE5vdGljZSgnXHUyNzA1IENvcGllZCBhcyBCYXNlNjQgZm9ybWF0Jyk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdG5ldyBOb3RpY2UoJ1x1Mjc0QyBGYWlsZWQgdG8gY29weTogJyArIGVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0Y29uc29sZS5lcnJvcignQ29weSBmYWlsZWQ6JywgZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdC8vID09PT09PT09PT0gXHU2NjNFXHU3OTNBXHU4QkU2XHU3RUM2XHU1OTA0XHU3NDA2XHU3RUQzXHU2NzlDID09PT09PT09PT1cblx0c2hvd0RldGFpbGVkUmVzdWx0cyhyZXN1bHQ6IHtjb250ZW50OiBzdHJpbmcsIGNvbnZlcnRlZENvdW50OiBudW1iZXIsIHNraXBwZWRDb3VudDogbnVtYmVyLCBkZXRhaWxzOiBBcnJheTx7cGF0aDogc3RyaW5nLCBzdGF0dXM6IHN0cmluZywgcmVhc29uPzogc3RyaW5nfT59KSB7XG5cdFx0Y29uc3QgdG90YWwgPSByZXN1bHQuY29udmVydGVkQ291bnQgKyByZXN1bHQuc2tpcHBlZENvdW50O1xuXG5cdFx0Ly8gXHU0RTNCXHU5MDFBXHU3N0U1XG5cdFx0bGV0IG1lc3NhZ2UgPSAnXHUyNzA1IENvcGllZCB0byBjbGlwYm9hcmRcXG5cXG4nO1xuXG5cdFx0bWVzc2FnZSArPSBgXHVEODNEXHVEQ0NBIFN1bW1hcnk6ICR7dG90YWx9IGltYWdlc1xcbmA7XG5cdFx0bWVzc2FnZSArPSBgICAgXHUyMDIyIENvbnZlcnRlZDogJHtyZXN1bHQuY29udmVydGVkQ291bnR9XFxuYDtcblx0XHRtZXNzYWdlICs9IGAgICBcdTIwMjIgU2tpcHBlZDogJHtyZXN1bHQuc2tpcHBlZENvdW50fWA7XG5cblx0XHQvLyBcdTU5ODJcdTY3OUNcdTU0MkZcdTc1MjhcdTRFODZcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdUZGMENcdTY2M0VcdTc5M0FcdTZCQ0ZcdTRFMkFcdTU2RkVcdTcyNDdcdTc2ODRcdTcyQjZcdTYwMDFcblx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93RGV0YWlsZWRMb2cpIHtcblx0XHRcdG1lc3NhZ2UgKz0gJ1xcblxcbic7XG5cblx0XHRcdC8vIFx1NjYzRVx1NzkzQVx1NkJDRlx1NEUyQVx1NTZGRVx1NzI0N1x1NzY4NFx1OEJFNlx1N0VDNlx1NzJCNlx1NjAwMVxuXHRcdFx0Y29uc3QgbWF4RGlzcGxheSA9IDg7IC8vIFx1NjcwMFx1NTkxQVx1NjYzRVx1NzkzQThcdTRFMkFcdTU2RkVcdTcyNDdcdTc2ODRcdThCRTZcdTYwQzVcblx0XHRcdGNvbnN0IGRldGFpbHNUb1Nob3cgPSByZXN1bHQuZGV0YWlscy5zbGljZSgwLCBtYXhEaXNwbGF5KTtcblxuXHRcdFx0Zm9yIChjb25zdCBkZXRhaWwgb2YgZGV0YWlsc1RvU2hvdykge1xuXHRcdFx0XHRjb25zdCBmaWxlTmFtZSA9IGRldGFpbC5wYXRoLnNwbGl0KCcvJykucG9wKCkgfHwgZGV0YWlsLnBhdGg7XG5cdFx0XHRcdGNvbnN0IHNob3J0TmFtZSA9IGZpbGVOYW1lLmxlbmd0aCA+IDM1ID8gZmlsZU5hbWUuc3Vic3RyaW5nKDAsIDMyKSArICcuLi4nIDogZmlsZU5hbWU7XG5cblx0XHRcdFx0aWYgKGRldGFpbC5zdGF0dXMgPT09ICdzdWNjZXNzJykge1xuXHRcdFx0XHRcdG1lc3NhZ2UgKz0gYFx1MjcxMyAke3Nob3J0TmFtZX1cXG5gO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGRldGFpbC5zdGF0dXMgPT09ICdmYWlsZWQnKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSArPSBgXHUyNzE3ICR7c2hvcnROYW1lfVxcbiAgXHUyMTkyICR7ZGV0YWlsLnJlYXNvbn1cXG5gO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGRldGFpbC5zdGF0dXMgPT09ICdza2lwcGVkJykge1xuXHRcdFx0XHRcdG1lc3NhZ2UgKz0gYFx1MjI5OCAke3Nob3J0TmFtZX1cXG4gIFx1MjE5MiAke2RldGFpbC5yZWFzb259XFxuYDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBcdTU5ODJcdTY3OUNcdThGRDhcdTY3MDlcdTY2RjRcdTU5MUFcdTU2RkVcdTcyNDdcdTY3MkFcdTY2M0VcdTc5M0Fcblx0XHRcdGlmIChyZXN1bHQuZGV0YWlscy5sZW5ndGggPiBtYXhEaXNwbGF5KSB7XG5cdFx0XHRcdGNvbnN0IHJlbWFpbmluZyA9IHJlc3VsdC5kZXRhaWxzLmxlbmd0aCAtIG1heERpc3BsYXk7XG5cdFx0XHRcdG1lc3NhZ2UgKz0gYFxcbi4uLiBhbmQgJHtyZW1haW5pbmd9IG1vcmVgO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFx1NjYzRVx1NzkzQVx1NjNBN1x1NTIzNlx1NTNGMFx1NjNEMFx1NzkzQVxuXHRcdG1lc3NhZ2UgKz0gYFxcblxcblx1RDgzRFx1RENBMSBDb25zb2xlIChDdHJsK1NoaWZ0K0kpIGZvciBmdWxsIGRldGFpbHNgO1xuXG5cdFx0Ly8gXHU2NjNFXHU3OTNBXHU2NUY2XHU5NUY0XHU2NkY0XHU5NTdGXHU3Njg0XHU5MDFBXHU3N0U1XHVGRjA4OFx1NzlEMlx1RkYwOVxuXHRcdG5ldyBOb3RpY2UobWVzc2FnZSwgODAwMCk7XG5cdH1cblxuXHQvLyA9PT09PT09PT09IFx1NjgzOFx1NUZDM1x1OEY2Q1x1NjM2Mlx1OTAzQlx1OEY5MSA9PT09PT09PT09XG5cdGFzeW5jIGNvbnZlcnRNYXJrZG93blRvQmFzZTY0KGNvbnRlbnQ6IHN0cmluZywgc291cmNlRmlsZTogVEZpbGUpOiBQcm9taXNlPHtjb250ZW50OiBzdHJpbmcsIGNvbnZlcnRlZENvdW50OiBudW1iZXIsIHNraXBwZWRDb3VudDogbnVtYmVyLCBkZXRhaWxzOiBBcnJheTx7cGF0aDogc3RyaW5nLCBzdGF0dXM6IHN0cmluZywgcmVhc29uPzogc3RyaW5nfT59PiB7XG5cdFx0Ly8gXHU1MzM5XHU5MTREIE1hcmtkb3duIFx1NTZGRVx1NzI0N1x1OEJFRFx1NkNENTogIVthbHRdKHBhdGgpIFx1NjIxNiAhW2FsdF0oPHBhdGg+KVxuXHRcdC8vIFx1NjUyRlx1NjMwMSBPYnNpZGlhbiBcdTc2ODQgIVtbaW1hZ2UucG5nXV0gXHU4QkVEXHU2Q0Q1XG5cdFx0Y29uc3QgaW1nUmVnZXggPSAvIVxcWyhbXlxcXV0qKVxcXVxcKDw/KFteKVwiPl0rKT4/XFwpfCFcXFtcXFsoW15cXF1dK1xcLihwbmd8anBnfGpwZWd8Z2lmfHdlYnB8c3ZnfGJtcCkpXFxdXFxdL2dpO1xuXG5cdFx0bGV0IHJlc3VsdCA9IGNvbnRlbnQ7XG5cdFx0bGV0IGNvbnZlcnRlZENvdW50ID0gMDtcblx0XHRsZXQgc2tpcHBlZENvdW50ID0gMDtcblx0XHRjb25zdCBkZXRhaWxzOiBBcnJheTx7cGF0aDogc3RyaW5nLCBzdGF0dXM6IHN0cmluZywgcmVhc29uPzogc3RyaW5nfT4gPSBbXTtcblxuXHRcdGNvbnN0IG1hdGNoZXMgPSBbLi4uY29udGVudC5tYXRjaEFsbChpbWdSZWdleCldO1xuXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdGNvbnNvbGUubG9nKGBbTURJbWFnZUVtYmVkXSBcdTVGMDBcdTU5Q0JcdTU5MDRcdTc0MDZcdTY1ODdcdTY4NjNcdUZGMENcdTUxNzFcdTYyN0VcdTUyMzAgJHttYXRjaGVzLmxlbmd0aH0gXHU0RTJBXHU1NkZFXHU3MjQ3YCk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBtYXRjaCBvZiBtYXRjaGVzKSB7XG5cdFx0XHRjb25zdCBmdWxsTWF0Y2ggPSBtYXRjaFswXTtcblxuXHRcdFx0Ly8gXHU1OTA0XHU3NDA2XHU2ODA3XHU1MUM2IE1hcmtkb3duIFx1OEJFRFx1NkNENTogIVthbHRdKHBhdGgpXG5cdFx0XHRpZiAobWF0Y2hbMV0gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb25zdCBhbHRUZXh0ID0gbWF0Y2hbMV07XG5cdFx0XHRcdGNvbnN0IGltYWdlUGF0aCA9IG1hdGNoWzJdO1xuXG5cdFx0XHRcdC8vIFx1OERGM1x1OEZDN1x1NURGMlx1N0VDRlx1NjYyRiBiYXNlNjQgXHU3Njg0XHU1NkZFXHU3MjQ3XG5cdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNraXBCYXNlNjRJbWFnZXMgJiYgaW1hZ2VQYXRoLnN0YXJ0c1dpdGgoJ2RhdGE6aW1hZ2UnKSkge1xuXHRcdFx0XHRcdHNraXBwZWRDb3VudCsrO1xuXHRcdFx0XHRcdGNvbnN0IGRpc3BsYXlQYXRoID0gaW1hZ2VQYXRoLnN1YnN0cmluZygwLCAzMCkgKyAnLi4uJztcblx0XHRcdFx0XHRkZXRhaWxzLnB1c2goe3BhdGg6IGRpc3BsYXlQYXRoLCBzdGF0dXM6ICdza2lwcGVkJywgcmVhc29uOiAnQWxyZWFkeSBCYXNlNjQnfSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbXHU4REYzXHU4RkM3XSAke2Rpc3BsYXlQYXRofSAtIFx1NTM5Rlx1NTZFMDogXHU1REYyXHU2NjJGIEJhc2U2NCBcdTY4M0NcdTVGMEZgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBcdThERjNcdThGQzdcdTdGNTFcdTdFRENcdTU2RkVcdTcyNDdcdUZGMDhcdTRFMERcdTY1MkZcdTYzMDFcdUZGMDlcblx0XHRcdFx0aWYgKGltYWdlUGF0aC5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgaW1hZ2VQYXRoLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykpIHtcblx0XHRcdFx0XHRza2lwcGVkQ291bnQrKztcblx0XHRcdFx0XHRkZXRhaWxzLnB1c2goe3BhdGg6IGltYWdlUGF0aCwgc3RhdHVzOiAnc2tpcHBlZCcsIHJlYXNvbjogJ05ldHdvcmsgaW1hZ2UgKG5vdCBzdXBwb3J0ZWQpJ30pO1xuXHRcdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgW1x1OERGM1x1OEZDN10gJHtpbWFnZVBhdGh9IC0gXHU1MzlGXHU1NkUwOiBcdTdGNTFcdTdFRENcdTU2RkVcdTcyNDdcdTRFMERcdTY1MkZcdTYzMDFcdThGNkNcdTYzNjJgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBcdThGNkNcdTYzNjJcdTY3MkNcdTU3MzBcdTU2RkVcdTcyNDdcblx0XHRcdFx0Y29uc3QgYmFzZTY0ID0gYXdhaXQgdGhpcy5pbWFnZVRvQmFzZTY0KGltYWdlUGF0aCwgc291cmNlRmlsZSk7XG5cdFx0XHRcdGlmIChiYXNlNjQpIHtcblx0XHRcdFx0XHRyZXN1bHQgPSByZXN1bHQucmVwbGFjZShmdWxsTWF0Y2gsIGAhWyR7YWx0VGV4dH1dKCR7YmFzZTY0fSlgKTtcblx0XHRcdFx0XHRjb252ZXJ0ZWRDb3VudCsrO1xuXHRcdFx0XHRcdGRldGFpbHMucHVzaCh7cGF0aDogaW1hZ2VQYXRoLCBzdGF0dXM6ICdzdWNjZXNzJ30pO1xuXHRcdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlLmxvZyhgW1x1NjIxMFx1NTI5Rl0gJHtpbWFnZVBhdGh9IC0gXHU1REYyXHU4RjZDXHU2MzYyXHU0RTNBIEJhc2U2NGApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRza2lwcGVkQ291bnQrKztcblx0XHRcdFx0XHRkZXRhaWxzLnB1c2goe3BhdGg6IGltYWdlUGF0aCwgc3RhdHVzOiAnZmFpbGVkJywgcmVhc29uOiAnRmlsZSBub3QgZm91bmQnfSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbXHU1OTMxXHU4RDI1XSAke2ltYWdlUGF0aH0gLSBcdTUzOUZcdTU2RTA6IFx1NjU4N1x1NEVGNlx1NjcyQVx1NjI3RVx1NTIzMFx1NjIxNlx1OEJGQlx1NTNENlx1NTkzMVx1OEQyNWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gXHU1OTA0XHU3NDA2IE9ic2lkaWFuIFdpa2kgXHU4QkVEXHU2Q0Q1OiAhW1tpbWFnZS5wbmddXVxuXHRcdFx0ZWxzZSBpZiAobWF0Y2hbM10gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb25zdCBpbWFnZU5hbWUgPSBtYXRjaFszXTtcblx0XHRcdFx0Y29uc3QgZGlzcGxheVBhdGggPSBgIVtbJHtpbWFnZU5hbWV9XV1gO1xuXG5cdFx0XHRcdC8vIFx1NTk4Mlx1Njc5Q1x1NEUwRFx1OEY2Q1x1NjM2MiBXaWtpIFx1OTRGRVx1NjNBNVx1RkYwQ1x1OERGM1x1OEZDN1xuXHRcdFx0XHRpZiAoIXRoaXMuc2V0dGluZ3MuY29udmVydFdpa2lMaW5rcykge1xuXHRcdFx0XHRcdHNraXBwZWRDb3VudCsrO1xuXHRcdFx0XHRcdGRldGFpbHMucHVzaCh7cGF0aDogZGlzcGxheVBhdGgsIHN0YXR1czogJ3NraXBwZWQnLCByZWFzb246ICdXaWtpIGxpbmsgY29udmVyc2lvbiBkaXNhYmxlZCd9KTtcblx0XHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYFtcdThERjNcdThGQzddICR7ZGlzcGxheVBhdGh9IC0gXHU1MzlGXHU1NkUwOiBXaWtpIFx1OTRGRVx1NjNBNVx1OEY2Q1x1NjM2Mlx1NURGMlx1Nzk4MVx1NzUyOGApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFx1OEY2Q1x1NjM2Mlx1NEUzQSBiYXNlNjRcblx0XHRcdFx0Y29uc3QgYmFzZTY0ID0gYXdhaXQgdGhpcy5pbWFnZVRvQmFzZTY0KGltYWdlTmFtZSwgc291cmNlRmlsZSk7XG5cdFx0XHRcdGlmIChiYXNlNjQpIHtcblx0XHRcdFx0XHQvLyBcdThGNkNcdTYzNjJcdTRFM0FcdTY4MDdcdTUxQzYgTWFya2Rvd24gXHU4QkVEXHU2Q0Q1XG5cdFx0XHRcdFx0cmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoZnVsbE1hdGNoLCBgIVske2ltYWdlTmFtZX1dKCR7YmFzZTY0fSlgKTtcblx0XHRcdFx0XHRjb252ZXJ0ZWRDb3VudCsrO1xuXHRcdFx0XHRcdGRldGFpbHMucHVzaCh7cGF0aDogZGlzcGxheVBhdGgsIHN0YXR1czogJ3N1Y2Nlc3MnfSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbXHU2MjEwXHU1MjlGXSAke2Rpc3BsYXlQYXRofSAtIFx1NURGMlx1OEY2Q1x1NjM2Mlx1NEUzQSBCYXNlNjRgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c2tpcHBlZENvdW50Kys7XG5cdFx0XHRcdFx0ZGV0YWlscy5wdXNoKHtwYXRoOiBkaXNwbGF5UGF0aCwgc3RhdHVzOiAnZmFpbGVkJywgcmVhc29uOiAnRmlsZSBub3QgZm91bmQnfSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGBbXHU1OTMxXHU4RDI1XSAke2Rpc3BsYXlQYXRofSAtIFx1NTM5Rlx1NTZFMDogXHU2NTg3XHU0RUY2XHU2NzJBXHU2MjdFXHU1MjMwXHU2MjE2XHU4QkZCXHU1M0Q2XHU1OTMxXHU4RDI1YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdGNvbnNvbGUubG9nKGBbTURJbWFnZUVtYmVkXSBcdTU5MDRcdTc0MDZcdTVCOENcdTYyMTA6ICR7Y29udmVydGVkQ291bnR9IFx1NEUyQVx1NjIxMFx1NTI5RiwgJHtza2lwcGVkQ291bnR9IFx1NEUyQVx1OERGM1x1OEZDN2ApO1xuXHRcdH1cblx0XHRyZXR1cm4geyBjb250ZW50OiByZXN1bHQsIGNvbnZlcnRlZENvdW50LCBza2lwcGVkQ291bnQsIGRldGFpbHMgfTtcblx0fVxuXG5cdC8vID09PT09PT09PT0gXHU1NkZFXHU3MjQ3XHU4RjZDIEJhc2U2NCA9PT09PT09PT09XG5cdGFzeW5jIGltYWdlVG9CYXNlNjQoaW1hZ2VQYXRoOiBzdHJpbmcsIHNvdXJjZUZpbGU6IFRGaWxlKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdC8vIFx1ODlFM1x1Njc5MFx1NTZGRVx1NzI0N1x1OERFRlx1NUY4NFxuXHRcdFx0Y29uc3QgaW1hZ2VGaWxlID0gdGhpcy5yZXNvbHZlSW1hZ2VQYXRoKGltYWdlUGF0aCwgc291cmNlRmlsZSk7XG5cdFx0XHRpZiAoIWltYWdlRmlsZSkge1xuXHRcdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybihgICBcdTI1MTRcdTI1MDAgXHU4REVGXHU1Rjg0XHU4OUUzXHU2NzkwXHU1OTMxXHU4RDI1OiBcdTU3MjhcdTRFRTVcdTRFMEJcdTRGNERcdTdGNkVcdTkwRkRcdTY3MkFcdTYyN0VcdTUyMzBcdTY1ODdcdTRFRjZgKTtcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oYCAgICAgLSBWYXVsdCBcdTY4MzlcdTc2RUVcdTVGNTU6ICR7aW1hZ2VQYXRofWApO1xuXHRcdFx0XHRcdGlmIChzb3VyY2VGaWxlLnBhcmVudCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKGAgICAgIC0gXHU3NkY4XHU1QkY5XHU4REVGXHU1Rjg0OiAke3NvdXJjZUZpbGUucGFyZW50LnBhdGh9LyR7aW1hZ2VQYXRofWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYCAgXHUyNTE0XHUyNTAwIFx1NjU4N1x1NEVGNlx1NURGMlx1NjI3RVx1NTIzMDogJHtpbWFnZUZpbGUucGF0aH1gKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gXHU4QkZCXHU1M0Q2XHU1NkZFXHU3MjQ3XHU0RTNBIEFycmF5QnVmZmVyXG5cdFx0XHRjb25zdCBhcnJheUJ1ZmZlciA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWRCaW5hcnkoaW1hZ2VGaWxlKTtcblxuXHRcdFx0Ly8gXHU4RjZDXHU2MzYyXHU0RTNBIEJhc2U2NFxuXHRcdFx0Y29uc3QgYmFzZTY0ID0gdGhpcy5hcnJheUJ1ZmZlclRvQmFzZTY0KGFycmF5QnVmZmVyKTtcblxuXHRcdFx0Ly8gXHU4M0I3XHU1M0Q2IE1JTUUgXHU3QzdCXHU1NzhCXG5cdFx0XHRjb25zdCBtaW1lVHlwZSA9IHRoaXMuZ2V0TWltZVR5cGUoaW1hZ2VGaWxlLmV4dGVuc2lvbik7XG5cblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdGNvbnN0IHNpemVLQiA9IChhcnJheUJ1ZmZlci5ieXRlTGVuZ3RoIC8gMTAyNCkudG9GaXhlZCgyKTtcblx0XHRcdFx0Y29uc29sZS5sb2coYCAgXHUyNTE0XHUyNTAwIFx1NjU4N1x1NEVGNlx1NTkyN1x1NUMwRjogJHtzaXplS0J9IEtCLCBNSU1FOiAke21pbWVUeXBlfWApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gYGRhdGE6JHttaW1lVHlwZX07YmFzZTY0LCR7YmFzZTY0fWA7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoYCAgXHUyNTE0XHUyNTAwIFx1OEJGQlx1NTNENlx1NjIxNlx1OEY2Q1x1NjM2Mlx1NTkzMVx1OEQyNTogJHtlcnJvci5tZXNzYWdlfWApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0Ly8gPT09PT09PT09PSBcdThERUZcdTVGODRcdTg5RTNcdTY3OTAgPT09PT09PT09PVxuXHRyZXNvbHZlSW1hZ2VQYXRoKGltYWdlUGF0aDogc3RyaW5nLCBzb3VyY2VGaWxlOiBURmlsZSk6IFRGaWxlIHwgbnVsbCB7XG5cdFx0Ly8gXHU3OUZCXHU5NjY0IE9ic2lkaWFuIFx1OERFRlx1NUY4NFx1NTI0RFx1N0YwMFxuXHRcdGxldCBjbGVhblBhdGggPSBpbWFnZVBhdGgucmVwbGFjZSgvXjx8PiQvZywgJycpLnRyaW0oKTtcblxuXHRcdC8vIFVSTCBcdTg5RTNcdTc4MDFcdUZGMDhcdTU5MDRcdTc0MDYgJTIwIFx1N0I0OVx1N0YxNlx1NzgwMVx1NUI1N1x1N0IyNlx1RkYwOVxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBkZWNvZGVkID0gZGVjb2RlVVJJQ29tcG9uZW50KGNsZWFuUGF0aCk7XG5cdFx0XHRpZiAoZGVjb2RlZCAhPT0gY2xlYW5QYXRoKSB7XG5cdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coYCAgXHUyNTE0XHUyNTAwIFVSTCBcdTg5RTNcdTc4MDE6IFwiJHtjbGVhblBhdGh9XCIgXHUyMTkyIFwiJHtkZWNvZGVkfVwiYCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNsZWFuUGF0aCA9IGRlY29kZWQ7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Ly8gXHU1OTgyXHU2NzlDXHU4OUUzXHU3ODAxXHU1OTMxXHU4RDI1XHVGRjBDXHU0RjdGXHU3NTI4XHU1MzlGXHU4REVGXHU1Rjg0XG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYCAgXHUyNTE0XHUyNTAwIFVSTCBcdTg5RTNcdTc4MDFcdTU5MzFcdThEMjVcdUZGMENcdTRGN0ZcdTc1MjhcdTUzOUZcdThERUZcdTVGODQ6ICR7Y2xlYW5QYXRofWApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFx1NjVCOVx1NkNENSAxOiBcdTc2RjRcdTYzQTVcdTRFQ0UgVmF1bHQgXHU2ODM5XHU3NkVFXHU1RjU1XHU2N0U1XHU2MjdFXG5cdFx0bGV0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY2xlYW5QYXRoKTtcblx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRpZiAodGhpcy5zZXR0aW5ncy5zaG93Q29udmVyc2lvbkxvZykge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgICBcdTI1MTRcdTI1MDAgXHU4OUUzXHU2NzkwXHU2NUI5XHU2Q0Q1OiBWYXVsdCBcdTY4MzlcdTc2RUVcdTVGNTVgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmaWxlO1xuXHRcdH1cblxuXHRcdC8vIFx1NjVCOVx1NkNENSAyOiBcdTc2RjhcdTVCRjlcdTRFOEVcdTVGNTNcdTUyNERcdTY1ODdcdTRFRjZcdTY3RTVcdTYyN0Vcblx0XHRpZiAoc291cmNlRmlsZS5wYXJlbnQpIHtcblx0XHRcdGNvbnN0IHJlbGF0aXZlUGF0aCA9IGAke3NvdXJjZUZpbGUucGFyZW50LnBhdGh9LyR7Y2xlYW5QYXRofWA7XG5cdFx0XHRmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHJlbGF0aXZlUGF0aCk7XG5cdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coYCAgXHUyNTE0XHUyNTAwIFx1ODlFM1x1Njc5MFx1NjVCOVx1NkNENTogXHU3NkY4XHU1QkY5XHU4REVGXHU1Rjg0ICgke3NvdXJjZUZpbGUucGFyZW50LnBhdGh9LylgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmlsZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBcdTY1QjlcdTZDRDUgMzogXHU0RjdGXHU3NTI4IE9ic2lkaWFuIFx1NzY4NFx1OTRGRVx1NjNBNVx1ODlFM1x1Njc5MFxuXHRcdGNvbnN0IHJlc29sdmVkRmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY2xlYW5QYXRoLCBzb3VyY2VGaWxlLnBhdGgpO1xuXHRcdGlmIChyZXNvbHZlZEZpbGUgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0aWYgKHRoaXMuc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYCAgXHUyNTE0XHUyNTAwIFx1ODlFM1x1Njc5MFx1NjVCOVx1NkNENTogT2JzaWRpYW4gXHU5NEZFXHU2M0E1XHU4OUUzXHU2NzkwYCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzb2x2ZWRGaWxlO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0Ly8gPT09PT09PT09PSBBcnJheUJ1ZmZlciBcdThGNkMgQmFzZTY0ID09PT09PT09PT1cblx0YXJyYXlCdWZmZXJUb0Jhc2U2NChidWZmZXI6IEFycmF5QnVmZmVyKTogc3RyaW5nIHtcblx0XHRjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG5cdFx0bGV0IGJpbmFyeSA9ICcnO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGJpbmFyeSArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldKTtcblx0XHR9XG5cdFx0cmV0dXJuIGJ0b2EoYmluYXJ5KTtcblx0fVxuXG5cdC8vID09PT09PT09PT0gXHU4M0I3XHU1M0Q2IE1JTUUgXHU3QzdCXHU1NzhCID09PT09PT09PT1cblx0Z2V0TWltZVR5cGUoZXh0ZW5zaW9uOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IG1pbWVUeXBlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcblx0XHRcdCdwbmcnOiAnaW1hZ2UvcG5nJyxcblx0XHRcdCdqcGcnOiAnaW1hZ2UvanBlZycsXG5cdFx0XHQnanBlZyc6ICdpbWFnZS9qcGVnJyxcblx0XHRcdCdnaWYnOiAnaW1hZ2UvZ2lmJyxcblx0XHRcdCd3ZWJwJzogJ2ltYWdlL3dlYnAnLFxuXHRcdFx0J3N2Zyc6ICdpbWFnZS9zdmcreG1sJyxcblx0XHRcdCdibXAnOiAnaW1hZ2UvYm1wJ1xuXHRcdH07XG5cdFx0cmV0dXJuIG1pbWVUeXBlc1tleHRlbnNpb24udG9Mb3dlckNhc2UoKV0gfHwgJ2ltYWdlL3BuZyc7XG5cdH1cbn1cblxuLy8gPT09PT09PT09PSBcdThCQkVcdTdGNkVcdTk3NjJcdTY3N0YgPT09PT09PT09PVxuY2xhc3MgTURJbWFnZUVtYmVkU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuXHRwbHVnaW46IE1ESW1hZ2VFbWJlZFBsdWdpbjtcblxuXHRjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBNREltYWdlRW1iZWRQbHVnaW4pIHtcblx0XHRzdXBlcihhcHAsIHBsdWdpbik7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdH1cblxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcblxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ01EIEltYWdlIEVtYmVkIFNldHRpbmdzJyB9KTtcblxuXHRcdC8vIFx1OEJCRVx1N0Y2RSAxOiBcdTY2M0VcdTc5M0FcdThGNkNcdTYzNjJcdTY1RTVcdTVGRDdcblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKCdTaG93IGNvbnZlcnNpb24gbG9nJylcblx0XHRcdC5zZXREZXNjKCdEaXNwbGF5IHN1bW1hcnkgaW5mb3JtYXRpb24gaW4gbm90aWZpY2F0aW9ucycpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcblx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3Muc2hvd0NvbnZlcnNpb25Mb2cgPSB2YWx1ZTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHQvLyBcdTkxQ0RcdTY1QjBcdTZFMzJcdTY3RDNcdThCQkVcdTdGNkVcdTk3NjJcdTY3N0ZcdTRFRTVcdTY2RjRcdTY1QjBcdThCRTZcdTdFQzZcdTY1RTVcdTVGRDdcdTkwMDlcdTk4NzlcdTc2ODRcdTUzRUZcdTg5QzFcdTYwMjdcblx0XHRcdFx0XHR0aGlzLmRpc3BsYXkoKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0Ly8gXHU4QkJFXHU3RjZFIDEuNTogXHU2NjNFXHU3OTNBXHU4QkU2XHU3RUM2XHU2NUU1XHU1RkQ3XHVGRjA4XHU0RjlEXHU4RDU2XHU0RThFIHNob3dDb252ZXJzaW9uTG9nXHVGRjA5XG5cdFx0aWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dDb252ZXJzaW9uTG9nKSB7XG5cdFx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdFx0LnNldE5hbWUoJ1Nob3cgZGV0YWlsZWQgbG9nJylcblx0XHRcdFx0LnNldERlc2MoJ1Nob3cgaW5kaXZpZHVhbCBpbWFnZSBzdGF0dXMgaW4gbm90aWZpY2F0aW9ucyAocmVxdWlyZXMgXCJTaG93IGNvbnZlcnNpb24gbG9nXCIpJylcblx0XHRcdFx0LmFkZFRvZ2dsZSh0b2dnbGUgPT4gdG9nZ2xlXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnNob3dEZXRhaWxlZExvZylcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5zaG93RGV0YWlsZWRMb2cgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyBcdThCQkVcdTdGNkUgMjogXHU4RjZDXHU2MzYyIFdpa2kgXHU5NEZFXHU2M0E1XG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZSgnQ29udmVydCBXaWtpIGxpbmtzJylcblx0XHRcdC5zZXREZXNjKCdDb252ZXJ0IE9ic2lkaWFuIFdpa2kgbGlua3MgKCFbW2ltYWdlLnBuZ11dKSB0byBzdGFuZGFyZCBNYXJrZG93biB3aXRoIEJhc2U2NCcpXG5cdFx0XHQuYWRkVG9nZ2xlKHRvZ2dsZSA9PiB0b2dnbGVcblx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbnZlcnRXaWtpTGlua3MpXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb252ZXJ0V2lraUxpbmtzID0gdmFsdWU7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdC8vIFx1OEJCRVx1N0Y2RSAzOiBcdThERjNcdThGQzcgQmFzZTY0IFx1NTZGRVx1NzI0N1xuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoJ1NraXAgQmFzZTY0IGltYWdlcycpXG5cdFx0XHQuc2V0RGVzYygnU2tpcCBpbWFnZXMgdGhhdCBhcmUgYWxyZWFkeSBpbiBCYXNlNjQgZm9ybWF0Jylcblx0XHRcdC5hZGRUb2dnbGUodG9nZ2xlID0+IHRvZ2dsZVxuXHRcdFx0XHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2tpcEJhc2U2NEltYWdlcylcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnNraXBCYXNlNjRJbWFnZXMgPSB2YWx1ZTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBT0Esc0JBQTRFO0FBVTVFLElBQU0sbUJBQXlDO0FBQUEsRUFDOUMsbUJBQW1CO0FBQUEsRUFDbkIsaUJBQWlCO0FBQUEsRUFDakIsa0JBQWtCO0FBQUEsRUFDbEIsa0JBQWtCO0FBQ25CO0FBR0EsSUFBcUIscUJBQXJCLGNBQWdELHVCQUFPO0FBQUE7QUFBQSxFQUl0RCxNQUFNLFNBQVM7QUFDZCxVQUFNLEtBQUssYUFBYTtBQUd4QixTQUFLLGNBQWMsSUFBSSx1QkFBdUIsS0FBSyxLQUFLLElBQUksQ0FBQztBQUc3RCxTQUFLO0FBQUEsTUFDSixLQUFLLElBQUksVUFBVSxHQUFHLGFBQWEsQ0FBQyxNQUFNLFNBQVM7QUFDbEQsWUFBSSxnQkFBZ0IseUJBQVMsS0FBSyxjQUFjLE1BQU07QUFDckQsZUFBSyxpQkFBaUIsTUFBTSxJQUFJO0FBQUEsUUFDakM7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBRUEsWUFBUSxJQUFJLDhCQUE4QjtBQUFBLEVBQzNDO0FBQUEsRUFFQSxXQUFXO0FBQ1YsWUFBUSxJQUFJLGdDQUFnQztBQUFB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

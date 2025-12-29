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
  showConversionLog: false,
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
      item.setTitle("\u590D\u5236\u4E3A Base64 \u683C\u5F0F").setIcon("clipboard-copy").onClick(async () => {
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
        new import_obsidian.Notice("\u2705 \u5DF2\u590D\u5236\u4E3A Base64 \u683C\u5F0F");
      }
    } catch (error) {
      new import_obsidian.Notice("\u274C \u590D\u5236\u5931\u8D25: " + error.message);
      console.error("Copy failed:", error);
    }
  }
  // ========== 显示详细处理结果 ==========
  showDetailedResults(result) {
    const total = result.convertedCount + result.skippedCount;
    let message = "\u2705 \u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\n\n";
    message += `\u{1F4CA} \u7EDF\u8BA1: ${total} \u4E2A\u56FE\u7247
`;
    message += `   \u2022 \u5DF2\u8F6C\u6362: ${result.convertedCount}
`;
    message += `   \u2022 \u5DF2\u8DF3\u8FC7: ${result.skippedCount}`;
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
... \u8FD8\u6709 ${remaining} \u4E2A`;
      }
    }
    message += `

\u{1F4A1} \u63A7\u5236\u53F0 (Ctrl+Shift+I) \u67E5\u770B\u5B8C\u6574\u8BE6\u60C5`;
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
    containerEl.createEl("h2", { text: "MD Image Embed \u8BBE\u7F6E" });
    new import_obsidian.Setting(containerEl).setName("\u663E\u793A\u8F6C\u6362\u65E5\u5FD7").setDesc("\u5728\u901A\u77E5\u4E2D\u663E\u793A\u8F6C\u6362\u6458\u8981\u4FE1\u606F").addToggle((toggle) => toggle.setValue(this.plugin.settings.showConversionLog).onChange(async (value) => {
      this.plugin.settings.showConversionLog = value;
      await this.plugin.saveSettings();
      this.display();
    }));
    if (this.plugin.settings.showConversionLog) {
      new import_obsidian.Setting(containerEl).setName("\u663E\u793A\u8BE6\u7EC6\u65E5\u5FD7").setDesc('\u5728\u901A\u77E5\u4E2D\u663E\u793A\u6BCF\u4E2A\u56FE\u7247\u7684\u72B6\u6001\uFF08\u9700\u8981\u542F\u7528"\u663E\u793A\u8F6C\u6362\u65E5\u5FD7"\uFF09').addToggle((toggle) => toggle.setValue(this.plugin.settings.showDetailedLog).onChange(async (value) => {
        this.plugin.settings.showDetailedLog = value;
        await this.plugin.saveSettings();
      }));
    }
    new import_obsidian.Setting(containerEl).setName("\u8F6C\u6362 Wiki \u94FE\u63A5").setDesc("\u5C06 Obsidian Wiki \u94FE\u63A5 (![[image.png]]) \u8F6C\u6362\u4E3A\u6807\u51C6 Markdown Base64 \u683C\u5F0F").addToggle((toggle) => toggle.setValue(this.plugin.settings.convertWikiLinks).onChange(async (value) => {
      this.plugin.settings.convertWikiLinks = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("\u8DF3\u8FC7 Base64 \u56FE\u7247").setDesc("\u8DF3\u8FC7\u5DF2\u7ECF\u662F Base64 \u683C\u5F0F\u7684\u56FE\u7247").addToggle((toggle) => toggle.setValue(this.plugin.settings.skipBase64Images).onChange(async (value) => {
      this.plugin.settings.skipBase64Images = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "\u9632\u8F6C\u8F7D\u4FDD\u62A4" });
    new import_obsidian.Setting(containerEl).setName("\u524D\u7F00\u6587\u4EF6\u8DEF\u5F84").setDesc('\u6DFB\u52A0\u5230\u6587\u7AE0\u5F00\u5934\u7684 Markdown \u6587\u4EF6\u8DEF\u5F84\uFF08\u5982 "templates/prefix.md"\uFF09\uFF0C\u7559\u7A7A\u7981\u7528').addText((text) => text.setPlaceholder("templates/prefix.md").setValue(this.plugin.settings.prefixFilePath).onChange(async (value) => {
      this.plugin.settings.prefixFilePath = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("\u540E\u7F00\u6587\u4EF6\u8DEF\u5F84").setDesc('\u6DFB\u52A0\u5230\u6587\u7AE0\u7ED3\u5C3E\u7684 Markdown \u6587\u4EF6\u8DEF\u5F84\uFF08\u5982 "templates/suffix.md"\uFF09\uFF0C\u7559\u7A7A\u7981\u7528').addText((text) => text.setPlaceholder("templates/suffix.md").setValue(this.plugin.settings.suffixFilePath).onChange(async (value) => {
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

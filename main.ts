/**
 * MDImageEmbed - Obsidian Plugin
 * Convert local images in Markdown to Base64 embedded format
 *
 * @author mengzhishanghun
 * @license MIT
 */
import { Plugin, TFile, Notice, Menu, PluginSettingTab, App, Setting } from 'obsidian';

// ========== 设置接口 ==========
interface MDImageEmbedSettings {
	showConversionLog: boolean;        // 是否显示转换日志
	fileSuffix: string;                 // 另存为文件的后缀
	convertWikiLinks: boolean;          // 是否转换 Wiki 链接
	skipNetworkImages: boolean;         // 是否跳过网络图片
	skipBase64Images: boolean;          // 是否跳过已有 Base64
}

const DEFAULT_SETTINGS: MDImageEmbedSettings = {
	showConversionLog: true,
	fileSuffix: '_base64',
	convertWikiLinks: true,
	skipNetworkImages: true,
	skipBase64Images: true
}

// ========== 主插件类 ==========
export default class MDImageEmbedPlugin extends Plugin {
	settings: MDImageEmbedSettings;

	// ========== 插件生命周期 ==========
	async onload() {
		await this.loadSettings();

		// 注册设置面板
		this.addSettingTab(new MDImageEmbedSettingTab(this.app, this));

		// 注册文件菜单事件（右键菜单）
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.addFileMenuItems(menu, file);
				}
			})
		);

		console.log('MD Image Embed plugin loaded');
	}

	onunload() {
		console.log('MD Image Embed plugin unloaded');
	}

	// ========== 设置管理 ==========
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// ========== 右键菜单 ==========
	addFileMenuItems(menu: Menu, file: TFile) {
		// 菜单项 1: 复制为 Base64 格式到剪贴板
		menu.addItem((item) => {
			item
				.setTitle('Copy as Base64 format')
				.setIcon('clipboard-copy')
				.onClick(async () => {
					await this.copyAsBase64(file);
				});
		});

		// 菜单项 2: 另存为 Base64 格式
		menu.addItem((item) => {
			item
				.setTitle('Save as Base64 format')
				.setIcon('save')
				.onClick(async () => {
					await this.saveAsBase64(file);
				});
		});
	}

	// ========== 功能 1: 复制到剪贴板 ==========
	async copyAsBase64(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			const result = await this.convertMarkdownToBase64(content, file);

			// 复制到剪贴板
			await navigator.clipboard.writeText(result.content);

			if (this.settings.showConversionLog) {
				new Notice(`✅ Copied! ${result.convertedCount} images converted, ${result.skippedCount} skipped`);
			} else {
				new Notice('✅ Copied as Base64 format');
			}
		} catch (error) {
			new Notice('❌ Failed to copy: ' + error.message);
			console.error('Copy failed:', error);
		}
	}

	// ========== 功能 2: 另存为新文件 ==========
	async saveAsBase64(file: TFile) {
		try {
			const content = await this.app.vault.read(file);
			const result = await this.convertMarkdownToBase64(content, file);

			// 生成新文件名
			const baseName = file.basename;
			const newFileName = `${baseName}${this.settings.fileSuffix}.md`;
			const newFilePath = file.parent
				? `${file.parent.path}/${newFileName}`
				: newFileName;

			// 创建新文件
			await this.app.vault.create(newFilePath, result.content);

			if (this.settings.showConversionLog) {
				new Notice(`✅ Saved as ${newFileName}! ${result.convertedCount} images converted`);
			} else {
				new Notice(`✅ Saved as ${newFileName}`);
			}
		} catch (error) {
			new Notice('❌ Failed to save: ' + error.message);
			console.error('Save failed:', error);
		}
	}

	// ========== 核心转换逻辑 ==========
	async convertMarkdownToBase64(content: string, sourceFile: TFile): Promise<{content: string, convertedCount: number, skippedCount: number}> {
		// 匹配 Markdown 图片语法: ![alt](path) 或 ![alt](<path>)
		// 支持 Obsidian 的 ![[image.png]] 语法
		const imgRegex = /!\[([^\]]*)\]\(<?([^)">]+)>?\)|!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\]\]/gi;

		let result = content;
		let convertedCount = 0;
		let skippedCount = 0;

		const matches = [...content.matchAll(imgRegex)];

		for (const match of matches) {
			const fullMatch = match[0];

			// 处理标准 Markdown 语法: ![alt](path)
			if (match[1] !== undefined) {
				const altText = match[1];
				const imagePath = match[2];

				// 跳过已经是 base64 的图片
				if (this.settings.skipBase64Images && imagePath.startsWith('data:image')) {
					skippedCount++;
					continue;
				}

				// 跳过网络图片
				if (this.settings.skipNetworkImages && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))) {
					skippedCount++;
					continue;
				}

				// 转换本地图片
				const base64 = await this.imageToBase64(imagePath, sourceFile);
				if (base64) {
					result = result.replace(fullMatch, `![${altText}](${base64})`);
					convertedCount++;
				} else {
					skippedCount++;
				}
			}
			// 处理 Obsidian Wiki 语法: ![[image.png]]
			else if (match[3] !== undefined) {
				const imageName = match[3];

				// 如果不转换 Wiki 链接，跳过
				if (!this.settings.convertWikiLinks) {
					skippedCount++;
					continue;
				}

				// 转换为 base64
				const base64 = await this.imageToBase64(imageName, sourceFile);
				if (base64) {
					// 转换为标准 Markdown 语法
					result = result.replace(fullMatch, `![${imageName}](${base64})`);
					convertedCount++;
				} else {
					skippedCount++;
				}
			}
		}

		console.log(`转换完成: ${convertedCount} 个图片已转换, ${skippedCount} 个已跳过`);
		return { content: result, convertedCount, skippedCount };
	}

	// ========== 图片转 Base64 ==========
	async imageToBase64(imagePath: string, sourceFile: TFile): Promise<string | null> {
		try {
			// 解析图片路径
			const imageFile = this.resolveImagePath(imagePath, sourceFile);
			if (!imageFile) {
				console.warn(`找不到图片: ${imagePath}`);
				return null;
			}

			// 读取图片为 ArrayBuffer
			const arrayBuffer = await this.app.vault.readBinary(imageFile);

			// 转换为 Base64
			const base64 = this.arrayBufferToBase64(arrayBuffer);

			// 获取 MIME 类型
			const mimeType = this.getMimeType(imageFile.extension);

			return `data:${mimeType};base64,${base64}`;
		} catch (error) {
			console.error(`转换图片失败: ${imagePath}`, error);
			return null;
		}
	}

	// ========== 路径解析 ==========
	resolveImagePath(imagePath: string, sourceFile: TFile): TFile | null {
		// 移除 Obsidian 路径前缀
		const cleanPath = imagePath.replace(/^<|>$/g, '').trim();

		// 方法 1: 直接从 Vault 根目录查找
		let file = this.app.vault.getAbstractFileByPath(cleanPath);
		if (file instanceof TFile) {
			return file;
		}

		// 方法 2: 相对于当前文件查找
		if (sourceFile.parent) {
			const relativePath = `${sourceFile.parent.path}/${cleanPath}`;
			file = this.app.vault.getAbstractFileByPath(relativePath);
			if (file instanceof TFile) {
				return file;
			}
		}

		// 方法 3: 使用 Obsidian 的链接解析
		const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
		if (resolvedFile instanceof TFile) {
			return resolvedFile;
		}

		return null;
	}

	// ========== ArrayBuffer 转 Base64 ==========
	arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	// ========== 获取 MIME 类型 ==========
	getMimeType(extension: string): string {
		const mimeTypes: Record<string, string> = {
			'png': 'image/png',
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'gif': 'image/gif',
			'webp': 'image/webp',
			'svg': 'image/svg+xml',
			'bmp': 'image/bmp'
		};
		return mimeTypes[extension.toLowerCase()] || 'image/png';
	}
}

// ========== 设置面板 ==========
class MDImageEmbedSettingTab extends PluginSettingTab {
	plugin: MDImageEmbedPlugin;

	constructor(app: App, plugin: MDImageEmbedPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'MD Image Embed Settings' });

		// 设置 1: 显示转换日志
		new Setting(containerEl)
			.setName('Show conversion log')
			.setDesc('Display detailed information about converted and skipped images')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showConversionLog)
				.onChange(async (value) => {
					this.plugin.settings.showConversionLog = value;
					await this.plugin.saveSettings();
				}));

		// 设置 2: 文件后缀
		new Setting(containerEl)
			.setName('File suffix')
			.setDesc('Suffix for "Save as" files (e.g., "_base64" → filename_base64.md)')
			.addText(text => text
				.setPlaceholder('_base64')
				.setValue(this.plugin.settings.fileSuffix)
				.onChange(async (value) => {
					this.plugin.settings.fileSuffix = value || '_base64';
					await this.plugin.saveSettings();
				}));

		// 设置 3: 转换 Wiki 链接
		new Setting(containerEl)
			.setName('Convert Wiki links')
			.setDesc('Convert Obsidian Wiki links (![[image.png]]) to standard Markdown with Base64')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convertWikiLinks)
				.onChange(async (value) => {
					this.plugin.settings.convertWikiLinks = value;
					await this.plugin.saveSettings();
				}));

		// 设置 4: 跳过网络图片
		new Setting(containerEl)
			.setName('Skip network images')
			.setDesc('Skip images that start with http:// or https://')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.skipNetworkImages)
				.onChange(async (value) => {
					this.plugin.settings.skipNetworkImages = value;
					await this.plugin.saveSettings();
				}));

		// 设置 5: 跳过 Base64 图片
		new Setting(containerEl)
			.setName('Skip Base64 images')
			.setDesc('Skip images that are already in Base64 format')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.skipBase64Images)
				.onChange(async (value) => {
					this.plugin.settings.skipBase64Images = value;
					await this.plugin.saveSettings();
				}));
	}
}

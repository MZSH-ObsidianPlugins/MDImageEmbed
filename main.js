/*
MDImageEmbed - Obsidian Plugin
将 Markdown 图片转换为 Base64 内嵌格式
*/

const { Plugin, Notice, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
	showConversionLog: true,
	fileSuffix: '_base64',
	convertWikiLinks: true,
	skipNetworkImages: true,
	skipBase64Images: true
};

class MDImageEmbedPlugin extends Plugin {
	async onload() {
		await this.loadSettings();

		// 注册设置面板
		this.addSettingTab(new MDImageEmbedSettingTab(this.app, this));

		// 注册文件菜单事件（右键菜单）
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file.extension === 'md') {
					this.addFileMenuItems(menu, file);
				}
			})
		);

		console.log('MD Image Embed plugin loaded');
	}

	onunload() {
		console.log('MD Image Embed plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	addFileMenuItems(menu, file) {
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

	async copyAsBase64(file) {
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

	async saveAsBase64(file) {
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

	async convertMarkdownToBase64(content, sourceFile) {
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

	async imageToBase64(imagePath, sourceFile) {
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

	resolveImagePath(imagePath, sourceFile) {
		// 移除 Obsidian 路径前缀
		const cleanPath = imagePath.replace(/^<|>$/g, '').trim();

		// 方法 1: 直接从 Vault 根目录查找
		let file = this.app.vault.getAbstractFileByPath(cleanPath);
		if (file && file.extension) {
			return file;
		}

		// 方法 2: 相对于当前文件查找
		if (sourceFile.parent) {
			const relativePath = `${sourceFile.parent.path}/${cleanPath}`;
			file = this.app.vault.getAbstractFileByPath(relativePath);
			if (file && file.extension) {
				return file;
			}
		}

		// 方法 3: 使用 Obsidian 的链接解析
		const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
		if (resolvedFile && resolvedFile.extension) {
			return resolvedFile;
		}

		return null;
	}

	arrayBufferToBase64(buffer) {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	getMimeType(extension) {
		const mimeTypes = {
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

class MDImageEmbedSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
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

module.exports = MDImageEmbedPlugin;

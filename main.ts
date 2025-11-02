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
	showDetailedLog: boolean;           // 是否显示详细日志（每个图片的状态）
	convertWikiLinks: boolean;          // 是否转换 Wiki 链接
	skipBase64Images: boolean;          // 是否跳过已有 Base64
}

const DEFAULT_SETTINGS: MDImageEmbedSettings = {
	showConversionLog: true,
	showDetailedLog: false,
	convertWikiLinks: true,
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
		// 菜单项: 复制为 Base64 格式到剪贴板
		menu.addItem((item) => {
			item
				.setTitle('Copy as Base64 format')
				.setIcon('clipboard-copy')
				.onClick(async () => {
					await this.copyAsBase64(file);
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
				// 显示详细的处理结果
				this.showDetailedResults(result);
			} else {
				new Notice('✅ Copied as Base64 format');
			}
		} catch (error) {
			new Notice('❌ Failed to copy: ' + error.message);
			console.error('Copy failed:', error);
		}
	}

	// ========== 显示详细处理结果 ==========
	showDetailedResults(result: {content: string, convertedCount: number, skippedCount: number, details: Array<{path: string, status: string, reason?: string}>}) {
		const total = result.convertedCount + result.skippedCount;

		// 主通知
		let message = '✅ Copied to clipboard\n\n';

		message += `📊 Summary: ${total} images\n`;
		message += `   • Converted: ${result.convertedCount}\n`;
		message += `   • Skipped: ${result.skippedCount}`;

		// 如果启用了详细日志，显示每个图片的状态
		if (this.settings.showDetailedLog) {
			message += '\n\n';

			// 显示每个图片的详细状态
			const maxDisplay = 8; // 最多显示8个图片的详情
			const detailsToShow = result.details.slice(0, maxDisplay);

			for (const detail of detailsToShow) {
				const fileName = detail.path.split('/').pop() || detail.path;
				const shortName = fileName.length > 35 ? fileName.substring(0, 32) + '...' : fileName;

				if (detail.status === 'success') {
					message += `✓ ${shortName}\n`;
				} else if (detail.status === 'failed') {
					message += `✗ ${shortName}\n  → ${detail.reason}\n`;
				} else if (detail.status === 'skipped') {
					message += `⊘ ${shortName}\n  → ${detail.reason}\n`;
				}
			}

			// 如果还有更多图片未显示
			if (result.details.length > maxDisplay) {
				const remaining = result.details.length - maxDisplay;
				message += `\n... and ${remaining} more`;
			}
		}

		// 显示控制台提示
		message += `\n\n💡 Console (Ctrl+Shift+I) for full details`;

		// 显示时间更长的通知（8秒）
		new Notice(message, 8000);
	}

	// ========== 核心转换逻辑 ==========
	async convertMarkdownToBase64(content: string, sourceFile: TFile): Promise<{content: string, convertedCount: number, skippedCount: number, details: Array<{path: string, status: string, reason?: string}>}> {
		// 匹配 Markdown 图片语法: ![alt](path) 或 ![alt](<path>)
		// 支持 Obsidian 的 ![[image.png]] 语法
		const imgRegex = /!\[([^\]]*)\]\(<?([^)">]+)>?\)|!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp|svg|bmp))\]\]/gi;

		let result = content;
		let convertedCount = 0;
		let skippedCount = 0;
		const details: Array<{path: string, status: string, reason?: string}> = [];

		const matches = [...content.matchAll(imgRegex)];

		if (this.settings.showConversionLog) {
			console.log(`[MDImageEmbed] 开始处理文档，共找到 ${matches.length} 个图片`);
		}

		for (const match of matches) {
			const fullMatch = match[0];

			// 处理标准 Markdown 语法: ![alt](path)
			if (match[1] !== undefined) {
				const altText = match[1];
				const imagePath = match[2];

				// 跳过已经是 base64 的图片
				if (this.settings.skipBase64Images && imagePath.startsWith('data:image')) {
					skippedCount++;
					const displayPath = imagePath.substring(0, 30) + '...';
					details.push({path: displayPath, status: 'skipped', reason: 'Already Base64'});
					if (this.settings.showConversionLog) {
						console.log(`[跳过] ${displayPath} - 原因: 已是 Base64 格式`);
					}
					continue;
				}

				// 跳过网络图片（不支持）
				if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
					skippedCount++;
					details.push({path: imagePath, status: 'skipped', reason: 'Network image (not supported)'});
					if (this.settings.showConversionLog) {
						console.log(`[跳过] ${imagePath} - 原因: 网络图片不支持转换`);
					}
					continue;
				}

				// 转换本地图片
				const base64 = await this.imageToBase64(imagePath, sourceFile);
				if (base64) {
					result = result.replace(fullMatch, `![${altText}](${base64})`);
					convertedCount++;
					details.push({path: imagePath, status: 'success'});
					if (this.settings.showConversionLog) {
						console.log(`[成功] ${imagePath} - 已转换为 Base64`);
					}
				} else {
					skippedCount++;
					details.push({path: imagePath, status: 'failed', reason: 'File not found'});
					if (this.settings.showConversionLog) {
						console.log(`[失败] ${imagePath} - 原因: 文件未找到或读取失败`);
					}
				}
			}
			// 处理 Obsidian Wiki 语法: ![[image.png]]
			else if (match[3] !== undefined) {
				const imageName = match[3];
				const displayPath = `![[${imageName}]]`;

				// 如果不转换 Wiki 链接，跳过
				if (!this.settings.convertWikiLinks) {
					skippedCount++;
					details.push({path: displayPath, status: 'skipped', reason: 'Wiki link conversion disabled'});
					if (this.settings.showConversionLog) {
						console.log(`[跳过] ${displayPath} - 原因: Wiki 链接转换已禁用`);
					}
					continue;
				}

				// 转换为 base64
				const base64 = await this.imageToBase64(imageName, sourceFile);
				if (base64) {
					// 转换为标准 Markdown 语法
					result = result.replace(fullMatch, `![${imageName}](${base64})`);
					convertedCount++;
					details.push({path: displayPath, status: 'success'});
					if (this.settings.showConversionLog) {
						console.log(`[成功] ${displayPath} - 已转换为 Base64`);
					}
				} else {
					skippedCount++;
					details.push({path: displayPath, status: 'failed', reason: 'File not found'});
					if (this.settings.showConversionLog) {
						console.log(`[失败] ${displayPath} - 原因: 文件未找到或读取失败`);
					}
				}
			}
		}

		if (this.settings.showConversionLog) {
			console.log(`[MDImageEmbed] 处理完成: ${convertedCount} 个成功, ${skippedCount} 个跳过`);
		}
		return { content: result, convertedCount, skippedCount, details };
	}

	// ========== 图片转 Base64 ==========
	async imageToBase64(imagePath: string, sourceFile: TFile): Promise<string | null> {
		try {
			// 解析图片路径
			const imageFile = this.resolveImagePath(imagePath, sourceFile);
			if (!imageFile) {
				if (this.settings.showConversionLog) {
					console.warn(`  └─ 路径解析失败: 在以下位置都未找到文件`);
					console.warn(`     - Vault 根目录: ${imagePath}`);
					if (sourceFile.parent) {
						console.warn(`     - 相对路径: ${sourceFile.parent.path}/${imagePath}`);
					}
				}
				return null;
			}

			if (this.settings.showConversionLog) {
				console.log(`  └─ 文件已找到: ${imageFile.path}`);
			}

			// 读取图片为 ArrayBuffer
			const arrayBuffer = await this.app.vault.readBinary(imageFile);

			// 转换为 Base64
			const base64 = this.arrayBufferToBase64(arrayBuffer);

			// 获取 MIME 类型
			const mimeType = this.getMimeType(imageFile.extension);

			if (this.settings.showConversionLog) {
				const sizeKB = (arrayBuffer.byteLength / 1024).toFixed(2);
				console.log(`  └─ 文件大小: ${sizeKB} KB, MIME: ${mimeType}`);
			}

			return `data:${mimeType};base64,${base64}`;
		} catch (error) {
			if (this.settings.showConversionLog) {
				console.error(`  └─ 读取或转换失败: ${error.message}`);
			}
			return null;
		}
	}

	// ========== 路径解析 ==========
	resolveImagePath(imagePath: string, sourceFile: TFile): TFile | null {
		// 移除 Obsidian 路径前缀
		let cleanPath = imagePath.replace(/^<|>$/g, '').trim();

		// URL 解码（处理 %20 等编码字符）
		try {
			const decoded = decodeURIComponent(cleanPath);
			if (decoded !== cleanPath) {
				if (this.settings.showConversionLog) {
					console.log(`  └─ URL 解码: "${cleanPath}" → "${decoded}"`);
				}
			}
			cleanPath = decoded;
		} catch (e) {
			// 如果解码失败，使用原路径
			if (this.settings.showConversionLog) {
				console.warn(`  └─ URL 解码失败，使用原路径: ${cleanPath}`);
			}
		}

		// 方法 1: 直接从 Vault 根目录查找
		let file = this.app.vault.getAbstractFileByPath(cleanPath);
		if (file instanceof TFile) {
			if (this.settings.showConversionLog) {
				console.log(`  └─ 解析方法: Vault 根目录`);
			}
			return file;
		}

		// 方法 2: 相对于当前文件查找
		if (sourceFile.parent) {
			const relativePath = `${sourceFile.parent.path}/${cleanPath}`;
			file = this.app.vault.getAbstractFileByPath(relativePath);
			if (file instanceof TFile) {
				if (this.settings.showConversionLog) {
					console.log(`  └─ 解析方法: 相对路径 (${sourceFile.parent.path}/)`);
				}
				return file;
			}
		}

		// 方法 3: 使用 Obsidian 的链接解析
		const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(cleanPath, sourceFile.path);
		if (resolvedFile instanceof TFile) {
			if (this.settings.showConversionLog) {
				console.log(`  └─ 解析方法: Obsidian 链接解析`);
			}
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
			.setDesc('Display summary information in notifications')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showConversionLog)
				.onChange(async (value) => {
					this.plugin.settings.showConversionLog = value;
					await this.plugin.saveSettings();
					// 重新渲染设置面板以更新详细日志选项的可见性
					this.display();
				}));

		// 设置 1.5: 显示详细日志（依赖于 showConversionLog）
		if (this.plugin.settings.showConversionLog) {
			new Setting(containerEl)
				.setName('Show detailed log')
				.setDesc('Show individual image status in notifications (requires "Show conversion log")')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showDetailedLog)
					.onChange(async (value) => {
						this.plugin.settings.showDetailedLog = value;
						await this.plugin.saveSettings();
					}));
		}

		// 设置 2: 转换 Wiki 链接
		new Setting(containerEl)
			.setName('Convert Wiki links')
			.setDesc('Convert Obsidian Wiki links (![[image.png]]) to standard Markdown with Base64')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.convertWikiLinks)
				.onChange(async (value) => {
					this.plugin.settings.convertWikiLinks = value;
					await this.plugin.saveSettings();
				}));

		// 设置 3: 跳过 Base64 图片
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

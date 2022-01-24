import CoreSearchAssistantPlugin from 'main';
import {
	App,
	EditorPosition,
	MarkdownView,
	Modal,
	SearchResultItem,
	WorkspaceLeaf,
	Match,
	EditorRange,
} from 'obsidian';
import { INTERVAL_MILLISECOND_TO_BE_DETACHED } from 'components/WorkspacePreview';
import { highlightMatches } from 'PreProcessor';

type ScrollDirection = 'up' | 'down';

const SCROLL_AMOUNT = 70;

export class PreviewModal extends Modal {
	item: SearchResultItem;
	plugin: CoreSearchAssistantPlugin;
	leaf: WorkspaceLeaf;
	matchEls: HTMLSpanElement[];
	currentFocus: number;

	constructor(
		app: App,
		plugin: CoreSearchAssistantPlugin,
		item: SearchResultItem
	) {
		super(app);
		this.plugin = plugin;
		this.item = item;
		this.leaf = new (WorkspaceLeaf as any)(app) as WorkspaceLeaf;
		this.matchEls = [];
		this.currentFocus = -1;
	}

	override onOpen() {
		// this.renderPreview();
		this.renderEdit();
		// this.renderPreviewWithHighLight();
		this.plugin.controller?.togglePreviewModalShown(true);

		// too fast to find elements
		// it should be called after rendering
		setTimeout(() => this.findMatches(), 100);

		// to prevent the modal immediately close
		// await new Promise((resolve) => setTimeout(resolve, 1));

		this.scope.register(['Ctrl'], ' ', () => {
			this.shouldRestoreSelection = true;
			this.close();
		});

		this.scope.register(['Ctrl'], 'Enter', () => {
			// this.plugin.controller?.open();
			this.openAndFocus(this.currentFocus);
			this.plugin.controller?.exit();
			this.shouldRestoreSelection = false;
			this.close();
		});

		this.scope.register(['Ctrl', 'Shift'], 'Enter', () => {
			this.plugin.controller?.open(this.plugin.settings?.splitDirection);
			this.plugin.controller?.exit();
			this.shouldRestoreSelection = false;
			this.close();
		});

		this.scope.register([], ' ', () => {
			this.scroll('down');
		});
		this.scope.register(['Shift'], ' ', () => {
			this.scroll('up');
		});
		this.scope.register([], 'ArrowDown', () => {
			this.scroll('down', SCROLL_AMOUNT);
		});
		this.scope.register(['Ctrl'], 'n', () => {
			this.scroll('down', SCROLL_AMOUNT);
		});
		this.scope.register([], 'ArrowUp', () => {
			this.scroll('up', SCROLL_AMOUNT);
		});
		this.scope.register(['Ctrl'], 'p', () => {
			this.scroll('up', SCROLL_AMOUNT);
		});
		this.scope.register([], 'Tab', (evt) => {
			evt.preventDefault(); // to prevent inserting indent in editing mode in the active leaf
			this.currentFocus =
				++this.currentFocus > this.matchEls.length - 1
					? 0
					: this.currentFocus;
			this.focusOn(this.currentFocus);
		});
		this.scope.register(['Shift'], 'Tab', (evt) => {
			evt.preventDefault();
			this.currentFocus =
				--this.currentFocus < 0
					? this.matchEls.length - 1
					: this.currentFocus;
			this.focusOn(this.currentFocus);
		});
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.detachLater(INTERVAL_MILLISECOND_TO_BE_DETACHED);

		// too fast to remain search mode
		setTimeout(() => {
			this.plugin.controller?.togglePreviewModalShown(false);
		}, 100);
	}

	private detachLater(millisecond: number) {
		if (!this.leaf) {
			return;
		}
		const leafToBeDetached = this.leaf;
		setTimeout(() => {
			leafToBeDetached.detach();
		}, millisecond);
	}

	private scroll(direction: ScrollDirection, px?: number) {
		const { containerEl, contentEl } = this;
		const move =
			(px ?? containerEl.clientHeight / 2) *
			(direction === 'up' ? -1 : 1);
		contentEl.scrollBy({
			top: move,
			behavior: 'smooth',
		});
	}

	private renderPreview() {
		const { contentEl, containerEl } = this;
		contentEl.empty();
		containerEl.addClass('core-search-assistant_preview-modal-container');

		this.leaf.openFile(this.item.file, { state: { mode: 'preview' } });
		contentEl.appendChild(this.leaf.containerEl);
	}

	private async renderEdit() {
		const { contentEl, containerEl, leaf, item } = this;
		contentEl.empty();
		containerEl.addClass('core-search-assistant_preview-modal-container');

		await leaf.openFile(this.item.file, { state: { mode: 'source' } });
		contentEl.appendChild(this.leaf.view.editMode.editorEl);
		this.leaf.view.editMode.editorEl.addClass('markdown-editor-view');

		item.result.content?.forEach((match) => {
			const range = translateMatch(item.content, match);

			(leaf.view.editMode.editor as any).addHighlights(
				[range],
				'highlight-search-match'
			);
		});
		console.log(leaf);
	}

	private async renderPreviewWithHighLight() {
		const { contentEl, containerEl, item } = this;
		contentEl.empty();
		containerEl.addClass('core-search-assistant_preview-modal-container');

		const previewView = new MarkdownView(this.leaf).previewMode;
		previewView.view.file = item.file; // necessary to remove error message

		const content = highlightMatches(
			item.content,
			item.result.content ?? [],
			{ cls: 'highlight-match' }
		);
		previewView.set(content, false); // load content

		contentEl.appendChild(previewView.containerEl);
		previewView.renderer.previewEl.addClass('preview-container');
	}

	async openAndFocus(matchId: number) {
		const { item } = this;
		const match = item?.result?.content?.[matchId];
		if (!match) {
			console.log('error match');
			return;
		}
		const range = translateMatch(item.content, match);

		const direction = this.plugin.settings?.splitDirection;

		const leaf =
			direction === undefined
				? this.app.workspace.getMostRecentLeaf()
				: this.app.workspace.splitActiveLeaf(direction);
		await leaf.openFile(item.file, {
			state: {
				mode: 'source',
			},
		});
		this.app.workspace.setActiveLeaf(leaf, true, true);
		// leaf.view.modes.source.highlightSearchMatch(range.from, range.to);
		leaf.view.editMode.editor.addHighlights(
			[range],
			'obsidian-search-match-highlight'
		);
	}

	private findMatches() {
		const { contentEl } = this;
		const matches = contentEl.querySelectorAll('span.highlight-match');
		matches.forEach((node) => {
			if (node instanceof HTMLSpanElement) {
				this.matchEls.push(node);
			}
		});
	}

	private focusOn(matchId: number) {
		[-1, 0, 1].forEach((i) => {
			const el = this.matchEls[matchId + i];
			if (el instanceof HTMLSpanElement) {
				if (i === 0) {
					el.addClass('focus-match');
					el.scrollIntoView({
						behavior: 'smooth',
						block: 'center',
					});
				} else {
					el.removeClass('focus-match');
				}
			}
		});
	}
}

function translatePtr(content: string, ptr: number): EditorPosition {
	const segments = content.slice(0, ptr).split('\n');
	const line = segments.length - 1;
	const ch = segments[line]?.length;
	if (ch === undefined) {
		throw `translatePtr failed: content=${content}, ptr=${ptr}`;
	}
	return { line, ch };
}

function translateMatch(content: string, match: Match): EditorRange {
	return {
		from: translatePtr(content, match[0]),
		to: translatePtr(content, match[1]),
	};
}

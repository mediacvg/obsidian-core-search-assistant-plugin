import {
	App,
	EditorRange,
	MarkdownView,
	MarkdownViewModeType,
	Match,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';
import { delay, scrollIteration } from 'utils/Util';

export class MarkdownViewRenderer {
	app: App;
	file: TFile;
	leaf: WorkspaceLeaf;
	containerEl: HTMLElement;

	constructor(app: App, containerEl: HTMLElement, file: TFile) {
		this.app = app;
		this.containerEl = containerEl;
		this.leaf = new (WorkspaceLeaf as any)(this.app);
		this.file = file;
		this.containerEl.appendChild(this.leaf.containerEl);
	}

	async load(mode?: MarkdownViewModeType): Promise<MarkdownViewRenderer> {
		await this.onload(mode);
		return this;
	}

	async unload() {
		this.onunload();
	}

	async togglePreview() {
		await this.setViewMode('preview');
	}

	async toggleSource() {
		await this.setViewMode('source');
	}

	async toggleViewMode() {
		const view = this.leaf.view as MarkdownView;
		if (view.getMode() === 'preview') {
			await this.toggleSource();
		} else {
			await this.togglePreview();
		}
	}

	private async onload(mode?: MarkdownViewModeType) {
		await this.openFile(this.oppositeMode(mode ?? 'preview'));
		await delay(1);
		await this.toggleViewMode();
	}

	private onunload() {
		this.leaf.containerEl.remove();
		this.leaf.detach();
	}

	private async openFile(mode: MarkdownViewModeType) {
		const { leaf, file } = this;
		await leaf.openFile(file, { state: { mode: mode } });
	}

	private async setViewMode(mode: MarkdownViewModeType) {
		const { leaf } = this;
		const state = leaf.getViewState();
		state.state.mode = mode;
		await leaf.setViewState(state);
	}

	// it should be called once because is is not idempotent
	// it can be called even when view mode = 'preview'
	highlightMatches(matches: Match[]) {
		const view = this.leaf.view as MarkdownView;
		// if (view.getMode() !== 'source') {
		// 	return;
		// }
		const editor = view.modes.source.editor;
		const ranges: EditorRange[] = [];
		matches.forEach((match) => {
			const range = {
				from: editor.offsetToPos(match[0]),
				to: editor.offsetToPos(match[1]),
			};
			ranges.push(range);
		});
		editor.addHighlights(ranges, 'highlight-search-match');
	}

	async scrollIntoView(match: Match, center?: boolean) {
		const view = this.leaf.view as MarkdownView;
		if (view.getMode() !== 'source') {
			return;
		}
		const editor = view.modes.source.editor;
		const range = {
			from: editor.offsetToPos(match[0]),
			to: editor.offsetToPos(match[1]),
		};

		// if content of a file is too large, we need to call scrollIntoView many times
		const iter = scrollIteration(editor);
		if (iter === undefined) {
			return;
		}
		for (let i = 0; i < iter; i++) {
			editor.scrollIntoView(range, center);
			await delay(1);
		}
	}

	async focusOn(match: Match, center?: boolean) {
		const view = this.leaf.view as MarkdownView;
		if (view.getMode() !== 'source') {
			return;
		}

		await this.scrollIntoView(match, center);

		const { editor } = view.modes.source;

		editor.removeHighlights('focus-search-match');
		const range = {
			from: editor.offsetToPos(match[0]),
			to: editor.offsetToPos(match[1]),
		};
		editor.addHighlights([range], 'focus-search-match');
	}

	private oppositeMode(mode: MarkdownViewModeType): MarkdownViewModeType {
		return mode === 'preview' ? 'source' : 'preview';
	}
}

// this.leaf = new (WorkspaceLeaf as any)(this.app) as WorkspaceLeaf;
// await this.leaf.openFile(item.file, { state: { mode: 'preview' } });
// this.containerEl.empty();
// this.containerEl.appendChild(this.leaf.containerEl);
// if (this.plugin.settings?.hideIframe) {
// 	this.containerEl.addClass('hide-iframe');
// }
// this.containerEl.show();
// console.log(this.leaf);
// console.log(this.leaf.getViewState());
// console.log(this.leaf.view.getState());

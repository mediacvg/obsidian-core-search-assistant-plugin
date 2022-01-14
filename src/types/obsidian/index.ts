import { sortOrderTypesInSearch } from 'types/Guards';

export * from 'obsidian';

declare module 'obsidian' {
	interface WorkspaceLeaf {
		containerEl: HTMLElement;
	}

	interface WorkspaceSidedock {
		children: WorkspaceSidedockTabParent[];
	}

	interface WorkspaceSidedockTabParent {
		children: WorkspaceLeaf[];
		type: 'tabs';
	}

	interface SearchView extends View {
		matchingCase: boolean;
		explainSearch: boolean;

		setCollapseAll(collapseAll: boolean): void;

		setExplainSearch(explainSearch: boolean): void;

		setExtraContext(extraContext: boolean): void;

		setMatchingCase(matchingCase: boolean): void;

		setSortOrder(sortOrder: SortOrderTypeInSearch): void;

		dom: SearchDom;

		searchComponent: SearchComponent;
	}

	type SortOrderTypeInSearch = typeof sortOrderTypesInSearch[number];
	// | 'alphabetical'
	// | 'alphabeticalReverse'
	// | 'byModifiedTime'
	// | 'byModifiedTimeReverse'
	// | 'byCreatedTime'
	// | 'byCreatedTimeReverse';

	interface SearchDom {
		extraContext: boolean;
		collapseAll: boolean;
		sortOrder: string;
		children: SearchResultItem[];
	}

	interface SearchResultItem {
		file: TFile;
		containerEl: HTMLElement;
	}
}

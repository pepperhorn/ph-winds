// Stub for Task 15, which replaces this with real PNG/PDF export
// (html-to-image + jsPDF, per spec Part 5). Kept here so Task 14 can wire
// the AppBar's export buttons without a forward dependency.

export const exportBoardImage = async (_el: HTMLElement, _kind: 'png' | 'pdf', _name: string): Promise<void> => {};

export const downloadText = (_text: string, _filename: string, _mime: string): void => {};

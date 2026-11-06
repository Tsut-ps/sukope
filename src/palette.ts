import { buildColormap, type ColormapName } from './colormap';

/** 現在選ばれている配色(256 段階の RGB 表) */
export const palette = { cmap: buildColormap('inferno') };

export function setPalette(name: ColormapName): void {
  palette.cmap = buildColormap(name);
}

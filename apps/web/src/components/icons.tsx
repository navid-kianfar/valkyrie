/* eslint-disable react-refresh/only-export-components -- icons are generated from a glyph map. */
/**
 * Icon components backed by the self-hosted Bootstrap Icons font (the set the
 * design concept uses). Names mirror the previous outline-icon imports so call
 * sites stay unchanged; `size-*` utilities are translated to a font-size, since
 * a font glyph is sized by type rather than by box dimensions.
 */
const GLYPHS = {
  Activity: 'activity',
  AlertTriangle: 'exclamation-triangle',
  ArrowLeft: 'arrow-left',
  ArrowRight: 'arrow-right',
  Bell: 'bell',
  BookOpen: 'book',
  Check: 'check-lg',
  ChevronDown: 'chevron-down',
  ChevronRight: 'chevron-right',
  ChevronUp: 'chevron-up',
  CircleAlert: 'exclamation-circle',
  Clock: 'clock',
  Copy: 'clipboard',
  Download: 'download',
  Eye: 'eye',
  EyeOff: 'eye-slash',
  Folder: 'folder',
  Globe: 'globe',
  Grid2X2: 'grid',
  HardDrive: 'hdd',
  History: 'clock-history',
  Info: 'info-circle',
  Key: 'key',
  Languages: 'translate',
  Layers: 'stack',
  LayoutDashboard: 'grid-1x2',
  List: 'list-ul',
  LightningFill: 'lightning-charge-fill',
  Loader2: 'arrow-repeat',
  Lock: 'lock',
  LogOut: 'box-arrow-right',
  Menu: 'list',
  Monitor: 'display',
  Moon: 'moon-stars',
  MoreHorizontal: 'three-dots',
  Pencil: 'pencil',
  Play: 'play-fill',
  Plus: 'plus-lg',
  RotateCcw: 'arrow-clockwise',
  ScanSearch: 'radar',
  Search: 'search',
  Server: 'hdd-stack',
  Settings: 'sliders',
  ShieldCheck: 'shield-check',
  ShieldOff: 'shield-slash',
  SlidersHorizontal: 'sliders',
  Sun: 'sun',
  SunMoon: 'circle-half',
  Terminal: 'terminal',
  Trash2: 'trash3',
  TriangleAlert: 'exclamation-triangle',
  Upload: 'upload',
  X: 'x-lg',
  Zap: 'lightning-charge',
} as const;

export type IconName = keyof typeof GLYPHS;

/** Tailwind spacing scale → px, for the handful of sizes used on icons. */
const SPACING: Record<string, number> = {
  '0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10, '3': 12, '3.5': 14,
  '4': 16, '4.5': 18, '5': 20, '6': 24, '7': 28, '8': 32, '9': 36, '10': 40, '12': 48,
};

function fontSizeFor(className: string | undefined): number | undefined {
  if (!className) return undefined;
  const arbitrary = /(?:^|\s)size-\[(\d+(?:\.\d+)?)px\]/.exec(className);
  if (arbitrary) return Number(arbitrary[1]);
  const scale = /(?:^|\s)size-(\d+(?:\.\d+)?)/.exec(className);
  if (scale && SPACING[scale[1]] !== undefined) return SPACING[scale[1]];
  return undefined;
}

export interface IconProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Accepted for API compatibility with the previous icon set; ignored. */
  strokeWidth?: number | string;
}

function createIcon(name: IconName) {
  const glyph = GLYPHS[name];
  const Icon = ({ className, strokeWidth: _strokeWidth, style, ...rest }: IconProps) => {
    const fontSize = fontSizeFor(className);
    return (
      <i
        {...rest}
        aria-hidden="true"
        className={`bi bi-${glyph}${className ? ` ${className}` : ''}`}
        style={fontSize ? { fontSize, ...style } : style}
      />
    );
  };
  Icon.displayName = name;
  return Icon;
}

export const Activity = /* @__PURE__ */ createIcon('Activity');
export const AlertTriangle = /* @__PURE__ */ createIcon('AlertTriangle');
export const ArrowLeft = /* @__PURE__ */ createIcon('ArrowLeft');
export const ArrowRight = /* @__PURE__ */ createIcon('ArrowRight');
export const Bell = /* @__PURE__ */ createIcon('Bell');
export const BookOpen = /* @__PURE__ */ createIcon('BookOpen');
export const Check = /* @__PURE__ */ createIcon('Check');
export const ChevronDown = /* @__PURE__ */ createIcon('ChevronDown');
export const ChevronRight = /* @__PURE__ */ createIcon('ChevronRight');
export const ChevronUp = /* @__PURE__ */ createIcon('ChevronUp');
export const CircleAlert = /* @__PURE__ */ createIcon('CircleAlert');
export const Clock = /* @__PURE__ */ createIcon('Clock');
export const Copy = /* @__PURE__ */ createIcon('Copy');
export const Download = /* @__PURE__ */ createIcon('Download');
export const Eye = /* @__PURE__ */ createIcon('Eye');
export const EyeOff = /* @__PURE__ */ createIcon('EyeOff');
export const Folder = /* @__PURE__ */ createIcon('Folder');
export const Globe = /* @__PURE__ */ createIcon('Globe');
export const Grid2X2 = /* @__PURE__ */ createIcon('Grid2X2');
export const HardDrive = /* @__PURE__ */ createIcon('HardDrive');
export const History = /* @__PURE__ */ createIcon('History');
export const Info = /* @__PURE__ */ createIcon('Info');
export const Key = /* @__PURE__ */ createIcon('Key');
export const Languages = /* @__PURE__ */ createIcon('Languages');
export const Layers = /* @__PURE__ */ createIcon('Layers');
export const LayoutDashboard = /* @__PURE__ */ createIcon('LayoutDashboard');
export const List = /* @__PURE__ */ createIcon('List');
export const LightningFill = /* @__PURE__ */ createIcon('LightningFill');
export const Loader2 = /* @__PURE__ */ createIcon('Loader2');
export const Lock = /* @__PURE__ */ createIcon('Lock');
export const LogOut = /* @__PURE__ */ createIcon('LogOut');
export const Menu = /* @__PURE__ */ createIcon('Menu');
export const Monitor = /* @__PURE__ */ createIcon('Monitor');
export const Moon = /* @__PURE__ */ createIcon('Moon');
export const MoreHorizontal = /* @__PURE__ */ createIcon('MoreHorizontal');
export const Pencil = /* @__PURE__ */ createIcon('Pencil');
export const Play = /* @__PURE__ */ createIcon('Play');
export const Plus = /* @__PURE__ */ createIcon('Plus');
export const RotateCcw = /* @__PURE__ */ createIcon('RotateCcw');
export const ScanSearch = /* @__PURE__ */ createIcon('ScanSearch');
export const Search = /* @__PURE__ */ createIcon('Search');
export const Server = /* @__PURE__ */ createIcon('Server');
export const Settings = /* @__PURE__ */ createIcon('Settings');
export const ShieldCheck = /* @__PURE__ */ createIcon('ShieldCheck');
export const ShieldOff = /* @__PURE__ */ createIcon('ShieldOff');
export const SlidersHorizontal = /* @__PURE__ */ createIcon('SlidersHorizontal');
export const Sun = /* @__PURE__ */ createIcon('Sun');
export const SunMoon = /* @__PURE__ */ createIcon('SunMoon');
export const Terminal = /* @__PURE__ */ createIcon('Terminal');
export const Trash2 = /* @__PURE__ */ createIcon('Trash2');
export const TriangleAlert = /* @__PURE__ */ createIcon('TriangleAlert');
export const Upload = /* @__PURE__ */ createIcon('Upload');
export const X = /* @__PURE__ */ createIcon('X');
export const Zap = /* @__PURE__ */ createIcon('Zap');

/* Aliases kept so existing imports keep working. */
export const MenuIcon = Menu;
export const SettingsIcon = Settings;

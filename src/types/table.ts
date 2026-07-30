export type Alignment = 'left' | 'center' | 'right';

export type VerticalAlignment = 'top' | 'middle' | 'bottom';

export type GradientDirection = 'horizontal' | 'vertical';

export interface GradientFill {
  colors: string[];
  direction: GradientDirection;
}

export interface Cell {
  id: string;
  content: string;
  align: Alignment;
  verticalAlign: VerticalAlignment;
  isHeader: boolean;
  rowSpan?: number;
  colSpan?: number;
  bold?: boolean;
  italic?: boolean;
  backgroundColor?: string;
  backgroundGradient?: GradientFill;
}

export interface Row {
  id: string;

  cells: (Cell | null)[]; 
  height?: string;
}

export interface TableModel {
  rows: Row[];
  columnWidths: (number | 'auto')[];
  caption?: string;
  borderRadius?: number;
}

export type TableAction = 
  | { type: 'UPDATE_CELL'; cellId: string; updates: Partial<Cell> }
  | { type: 'ADD_ROW'; index?: number }
  | { type: 'ADD_COL'; index?: number }
  | { type: 'DELETE_ROW'; rowId: string }
  | { type: 'DELETE_COL'; colIndex: number }
  | { type: 'SET_TABLE'; model: TableModel };

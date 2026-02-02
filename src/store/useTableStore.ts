import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TableModel, Cell, Row } from '../types/table';


const generateId = () => crypto.randomUUID();

export interface Range {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface TableState {
  table: TableModel;
  selectedCellId: string | null;
  selectionRange: Range | null;
  

  updateCell: (cellId: string, updates: Partial<Cell>) => void;
  updateSelection: (updates: Partial<Cell>) => void;
  setSelectionRange: (range: Range | null) => void;
  setColumnWidth: (index: number, width: number) => void;
  setRowHeight: (index: number, height: string) => void;
  

  insertRow: (direction: 'above' | 'below') => void;
  insertCol: (direction: 'left' | 'right') => void;

  deleteSelectedCols: () => void;
  deleteSelectedRows: () => void;
  

  mergeCells: () => void;
  splitCellEnhanced: (count: number, direction: 'horizontal' | 'vertical') => void;
  distributeCols: () => void;
  distributeRows: () => void;
  
  setTable: (model: TableModel) => void;
  setSelectedCell: (cellId: string | null) => void;
  setCaption: (caption: string) => void;
  setBorderRadius: (radius: number) => void;
  

  history: {
    past: TableModel[];
    future: TableModel[];
  };
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;
}

const createEmptyCell = (isHeader = false): Cell => ({
    id: generateId(),
    content: '',
    align: 'center',
    verticalAlign: 'middle',
    isHeader,
});

const createEmptyRow = (colCount: number, isHeader = false): Row => ({
    id: generateId(),
    cells: Array.from({ length: colCount }, () => createEmptyCell(isHeader)),
    height: '40px',
});


const initialTable: TableModel = {
    rows: Array.from({ length: 3 }, () => createEmptyRow(3)),
    columnWidths: Array(3).fill(200),
    borderRadius: 0,
};

export const useTableStore = create<TableState>()(persist((set) => ({
  table: initialTable,
  selectedCellId: null,
  selectionRange: null,


  history: {
      past: [],
      future: []
  },

  undo: () => set((state) => {
      const { past, future } = state.history;
      if (past.length === 0) return state;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      
      return {
          table: previous,
          history: {
              past: newPast,
              future: [state.table, ...future]
          }
      };
  }),

  redo: () => set((state) => {
      const { past, future } = state.history;
      if (future.length === 0) return state;

      const next = future[0];
      const newFuture = future.slice(1);

      return {
          table: next,
          history: {
              past: [...past, state.table],
              future: newFuture
          }
      };
  }),
  





  setSelectionRange: (range) => set({ selectionRange: range }),

  updateCell: (cellId, updates) => set((state) => {

    const newHistory = {
        past: [...state.history.past, state.table],
        future: []
    };

    const newRows = state.table.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => 
        (cell && cell.id === cellId) ? { ...cell, ...updates } : cell
      )
    }));
    return { 
        table: { ...state.table, rows: newRows },
        history: newHistory
    };
  }),

  updateSelection: (updates: Partial<Cell>) => set((state) => {

      const newHistory = {
          past: [...state.history.past, state.table],
          future: []
      };

      const range = state.selectionRange;
      if (!range && state.selectedCellId) {

          return { 
              table: {
                  ...state.table,
                  rows: state.table.rows.map(row => ({
                      ...row,
                      cells: row.cells.map(cell => 
                          (cell && cell.id === state.selectedCellId) ? { ...cell, ...updates } : cell
                      )
                  }))
              },
              history: newHistory
          };
      }
      if (!range) return state;

      const { startRow, startCol, endRow, endCol } = range;
      const rMin = Math.min(startRow, endRow);
      const rMax = Math.max(startRow, endRow);
      const cMin = Math.min(startCol, endCol);
      const cMax = Math.max(startCol, endCol);

      const newRows = state.table.rows.map((row, rIdx) => {
          if (rIdx < rMin || rIdx > rMax) return row;
          return {
              ...row,
              cells: row.cells.map((cell, cIdx) => {
                  if (cIdx >= cMin && cIdx <= cMax && cell) {
                      return { ...cell, ...updates };
                  }
                  return cell;
              })
          };
      });

      return { 
          table: { ...state.table, rows: newRows },
          history: newHistory 
      };
  }),

  insertRow: (direction) => set((state) => {
    let targetIndex = -1;
    let referenceRowIndex = -1;
    const range = state.selectionRange;
    

    if (range) {
        if (direction === 'above') {
            targetIndex = Math.min(range.startRow, range.endRow);
            referenceRowIndex = targetIndex;
        } else {
            targetIndex = Math.max(range.startRow, range.endRow) + 1;
            referenceRowIndex = Math.max(range.startRow, range.endRow);
        }
    } else if (state.selectedCellId) {

        const rIdx = state.table.rows.findIndex(r => r.cells.some(c => c?.id === state.selectedCellId));
        if (rIdx !== -1) {
            targetIndex = direction === 'above' ? rIdx : rIdx + 1;
            referenceRowIndex = rIdx;
        }
    }
    

    if (targetIndex === -1) {
        targetIndex = state.table.rows.length;
        referenceRowIndex = state.table.rows.length - 1;
    }

    const newHistory = {
        past: [...state.history.past, state.table],
        future: []
    };


    const newRows = JSON.parse(JSON.stringify(state.table.rows));
    const colCount = state.table.columnWidths.length || (newRows[0]?.cells.length || 1);




    for (let r = 0; r < targetIndex; r++) {
        if (r >= newRows.length) break;
        const row = newRows[r];
        for (let c = 0; c < row.cells.length; c++) {
            const cell = row.cells[c];
            if (cell) {
                const rSpan = cell.rowSpan || 1;


                if (r + rSpan > targetIndex) {
                    cell.rowSpan = rSpan + 1;
                }
            }
        }
    }



    const newRowCells: (Cell | null)[] = [];
    const referenceRow = referenceRowIndex >= 0 && referenceRowIndex < newRows.length ? newRows[referenceRowIndex] : null;

    let activeColSpan = 0;

    for (let c = 0; c < colCount; c++) {
         if (activeColSpan > 0) {
             newRowCells.push(null);
             activeColSpan--;
             continue;
         }


         let isVerticallyCovered = false;
         for (let r = 0; r < targetIndex; r++) {
             const cell = newRows[r].cells[c];
             if (cell) {
                 const rSpan = cell.rowSpan || 1;
                 if (r + rSpan > targetIndex) {
                     isVerticallyCovered = true;
                     break;
                 }
             }
         }
         
         if (isVerticallyCovered) {
             newRowCells.push(null);

             for (let r = 0; r < targetIndex; r++) {
                 const cell = newRows[r].cells[c];
                 if (cell && (cell.rowSpan || 1) + r > targetIndex) {
                     if ((cell.colSpan || 1) > 1) {
                         activeColSpan = (cell.colSpan || 1) - 1;
                     }
                     break;
                 }
             }
         } else {

             const newCell = createEmptyCell(false);
             const refCell = referenceRow?.cells[c];
             

             if (refCell) {
                 newCell.colSpan = refCell.colSpan;
                 newCell.backgroundColor = refCell.backgroundColor;
                 
                 if ((refCell.colSpan || 1) > 1) {
                     activeColSpan = (refCell.colSpan || 1) - 1;
                 }
             }
             
             newRowCells.push(newCell);
         }
    }

    const newRow = {
        id: generateId(),
        cells: newRowCells,
        height: 'auto'
    };


    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex > newRows.length) targetIndex = newRows.length;

    newRows.splice(targetIndex, 0, newRow);
    
    return { 
        table: { ...state.table, rows: newRows },
        history: newHistory
    };
  }),

  insertCol: (direction) => set((state) => {
    let targetIndex = -1;
    let referenceColIndex = -1;
    const range = state.selectionRange;


    if (range) {
        if (direction === 'left') {
            targetIndex = Math.min(range.startCol, range.endCol);
            referenceColIndex = targetIndex;
        } else {
            targetIndex = Math.max(range.startCol, range.endCol) + 1;
            referenceColIndex = Math.max(range.startCol, range.endCol);
        }
    } else if (state.selectedCellId) {
        outer: for (const row of state.table.rows) {
            for (let c = 0; c < row.cells.length; c++) {
                if (row.cells[c]?.id === state.selectedCellId) {
                    targetIndex = direction === 'left' ? c : c + 1;
                    referenceColIndex = c;
                    break outer;
                }
            }
        }
    }

    if (targetIndex === -1) {
        targetIndex = state.table.columnWidths.length;
        referenceColIndex = targetIndex - 1;
    }

    const newHistory = {
        past: [...state.history.past, state.table],
        future: []
    };

    let newColumnActiveRowSpan = 0;

    const newRows = state.table.rows.map(row => {

        const newCells = [...row.cells];
        


        let insertionCovered = false;



        for (let c = 0; c < targetIndex; c++) {
            const cell = newCells[c];
            if (cell) {
                const cSpan = cell.colSpan || 1;
                if (c + cSpan > targetIndex) {

                    insertionCovered = true;

                    newCells[c] = { ...cell, colSpan: cSpan + 1 };
                    break;
                }
            }
        }


        if (insertionCovered) {



             if (newColumnActiveRowSpan > 0) {
                 newColumnActiveRowSpan--;
             }
             newCells.splice(targetIndex, 0, null);
        } else {

             if (newColumnActiveRowSpan > 0) {

                 newCells.splice(targetIndex, 0, null);
                 newColumnActiveRowSpan--;
             } else {


                 const refCell = row.cells[referenceColIndex];
                 const isRowHeader = row.cells.some(c => c && c.isHeader);
                 const newCell = createEmptyCell(isRowHeader);
                 
                 if (refCell) {
                     newCell.backgroundColor = refCell.backgroundColor;

                     const refRowSpan = refCell.rowSpan || 1;
                     if (refRowSpan > 1) {
                         newCell.rowSpan = refRowSpan;
                         newColumnActiveRowSpan = refRowSpan - 1;
                     }
                 }
                 
                 newCells.splice(targetIndex, 0, newCell);
             }
        }

        return { ...row, cells: newCells };
    });
    

    const newWidths = [...state.table.columnWidths];
    let widthInsertAt = targetIndex;
    if (widthInsertAt < 0) widthInsertAt = 0;
    if (widthInsertAt > newWidths.length) widthInsertAt = newWidths.length;
    

    const refWidth = newWidths[referenceColIndex] || 150;
    newWidths.splice(widthInsertAt, 0, typeof refWidth === 'number' ? refWidth : 150);

    return { 
        table: { ...state.table, rows: newRows, columnWidths: newWidths },
        history: newHistory
    };
  }),



  deleteSelectedCols: () => set((state) => {
      let colsToDelete: number[] = [];
      const range = state.selectionRange;
      
      if (range) {
          const start = Math.min(range.startCol, range.endCol);
          const end = Math.max(range.startCol, range.endCol);
          for (let i = start; i <= end; i++) colsToDelete.push(i);
      } else if (state.selectedCellId) {
          outer: for (const row of state.table.rows) {
              for (let c = 0; c < row.cells.length; c++) {
                  if (row.cells[c]?.id === state.selectedCellId) {
                      colsToDelete.push(c);
                      break outer;
                  }
              }
          }
      }

      if (colsToDelete.length === 0) return state;

      if (state.table.columnWidths.length <= colsToDelete.length) {
          return state;
      }

      const newHistory = {
          past: [...state.history.past, state.table],
          future: []
      };


      const rows = JSON.parse(JSON.stringify(state.table.rows));
      


      for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          for (let c = 0; c < row.cells.length; c++) {
              const cell = row.cells[c];
              if (cell && (cell.colSpan || 1) > 1) {
                   const oldSpan = cell.colSpan;
                   const coveredIndices = [];
                   for (let k = 0; k < oldSpan; k++) coveredIndices.push(c + k);

                   const survivingIndices = coveredIndices.filter(idx => !colsToDelete.includes(idx));

                   if (survivingIndices.length === 0) {

                   } else {
                       const newSpan = survivingIndices.length;
                       const firstSurvivor = survivingIndices[0];
                       
                       if (firstSurvivor === c) {

                           if (newSpan !== oldSpan) {
                               cell.colSpan = newSpan;
                           }
                       } else {

                           row.cells[firstSurvivor] = {
                               ...cell,
                               colSpan: newSpan
                           };
                       }
                   }
              }
          }
      }

      const newWidths = state.table.columnWidths.filter((_: any, idx: number) => !colsToDelete.includes(idx));
      
      const newRows = rows.map((row: Row) => {
          const newCells = row.cells.filter((_: any, idx: number) => !colsToDelete.includes(idx));
          return { ...row, cells: newCells };
      });

      return { 
          table: { ...state.table, rows: newRows, columnWidths: newWidths },
          selectionRange: null, 
          selectedCellId: null,
          history: newHistory
      };
  }),

  deleteSelectedRows: () => set((state) => {
      let rowsToDelete: number[] = [];
      const range = state.selectionRange;
      
      if (range) {
          const start = Math.min(range.startRow, range.endRow);
          const end = Math.max(range.startRow, range.endRow);
          for (let i = start; i <= end; i++) rowsToDelete.push(i);
      } else if (state.selectedCellId) {

          const rIdx = state.table.rows.findIndex(r => r.cells.some(c => c?.id === state.selectedCellId));
          if (rIdx !== -1) rowsToDelete.push(rIdx);
      }

      if (rowsToDelete.length === 0) return state;
      

      if (state.table.rows.length <= rowsToDelete.length) {
           return state;
      }

      const newHistory = {
          past: [...state.history.past, state.table],
          future: []
      };


      const rows = JSON.parse(JSON.stringify(state.table.rows));
      


      const colCount = state.table.columnWidths.length;
      
      for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < colCount; c++) {
              const cell = rows[r].cells[c];
              if (cell && (cell.rowSpan || 1) > 1) {
                  const oldSpan = cell.rowSpan;
                  const coveredIndices = [];
                  for (let k = 0; k < oldSpan; k++) coveredIndices.push(r + k);
                  
                  const survivingIndices = coveredIndices.filter(idx => !rowsToDelete.includes(idx));
                  
                  if (survivingIndices.length === 0) {



                  } else {
                      const newSpan = survivingIndices.length;
                      const firstSurvivor = survivingIndices[0];
                      
                      if (firstSurvivor === r) {


                          if (newSpan !== oldSpan) {
                              cell.rowSpan = newSpan;
                          }
                      } else {



                          rows[firstSurvivor].cells[c] = {
                              ...cell,
                              rowSpan: newSpan
                          };


                      }
                      







                  }
              }
          }
      }


      const newRows = rows.filter((_: any, idx: number) => !rowsToDelete.includes(idx));
      
      return { 
          table: { ...state.table, rows: newRows },
          selectedCellId: null,
          selectionRange: null,
          history: newHistory
      };
  }),

  mergeCells: () => set((state) => {
      const range = state.selectionRange;
      if (!range) return state;

      
      const startRow = Math.min(range.startRow, range.endRow);
      const endRow = Math.max(range.startRow, range.endRow);
      const startCol = Math.min(range.startCol, range.endCol);
      const endCol = Math.max(range.startCol, range.endCol);
      
      const rowSpan = endRow - startRow + 1;
      const colSpan = endCol - startCol + 1;
      if (rowSpan === 1 && colSpan === 1) return state;

      const newHistory = {
          past: [...state.history.past, state.table],
          future: []
      };

      const newRows = [...state.table.rows];
      const originCell = newRows[startRow].cells[startCol];
      
      if (!originCell) return state; 


      newRows[startRow] = {
          ...newRows[startRow],
          cells: [...newRows[startRow].cells]
      };
      

      
      const contents: string[] = [];
      for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
              const cell = state.table.rows[r].cells[c];
              if (cell && cell.content && cell.content.trim()) {
                  contents.push(cell.content);
              }
          }
      }

      newRows[startRow].cells[startCol] = {
          ...originCell,
          content: contents.join(' '),
          rowSpan,
          colSpan
      };


      for (let r = startRow; r <= endRow; r++) {
           if (newRows[r] === state.table.rows[r]) {
               newRows[r] = { ...newRows[r], cells: [...newRows[r].cells] };
           }
           
           for (let c = startCol; c <= endCol; c++) {
               if (r === startRow && c === startCol) continue;
               newRows[r].cells[c] = null;
           }
      }

      return { 
          table: { ...state.table, rows: newRows },
          selectionRange: null, 
          selectedCellId: originCell.id,
          history: newHistory
      };
  }),

  splitCellEnhanced: (count, direction) => set((state) => {

      const targets: {r: number, c: number}[] = [];
      const range = state.selectionRange;
      
      
      if (range) {
          for (let r = range.startRow; r <= range.endRow; r++) {
              for (let c = range.startCol; c <= range.endCol; c++) {
                   targets.push({r, c});
              }
          }
      } else if (state.selectedCellId) {

           for (let r = 0; r < state.table.rows.length; r++) {
              const row = state.table.rows[r];
              for (let c = 0; c < row.cells.length; c++) {
                  if (row.cells[c]?.id === state.selectedCellId) {
                      targets.push({r, c});
                      break;
                  }
              }
              if (targets.length > 0) break;
           }
      }
      
      if (targets.length === 0 || count < 2) return state;

      const newHistory = {
          past: [...state.history.past, state.table],
          future: []
      };


      const tableClone = JSON.parse(JSON.stringify(state.table));
      const newRows = tableClone.rows as Row[];
      let newWidths = tableClone.columnWidths;






      if (direction === 'horizontal') {










          

          const uniqueCols = Array.from(new Set(targets.map(t => t.c))).sort((a,b) => b - a);
          
          for (const targetC of uniqueCols) {

               const added = count - 1;
               

               const originalWidth = typeof newWidths[targetC] === 'number' ? newWidths[targetC] as number : 150;
               const newColWidth = Math.floor(originalWidth / count);
               newWidths[targetC] = newColWidth;
               for (let k = 0; k < added; k++) {
                   newWidths.splice(targetC + 1, 0, newColWidth);
               }


               for (let r = 0; r < newRows.length; r++) {
                   const row = newRows[r];
                   


                   const isTarget = targets.some(t => t.r === r && t.c === targetC);
                   
                   if (isTarget) {

                       const targetCell = row.cells[targetC];



                       



                       if (targetCell) {
                           for (let k = 0; k < added; k++) {
                               const splitPart = createEmptyCell(targetCell.isHeader);
                               splitPart.backgroundColor = targetCell.backgroundColor;
                               if (targetCell.rowSpan && targetCell.rowSpan > 1) {
                                   splitPart.rowSpan = targetCell.rowSpan;
                               }

                               splitPart.id = generateId() + '_' + k; 
                               row.cells.splice(targetC + 1, 0, splitPart);
                           }
                           if ((targetCell.colSpan || 1) > 1) {
                               row.cells[targetC] = { ...targetCell, colSpan: 1 };
                           }
                       } else {




                           for (let k = 0; k < added; k++) {
                               row.cells.splice(targetC + 1, 0, null);
                           }
                       }
                       
                   } else {

                       const cellAtPos = row.cells[targetC];
                       if (cellAtPos) {
                           const currentSpan = cellAtPos.colSpan || 1;
                           row.cells[targetC] = { 
                               ...cellAtPos, 
                               colSpan: currentSpan + added 
                           };
                           for (let k = 0; k < added; k++) {
                               row.cells.splice(targetC + 1, 0, null);
                           }
                       } else {

                            let ownerIdx = -1;
                            for (let k = targetC - 1; k >= 0; k--) {
                                if (row.cells[k]) {
                                    const c = row.cells[k]!;
                                    const span = c.colSpan || 1;
                                    if (k + span > targetC) {
                                        ownerIdx = k;
                                    }
                                    break;
                                }
                            }
                            if (ownerIdx !== -1) {
                                const owner = row.cells[ownerIdx]!;
                                row.cells[ownerIdx] = { ...owner, colSpan: (owner.colSpan || 1) + added };
                                for (let k = 0; k < added; k++) {
                                    row.cells.splice(targetC + 1, 0, null);
                                }
                            } else {

                                for (let k = 0; k < added; k++) {
                                    row.cells.splice(targetC + 1, 0, null);
                                }
                            }
                       }
                   }
               }
          }

      } else {
          

          
          const cellsToProcess: { r: number, c: number, cell: Cell }[] = [];
          const processedIds = new Set<string>();

          for (const t of targets) {
             const cell = newRows[t.r].cells[t.c];

             
             if (cell && !processedIds.has(cell.id)) {
                 cellsToProcess.push({ r: t.r, c: t.c, cell });
                 processedIds.add(cell.id);
             }
          }

          
          
          const canOptimize = cellsToProcess.length > 0 && cellsToProcess.every(item => {
              const span = item.cell.rowSpan || 1;
              return span >= count && span % count === 0;
          });

          if (canOptimize) {
               
               for (const item of cellsToProcess) {
                   const { r, c, cell } = item;
                   const originalSpan = cell.rowSpan || 1;
                   const newSpan = originalSpan / count;
                   
                   
                   newRows[r].cells[c] = { ...cell, rowSpan: newSpan };
                   
                   
                   for (let k = 1; k < count; k++) {
                       const targetRowIdx = r + (newSpan * k);
                       
                       const newCell = createEmptyCell(cell.isHeader);
                       newCell.backgroundColor = cell.backgroundColor;
                       newCell.colSpan = cell.colSpan;
                       if (newSpan > 1) newCell.rowSpan = newSpan;
                       
                       
                       newRows[targetRowIdx].cells[c] = newCell;
                   }
               }
          } else {
              
              const uniqueRows = Array.from(new Set(targets.map(t => t.r))).sort((a,b) => b - a);
              const colCount = newWidths.length;

              for (const targetR of uniqueRows) {
                  const added = count - 1;
                  
                  
                  const originalHeightStr = newRows[targetR].height;
                  let originalHeight: number;
                  if (typeof originalHeightStr === 'number') {
                      originalHeight = originalHeightStr;
                  } else if (typeof originalHeightStr === 'string' && originalHeightStr !== 'auto') {
                      originalHeight = parseInt(originalHeightStr) || 40;
                  } else {
                      originalHeight = 40;
                  }
                  
                  
                  const newRowHeight = Math.max(10, Math.floor(originalHeight / count));
                  
                  
                  newRows[targetR].height = `${newRowHeight}px`;
                  
                  const templateRows: Row[] = [];
                  for (let k = 0; k < added; k++) {
                      templateRows.push({
                          id: generateId(),
                          cells: Array.from({ length: colCount }).map(() => null),
                          height: `${newRowHeight}px`
                      });
                  }


                  for (let c = 0; c < colCount; c++) {
                       const isTarget = targets.some(t => t.r === targetR && t.c === c);
                       const targetCell = newRows[targetR].cells[c];

                       if (isTarget) {
                           if (targetCell) {
                                const originalSpan = targetCell.rowSpan || 1;
                                for (let k = 0; k < added; k++) {
                                    const newC = createEmptyCell(false);
                                    if (targetCell.backgroundColor) newC.backgroundColor = targetCell.backgroundColor;
                                    if (targetCell.colSpan && targetCell.colSpan > 1) newC.colSpan = targetCell.colSpan;
                                    
                                    if (k === added - 1 && originalSpan > 1) {
                                      newC.rowSpan = originalSpan;
                                    }

                                    templateRows[k].cells[c] = newC;
                                }
                               
                               newRows[targetR].cells[c] = {
                                   ...targetCell,
                                   rowSpan: 1
                               };
                           }
                       } else {
                           if (targetCell) {
                               newRows[targetR].cells[c] = {
                                   ...targetCell,
                                   rowSpan: (targetCell.rowSpan || 1) + added
                               };
                           }
                       }
                  }
                  
                  for (let r = 0; r < targetR; r++) { 
                       const row = newRows[r];
                       for (let c = 0; c < colCount; c++) {
                           const cell = row.cells[c];
                           if (cell) {
                               const rSpan = cell.rowSpan || 1;
                               if (r + rSpan - 1 >= targetR) {
                                   newRows[r].cells[c] = {
                                       ...cell,
                                       rowSpan: rSpan + added
                                   };
                               }
                           }
                       }
                  }

                  newRows.splice(targetR + 1, 0, ...templateRows);
              }
          }

      }
      
      return { 
          table: { ...tableClone, rows: newRows, columnWidths: newWidths },
          history: newHistory
      };
  }),

  distributeCols: () => set((state) => {
      const newHistory = {
          past: [...state.history.past, state.table],
          future: []
      };

      const cols = state.table.columnWidths.length;
      const pct = Math.floor(100 / cols);
      const newWidths = Array(cols).fill(`${pct}%`); 
      return { 
          table: { ...state.table, columnWidths: newWidths },
          history: newHistory
      };
  }),

  distributeRows: () => set((state) => {
      const newHistory = {
          past: [...state.history.past, state.table],
          future: []
      };

      const range = state.selectionRange;
      const newRows = [...state.table.rows];
      
      let targetIndices: number[] = [];

      if (range) {
          for (let r = range.startRow; r <= range.endRow; r++) {
              targetIndices.push(r);
          }
      } else {
          targetIndices = newRows.map((_, i) => i);
      }

      if (targetIndices.length === 0) return state;

      const firstHeight = newRows[targetIndices[0]].height;
      const newHeight = (firstHeight === '3rem') ? 'auto' : '3rem';

      targetIndices.forEach(idx => {
          if (newRows[idx]) {
             newRows[idx] = { ...newRows[idx], height: newHeight };
          }
      });

      return { 
          table: { ...state.table, rows: newRows },
          history: newHistory
      }; 
  }),

  setTable: (model) => set((state) => ({ 
      table: model,
      history: {
          past: [...state.history.past, state.table],
          future: []
      }
  })),
  
  setSelectedCell: (cellId) => set({ selectedCellId: cellId }),

  setCaption: (caption) => set((state) => ({ 
      table: { ...state.table, caption },

      history: {
          past: [...state.history.past, state.table],
          future: []
      }
  })),
  
  setColumnWidth: (index, width) => set((state) => {









      




      const newWidths = [...state.table.columnWidths];
      if (index >= 0 && index < newWidths.length) {
          newWidths[index] = width;
      }
      return { table: { ...state.table, columnWidths: newWidths } };
  }),

  setRowHeight: (index, height) => set((state) => {

      const newRows = [...state.table.rows];
      if (index >= 0 && index < newRows.length) {
          newRows[index] = { ...newRows[index], height };
      }
      return { table: { ...state.table, rows: newRows } };
  }),
  

  saveHistory: () => set((state) => ({
      history: {
          past: [...state.history.past, state.table],
          future: []
      }
  })),
  
  setBorderRadius: (radius) => set((state) => ({
      table: { ...state.table, borderRadius: radius }
  })),
}), {
    name: 'tabular-storage',
    partialize: (state) => ({ table: state.table, history: state.history }),
}));

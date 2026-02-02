import React, { useState, useRef, useEffect } from 'react';
import { useTableStore } from "@/store/useTableStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Trash2, PaintBucket, RotateCcw, RotateCw, ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, AlignStartVertical, AlignCenterVertical, AlignEndVertical } from "lucide-react";
import { SplitCellDialog } from "@/components/split-cells-dialog";
import katex from 'katex';
import 'katex/dist/katex.min.css';


const MIN_COL_WIDTH = 40;
const MIN_ROW_HEIGHT = 30;

const PALETTE_COLORS = [
    '#FFFFFF', '#000000', '#EEECE1', '#1F497D', '#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646',
    '#F2F2F2', '#7F7F7F', '#DDD9C3', '#C6D9F0', '#DBE5F1', '#F2DCDB', '#EBF1DD', '#E5E0EC', '#DBEEF3', '#FDE9D9',
    '#D8D8D8', '#595959', '#C4BD97', '#8DB3E2', '#B8CCE4', '#E5B9B7', '#D7E3BC', '#CCC1D9', '#B7DDE8', '#FBD5B5',
    '#BFBFBF', '#3F3F3F', '#938953', '#548DD4', '#95B3D7', '#D99694', '#C3D69B', '#B2A6C6', '#92CDDC', '#FAC08F',
    '#A5A5A5', '#262626', '#494429', '#17365D', '#366092', '#953734', '#76923C', '#5F497A', '#31859B', '#E36C09',
    '#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#800000', '#008000', '#000080', '#808000'
];

interface EditableCellProps {
    initialContent: string;
    className: string;
    onSave: (content: string) => void;
    onBlur: () => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ initialContent, className, onSave, onBlur }) => {
    const ref = useRef<HTMLDivElement>(null);
    const contentRef = useRef(initialContent);

    useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = initialContent;
            
            
            const focusAndMoveCursor = () => {
                if (ref.current) {
                    ref.current.focus();
                    try {
                        const range = document.createRange();
                        range.selectNodeContents(ref.current);
                        range.collapse(false); 
                        const sel = window.getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                    } catch (e) {
                         console.warn("Failed to set cursor position", e);
                    }
                }
            };

            
            focusAndMoveCursor();
            
            
            requestAnimationFrame(focusAndMoveCursor);
            setTimeout(focusAndMoveCursor, 10);
        }
    }, []); 

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        contentRef.current = e.currentTarget.innerHTML;
    };

    const handleBlur = () => {
        if (contentRef.current !== initialContent) {
            onSave(contentRef.current);
        }
        onBlur();
    };

    return (
        <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            className={`${className} outline-none cursor-text min-h-[1.5em]`}
            onInput={handleInput}
            onBlur={handleBlur}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()} 
            onPaste={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
            }}
        />
    );
};

import { parseClipboardHtml } from "@/lib/clipboard-parser";

export function InteractiveTable() {
  const { 
    table, updateCell, updateSelection, insertRow, insertCol, deleteSelectedRows, deleteSelectedCols,
    selectedCellId, setSelectedCell,
    selectionRange, setSelectionRange,
    mergeCells, splitCellEnhanced,
    setColumnWidth, setRowHeight,
    setTable, setBorderRadius,
    undo, redo, history, saveHistory
  } = useTableStore();
  
  const blobToBase64 = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }

        if (
            ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
            ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
        ) {
            e.preventDefault();
            redo();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
              setIsColorPickerOpen(false);
          }
      };
      
      if (isColorPickerOpen) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [isColorPickerOpen]);

  const handleColorSelect = (color: string | undefined) => {
      updateSelection({ backgroundColor: color });
      setIsColorPickerOpen(false);
  };
  
  const handlePaste = React.useCallback(async (e: React.ClipboardEvent) => {
    console.log('[Table] Paste event triggered');
    const html = e.clipboardData.getData('text/html');
    let files = e.clipboardData.files; 
    
    if (files.length === 0 && e.clipboardData.items) {
        const itemFiles: File[] = [];
        for (let i = 0; i < e.clipboardData.items.length; i++) {
            const item = e.clipboardData.items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                 const f = item.getAsFile();
                 if (f) itemFiles.push(f);
            }
        }
        if (itemFiles.length > 0) {
            console.log('[Table] Found files in items workaround:', itemFiles.length);
        }
    }

    const hasFiles = files.length > 0 || (e.clipboardData.items && Array.from(e.clipboardData.items).some(i => i.kind === 'file' && i.type.startsWith('image/')));

    if (selectedCellId && hasFiles) {
        let file = files.length > 0 ? files[0] : null;
        if (!file && e.clipboardData.items) {
             for (let i=0; i<e.clipboardData.items.length; i++) {
                 if (e.clipboardData.items[i].kind === 'file' && e.clipboardData.items[i].type.startsWith('image/')) {
                     file = e.clipboardData.items[i].getAsFile();
                     break;
                 }
             }
        }

        if (file && file.type.startsWith('image/')) {
            e.preventDefault();
            console.log('[Table] Pasting image into cell:', selectedCellId);
            try {
                const base64 = await blobToBase64(file);
                const cell = table.rows.flatMap(r => r.cells).find(c => c?.id === selectedCellId);
                if (cell) {
                    const imgTag = `<br><img src="${base64}" style="max-width:100%; height:auto;">`;
                    updateCell(selectedCellId, { content: cell.content + imgTag });
                }
            } catch (err) {
                console.error("[Table] Failed to paste image:", err);
            }
            return;
        }
    }
    
    if (files.length === 0 && html) {
        
        const plainText = e.clipboardData.getData('text/plain');
        if (plainText && /^(?:\/|[a-zA-Z]:\\|file:).+\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(plainText.trim())) {
            alert("Aviso de Segurança do Navegador:\n\nNão é possível colar imagens diretamente pelo caminho do arquivo.\n\nPor favor, use:\n1. Arrastar e Soltar (Drag & Drop) o arquivo aqui.\n2. O botão de upload de imagem.\n3. Copie a imagem em si (botão direito -> Copiar Imagem), não o arquivo.");
            return;
        }
    }

    if (html) {
        e.preventDefault();
        try {
            const parsed = await parseClipboardHtml(html, e.clipboardData.files);
            if (parsed) {
                setTable(parsed);
            }
        } catch (err) {
            console.error("Paste error:", err);
        }
    }
  }, [setTable, selectedCellId, table.rows, updateCell]);

  
  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleGlobalDrop = async (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('[Table] Drop event detected');
        const files = e.dataTransfer?.files;
        
        if (files && files.length > 0) {
            const file = files[0];
            console.log('[Table] Dropped file:', file.name, file.type, file.size);
            
            if (file.type.startsWith('image/')) {
                
                let targetId = selectedCellId;
                console.log('[Table] Current selectedCellId:', selectedCellId);
                
                
                if (!targetId) {
                    
                    const firstRow = table.rows[0];
                    if (firstRow) {
                        const firstCell = firstRow.cells.find(c => c !== null);
                        if (firstCell) {
                            targetId = firstCell.id;
                            console.log('[Table] Defaulting to first cell:', targetId);
                        }
                    }
                }

                if (targetId) {
                     try {
                        const base64 = await blobToBase64(file);
                        console.log('[Table] Converted to base64, length:', base64.length);
                        
                        const outputContent = `<br><img src="${base64}" style="max-width:100%; height:auto;">`;
                        
                        const cell = table.rows.flatMap(r => r.cells).find(c => c?.id === targetId);
                        if (cell) {
                            console.log('[Table] Updating cell', targetId);
                            updateCell(targetId, { content: cell.content + outputContent });
                        } else {
                            console.warn('[Table] Target cell not found in store:', targetId);
                        }
                    } catch (err) {
                        console.error("[Table] Drop failed:", err);
                    }
                } else {
                    console.warn('[Table] No valid target cell could be determined');
                }
            } else {
                console.log('[Table] Dropped file is not an image');
            }
        } else {
            console.log('[Table] No files in drop event');
        }
    };
    
    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('drop', handleGlobalDrop);
    
    return () => {
        document.removeEventListener('dragover', handleGlobalDragOver);
        document.removeEventListener('drop', handleGlobalDrop);
    };
  }, [selectedCellId, table, updateCell]); 

  const [resizingCol, setResizingCol] = useState<{ index: number, startX: number, startWidth: number } | null>(null);
  const [resizingRow, setResizingRow] = useState<{ index: number, startY: number, startHeight: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const editingContentRef = useRef<string>("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetCellId, setUploadTargetCellId] = useState<string | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
        const target = event.target as Node;
        
        if (tableRef.current?.contains(target) || toolbarRef.current?.contains(target)) {
            return;
        }
        
        if (selectedCellId || selectionRange) {
            setSelectedCell(null);
            setSelectionRange(null);
            
        }
    };
    
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [selectedCellId, selectionRange, setSelectedCell, setSelectionRange, setEditingCell]);
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log('[Table] detailed upload started');
      const file = e.target.files?.[0];
      if (file && uploadTargetCellId) {
          try {
             console.log('[Table] Uploading file:', file.name, 'to cell:', uploadTargetCellId);
             const base64 = await blobToBase64(file);
             
             const cell = table.rows.flatMap(r => r.cells).find(c => c?.id === uploadTargetCellId);
             if (cell) {
                 const newContent = cell.content.replace(
                     /<button class="image-placeholder-btn".*?<\/button>/, 
                     `<img src="${base64}" style="max-width:100%; height:auto;">`
                 );
                 updateCell(uploadTargetCellId, { content: newContent });
             }
          } catch (err) {
              console.error("Upload failed", err);
          }
      }

      setUploadTargetCellId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target && target.classList.contains('image-placeholder-btn')) {
             console.log('[Table] Global click caught on placeholder button');
             e.preventDefault();
             e.stopPropagation();
             
             const td = target.closest('td');
             const cellId = td?.getAttribute('data-cell-id');
             
             if (cellId) {
                 console.log('[Table] Identified cell:', cellId);
                 setUploadTargetCellId(cellId);

                 fileInputRef.current?.click();
             } else {
                 console.warn('[Table] Could not find parent cell ID');
             }
        }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
        document.removeEventListener('click', handleGlobalClick);
    };
  }, []);


  

  
  const processHtmlWithLatex = (html: string) => {
      if (!html || !html.includes('$')) return html;

      
      
      return html.replace(/\$([^$]+?)\$/g, (match, inner) => {
           
           if (inner.includes('="')) return match;
           
           
           let cleanTex = inner.replace(/<[^>]+>/g, '');
           
           
           cleanTex = cleanTex.replace(/\u00A0/g, ' ');
           
           
           const txt = document.createElement('textarea');
           txt.innerHTML = cleanTex;
           cleanTex = txt.value;

           try {
               const rendered = katex.renderToString(cleanTex, { 
                   throwOnError: false,
                   displayMode: false
               });
                return `<span class="latex-container inline-block mx-0.5" style="font-size: 0.9em; vertical-align: middle;">${rendered}</span>`;
           } catch (e) {
               console.error("KaTeX render error:", e);
               return match;
           }
      });
  };


  const handleDoubleClick = (cellId: string) => {
      const cell = table.rows.flatMap(r => r.cells).find(c => c?.id === cellId);
      if (cell) {
          editingContentRef.current = cell.content;
      }
      setEditingCell(cellId);
  };
  const handleColResizeStart = (e: React.MouseEvent, index: number, width: number) => {
      e.preventDefault();
      e.stopPropagation();
      saveHistory();
      setResizingCol({ index, startX: e.clientX, startWidth: width });
  };

  const handleRowResizeStart = (e: React.MouseEvent, index: number, height: number) => {
      e.preventDefault();
      e.stopPropagation();
      saveHistory();
      setResizingRow({ index, startY: e.clientY, startHeight: height });
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (resizingCol) {
              const diff = e.clientX - resizingCol.startX;
              const newWidth = Math.max(MIN_COL_WIDTH, resizingCol.startWidth + diff);
              setColumnWidth(resizingCol.index, newWidth);
          }
          if (resizingRow) {
              const diff = e.clientY - resizingRow.startY;
              const newHeight = Math.max(MIN_ROW_HEIGHT, resizingRow.startHeight + diff);
              setRowHeight(resizingRow.index, `${newHeight}px`);
          }
      };

      const handleMouseUp = () => {
          setResizingCol(null);
          setResizingRow(null);
      };

      if (resizingCol || resizingRow) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [resizingCol, resizingRow, setColumnWidth, setRowHeight]);

  
  const measureContent = (content: string, styles: React.CSSProperties, maxWidth?: number) => {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.height = 'auto';
      tempDiv.style.width = maxWidth ? `${maxWidth}px` : 'auto';
      tempDiv.style.whiteSpace = maxWidth ? 'normal' : 'nowrap';
      tempDiv.style.fontFamily = String(styles.fontFamily || '"Computer Modern", serif');
      tempDiv.style.fontSize = String(styles.fontSize || 'inherit');
      tempDiv.style.fontWeight = String(styles.fontWeight || 'normal');
      tempDiv.style.fontStyle = String(styles.fontStyle || 'normal');
      tempDiv.style.padding = '4px 8px'; 
      tempDiv.style.boxSizing = 'border-box';
      
      
      tempDiv.innerHTML = processHtmlWithLatex(content);
      
      document.body.appendChild(tempDiv);
      const width = tempDiv.offsetWidth;
      const height = tempDiv.offsetHeight;
      document.body.removeChild(tempDiv);
      
      return { width, height };
  };

  const handleColAutoResize = (colIndex: number) => {
      let maxW = MIN_COL_WIDTH;
      
      table.rows.forEach(row => {
          const cell = row.cells[colIndex];
          if (cell && (cell.colSpan || 1) === 1) { 
             const styles: React.CSSProperties = {
                 fontWeight: cell.bold ? 'bold' : 'normal',
                 fontStyle: cell.italic ? 'italic' : 'normal',
             };
             const { width } = measureContent(cell.content, styles);
             
             if (width + 1  > maxW) maxW = width + 1;
          }
      });
      
      setColumnWidth(colIndex, maxW);
  };

  const handleRowAutoResize = (rowIndex: number) => {
      let maxH = MIN_ROW_HEIGHT;
      const row = table.rows[rowIndex];
      
      row.cells.forEach((cell, colIndex) => {
          if (cell && (cell.rowSpan || 1) === 1) { 
              
              let availableWidth = 0;
              const colSpan = cell.colSpan || 1;
              
              for (let k = 0; k < colSpan; k++) {
                  const targetColIdx = colIndex + k;
                  const w = table.columnWidths[targetColIdx];
                  availableWidth += (typeof w === 'number' ? w : MIN_COL_WIDTH);
              }

              const styles: React.CSSProperties = {
                 fontWeight: cell.bold ? 'bold' : 'normal',
                 fontStyle: cell.italic ? 'italic' : 'normal',
             };
             
             const { height } = measureContent(cell.content, styles, availableWidth);
             if (height > maxH) maxH = height;
          }
      });

      setRowHeight(rowIndex, `${maxH}px`);
  };

  const getCellCoords = (id: string) => {
      for (let r = 0; r < table.rows.length; r++) {
          for (let c = 0; c < table.rows[r].cells.length; c++) {
              if (table.rows[r].cells[c]?.id === id) return { r, c };
          }
      }
      return null;
  };

  const handleMouseDown = (cellId: string) => {
      if (resizingCol || resizingRow) return;
      setIsSelecting(true);
      setSelectedCell(cellId);
      const coords = getCellCoords(cellId);
      if (coords) {
          const cell = table.rows[coords.r].cells[coords.c];
          const rowSpan = cell?.rowSpan || 1;
          const colSpan = cell?.colSpan || 1;
          
          
          setSelectionRange({ 
              startRow: coords.r, 
              startCol: coords.c, 
              endRow: coords.r + rowSpan - 1, 
              endCol: coords.c + colSpan - 1 
          });
      }
  };

  const handleMouseEnter = (cellId: string) => {
      if (!isSelecting || !selectionRange) return;
      const coords = getCellCoords(cellId);
      if (coords) {
          const cell = table.rows[coords.r].cells[coords.c];
          const rowSpan = cell?.rowSpan || 1;
          const colSpan = cell?.colSpan || 1;
          
          
          const cellEndRow = coords.r + rowSpan - 1;
          const cellEndCol = coords.c + colSpan - 1;
          
          
          setSelectionRange({ 
              ...selectionRange, 
              endRow: cellEndRow,
              endCol: cellEndCol
          });
      }
  };

  const handleMouseUpSelection = () => {
      setIsSelecting(false);
  };
    
  const normalizedRange = React.useMemo(() => {
      if (!selectionRange) return null;
      return {
          startRow: Math.min(selectionRange.startRow, selectionRange.endRow),
          endRow: Math.max(selectionRange.startRow, selectionRange.endRow),
          startCol: Math.min(selectionRange.startCol, selectionRange.endCol),
          endCol: Math.max(selectionRange.startCol, selectionRange.endCol),
      };
  }, [selectionRange]);

  const isCellSelected = (r: number, c: number) => {
      if (!normalizedRange) return false;
      
      
      
      for (let rowIdx = normalizedRange.startRow; rowIdx <= normalizedRange.endRow; rowIdx++) {
          for (let colIdx = normalizedRange.startCol; colIdx <= normalizedRange.endCol; colIdx++) {
              const cell = table.rows[rowIdx]?.cells[colIdx];
              if (cell) {
                  
                  const cellRowSpan = cell.rowSpan || 1;
                  const cellColSpan = cell.colSpan || 1;
                  
                  const cellOccupiesPosition = 
                      r >= rowIdx && r < rowIdx + cellRowSpan &&
                      c >= colIdx && c < colIdx + cellColSpan;
                  
                  if (cellOccupiesPosition) {
                      return true;
                  }
              }
          }
      }
      return false;
  };

  const currentAlignment = React.useMemo(() => {
      if (!normalizedRange) {
          if (selectedCellId) {
              const cell = table.rows.flatMap(r => r.cells).find(c => c?.id === selectedCellId);
              return cell?.align || 'center';
          }
          return null;
      }

      let commonAlign: string | null = null;
      let first = true;

      const { startRow, endRow, startCol, endCol } = normalizedRange;

      for (let r = startRow; r <= endRow; r++) {
         for (let c = startCol; c <= endCol; c++) {
             const cell = table.rows[r]?.cells[c];
             if (cell) {
                 const align = cell.align || 'center';
                 if (first) {
                     commonAlign = align;
                     first = false;
                 } else {
                     if (commonAlign !== align) {
                         return null;
                     }
                 }
             }
         }
      }
      return commonAlign;
  }, [normalizedRange, selectedCellId, table.rows]);

  const currentVerticalAlignment = React.useMemo(() => {
      if (!normalizedRange) {
          if (selectedCellId) {
              const cell = table.rows.flatMap(r => r.cells).find(c => c?.id === selectedCellId);
              return cell?.verticalAlign || 'middle';
          }
          return null;
      }

      let commonAlign: string | null = null;
      let first = true;

      const { startRow, endRow, startCol, endCol } = normalizedRange;

      for (let r = startRow; r <= endRow; r++) {
         for (let c = startCol; c <= endCol; c++) {
             const cell = table.rows[r]?.cells[c];
             if (cell) {
                 const align = cell.verticalAlign || 'middle';
                 if (first) {
                     commonAlign = align;
                     first = false;
                 } else {
                     if (commonAlign !== align) {
                         return null;
                     }
                 }
             }
         }
      }
      return commonAlign;
  }, [normalizedRange, selectedCellId, table.rows]);
  
  const currentFormat = React.useMemo(() => {
       if (!normalizedRange) {
           if (selectedCellId) {
               const cell = table.rows.flatMap(r => r.cells).find(c => c?.id === selectedCellId);
               return { bold: !!cell?.bold, italic: !!cell?.italic };
           }
           return { bold: false, italic: false };
       }
       
       let allBold = true;
       let allItalic = true;
       let hasCell = false;

       const { startRow, endRow, startCol, endCol } = normalizedRange;
       for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const cell = table.rows[r]?.cells[c];
                if (cell) {
                    hasCell = true;
                    if (!cell.bold) allBold = false;
                    if (!cell.italic) allItalic = false;
                }
            }
       }
       return { bold: hasCell && allBold, italic: hasCell && allItalic };
  }, [normalizedRange, selectedCellId, table.rows]);

  const handleFormat = (command: 'bold' | 'italic') => {
      
      if (editingCell) {
          document.execCommand(command, false);
          
          
          return;
      }

      
      updateSelection({ [command]: !currentFormat[command] });
  }; 

  return (
    <div 
        className="flex flex-col h-full bg-white select-none outline-none" 
        onMouseUp={handleMouseUpSelection}
        onPaste={handlePaste}
        tabIndex={0}
        autoFocus
    >
        {}
        <div ref={toolbarRef} className="h-12 md:h-12 border-b flex items-center justify-between px-4 bg-gray-50 flex-none relative z-50">
             <div className="flex items-center gap-1 flex-none">
                 <Button variant="ghost" size="icon" onClick={() => undo()} disabled={history.past.length === 0} title="Desfazer (Ctrl+Z)"><RotateCcw className="w-4 h-4" /></Button>
                 <Button variant="ghost" size="icon" onClick={() => redo()} disabled={history.future.length === 0} title="Refazer (Ctrl+Y)"><RotateCw className="w-4 h-4" /></Button>
                 <div className="w-px h-6 bg-gray-300 mx-2" />
                 
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(currentFormat.bold && "bg-gray-200 hover:bg-gray-300")}
                    onClick={() => handleFormat('bold')}
                    onMouseDown={(e) => e.preventDefault()} 
                    disabled={!selectedCellId}
                    title="Negrito"
                 >
                    <Bold className="w-4 h-4" />
                 </Button>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(currentFormat.italic && "bg-gray-200 hover:bg-gray-300")}
                    onClick={() => handleFormat('italic')}
                    onMouseDown={(e) => e.preventDefault()} 
                    disabled={!selectedCellId}
                    title="Itálico"
                 >
                    <Italic className="w-4 h-4" />
                 </Button>
                 <div className="w-px h-6 bg-gray-300 mx-2" />
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(currentAlignment === 'left' && "bg-gray-200 hover:bg-gray-300")}
                    onClick={() => updateSelection({ align: 'left' })}
                    disabled={!selectedCellId}
                    title="Alinhar à Esquerda"
                 >
                    <AlignLeft className="w-4 h-4" />
                 </Button>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(currentAlignment === 'center' && "bg-gray-200 hover:bg-gray-300")}
                    onClick={() => updateSelection({ align: 'center' })}
                    disabled={!selectedCellId}
                    title="Centralizar"
                 >
                    <AlignCenter className="w-4 h-4" />
                 </Button>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(currentAlignment === 'right' && "bg-gray-200 hover:bg-gray-300")}
                    onClick={() => updateSelection({ align: 'right' })}
                    disabled={!selectedCellId}
                    title="Alinhar à Direita"
                 >
                    <AlignRight className="w-4 h-4" />
                 </Button>

                 <div className="w-px h-6 bg-gray-300 mx-2" />

                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(currentVerticalAlignment === 'top' && "bg-gray-200 hover:bg-gray-300")}
                    onClick={() => updateSelection({ verticalAlign: 'top' })}
                    disabled={!selectedCellId}
                    title="Alinhar Acima"
                 >
                    <AlignStartVertical className="w-4 h-4 rotate-90" />
                 </Button>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(currentVerticalAlignment === 'middle' && "bg-gray-200 hover:bg-gray-300")}
                    onClick={() => updateSelection({ verticalAlign: 'middle' })}
                    disabled={!selectedCellId}
                    title="Alinhar Verticalmente ao Meio"
                 >
                    <AlignCenterVertical className="w-4 h-4 rotate-90" />
                 </Button>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(currentVerticalAlignment === 'bottom' && "bg-gray-200 hover:bg-gray-300")}
                    onClick={() => updateSelection({ verticalAlign: 'bottom' })}
                    disabled={!selectedCellId}
                    title="Alinhar Abaixo"
                 >
                    <AlignEndVertical className="w-4 h-4 rotate-90" />
                 </Button>
                 
                 <div className="w-px h-6 bg-gray-300 mx-2" />
                 
                 {}
                 <div className="relative">
                     <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)} 
                        disabled={!selectedCellId}
                        title="Cor de Fundo"
                     >
                         <PaintBucket className="w-4 h-4" />
                     </Button>
                     {isColorPickerOpen && (
                         <div ref={colorPickerRef} className="absolute top-full left-0 mt-2 bg-white border shadow-lg rounded-lg p-2 z-50 w-[240px]">
                             <div className="grid grid-cols-10 gap-1">
                                 {}
                                 <button 
                                     className="col-span-10 text-xs text-left px-2 py-1 hover:bg-gray-100 rounded mb-2 border border-dashed border-gray-300"
                                     onClick={() => handleColorSelect(undefined)}
                                 >
                                     Sem Preenchimento
                                 </button>
                                 
                                 {PALETTE_COLORS.map((color, idx) => (
                                     <button
                                         key={idx}
                                         className="w-5 h-5 rounded-sm border border-gray-200 hover:scale-110 transition-transform"
                                         style={{ backgroundColor: color }}
                                         onClick={() => handleColorSelect(color)}
                                         title={color}
                                     />
                                 ))}
                             </div>
                         </div>
                     )}
                 </div>
                 
                 <div className="w-px h-6 bg-gray-300 mx-2" />
                 
                 <div className="flex items-center gap-2 mx-2">
                     <span className="text-xs text-gray-500 font-medium">Arred.:</span>
                     <input
                         type="range"
                         min="0"
                         max="24"
                         step="1"
                         className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                         value={table.borderRadius || 0}
                         onMouseDown={() => saveHistory()}
                         onChange={(e) => setBorderRadius(Number(e.target.value))}
                         title="Arredondar Bordas"
                     />
                 </div>

                 <div className="w-px h-6 bg-gray-300 mx-2" />
                 <Button variant="ghost" size="sm" onClick={mergeCells} disabled={!selectionRange}>Mesclar</Button>
                 <Button variant="ghost" size="sm" onClick={() => setIsSplitDialogOpen(true)} disabled={!selectedCellId}>Dividir</Button>
                 <div className="w-px h-6 bg-gray-300 mx-2" />
                 <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => insertRow('above')} title="Inserir Linha Acima" disabled={!selectedCellId}><ArrowUpToLine className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => insertRow('below')} title="Inserir Linha Abaixo" disabled={!selectedCellId}><ArrowDownToLine className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => insertCol('left')} title="Inserir Coluna à Esquerda" disabled={!selectedCellId}><ArrowLeftToLine className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => insertCol('right')} title="Inserir Coluna à Direita" disabled={!selectedCellId}><ArrowRightToLine className="w-4 h-4" /></Button>
                    
                    <div className="w-px h-6 bg-gray-300 mx-2" />
                    <Button variant="ghost" size="sm" className="text-red-500 gap-2" onClick={() => deleteSelectedRows()} disabled={!selectedCellId} title='Excluir Linhas Selecionadas'>
                        <Trash2 className="w-4 h-4" /> Linha
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 gap-2" onClick={() => deleteSelectedCols()} disabled={!selectedCellId} title='Excluir Colunas Selecionadas'>
                        <Trash2 className="w-4 h-4" /> Coluna
                    </Button>
                 </div>
             </div>
        </div>

        <SplitCellDialog 
          isOpen={isSplitDialogOpen} 
          onClose={() => setIsSplitDialogOpen(false)} 
          onConfirm={(count, direction) => splitCellEnhanced(count, direction)}
        />
        
        <div className="flex-1 overflow-auto bg-gray-100 p-8 flex items-start justify-start md:justify-center">
            
            <div 
                id="interactive-table-container"
                className="relative inline-flex flex-col items-start mx-auto leading-none text-[0px]"
                style={{
                    borderRadius: (table.borderRadius || 0) + 'px',
                    overflow: 'hidden',
                    fontFamily: '"Computer Modern", serif',
                    border: '1px solid black'
                }}
            >
                {}


                <table 
                    ref={tableRef}
                    className="border-collapse table-fixed bg-white text-base"
                    style={{ 
                        width: 'max-content',
                        borderStyle: 'hidden'
                    }}
                >
                    <colgroup>
                        {table.columnWidths.map((w, i) => (
                            <col key={i} style={{ width: w }} />
                        ))}
                    </colgroup>
                    <tbody>
                        {table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} style={{ height: row.height || MIN_ROW_HEIGHT }}>
                                {row.cells.map((cell, colIndex) => {
                                    if (!cell) return null;
                                    
                                    const isSelected = isCellSelected(rowIndex, colIndex);

                                    return (
                                        <td
                                            key={cell.id}
                                            data-cell-id={cell.id}
                                            colSpan={cell.colSpan}
                                            rowSpan={cell.rowSpan}
                                            className={cn(
                                                "border border-black relative p-0",
                                                (!cell.verticalAlign || cell.verticalAlign === 'middle') && "align-middle",
                                                cell.verticalAlign === 'top' && "align-top",
                                                cell.verticalAlign === 'bottom' && "align-bottom",
                                                isSelected && "z-10"
                                            )}
                                            style={{ 
                                                backgroundColor: isSelected ? '#eff6ff' : (cell.backgroundColor || undefined),
                                                minWidth: table.columnWidths[colIndex],
                                                height: row.height
                                            }}
                                            onMouseDown={() => handleMouseDown(cell.id)}
                                            onMouseEnter={() => handleMouseEnter(cell.id)}
                                            onDoubleClick={() => handleDoubleClick(cell.id)}
                                        >
                                            {editingCell === cell.id ? (
                                                <div className="w-full relative overflow-hidden">
                                                    <EditableCell
                                                        initialContent={cell.content}
                                                        className={cn(
                                                            "w-full px-2 py-1 wrap-break-word whitespace-normal outline-none",
                                                            cell.align === 'center' && "text-center",
                                                            cell.align === 'right' && "text-right",
                                                            cell.bold && "font-bold",
                                                            cell.italic && "italic"
                                                        )}
                                                        onSave={(newContent) => updateCell(cell.id, { content: newContent })}
                                                        onBlur={() => setEditingCell(null)}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-full relative overflow-hidden">
                                                    <div 
                                                        className={cn(
                                                            "w-full px-2 py-1 wrap-break-word whitespace-normal pointer-events-none",
                                                            cell.align === 'center' && "text-center",
                                                            cell.align === 'right' && "text-right",
                                                            cell.bold && "font-bold",
                                                            cell.italic && "italic"
                                                        )}
                                                        dangerouslySetInnerHTML={{ __html: processHtmlWithLatex(cell.content) }}
                                                    />
                                                </div>
                                            )}

                                            {/* Column Resize Handle */}
                                            <div 
                                                className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-blue-400 z-20 opacity-0 hover:opacity-100 transition-opacity"
                                                style={{ right: '-1px' }}
                                                onMouseDown={(e) => {
                                                    const targetColIdx = colIndex + (cell.colSpan || 1) - 1;
                                                    handleColResizeStart(e, targetColIdx, typeof table.columnWidths[targetColIdx] === 'number' ? table.columnWidths[targetColIdx] as number : MIN_COL_WIDTH);
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    const targetColIdx = colIndex + (cell.colSpan || 1) - 1;
                                                    handleColAutoResize(targetColIdx);
                                                }}
                                            />

                                            {/* Row Resize Handle */}
                                            <div 
                                                className="absolute bottom-0 left-0 w-full h-2 cursor-row-resize hover:bg-blue-400 z-20 opacity-0 hover:opacity-100 transition-opacity"
                                                style={{ bottom: '-1px' }}
                                                onMouseDown={(e) => {
                                                    const targetRowIdx = rowIndex + (cell.rowSpan || 1) - 1;
                                                    table
                                                    const tableElement = (e.target as HTMLElement).closest('table');
                                                    const allRows = tableElement?.querySelectorAll('tbody > tr');
                                                    const targetRowElement = allRows?.[targetRowIdx];
                                                    const actualHeight = targetRowElement ? targetRowElement.getBoundingClientRect().height : MIN_ROW_HEIGHT;
                                                    handleRowResizeStart(e, targetRowIdx, actualHeight);
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    const targetRowIdx = rowIndex + (cell.rowSpan || 1) - 1;
                                                    handleRowAutoResize(targetRowIdx);
                                                }}
                                            />


                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Hidden File Input for Image Upload */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload} 
            />
        </div>
    </div>
  );
}

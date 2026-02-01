import type { TableModel, Row, Cell, Alignment, VerticalAlignment } from '../types/table';

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const parseClipboardHtml = async (html: string, files?: FileList): Promise<TableModel | null> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');

  if (!table) return null;


  const imageFiles = files ? Array.from(files).filter(f => f.type.startsWith('image/')) : [];
  console.log('[ClipboardParser] Received HTML length:', html.length);
  console.log('[ClipboardParser] Received files:', files ? files.length : 0);
  console.log('[ClipboardParser] Image files found:', imageFiles.length);
  
  let fileIndex = 0;

  const trs = table.querySelectorAll('tr');
  const genId = () => crypto.randomUUID();


  const grid: (Cell | null)[][] = [];


  const processCells = async () => {
      for (let rowIndex = 0; rowIndex < trs.length; rowIndex++) {
        const tr = trs[rowIndex];
        if (!grid[rowIndex]) grid[rowIndex] = [];
        
        let colIndex = 0;
        const cells = tr.querySelectorAll('td, th');

        for (const cellEl of Array.from(cells)) {

            while (grid[rowIndex][colIndex] !== undefined) {
                colIndex++;
            }

            const rowSpan = parseInt(cellEl.getAttribute('rowspan') || '1', 10);
            const colSpan = parseInt(cellEl.getAttribute('colspan') || '1', 10);
            const isHeader = cellEl.tagName.toLowerCase() === 'th';
            
            const style = cellEl.getAttribute('style') || '';
            let align: Alignment = 'center';
            if (style.includes('text-align: left') || cellEl.getAttribute('align') === 'left') align = 'left';
            if (style.includes('text-align: right') || cellEl.getAttribute('align') === 'right') align = 'right';


            const extractContent = async (el: Node): Promise<string> => {
                let html = '';
                for (const child of Array.from(el.childNodes)) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        const text = child.textContent || '';
                        html += text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        const el = child as Element;
                        const tag = el.tagName.toLowerCase();
                        
                        if (tag === 'img') {
                            const src = el.getAttribute('src') || '';
                            console.log('[ClipboardParser] Found img tag, src:', src);
                            let finalSrc = src;
                            


                            if ((src.startsWith('file:') || src === '') && fileIndex < imageFiles.length) {
                                try {
                                    console.log('[ClipboardParser] Attempting to match local file at index', fileIndex);


                                    const file = imageFiles[fileIndex++];
                                    finalSrc = await blobToBase64(file);
                                    console.log('[ClipboardParser] Converted to base64, length:', finalSrc.length);
                                } catch (e) {
                                    console.error("[ClipboardParser] Failed to convert image", e);
                                }
                            } else if (src.startsWith('file:') || src === '') {
                                console.log('[ClipboardParser] No local file match needed or no files available. src starts with:', src.substring(0, 20), 'fileIndex:', fileIndex, 'total images:', imageFiles.length);

                                finalSrc = '';

                                html += `<button class="image-placeholder-btn" style="display:inline-block; border:1px dashed #ccc; padding:6px 12px; font-size:12px; color:#555; background:#f5f5f5; cursor:pointer; pointer-events:auto; border-radius:4px;">Upload Image</button>`;

                                continue;
                            }

                            if (finalSrc) {
                                const width = el.getAttribute('width');
                                const height = el.getAttribute('height');
                                const style = el.getAttribute('style');
                                let imgTag = `<img src="${finalSrc}"`;
                                if (width) imgTag += ` width="${width}"`;
                                if (height) imgTag += ` height="${height}"`;
                                imgTag += ` style="max-width: 100%; height: auto; ${style || ''}"`; 
                                imgTag += '>';
                                html += imgTag;
                            }
                        } else if (tag === 'br') {
                            html += '<br>';
                        } else if (tag === 'p' || tag === 'div') {
                            if (html.length > 0 && !html.endsWith('<br>')) html += '<br>';






                            
                            const innerRes = await extractContent(child);
                            html += innerRes;
                            html += '<br>'; 
                        } else if (['b', 'strong', 'i', 'em', 'u', 'span'].includes(tag)) {
                            html += `<${tag}>${await extractContent(child)}</${tag}>`;
                        } else {
                            html += await extractContent(child);
                        }
                    }
                }
                return html;
            };

            let rawContent = await extractContent(cellEl);
            



            if (rawContent.length > 0 && rawContent.length % 2 === 0) {
                 const half = rawContent.length / 2;
                 const first = rawContent.substring(0, half);
                 const second = rawContent.substring(half);
                 if (first === second) {
                     rawContent = first;
                 }
            }

            rawContent = rawContent
                .replace(/(<br\s*\/?>\s*){2,}/gi, '<br>')
                .trim();
                
            if (rawContent === '<br>') rawContent = '';

            const content = rawContent;

            let verticalAlign: VerticalAlignment = 'middle';
            if (style.includes('vertical-align: top') || cellEl.getAttribute('valign') === 'top') verticalAlign = 'top';
            if (style.includes('vertical-align: bottom') || cellEl.getAttribute('valign') === 'bottom') verticalAlign = 'bottom';

            const newCell: Cell = {
                id: genId(),
                content,
                align,
                verticalAlign,
                isHeader,
                rowSpan: rowSpan > 1 ? rowSpan : undefined,
                colSpan: colSpan > 1 ? colSpan : undefined,
            };

            for (let r = 0; r < rowSpan; r++) {
                for (let c = 0; c < colSpan; c++) {
                    const targetRow = rowIndex + r;
                    const targetCol = colIndex + c;
                    
                    if (!grid[targetRow]) grid[targetRow] = [];
                    
                    if (r === 0 && c === 0) {
                        grid[targetRow][targetCol] = newCell;
                    } else {
                        grid[targetRow][targetCol] = null;
                    }
                }
            }
            colIndex += colSpan;
        }
      }
  };

  await processCells();


  const rows: Row[] = grid.map(rowCells => ({
      id: genId(),
      cells: rowCells
  }));


  if (rows.length === 0) return null;


  let maxCols = 0;
  rows.forEach(r => maxCols = Math.max(maxCols, r.cells.length));
  
  rows.forEach(r => {
      while(r.cells.length < maxCols) {
          r.cells.push({
              id: genId(),
              content: '',
              align: 'center',
              isHeader: false,
              verticalAlign: 'middle',
          });
      }
  });


  const rawWidths: number[] = Array(maxCols).fill(0);
  let hasSpecificWidths = false;

  const parseWidth = (w: string | null): number => {
      if (!w) return 0;

      if (w.includes('%')) {



          return parseFloat(w);
      }

      const num = parseFloat(w.replace(/[^\d.]/g, ''));
      return isNaN(num) ? 0 : num;
  };


  const cols = table.querySelectorAll('col');
  if (cols.length > 0) {
      cols.forEach((col, idx) => {
          if (idx < maxCols) {
              const htmlCol = col as HTMLElement;
              const w = htmlCol.getAttribute('width') || htmlCol.style.width;
              if (w) {
                  const val = parseWidth(w);
                  if (val > 0) {
                      rawWidths[idx] = val;
                      hasSpecificWidths = true;
                  }
              }
          }
      });
  } 
  

  if (!hasSpecificWidths || rawWidths.some(w => w === 0)) {
      const firstRow = trs[0];
      if (firstRow) {
         const cells = firstRow.querySelectorAll('th, td');
         cells.forEach((cell, idx) => {



             if (idx < maxCols) {
                  const htmlCell = cell as HTMLElement;
                  const w = htmlCell.getAttribute('width') || htmlCell.style.width;
                  if (w) {
                       const val = parseWidth(w);
                       if (val > 0) {

                           if (rawWidths[idx] === 0) {
                               rawWidths[idx] = val;
                               hasSpecificWidths = true;
                           }
                       }
                  }
             }
         });
      }
  }


  const columnWidths: (number | 'auto')[] = Array(maxCols).fill('auto');
  if (hasSpecificWidths) {

      
      const knowns = rawWidths.filter(w => w > 0);
      const avg = knowns.length > 0 ? knowns.reduce((a,b)=>a+b,0) / knowns.length : 100;
      
      const filledWidths = rawWidths.map(w => w === 0 ? avg : w);
      
      const total = filledWidths.reduce((a, b) => a + b, 0);
      
      if (total > 0) {
          filledWidths.forEach((w, i) => {
              const pct = (w / total);

              columnWidths[i] = Math.max(50, Math.floor(pct * 1000));
          });
      }
  }

  return {
    rows,
    columnWidths,
    caption: table.querySelector('caption')?.textContent || undefined,
  };
};

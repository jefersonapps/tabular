import { FilePlus2, FileSpreadsheet, Download, History, Table2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { useTableStore } from "@/store/useTableStore";
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export function Header() {
  const { setSelectedCell, setSelectionRange, recentTables, createNewTable, restoreRecentTable } = useTableStore();
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  
  const handleDownloadPDF = async () => {
    // Commit any content that is still being edited before cloning the table.
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }

    // Clear selection for a clean capture
    setSelectedCell(null);
    setSelectionRange(null);
    
    // Wait for React to paint the clean state and for Computer Modern/KaTeX
    // fonts to be available before html2canvas measures the text.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await document.fonts?.ready;

    const container = document.getElementById('interactive-table-container');
    if (!container) return;

    try {
        const MARGIN = 6; // Tightened margin
        const CAPTURE_SCALE = 4;

        // High quality capture
        const canvas = await html2canvas(container, {
            scale: CAPTURE_SCALE,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            onclone: async (clonedDoc) => {
                await clonedDoc.fonts?.ready;

                const clonedContainer = clonedDoc.getElementById('interactive-table-container');
                if (clonedContainer) {
                    clonedContainer.style.position = 'relative';
                    clonedContainer.style.display = 'inline-block';
                    clonedContainer.style.margin = '0';
                    clonedContainer.style.padding = `${MARGIN}px`;
                    clonedContainer.style.transform = 'none';
                    clonedContainer.style.boxShadow = 'none';
                    clonedContainer.style.border = 'none';
                    clonedContainer.style.overflow = 'visible';
                    clonedContainer.style.background = 'white';
                    
                    const table = clonedContainer.querySelector('table');
                    if (table) {
                        table.style.border = 'none';
                        table.style.borderCollapse = 'separate';
                        table.style.borderSpacing = '0';
                        table.style.margin = '0';
                        table.style.overflow = 'visible';
                        
                        table.style.borderTop = '1px solid black';
                        table.style.borderLeft = '1px solid black';
                        
                        const cells = table.querySelectorAll('td, th');
                        cells.forEach(c => {
                            const cell = c as HTMLElement;
                            cell.style.border = 'none';
                            cell.style.borderRight = '1px solid black';
                            cell.style.borderBottom = '1px solid black';
                            cell.style.boxSizing = 'border-box';
                            cell.style.overflow = 'visible';
                            
                            cell.style.display = 'table-cell';
                            cell.style.padding = '0';
                        });

                        // html2canvas-pro measures text word by word when letter-spacing
                        // is exactly zero. With custom fonts and flex cell contents those
                        // word ranges can lose the width of whitespace. A negligible,
                        // non-zero value makes it measure graphemes and preserves spaces.
                        const cellContents = table.querySelectorAll<HTMLElement>(
                            'td > div > div, th > div > div'
                        );
                        cellContents.forEach(content => {
                            content.style.letterSpacing = '0.01px';
                        });

                        // Resize hit areas are editor UI and must not affect the clone's
                        // bounds or overlap cell contents in the exported image.
                        const resizeHandles = table.querySelectorAll<HTMLElement>(
                            '.cursor-col-resize, .cursor-row-resize'
                        );
                        resizeHandles.forEach(handle => {
                            handle.style.display = 'none';
                        });
                    }
                }
            }
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Calculate dimensions in mm including the margin
        const widthMm = (canvas.width / CAPTURE_SCALE) * 0.264583; 
        const heightMm = (canvas.height / CAPTURE_SCALE) * 0.264583;

        const pdf = new jsPDF({
            orientation: widthMm > heightMm ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [widthMm, heightMm]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
        pdf.save(`tabela-${new Date().getTime()}.pdf`);
    } catch (err) {
        console.error("Failed to generate PDF:", err);
        // Fallback to window.print if jspdf fails
        window.print();
    }
  };

  return (
    <header className="min-h-14 border-b px-3 py-2 sm:px-4 flex items-center justify-between gap-3 bg-card">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-md">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-semibold text-lg">Tabular</h1>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2">
             <Button size="sm" variant="outline" onClick={createNewTable} className="gap-2">
                  <FilePlus2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Nova tabela</span>
             </Button>
             <div className="relative">
                 <Button size="sm" variant="outline" onClick={() => setIsRecentOpen((open) => !open)} className="gap-2" aria-expanded={isRecentOpen}>
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">Recentes</span>
                 </Button>
                 {isRecentOpen && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border bg-popover p-2 shadow-lg">
                       <div className="px-2 py-1.5 text-sm font-semibold">Últimas tabelas</div>
                       {recentTables.length === 0 ? (
                         <p className="px-2 py-4 text-sm text-muted-foreground">Nenhuma tabela anterior.</p>
                       ) : (
                         <div className="max-h-72 overflow-y-auto">
                           {recentTables.map((recent) => (
                             <button
                               key={recent.id}
                               onClick={() => { restoreRecentTable(recent.id); setIsRecentOpen(false); }}
                               className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
                             >
                               <Table2 className="size-4 shrink-0 text-muted-foreground" />
                               <span className="min-w-0 flex-1">
                                 <span className="block truncate text-sm font-medium">{recent.table.rows.length} linhas × {recent.table.columnWidths.length} colunas</span>
                                 <span className="block text-xs text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(recent.createdAt))}</span>
                               </span>
                             </button>
                           ))}
                         </div>
                       )}
                    </div>
                 )}
             </div>
              <Button size="sm" onClick={handleDownloadPDF} className="gap-2 bg-black text-white hover:bg-gray-800">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar PDF</span>
              </Button>
        </div>
    </header>
  );
}

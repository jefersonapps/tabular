import { FilePlus2, FileSpreadsheet, Download, History, Table2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { useTableStore } from "@/store/useTableStore";
import { domToCanvas } from 'modern-screenshot';
import { jsPDF } from 'jspdf';

const canvasHasVisibleContent = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || canvas.width === 0 || canvas.height === 0) return false;

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    // Sampling every eighth pixel is enough to find table borders/text while
    // avoiding a costly comparison of every high-resolution pixel.
    for (let index = 0; index < pixels.length; index += 4 * 8) {
        const alpha = pixels[index + 3];
        const isNotWhite = pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250;
        if (alpha > 0 && isNotWhite) return true;
    }

    return false;
};

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
        const MARGIN = 6;
        const CAPTURE_SCALE = 4;
        const PX_TO_MM = 0.264583;

        // modern-screenshot embeds the fonts and computed styles used by the
        // subtree before asking the browser to paint it. This preserves KaTeX's
        // exact baselines instead of reconstructing text with CanvasRenderingContext2D.
        const canvas = await domToCanvas(container, {
            scale: CAPTURE_SCALE,
            backgroundColor: '#ffffff',
            filter: node => !(
                node instanceof HTMLElement
                && (
                    node.classList.contains('cursor-col-resize')
                    || node.classList.contains('cursor-row-resize')
                )
            ),
            style: {
                boxShadow: 'none'
            }
        });

        if (!canvasHasVisibleContent(canvas)) {
            throw new Error('A captura da tabela ficou vazia; o PDF não foi gerado.');
        }

        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Add the PDF margin outside the bitmap. Padding the cloned DOM would
        // change its dimensions and could shift the table relative to preview.
        const contentWidthMm = (canvas.width / CAPTURE_SCALE) * PX_TO_MM;
        const contentHeightMm = (canvas.height / CAPTURE_SCALE) * PX_TO_MM;
        const marginMm = MARGIN * PX_TO_MM;
        const widthMm = contentWidthMm + (marginMm * 2);
        const heightMm = contentHeightMm + (marginMm * 2);

        const pdf = new jsPDF({
            orientation: widthMm > heightMm ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [widthMm, heightMm]
        });

        pdf.addImage(imgData, 'PNG', marginMm, marginMm, contentWidthMm, contentHeightMm);
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

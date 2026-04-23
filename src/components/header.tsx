import { FileSpreadsheet, Download } from "lucide-react";
import { Button } from "./ui/button";
import { useTableStore } from "@/store/useTableStore";
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export function Header() {
  const { setSelectedCell, setSelectionRange } = useTableStore();
  
  const handleDownloadPDF = async () => {
    // Clear selection for a clean capture
    setSelectedCell(null);
    setSelectionRange(null);
    
    // Wait for UI to update
    await new Promise(resolve => setTimeout(resolve, 200));

    const container = document.getElementById('interactive-table-container');
    if (!container) return;

    try {
        const MARGIN = 6; // Tightened margin

        // High quality capture
        const canvas = await html2canvas(container, {
            scale: 4, 
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
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
                            cell.style.verticalAlign = 'middle';
                            cell.style.padding = '8px 4px';
                            
                            const innerDiv = cell.querySelector('div');
                            if (innerDiv) {
                                innerDiv.style.display = 'flex';
                                innerDiv.style.flexDirection = 'column';
                                innerDiv.style.justifyContent = 'center';
                                innerDiv.style.height = 'auto';
                                innerDiv.style.minHeight = '0';
                            }
                        });
                    }
                }
            }
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // Calculate dimensions in mm including the margin
        const widthMm = (canvas.width / 4) * 0.264583; 
        const heightMm = (canvas.height / 4) * 0.264583;

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
    <header className="h-14 border-b px-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-md">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-semibold text-lg">Tabular</h1>
        </div>
        
        <div className="flex items-center gap-2">
             <Button size="sm" onClick={handleDownloadPDF} className="gap-2 bg-black text-white hover:bg-gray-800">
                 <Download className="w-4 h-4" />
                 Exportar PDF
             </Button>
        </div>
    </header>
  );
}

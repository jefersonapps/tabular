import { FileSpreadsheet, Download } from "lucide-react";
import { Button } from "./ui/button";
import { useTableStore } from "@/store/useTableStore";

export function Header() {
  const { setSelectedCell, setSelectionRange, table } = useTableStore();
  
  const handleDownloadPDF = async () => {
    
    setSelectedCell(null);
    setSelectionRange(null);
    
    
    setTimeout(() => {
        const container = document.getElementById('interactive-table-container');
        if (container) {
            const tableElement = container.querySelector('table') as HTMLElement;
            if (tableElement) {
                
                const rect = container.getBoundingClientRect();
                const width = rect.width;
                const height = rect.height;
               
                const padding = 1;
                const printWidth = width + (padding * 2);
                const printHeight = height + (padding * 2);

                const borderRadius = table.borderRadius || 0;
                
                const style = document.createElement('style');
                style.innerHTML = `
                    @media print {
                        @page {
                            size: ${printWidth}px ${printHeight}px;
                            margin: 0 !important;
                        }
                        html, body {
                            width: ${printWidth}px !important;
                            height: ${printHeight}px !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            overflow: hidden !important;
                            background-color: white !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        #interactive-table-container {
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            box-shadow: none !important;
                            width: ${printWidth}px !important;
                            height: ${printHeight}px !important;
                            overflow: hidden !important;
                            border: 1px solid black !important;
                            border-radius: ${borderRadius}px !important;
                            background-color: white !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                        }
                        #interactive-table-container table {
                            width: ${width}px !important;
                            height: ${height}px !important;
                            margin: 0 !important;
                            border-collapse: collapse !important;
                            border-style: hidden !important;
                            table-layout: fixed !important;
                        }
                        #interactive-table-container td, 
                        #interactive-table-container th {
                            border: 1px solid black !important;
                            visibility: visible !important;
                        }
                        * {
                            box-sizing: border-box !important;
                            -webkit-print-color-adjust: exact !important;
                        }
                    }
                `;
                document.head.appendChild(style);
                
                window.print();
                
                setTimeout(() => {
                    document.head.removeChild(style);
                }, 100);
            } else {
                window.print();
            }
        } else {
            window.print();
        }
    }, 100);
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

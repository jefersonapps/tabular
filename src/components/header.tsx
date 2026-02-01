import { FileSpreadsheet } from "lucide-react";

export function Header() {
  return (
    <header className="h-14 border-b px-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-md">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-semibold text-lg">Tabular</h1>
        </div>
        
        <div className="flex items-center gap-2">
             {}
        </div>
    </header>
  );
}

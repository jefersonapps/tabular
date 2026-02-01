import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Columns, Rows } from "lucide-react";
import { cn } from "@/lib/utils";

interface SplitCellDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (count: number, direction: 'horizontal' | 'vertical') => void;
}

export function SplitCellDialog({ isOpen, onClose, onConfirm }: SplitCellDialogProps) {
  const [count, setCount] = useState(2);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(count, direction);
    onClose();
  };

  const increment = () => setCount(prev => Math.min(20, prev + 1));
  const decrement = () => setCount(prev => Math.max(2, prev - 1));

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/20" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      <div className="bg-white text-gray-900 rounded-lg shadow-xl w-[320px] overflow-hidden border border-gray-200">
        {}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Dividir células</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {}
        <div className="p-5 space-y-6">
          
          {}
          <div className="space-y-2">
            <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Dividir</Label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 font-medium">Dividir célula em:</span>
              <div className="flex items-center">
                <Input 
                  type="number" 
                  value={count} 
                  onChange={(e) => setCount(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-16 h-9 bg-white border-gray-300 text-center text-gray-900 p-1 focus-visible:ring-1 focus-visible:ring-black focus-visible:border-black rounded-r-none"
                />
                <div className="flex flex-col h-9 border border-l-0 border-gray-300 rounded-r-md overflow-hidden bg-gray-50">
                   <button 
                      onClick={increment}
                      className="h-1/2 px-2 hover:bg-gray-200 border-b border-gray-300 flex items-center justify-center text-[10px] text-gray-700 active:bg-gray-300 transition-colors"
                   >
                     +
                   </button>
                   <button 
                      onClick={decrement}
                      className="h-1/2 px-2 hover:bg-gray-200 flex items-center justify-center text-[10px] text-gray-700 active:bg-gray-300 transition-colors"
                   >
                     −
                   </button>
                </div>
              </div>
            </div>
          </div>

          {}
          <div className="space-y-3">
            <Label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Direção</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={cn(
                  "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                  direction === 'horizontal' ? "border-black" : "border-gray-300 group-hover:border-gray-400"
                )}>
                  {direction === 'horizontal' && <div className="w-2 h-2 bg-black rounded-full" />}
                </div>
                <input 
                  type="radio" 
                  name="direction" 
                  className="hidden"
                  checked={direction === 'horizontal'}
                  onChange={() => setDirection('horizontal')}
                />
                <Columns className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900">Horizontalmente</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={cn(
                  "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                  direction === 'vertical' ? "border-black" : "border-gray-300 group-hover:border-gray-400"
                )}>
                  {direction === 'vertical' && <div className="w-2 h-2 bg-black rounded-full" />}
                </div>
                <input 
                  type="radio" 
                  name="direction" 
                  className="hidden"
                  checked={direction === 'vertical'}
                  onChange={() => setDirection('vertical')}
                />
                <Rows className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900">Verticalmente</span>
              </label>
            </div>
          </div>

          {}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
               variant="ghost" 
               onClick={onClose}
               className="text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              Cancelar
            </Button>
            <Button 
               onClick={handleConfirm}
               className="bg-black hover:bg-gray-800 text-white shadow-sm"
            >
              OK
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}

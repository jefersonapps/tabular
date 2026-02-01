import { Header } from '@/components/header';
import { InteractiveTable } from '@/components/interactive-table';
import 'katex/dist/katex.min.css';

function App() {
  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-hidden">
             <InteractiveTable />
        </main>
    </div>
  )
}

export default App

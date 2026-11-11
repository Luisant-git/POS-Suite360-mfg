import { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

const ShortcutHelpButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  return (
    <>
      <button 
        type="button"
        onClick={() => setIsOpen(true)}
        className="border border-[#0B355B] text-[#0B355B] hover:bg-[#0B355B] hover:text-white px-3 py-1 rounded flex items-center gap-1 text-[12px] transition-colors font-bold"
        title="Keyboard Shortcuts (F1)"
      >
        <Keyboard size={14} /> Keyboard Shortcuts
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#0B355B] text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Keyboard size={20} />
                <h2 className="font-bold text-lg">Keyboard Shortcuts</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded transition-colors text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                  <span className="font-bold text-gray-700 text-[14px]">Add New Row</span>
                  <span className="bg-gray-100 border border-gray-300 text-gray-800 font-bold px-2 py-1 rounded text-[12px] shadow-sm min-w-[40px] text-center">F2</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                  <span className="font-bold text-gray-700 text-[14px]">Save Invoice</span>
                  <span className="bg-gray-100 border border-gray-300 text-gray-800 font-bold px-2 py-1 rounded text-[12px] shadow-sm min-w-[40px] text-center">F10</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                  <span className="font-bold text-gray-700 text-[14px]">Clear Form</span>
                  <span className="bg-gray-100 border border-gray-300 text-gray-800 font-bold px-2 py-1 rounded text-[12px] shadow-sm min-w-[40px] text-center">F4</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                  <span className="font-bold text-gray-700 text-[14px]">Go to Dashboard</span>
                  <span className="bg-gray-100 border border-gray-300 text-gray-800 font-bold px-2 py-1 rounded text-[12px] shadow-sm min-w-[40px] text-center">Esc</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                  <span className="font-bold text-gray-700 text-[14px]">Delete Current Row</span>
                  <span className="bg-gray-100 border border-gray-300 text-gray-800 font-bold px-2 py-1 rounded text-[12px] shadow-sm min-w-[40px] text-center">Ctrl + Del</span>
                </div>
                <div className="flex justify-between items-center py-2.5">
                  <span className="font-bold text-gray-700 text-[14px]">Move to Next Cell / Row</span>
                  <span className="bg-gray-100 border border-gray-300 text-gray-800 font-bold px-2 py-1 rounded text-[12px] shadow-sm min-w-[40px] text-center">Enter or Tab</span>
                </div>
              </div>

              <div className="mt-8 text-center">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 px-8 rounded border border-gray-300 transition-colors shadow-sm w-full"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShortcutHelpButton;

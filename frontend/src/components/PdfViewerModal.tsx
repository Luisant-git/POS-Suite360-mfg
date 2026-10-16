import { X, Download } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
}

const PdfViewerModal = ({ isOpen, onClose, pdfUrl, title }: PdfViewerModalProps) => {
  useEffect(() => {
    if (isOpen) {
      const originalTitle = document.title;
      document.title = title;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white w-[90%] max-w-[1000px] h-[90vh] flex flex-col rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="flex justify-between items-center bg-[#1E293B] text-white p-3">
          <h2 className="font-bold text-sm">{title}</h2>
          <div className="flex gap-4 items-center">
            <a 
              href={pdfUrl} 
              download={`${title}.pdf`}
              className="text-white hover:text-blue-400 transition-colors flex items-center gap-1 text-[13px] font-normal"
            >
              <Download size={14} /> Download PDF
            </a>
            <button type="button" onClick={onClose} className="hover:text-red-400 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100">
          <iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Viewer" />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PdfViewerModal;

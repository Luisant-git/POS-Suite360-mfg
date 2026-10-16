import React from 'react';
import { Loader2 } from 'lucide-react';

interface TableLoaderProps {
  columns: number;
  text?: string;
}

const TableLoader: React.FC<TableLoaderProps> = ({ columns, text = "Loading data..." }) => {
  return (
    <tr>
      <td colSpan={columns} className="py-12">
        <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
          <span className="text-sm font-bold">{text}</span>
        </div>
      </td>
    </tr>
  );
};

export default TableLoader;

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X, Tag } from 'lucide-react';

export default function PrintableTags({ items = [], onClose }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center space-x-2.5">
            <Tag className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold">Printable Equipment QR Asset Tags</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sticker Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-100 border-b border-slate-200 text-xs text-slate-700 no-print flex items-center justify-between">
          <span>
            Showing <strong>{items.length}</strong> printable tags. Ready for standard label printer or Avery 2.5" x 1.5" sticker paper.
          </span>
          <span className="font-mono text-slate-600">EquipTrack Asset Tagging Engine</span>
        </div>

        {/* Printable Sheet */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50" id="printable-tags-area">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((item) => {
              const qrPayload = JSON.stringify({
                asset_tag: item.asset_tag,
                name: item.name,
                serial: item.serial_number || ''
              });

              return (
                <div
                  key={item.id}
                  className="bg-white p-3.5 rounded-xl border-2 border-slate-900 flex flex-col justify-between shadow-xs break-inside-avoid"
                  style={{ minHeight: '140px' }}
                >
                  <div className="flex items-start justify-between border-b border-slate-200 pb-2 mb-2">
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-600">
                        EquipTrack Asset Tag
                      </div>
                      <div className="text-xs font-bold text-slate-900 leading-tight line-clamp-1">
                        {item.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 my-1">
                    <div className="p-1 bg-white border border-slate-300 rounded shrink-0">
                      <QRCodeSVG value={qrPayload} size={70} level="M" />
                    </div>
                    <div className="flex-1 text-[11px] space-y-0.5">
                      <div className="font-mono font-bold text-slate-900 text-sm tracking-wide">
                        {item.asset_tag}
                      </div>
                      <div className="text-slate-500 text-[10px] truncate">
                        Loc: {item.location || 'Depot'}
                      </div>
                      <div className="text-slate-400 text-[9px] font-mono truncate">
                        S/N: {item.serial_number || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-1.5 mt-1 flex justify-between items-center text-[9px] text-slate-600 font-mono">
                    <span>PROPERTY OF INSTITUTION</span>
                    <span>DO NOT REMOVE</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

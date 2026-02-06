import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Building2 } from 'lucide-react';
import type { Office } from '@/types';

interface OfficeSelectorProps {
  offices: Office[];
  selectedOfficeIds: string[];
  onChange: (officeIds: string[]) => void;
}

export function OfficeSelector({ offices, selectedOfficeIds, onChange }: OfficeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOffice = (officeId: string) => {
    if (selectedOfficeIds.includes(officeId)) {
      onChange(selectedOfficeIds.filter((id) => id !== officeId));
    } else {
      onChange([...selectedOfficeIds, officeId]);
    }
  };

  const selectAll = () => {
    onChange(offices.map((o) => o.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selectedOfficeIds.length === 0) return 'Select offices';
    if (selectedOfficeIds.length === offices.length) return 'All offices';
    if (selectedOfficeIds.length === 1) {
      return offices.find((o) => o.id === selectedOfficeIds[0])?.name || 'Select offices';
    }
    return `${selectedOfficeIds.length} offices selected`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Building2 className="w-4 h-4 text-slate-400" />
        <span>{getDisplayText()}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2">
          <div className="px-3 pb-2 border-b border-slate-100 flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Select all
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={clearAll}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium"
            >
              Clear
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {offices.map((office) => {
              const isSelected = selectedOfficeIds.includes(office.id);
              return (
                <button
                  key={office.id}
                  onClick={() => toggleOffice(office.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-900">{office.name}</p>
                    <p className="text-xs text-slate-500">{office.location}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

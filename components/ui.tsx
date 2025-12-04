
import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

// overflow-hidden kaldırıldı ki dropdownlar kesilmesin.
export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void; id?: string }> = ({ children, className = "", onClick, id }) => (
  <div id={id} onClick={onClick} className={`bg-white rounded-xl shadow-sm border border-gray-200 card-base ${className}`}>
    {children}
  </div>
);

interface ButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ onClick, children, variant = 'primary', className = "", disabled = false }) => {
  // v17 Style Gradient Button Base
  const baseStyle = "px-6 py-2.5 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99]";
  
  const variants: Record<string, string> = {
    // v17 Gradient
    primary: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-500/20",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
    success: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 font-medium"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "blue" }) => {
    const colors: Record<string, string> = {
        blue: "bg-indigo-50 text-indigo-700 border border-indigo-100",
        green: "bg-emerald-50 text-emerald-700 border border-emerald-100",
        yellow: "bg-amber-50 text-amber-700 border border-amber-100",
        purple: "bg-purple-50 text-purple-700 border border-purple-100",
        red: "bg-rose-50 text-rose-700 border border-rose-100",
        gray: "bg-gray-100 text-gray-700 border border-gray-200"
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-md text-xs font-semibold ${colors[color] || colors.gray}`}>
            {children}
        </span>
    );
};

interface MultiSelectProps<T extends string | number> {
  options: T[];
  selected: T[];
  onChange: (selected: T[]) => void;
  label: string;
}

export const MultiSelect = <T extends string | number>({ options, selected, onChange, label }: MultiSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: T) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      const newSelected = [...selected, option];
      // Basit sıralama (Number ise sayısal, String ise alfabetik)
      if (typeof option === 'number') {
          newSelected.sort((a,b) => (a as number) - (b as number));
      } else {
          newSelected.sort();
      }
      onChange(newSelected);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-gray-300 rounded-lg p-2.5 bg-white cursor-pointer flex justify-between items-center text-sm shadow-sm hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all multi-select-trigger"
      >
        <span className={`truncate ${selected.length === 0 ? "text-gray-400 placeholder-text" : "text-gray-800 font-medium value-text"}`}>
          {selected.length === 0 ? label : `Seçilen: ${selected.join(', ')}`}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500 icon shrink-0 ml-2" />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto py-1 multi-select-dropdown">
          {options.length === 0 ? (
             <div className="p-3 text-xs text-gray-500 text-center">Liste boş.</div>
          ) : (
             options.map(option => (
                <div 
                  key={option} 
                  onClick={() => toggleOption(option)}
                  className="flex items-center gap-2 px-3 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm transition-colors multi-select-option"
                >
                  <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors shrink-0 ${selected.includes(option) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                    {selected.includes(option) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={selected.includes(option) ? 'text-indigo-900 font-medium' : 'text-gray-700'}>
                      {typeof option === 'number' ? `Kıdem ${option}` : option}
                  </span>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};

interface DateSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    selectedDays: number[];
    onSave: (days: number[]) => void;
    daysInMonth: number;
    color: 'red' | 'green';
}

export const DateSelectModal: React.FC<DateSelectModalProps> = ({ isOpen, onClose, title, selectedDays, onSave, daysInMonth, color }) => {
    if (!isOpen) return null;

    const [tempSelected, setTempSelected] = useState<number[]>(selectedDays);

    useEffect(() => {
        setTempSelected(selectedDays);
    }, [selectedDays]);

    const toggleDay = (day: number) => {
        if (tempSelected.includes(day)) {
            setTempSelected(tempSelected.filter(d => d !== day));
        } else {
            setTempSelected([...tempSelected, day].sort((a, b) => a - b));
        }
    };

    const activeClass = color === 'red' 
        ? 'bg-red-500 text-white border-red-600 shadow-md transform scale-105' 
        : 'bg-emerald-500 text-white border-emerald-600 shadow-md transform scale-105';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in date-select-modal-overlay">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-gray-100 date-select-modal-content">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 date-select-modal-header">
                    <h3 className="font-bold text-gray-900 text-lg title">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 close-btn"><X className="w-5 h-5 text-gray-500" /></button>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-7 gap-2 mb-4">
                        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
                            <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase">{d}</div>
                        ))}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                            <button
                                key={day}
                                onClick={() => toggleDay(day)}
                                className={`h-10 rounded-lg text-sm font-bold border transition-all duration-200 ${
                                    tempSelected.includes(day) 
                                    ? activeClass 
                                    : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:shadow-sm day-btn'
                                }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 footer">
                        <Button variant="ghost" onClick={onClose} className="cancel-btn">İptal</Button>
                        <Button variant="primary" onClick={() => { onSave(tempSelected); onClose(); }}>Kaydet</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

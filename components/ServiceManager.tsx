import React, { useState, useMemo } from 'react';
import { Service, Staff, Group, UnitConstraint } from '../types';
import { Card, Button, Badge, MultiSelect } from './ui';
import { ICONS } from '../constants';
import { GripVertical, Calendar, Check, X } from 'lucide-react';

interface ServiceManagerProps {
    services: Service[];
    setServices: (services: Service[]) => void;
    staff: Staff[];
    isBlackAndWhite: boolean;
    unitConstraints?: UnitConstraint[];
    setUnitConstraints?: React.Dispatch<React.SetStateAction<UnitConstraint[]>>;
}

export const ServiceManager: React.FC<ServiceManagerProps> = ({ 
    services, setServices, staff, isBlackAndWhite,
    unitConstraints = [], setUnitConstraints
}) => {
    const [newService, setNewService] = useState<Partial<Service>>({ 
        name: '', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2, 3], priorityRoles: [], preferredGroup: 'Farketmez', isEmergency: false 
    });

    const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);

    const uniqueRoles = useMemo(() => Array.from(new Set(staff.map(s => s.role))).sort((a: number, b: number) => a - b), [staff]);
    
    // Get unique units from staff
    const uniqueUnits = useMemo(() => {
        const units = new Set(staff.map(s => s.unit || "").filter(u => u.trim() !== ""));
        return Array.from(units).sort();
    }, [staff]);

    const handleAddService = () => {
        if (!newService.name) return;
        setServices([...services, { ...newService, id: Date.now().toString() } as Service]);
        setNewService({ name: '', minDailyCount: 1, maxDailyCount: 1, allowedRoles: [1, 2, 3], priorityRoles: [], preferredGroup: 'Farketmez', isEmergency: false });
    };

    const handleDeleteService = (id: string) => {
        setServices(services.filter(s => s.id !== id));
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedServiceId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedServiceId || draggedServiceId === targetId) return;

        const newServices = [...services];
        const sourceIndex = newServices.findIndex(s => s.id === draggedServiceId);
        const targetIndex = newServices.findIndex(s => s.id === targetId);

        if (sourceIndex === -1 || targetIndex === -1) return;

        const [movedService] = newServices.splice(sourceIndex, 1);
        newServices.splice(targetIndex, 0, movedService);

        setServices(newServices);
        setDraggedServiceId(null);
    };
    
    // --- Unit Constraint Handlers ---
    const toggleUnitDay = (unitName: string, dayIndex: number) => {
        if (!setUnitConstraints) return;
        
        // Find existing
        const existingIdx = unitConstraints.findIndex(c => c.unit === unitName);
        let newConstraints = [...unitConstraints];
        
        if (existingIdx === -1) {
            // New constraint, start with all days enabled EXCEPT the one toggled? 
            // Or start with none? Usually better to start with "Only this day" if user clicks.
            // But here we show buttons. Let's assume if no constraint exists, it means ALL days allowed.
            // So if user clicks a day, they probably want to restrict.
            // Actually, if no constraint object exists, logic says "Any day".
            // So if user creates a constraint object, we should populate it with current state.
            // Strategy: If user clicks a day, we create constraint with that day toggled OFF (since default is ON).
            // Wait, standard UI: Button active = Allowed. Button inactive = Restricted.
            // Default (No object) = All Active.
            // So clicking a day means "Disable this day".
            
            // Create object with all days allowed (0..6)
            const allDays = [0,1,2,3,4,5,6];
            // Remove the clicked day
            const newAllowed = allDays.filter(d => d !== dayIndex);
            newConstraints.push({ unit: unitName, allowedDays: newAllowed });
        } else {
            const current = newConstraints[existingIdx];
            if (current.allowedDays.includes(dayIndex)) {
                // Remove it
                current.allowedDays = current.allowedDays.filter(d => d !== dayIndex);
            } else {
                // Add it
                current.allowedDays = [...current.allowedDays, dayIndex].sort();
            }
            
            // Cleanup: If all days allowed, remove constraint object to save space/logic
            if (current.allowedDays.length === 7) {
                newConstraints = newConstraints.filter((_, i) => i !== existingIdx);
            } else {
                newConstraints[existingIdx] = current;
            }
        }
        setUnitConstraints(newConstraints);
    };
    
    const isDayAllowed = (unitName: string, dayIndex: number) => {
        const constraint = unitConstraints.find(c => c.unit === unitName);
        if (!constraint) return true; // Default allow all
        return constraint.allowedDays.includes(dayIndex);
    };

    const inputClass = `w-full rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${
        isBlackAndWhite 
        ? '!bg-slate-800 !border-slate-700 text-white placeholder-slate-400' 
        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
    }`;
    
    const smallInputClass = `p-2.5 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${
        isBlackAndWhite 
        ? '!bg-slate-800 !border-slate-700 text-white placeholder-slate-400' 
        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
    }`;
    
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className={`flex justify-between items-end p-6 rounded-xl border shadow-sm transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800' : 'bg-white border-gray-200'}`}>
              <div>
                  <h2 className={`text-2xl font-bold ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Servis Kuralları</h2>
                  <p className={`mt-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Servisleri sürükleyip bırakarak sıralamayı değiştirebilirsiniz. Bu sıralama Excel çıktısında kullanılır.</p>
              </div>
            </div>
            
            {/* Unit Constraints Section */}
            {setUnitConstraints && (
                <Card className={`p-6 border-l-4 transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-blue-500' : 'border-l-blue-500'}`}>
                    <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>
                        <Calendar className="w-5 h-5"/> Birim Çalışma Günleri
                    </h3>
                    <p className={`text-sm mb-4 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-600'}`}>
                        Belirli branşların sadece haftanın belirli günlerinde nöbet tutmasını istiyorsanız buradan ayarlayabilirsiniz.
                        (Yeşil: Nöbet Yazılabilir, Gri: Yazılamaz)
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uniqueUnits.map(unit => (
                            <div key={unit} className={`p-3 rounded-lg border ${isBlackAndWhite ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
                                <div className={`font-bold text-sm mb-2 ${isBlackAndWhite ? 'text-white' : 'text-gray-800'}`}>{unit}</div>
                                <div className="flex justify-between gap-1">
                                    {days.map((d, idx) => {
                                        const allowed = isDayAllowed(unit, idx);
                                        return (
                                            <button 
                                                key={idx}
                                                onClick={() => toggleUnitDay(unit, idx)}
                                                className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${
                                                    allowed 
                                                    ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600' 
                                                    : (isBlackAndWhite ? 'bg-slate-900 text-slate-600' : 'bg-gray-200 text-gray-400')
                                                }`}
                                                title={allowed ? "Nöbet Yazılabilir" : "Nöbet Yazılamaz"}
                                            >
                                                {d}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                        {uniqueUnits.length === 0 && (
                            <div className={`text-sm italic ${isBlackAndWhite ? 'text-gray-500' : 'text-gray-400'}`}>Personel eklediğinizde branşlar burada listelenecektir.</div>
                        )}
                    </div>
                </Card>
            )}
            
            <Card className={`p-6 border-l-4 transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-emerald-500' : 'border-l-indigo-500'}`}>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-6 items-start">
                <div className="md:col-span-2">
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Servis Adı</label>
                  <input type="text" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className={inputClass} placeholder="Örn: Acil" />
                  <div className="mt-3 flex items-center gap-2">
                      <input type="checkbox" id="isEmerg" checked={newService.isEmergency} onChange={e => setNewService({...newService, isEmergency: e.target.checked})} className={`rounded text-indigo-600 focus:ring-indigo-500 ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : ''}`} />
                      <label htmlFor="isEmerg" className={`text-sm font-medium ${isBlackAndWhite ? 'text-white' : 'text-rose-600'}`}>Bu bir Acil Nöbetidir</label>
                  </div>
                </div>
                <div>
                   <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Min-Max Kişi</label>
                   <div className="flex gap-2">
                       <input type="number" value={newService.minDailyCount} onChange={e => setNewService({...newService, minDailyCount: parseInt(e.target.value)})} className={`w-1/2 ${smallInputClass}`} placeholder="Min" />
                       <input type="number" value={newService.maxDailyCount} onChange={e => setNewService({...newService, maxDailyCount: parseInt(e.target.value)})} className={`w-1/2 ${smallInputClass}`} placeholder="Max" />
                   </div>
                </div>
                <div className="md:col-span-2 space-y-4">
                   <div className="space-y-1">
                     <label className={`block text-xs font-bold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Yazılabilir Kıdemler</label>
                     <MultiSelect label="Seçiniz..." options={uniqueRoles} selected={newService.allowedRoles || []} onChange={(vals) => setNewService({...newService, allowedRoles: vals})} />
                   </div>
                   <div className="space-y-1">
                     <label className={`block text-xs font-bold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Öncelikli Kıdemler</label>
                     <MultiSelect label="Seçiniz..." options={uniqueRoles} selected={newService.priorityRoles || []} onChange={(vals) => setNewService({...newService, priorityRoles: vals})} />
                   </div>
                </div>
                 <div>
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Öncelikli Grup</label>
                  <select value={newService.preferredGroup} onChange={e => setNewService({...newService, preferredGroup: e.target.value as any})} className={inputClass}>
                    <option value="Farketmez">Farketmez</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                  </select>
                </div>
                <div className="md:col-span-6 flex justify-end">
                  <Button onClick={handleAddService} className={`w-48 justify-center ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500' : ''}`}>{ICONS.Plus} Servisi Ekle</Button>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((s, index) => (
                <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, s.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, s.id)}
                    className={`transition-transform duration-200 ${draggedServiceId === s.id ? 'opacity-50 scale-95' : 'opacity-100'}`}
                >
                    <Card className={`p-5 relative group hover:shadow-lg transition-all border-l-4 cursor-grab active:cursor-grabbing ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-slate-600' : (s.isEmergency ? 'border-l-rose-500' : 'border-l-indigo-500')}`}>
                      
                      {/* Drag Handle Icon */}
                      <div className={`absolute top-4 left-3 ${isBlackAndWhite ? 'text-slate-600' : 'text-gray-300'}`}>
                          <GripVertical className="w-5 h-5" />
                      </div>

                      <button onClick={() => handleDeleteService(s.id)} className={`absolute top-4 right-4 transition-colors ${isBlackAndWhite ? 'text-gray-500 hover:text-red-400' : 'text-gray-300 hover:text-red-500'}`}>{ICONS.Trash}</button>
                      
                      <div className="flex items-center gap-3 mb-2 pl-6">
                          <h3 className={`font-bold text-lg ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>{s.name}</h3>
                          {s.isEmergency && <Badge color={isBlackAndWhite ? "gray" : "red"}>Acil</Badge>}
                      </div>
                      <div className={`space-y-2 text-sm mt-4 p-3 rounded-lg ml-6 ${isBlackAndWhite ? '!bg-slate-800 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                         <div className="flex justify-between items-center"><span className={`text-xs font-semibold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-400'}`}>Kişi Sayısı</span><span className={`font-bold px-2 py-0.5 rounded shadow-sm border ${isBlackAndWhite ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white text-gray-900 border-gray-200'}`}>{s.minDailyCount}-{s.maxDailyCount}</span></div>
                         <div className="flex justify-between items-center"><span className={`text-xs font-semibold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-400'}`}>Roller</span><span className="font-mono text-xs">{s.allowedRoles.join(', ')}</span></div>
                      </div>
                    </Card>
                </div>
              ))}
            </div>
          </div>
    );
};
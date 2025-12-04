
import React, { useState, useMemo } from 'react';
import { Service, Staff, UnitConstraint } from '../types';
import { Card, Button, Badge, MultiSelect } from './ui';
import { ICONS } from '../constants';
import { GripVertical, Calendar, Check, X, Target, Pencil } from 'lucide-react';

interface ServiceManagerProps {
    services: Service[];
    setServices: (services: Service[]) => void;
    staff: Staff[];
    isBlackAndWhite: boolean;
    unitConstraints?: UnitConstraint[];
    setUnitConstraints?: React.Dispatch<React.SetStateAction<UnitConstraint[]>>;
    dailyTotalTarget?: number;
    setDailyTotalTarget?: React.Dispatch<React.SetStateAction<number>>;
}

export const ServiceManager: React.FC<ServiceManagerProps> = ({ 
    services, setServices, staff, isBlackAndWhite,
    unitConstraints = [], setUnitConstraints,
    dailyTotalTarget, setDailyTotalTarget
}) => {
    const [newService, setNewService] = useState<Partial<Service>>({ 
        name: '', minDailyCount: 1, maxDailyCount: 1, isEmergency: false, allowedUnits: [] 
    });

    const [editingService, setEditingService] = useState<Service | null>(null);

    const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
    
    // Constraint Targets (Includes specialties)
    const uniqueConstraintTargets = useMemo(() => {
        const units = new Set(staff.map(s => (s.unit || "").trim()));
        // Add specific specialty names that map to logic
        units.add('Transplantasyon');
        units.add('Yara Bakım');
        return Array.from(units).filter(u => u.length > 0).sort();
    }, [staff]);

    // Unique Staff Units (For Service Filtering)
    const uniqueStaffUnits = useMemo(() => {
        const units = new Set(staff.map(s => (s.unit || "").trim()));
        return Array.from(units).filter((u: string) => u.length > 0).sort();
    }, [staff]);

    const handleAddService = () => {
        if (!newService.name) return;
        setServices([...services, { ...newService, id: Date.now().toString() } as Service]);
        setNewService({ name: '', minDailyCount: 1, maxDailyCount: 1, isEmergency: false, allowedUnits: [] });
    };

    const handleUpdateService = () => {
        if (!editingService || !editingService.name) return;
        setServices(services.map(s => s.id === editingService.id ? editingService : s));
        setEditingService(null);
    };

    const handleDeleteService = (id: string) => {
        if(window.confirm("Bu servisi silmek istediğinize emin misiniz?")) {
            setServices(services.filter(s => s.id !== id));
        }
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
            // Default allow all except clicked
            const allDays = [0,1,2,3,4,5,6];
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
            
            // Cleanup
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

            {/* GLOBAL DAILY TARGET SETTING */}
            {setDailyTotalTarget && (
                <Card className={`p-6 border-l-4 transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-purple-500' : 'border-l-purple-500'}`}>
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="flex-1">
                            <h3 className={`font-bold text-lg mb-1 flex items-center gap-2 ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>
                                <Target className="w-5 h-5"/> Günlük Toplam Nöbetçi Hedefi
                            </h3>
                            <p className={`text-sm ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-600'}`}>
                                Her gün hastanede toplam kaç nöbetçi olmasını istiyorsunuz? 
                                <br/>Sistem önce servis minimumlarını doldurur, eğer toplam sayı bu hedefin altındaysa, boşta personeli kapasitesi olan (Min &lt; Max) servislere dağıtır.
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                                <span className={`font-bold text-sm ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-700'}`}>Hedef Sayı:</span>
                                <input 
                                    type="number" 
                                    min="1"
                                    max="50"
                                    value={dailyTotalTarget} 
                                    onChange={(e) => setDailyTotalTarget(parseInt(e.target.value) || 0)} 
                                    className={`w-20 text-center font-bold text-lg ${smallInputClass}`} 
                                />
                            </div>
                            <div className={`text-[10px] ${isBlackAndWhite ? 'text-gray-500' : 'text-gray-400'}`}>Örn: 6 kişi</div>
                        </div>
                    </div>
                </Card>
            )}
            
            {/* Unit Constraints Section */}
            {setUnitConstraints && (
                <Card className={`p-6 border-l-4 transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-blue-500' : 'border-l-blue-500'}`}>
                    <h3 className={`font-bold text-lg mb-4 flex items-center gap-2 ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>
                        <Calendar className="w-5 h-5"/> Özellik/Branş Gün Kısıtlamaları
                    </h3>
                    <p className={`text-sm mb-4 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-600'}`}>
                        Belirli branşların veya özelliklerin (Örn: Transplantasyon) sadece haftanın belirli günlerinde nöbet tutmasını istiyorsanız buradan ayarlayabilirsiniz.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uniqueConstraintTargets.map(unit => {
                            const isSpecialty = unit === 'Transplantasyon' || unit === 'Yara Bakım';
                            return (
                                <div key={unit} className={`p-3 rounded-lg border ${isBlackAndWhite ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
                                    <div className={`font-bold text-sm mb-2 flex items-center gap-2 ${isBlackAndWhite ? 'text-white' : 'text-gray-800'}`}>
                                        {unit} 
                                        {isSpecialty && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Özel</span>}
                                    </div>
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
                            );
                        })}
                    </div>
                </Card>
            )}
            
            <Card className={`p-6 border-l-4 transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-emerald-500' : 'border-l-indigo-500'}`}>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-6 items-start">
                <div className="md:col-span-2">
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Servis Adı</label>
                  <input type="text" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className={inputClass} placeholder="Örn: Acil" />
                </div>
                <div>
                   <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Min-Max Kişi</label>
                   <div className="flex gap-2">
                       <input type="number" value={newService.minDailyCount} onChange={e => setNewService({...newService, minDailyCount: parseInt(e.target.value)})} className={`w-1/2 ${smallInputClass}`} placeholder="Min" />
                       <input type="number" value={newService.maxDailyCount} onChange={e => setNewService({...newService, maxDailyCount: parseInt(e.target.value)})} className={`w-1/2 ${smallInputClass}`} placeholder="Max" />
                   </div>
                </div>
                <div className="md:col-span-3 space-y-4">
                   <div className="space-y-1">
                     <label className={`block text-xs font-bold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Zorunlu Branşlar (Boşsa Hepsi)</label>
                     <MultiSelect label="Tüm Branşlar" options={uniqueStaffUnits} selected={newService.allowedUnits || []} onChange={(vals) => setNewService({...newService, allowedUnits: vals})} />
                   </div>
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
                    <Card className={`p-5 relative group hover:shadow-lg transition-all border-l-4 cursor-grab active:cursor-grabbing ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-slate-600' : 'border-l-indigo-500'}`}>
                      
                      {/* Drag Handle Icon */}
                      <div className={`absolute top-4 left-3 ${isBlackAndWhite ? 'text-slate-600' : 'text-gray-300'}`}>
                          <GripVertical className="w-5 h-5" />
                      </div>

                      {/* Action Buttons */}
                      <div className="absolute top-4 right-4 flex gap-1">
                           <button 
                                onClick={() => setEditingService(s)}
                                className={`transition-colors p-1 rounded hover:bg-black/5 ${isBlackAndWhite ? 'text-gray-500 hover:text-indigo-400 hover:bg-white/10' : 'text-gray-400 hover:text-indigo-600'}`}
                                title="Düzenle"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                           <button 
                                onClick={() => handleDeleteService(s.id)} 
                                className={`transition-colors p-1 rounded hover:bg-black/5 ${isBlackAndWhite ? 'text-gray-500 hover:text-red-400 hover:bg-white/10' : 'text-gray-400 hover:text-red-500'}`}
                                title="Sil"
                           >
                               {ICONS.Trash}
                           </button>
                      </div>
                      
                      <div className="flex items-center gap-3 mb-2 pl-6">
                          <h3 className={`font-bold text-lg ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>{s.name}</h3>
                      </div>
                      <div className={`space-y-2 text-sm mt-4 p-3 rounded-lg ml-6 ${isBlackAndWhite ? '!bg-slate-800 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                         <div className="flex justify-between items-center"><span className={`text-xs font-semibold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-400'}`}>Kişi Sayısı</span><span className={`font-bold px-2 py-0.5 rounded shadow-sm border ${isBlackAndWhite ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white text-gray-900 border-gray-200'}`}>{s.minDailyCount}-{s.maxDailyCount}</span></div>
                         {s.allowedUnits && s.allowedUnits.length > 0 && (
                            <div className="flex justify-between items-start"><span className={`text-xs font-semibold uppercase tracking-wide mt-0.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-400'}`}>Branşlar</span><span className="font-mono text-xs text-right max-w-[120px]">{s.allowedUnits.join(', ')}</span></div>
                         )}
                      </div>
                    </Card>
                </div>
              ))}
            </div>

            {/* EDIT SERVICE MODAL */}
            {editingService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 text-white' : 'border-gray-200'}`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                            <h3 className="font-bold text-lg">Servis Düzenle</h3>
                            <button onClick={() => setEditingService(null)} className="p-1 rounded-full hover:bg-black/10"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Servis Adı</label>
                                <input type="text" value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} className={inputClass} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Min Kişi</label>
                                    <input type="number" value={editingService.minDailyCount} onChange={e => setEditingService({...editingService, minDailyCount: parseInt(e.target.value)})} className={inputClass} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Max Kişi</label>
                                    <input type="number" value={editingService.maxDailyCount} onChange={e => setEditingService({...editingService, maxDailyCount: parseInt(e.target.value)})} className={inputClass} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className={`block text-xs font-bold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Zorunlu Branşlar</label>
                                <MultiSelect label="Tüm Branşlar" options={uniqueStaffUnits} selected={editingService.allowedUnits || []} onChange={(vals) => setEditingService({...editingService, allowedUnits: vals})} />
                            </div>
                        </div>
                        <div className={`p-4 border-t flex justify-end gap-3 ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                            <Button variant="ghost" onClick={() => setEditingService(null)} className={isBlackAndWhite ? 'text-gray-400 hover:text-white' : ''}>İptal</Button>
                            <Button onClick={handleUpdateService}>Değişiklikleri Kaydet</Button>
                        </div>
                    </div>
                </div>
            )}
          </div>
    );
};

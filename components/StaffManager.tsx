
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Staff, RoleConfig } from '../types';
import { Card, Button, DateSelectModal } from './ui';
import { RefreshCw, FileJson, Upload, CheckCircle2, Circle, Stethoscope, DoorOpen, Layers, X, UserPlus, Trash2, Users, AlertCircle } from 'lucide-react';

interface StaffManagerProps {
    staff: Staff[];
    setStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
    roleConfigs: Record<number, RoleConfig>;
    setRoleConfigs: React.Dispatch<React.SetStateAction<Record<number, RoleConfig>>>;
    handleResetData: () => void;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    generateTemplate: () => void;
    handleImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleExportBackup: () => void;
    isBlackAndWhite: boolean;
    daysInMonth: number;
}

export const StaffManager: React.FC<StaffManagerProps> = ({
    staff, setStaff, roleConfigs, setRoleConfigs,
    handleResetData, handleFileUpload, generateTemplate,
    handleImportBackup, handleExportBackup, isBlackAndWhite, daysInMonth
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backupInputRef = useRef<HTMLInputElement>(null);
    const [newStaff, setNewStaff] = useState<Partial<Staff>>({ 
        name: '', role: 2, unit: 'Genel Cerrahi', room: '', group: 'A', quotaService: 7, quotaEmergency: 0, weekendLimit: 2, offDays: [], requestedDays: [], isActive: true
    });

    const [dateModal, setDateModal] = useState<{ isOpen: boolean, staffId: string, type: 'off' | 'request' } | null>(null);

    // Bulk Edit State
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkUnit, setBulkUnit] = useState<string>('ALL'); // Default to ALL
    const [bulkQuota, setBulkQuota] = useState<string>('7'); 
    const [bulkWeekend, setBulkWeekend] = useState<string>('2'); 

    // Extract unique units for dropdown, normalize spaces
    const uniqueUnits = useMemo(() => {
        const units = new Set(staff.map(s => (s.unit || "").trim()));
        return Array.from(units).filter((u: string) => u.length > 0).sort();
    }, [staff]);

    // Calculate affected staff count for preview based on EXACT match or ALL
    const affectedCount = useMemo(() => {
        if (bulkUnit === 'ALL') return staff.length;
        return staff.filter(s => (s.unit || "").trim() === bulkUnit).length;
    }, [staff, bulkUnit]);

    const handleAddStaff = () => {
        if (!newStaff.name) return;
        setStaff(prev => [...prev, { ...newStaff, id: Date.now().toString(), isActive: true } as Staff]);
        setNewStaff({ name: '', role: 2, unit: 'Genel Cerrahi', room: '', group: 'A', quotaService: 7, quotaEmergency: 0, weekendLimit: 2, offDays: [], requestedDays: [], isActive: true });
    };

    const handleDeleteStaff = (e: React.MouseEvent, id: string) => {
        // Stop propagation strictly to prevent card click issues
        e.preventDefault();
        e.stopPropagation();
        
        if(window.confirm("Bu personeli silmek istediğinize emin misiniz?")) {
            setStaff(prev => prev.filter(s => s.id !== id));
        }
    };
    
    const toggleStaffActive = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setStaff(prev => prev.map(s => {
            if (s.id === id) {
                return { ...s, isActive: !s.isActive };
            }
            return s;
        }));
    };

    const openDateModal = (staffId: string, type: 'off' | 'request') => {
        setDateModal({ isOpen: true, staffId, type });
    };

    const handleDateSave = (days: number[]) => {
        if (!dateModal) return;
        setStaff(prev => prev.map(s => {
            if (s.id === dateModal.staffId) {
                return dateModal.type === 'off' ? { ...s, offDays: days } : { ...s, requestedDays: days };
            }
            return s;
        }));
    };

    const applyBulkUpdate = () => {
        try {
            const targetQuota = parseInt(bulkQuota);
            const targetWeekend = parseInt(bulkWeekend);

            if (isNaN(targetQuota) || isNaN(targetWeekend)) {
                alert("Lütfen geçerli sayısal değerler giriniz.");
                return;
            }

            // 1. Identify Target IDs FIRST
            let targetIds: string[] = [];

            if (bulkUnit === 'ALL') {
                targetIds = staff.map(s => s.id);
            } else {
                targetIds = staff
                    .filter(s => (s.unit || "").trim() === bulkUnit)
                    .map(s => s.id);
            }

            if (targetIds.length === 0) {
                alert('Seçilen kriterlere uygun personel bulunamadı.');
                return;
            }

            // 2. Functional Update with ID lookup (Safe & Fast)
            // Removed window.confirm to streamline UX - the modal preview is enough warning.
            setStaff(prevStaff => prevStaff.map(s => {
                if (targetIds.includes(s.id)) {
                    return { 
                        ...s, 
                        quotaService: targetQuota, 
                        weekendLimit: targetWeekend 
                    };
                }
                return s;
            }));
            
            // 3. Close Modal Immediately
            setShowBulkModal(false);
            
        } catch (error) {
            console.error("Bulk update failed:", error);
            alert("Güncelleme sırasında bir hata oluştu.");
        }
    };

    const inputClass = `w-full rounded-lg shadow-sm p-2.5 border focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${
        isBlackAndWhite 
        ? '!bg-slate-800 !border-slate-700 text-white placeholder-slate-400' 
        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
    }`;
    
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Header */}
             <div className={`flex flex-col xl:flex-row justify-between items-end gap-4 p-6 rounded-xl border shadow-sm transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800' : 'bg-white border-gray-200'}`}>
              <div>
                <h2 className={`text-2xl font-bold ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Hemşire Yönetimi</h2>
                <p className={`mt-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Branş, salon ve kıdem bilgilerini buradan yönetin.</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-start xl:justify-end">
                 <input type="file" ref={backupInputRef} accept=".json" onChange={handleImportBackup} className="hidden" />
                 
                 <Button variant="secondary" onClick={() => setShowBulkModal(true)} className={`text-xs px-3 ${isBlackAndWhite ? '!bg-slate-800 text-white !border-slate-700 hover:!bg-slate-700' : ''}`}>
                    <Layers className="w-3.5 h-3.5" /> Toplu Düzenle
                 </Button>

                 <Button variant="secondary" onClick={() => backupInputRef.current?.click()} className={`text-xs px-3 ${isBlackAndWhite ? '!bg-slate-800 text-white !border-slate-700 hover:!bg-slate-700' : ''}`}>
                    <Upload className="w-3.5 h-3.5" /> Yedek Yükle
                 </Button>
                 <Button variant="secondary" onClick={handleExportBackup} className={`text-xs px-3 ${isBlackAndWhite ? '!bg-slate-800 text-white !border-slate-700 hover:!bg-slate-700' : ''}`}>
                    <FileJson className="w-3.5 h-3.5" /> Yedek Al
                 </Button>
                 <Button variant="danger" onClick={handleResetData} className="text-xs px-3">
                    <RefreshCw className="w-3.5 h-3.5" /> Sıfırla
                 </Button>
              </div>
            </div>

            {/* Manual Add Form */}
            <Card className={`p-6 border-l-4 transition-colors ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 border-l-indigo-500' : 'border-l-indigo-500'}`}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>AD SOYAD</label>
                        <input type="text" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} className={inputClass} placeholder="Hem. İsim Soyisim" />
                    </div>
                    <div className="md:col-span-2">
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>BRANŞ</label>
                        <select value={newStaff.unit} onChange={e => setNewStaff({...newStaff, unit: e.target.value})} className={inputClass}>
                            <option value="Genel Cerrahi">Genel Cerrahi</option>
                            <option value="KBB">KBB</option>
                            <option value="Beyin ve Ortopedi">Beyin ve Ortopedi</option>
                            <option value="Plastik">Plastik</option>
                            <option value="Transplantasyon">Transplantasyon</option>
                            <option value="Yara">Yara Bakım</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>SALON NO</label>
                        <input type="text" value={newStaff.room} onChange={e => setNewStaff({...newStaff, room: e.target.value})} className={inputClass} placeholder="Örn: 1" />
                    </div>
                    <div className="md:col-span-2">
                         <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>KIDEM</label>
                         <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: parseInt(e.target.value)})} className={inputClass}>
                            <option value={1}>1 - Kıdemli</option>
                            <option value={2}>2 - Tecrübeli</option>
                            <option value={3}>3 - Yeni/Çömez</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                         <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>HEDEF</label>
                         <input type="number" value={newStaff.quotaService} onChange={e => setNewStaff({...newStaff, quotaService: parseInt(e.target.value) || 0})} className={inputClass} />
                    </div>
                    <div className="md:col-span-1">
                         <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>HS LİMİT</label>
                         <input type="number" value={newStaff.weekendLimit} onChange={e => setNewStaff({...newStaff, weekendLimit: parseInt(e.target.value) || 0})} className={inputClass} />
                    </div>
                    <div className="md:col-span-1">
                        <Button onClick={handleAddStaff} className={`w-full h-[42px] ${isBlackAndWhite ? '!bg-indigo-600 !border-indigo-500 text-white' : ''}`}>
                            <UserPlus className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Staff List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {staff.length === 0 && (
                    <div className={`col-span-full py-12 text-center rounded-xl border border-dashed ${isBlackAndWhite ? 'border-slate-700 text-gray-500' : 'border-gray-300 text-gray-400'}`}>
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Henüz personel eklenmedi. Manuel ekleyebilir veya Excel/Yedek yükleyebilirsiniz.</p>
                    </div>
                )}
                {staff.map(person => (
                    <Card 
                        key={person.id} 
                        className={`p-4 relative group hover:shadow-lg transition-all border-l-4 ${
                            isBlackAndWhite 
                            ? `!bg-slate-900 !border-slate-800 !text-white ${person.isActive !== false ? 'border-l-indigo-500' : 'border-l-slate-700 opacity-60'}` 
                            : `${person.isActive !== false ? 'border-l-indigo-500' : 'border-l-gray-300 bg-gray-50 opacity-60'}`
                        }`}
                    >
                        {/* Z-Index increased to 20 to ensure it's above everything else */}
                        <button 
                            onClick={(e) => toggleStaffActive(e, person.id)} 
                            className={`absolute top-3 left-3 transition-colors z-20 p-1 rounded-full ${
                                person.isActive !== false 
                                ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50' 
                                : (isBlackAndWhite ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')
                            }`}
                            title={person.isActive !== false ? "Pasife Al" : "Aktifleştir"}
                        >
                            {person.isActive !== false ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        </button>
                        
                        <button 
                            onClick={(e) => handleDeleteStaff(e, person.id)} 
                            className={`absolute top-3 right-3 transition-colors z-20 p-1 rounded-full ${
                                isBlackAndWhite 
                                ? 'text-gray-600 hover:text-red-400 hover:bg-slate-800' 
                                : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                            }`}
                            title="Personeli Sil"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-3 ml-8">
                             <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                                 isBlackAndWhite 
                                 ? (person.isActive !== false ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-slate-500') 
                                 : (person.isActive !== false ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-400')
                             }`}>
                                 {person.name.charAt(0)}
                             </div>
                             <div className="min-w-0">
                                 <h4 className={`font-bold truncate pr-6 ${person.isActive === false && 'line-through'}`}>{person.name}</h4>
                                 <div className="flex flex-wrap gap-2 text-xs opacity-70 mt-1">
                                     <span className="flex items-center gap-1"><Stethoscope className="w-3 h-3"/> {person.unit}</span>
                                     <span>|</span>
                                     <span className="flex items-center gap-1"><DoorOpen className="w-3 h-3"/> {person.room ? `Salon ${person.room}` : 'Odasız'}</span>
                                 </div>
                             </div>
                        </div>

                        <div className={`grid grid-cols-3 gap-2 text-center text-xs p-2 rounded-lg mb-4 ${isBlackAndWhite ? 'bg-slate-800' : 'bg-white shadow-sm border border-gray-100'}`}>
                             <div>
                                 <div className={`font-bold ${person.isActive !== false ? 'text-indigo-500' : 'text-gray-400'}`}>{person.quotaService}</div>
                                 <div className="opacity-60">Hedef</div>
                             </div>
                             <div>
                                 <div className={`font-bold ${person.isActive !== false ? 'text-rose-500' : 'text-gray-400'}`}>{person.weekendLimit}</div>
                                 <div className="opacity-60">HS Limit</div>
                             </div>
                             <div>
                                 <div className={`font-bold ${person.isActive !== false ? 'text-purple-500' : 'text-gray-400'}`}>{person.role === 1 ? 'Kıdemli' : (person.role === 2 ? 'Tecrübeli' : 'Yeni')}</div>
                                 <div className="opacity-60">Seviye</div>
                             </div>
                        </div>

                        <div className="flex gap-2">
                             <Button variant="secondary" onClick={() => openDateModal(person.id, 'off')} disabled={person.isActive === false} className={`flex-1 text-xs h-8 ${isBlackAndWhite ? '!bg-slate-700 !border-slate-600 text-white hover:!bg-slate-600' : ''}`}>
                                 İzin ({person.offDays.length})
                             </Button>
                             <Button variant="secondary" onClick={() => openDateModal(person.id, 'request')} disabled={person.isActive === false} className={`flex-1 text-xs h-8 ${isBlackAndWhite ? '!bg-slate-700 !border-slate-600 text-white hover:!bg-slate-600' : ''}`}>
                                 İstek ({person.requestedDays.length})
                             </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Bulk Edit Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border ${isBlackAndWhite ? '!bg-slate-900 !border-slate-700' : 'border-gray-100'}`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isBlackAndWhite ? 'bg-slate-950 border-slate-800' : 'bg-gray-50'}`}>
                            <h3 className={`font-bold text-lg ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Toplu Hedef Düzenle</h3>
                            <button onClick={() => setShowBulkModal(false)} className={`p-1 rounded-full ${isBlackAndWhite ? 'hover:bg-slate-800' : 'hover:bg-gray-200'}`}><X className={`w-5 h-5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className={`text-sm ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-600'}`}>
                                Seçtiğiniz birime veya tüm personele ait nöbet hedeflerini tek seferde güncelleyin.
                            </p>
                            
                            <div className="space-y-2">
                                <label className={`block text-xs font-bold uppercase tracking-wide ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>BİRİM / KAPSAM</label>
                                <select value={bulkUnit} onChange={(e) => setBulkUnit(e.target.value)} className={inputClass}>
                                    <option value="ALL">TÜM BİRİMLER (Herkes)</option>
                                    {uniqueUnits.map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                                
                                <div className={`flex items-center gap-2 p-2 rounded-lg text-xs font-bold ${isBlackAndWhite ? 'bg-indigo-900/30 text-indigo-200 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Bu işlem {affectedCount} personeli etkileyecek.</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>YENİ HEDEF</label>
                                    <input type="number" value={bulkQuota} onChange={(e) => setBulkQuota(e.target.value)} className={inputClass} placeholder="7" />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>HS LİMİTİ</label>
                                    <input type="number" value={bulkWeekend} onChange={(e) => setBulkWeekend(e.target.value)} className={inputClass} placeholder="2" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                                <Button variant="ghost" onClick={() => setShowBulkModal(false)} className={isBlackAndWhite ? 'text-gray-400 hover:text-white hover:bg-slate-800' : ''}>İptal</Button>
                                <Button variant="primary" onClick={applyBulkUpdate}>Uygula</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {dateModal && (
                <DateSelectModal 
                    isOpen={dateModal.isOpen}
                    onClose={() => setDateModal(null)}
                    title={dateModal.type === 'off' ? 'İzinli Günleri Seç' : 'Nöbet İstenen Günleri Seç'}
                    selectedDays={dateModal.type === 'off' 
                        ? (staff.find(s => s.id === dateModal.staffId)?.offDays || []) 
                        : (staff.find(s => s.id === dateModal.staffId)?.requestedDays || [])
                    }
                    onSave={handleDateSave}
                    daysInMonth={daysInMonth}
                    color={dateModal.type
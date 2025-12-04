
import React, { useState, useRef, useMemo } from 'react';
import { Staff, RoleConfig, Specialty } from '../types';
import { Card, Button, DateSelectModal } from './ui';
import { RefreshCw, FileJson, Upload, CheckCircle2, Circle, Stethoscope, DoorOpen, Layers, X, UserPlus, Trash2, Users, AlertCircle, Star, Pencil } from 'lucide-react';

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
        name: '', role: 2, unit: 'Genel Cerrahi', specialty: 'none', room: '', quotaService: 2, quotaEmergency: 0, weekendLimit: 1, offDays: [], requestedDays: [], isActive: true
    });

    const [dateModal, setDateModal] = useState<{ isOpen: boolean, staffId: string, type: 'off' | 'request' } | null>(null);

    // Editing State
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

    // Bulk Edit State
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkUnit, setBulkUnit] = useState<string>('ALL'); // Default to ALL
    const [bulkRole, setBulkRole] = useState<string>('ALL'); // Default to ALL
    const [bulkQuota, setBulkQuota] = useState<string>('2'); 
    const [bulkWeekend, setBulkWeekend] = useState<string>('1'); 

    // Extract unique units for dropdown, normalize spaces
    const uniqueUnits = useMemo(() => {
        const units = new Set(staff.map(s => (s.unit || "").trim()));
        return Array.from(units).filter((u: string) => u.length > 0).sort();
    }, [staff]);

    // Calculate affected staff count for preview based on EXACT match or ALL
    const affectedCount = useMemo(() => {
        return staff.filter(s => {
            const unitMatch = bulkUnit === 'ALL' || (s.unit || "").trim() === bulkUnit;
            const roleMatch = bulkRole === 'ALL' || s.role.toString() === bulkRole;
            return unitMatch && roleMatch;
        }).length;
    }, [staff, bulkUnit, bulkRole]);

    const handleAddStaff = () => {
        if (!newStaff.name) return;
        setStaff(prev => [...prev, { ...newStaff, id: Date.now().toString(), isActive: true } as Staff]);
        setNewStaff({ name: '', role: 2, unit: 'Genel Cerrahi', specialty: 'none', room: '', quotaService: 2, quotaEmergency: 0, weekendLimit: 1, offDays: [], requestedDays: [], isActive: true });
    };

    const handleDeleteStaff = (e: React.MouseEvent, id: string) => {
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

    const handleEditSave = () => {
        if (!editingStaff) return;
        setStaff(prev => prev.map(s => s.id === editingStaff.id ? editingStaff : s));
        setEditingStaff(null);
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

            // Filter staff based on both Unit and Role
            const targetIds = staff.filter(s => {
                const unitMatch = bulkUnit === 'ALL' || (s.unit || "").trim() === bulkUnit;
                const roleMatch = bulkRole === 'ALL' || s.role.toString() === bulkRole;
                return unitMatch && roleMatch;
            }).map(s => s.id);

            if (targetIds.length === 0) {
                alert('Seçilen kriterlere uygun personel bulunamadı.');
                return;
            }

            setStaff(prevStaff => prevStaff.map(s => {
                if (targetIds.includes(s.id)) {
                    return { ...s, quotaService: targetQuota, weekendLimit: targetWeekend };
                }
                return s;
            }));
            
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
                    <div className="md:col-span-2">
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
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>ÖZELLİK DURUMU</label>
                        <select value={newStaff.specialty} onChange={e => setNewStaff({...newStaff, specialty: e.target.value as Specialty})} className={inputClass}>
                            <option value="none">Özellik Yok (Normal)</option>
                            <option value="transplant">Transplantasyon</option>
                            <option value="wound">Yara Bakım</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>SALON</label>
                        <input type="text" value={newStaff.room} onChange={e => setNewStaff({...newStaff, room: e.target.value})} className={inputClass} placeholder="No" />
                    </div>
                    <div className="md:col-span-2">
                         <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>KIDEM</label>
                         <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: parseInt(e.target.value)})} className={inputClass}>
                            <option value={1}>1 - Kıdemli</option>
                            <option value={2}>2 - Tecrübeli</option>
                            <option value={3}>3 - Yeni/Çömez</option>
                        </select>
                    </div>
                    <div className="md:col-span-2">
                         <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>HEDEF / HS</label>
                         <div className="flex gap-1">
                             <input type="number" value={newStaff.quotaService} onChange={e => setNewStaff({...newStaff, quotaService: parseInt(e.target.value) || 0})} className={inputClass} placeholder="Hedef" />
                             <input type="number" value={newStaff.weekendLimit} onChange={e => setNewStaff({...newStaff, weekendLimit: parseInt(e.target.value) || 0})} className={inputClass} placeholder="HS" />
                         </div>
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
                        <button 
                            onClick={(e) => toggleStaffActive(e, person.id)} 
                            className={`absolute top-3 left-3 transition-colors z-20 p-1 rounded-full ${
                                person.isActive !== false 
                                ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50' 
                                : (isBlackAndWhite ? 'text-slate-600 hover:text-slate-400 hover:bg-slate-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')
                            }`}
                        >
                            {person.isActive !== false ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        </button>
                        
                        {/* Edit Button */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setEditingStaff({...person}); }} 
                            className={`absolute top-3 right-10 transition-colors z-20 p-1 rounded-full ${
                                isBlackAndWhite 
                                ? 'text-gray-600 hover:text-indigo-400 hover:bg-slate-800' 
                                : 'text-gray-300 hover:text-indigo-500 hover:bg-indigo-50'
                            }`}
                            title="Personeli Düzenle"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>

                        <button 
                            onClick={(e) => handleDeleteStaff(e, person.id)} 
                            className={`absolute top-3 right-3 transition-colors z-20 p-1 rounded-full ${
                                isBlackAndWhite 
                                ? 'text-gray-600 hover:text-red-400 hover:bg-slate-800' 
                                : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                            }`}
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

                        {/* SPECIALTY BADGE */}
                        {person.specialty && person.specialty !== 'none' && (
                            <div className={`mb-3 ml-8 text-xs font-bold px-2 py-1 rounded inline-flex items-center gap-1 ${
                                person.specialty === 'transplant' 
                                ? (isBlackAndWhite ? 'bg-purple-900/50 text-purple-200 border border-purple-800' : 'bg-purple-100 text-purple-700 border border-purple-200')
                                : (isBlackAndWhite ? 'bg-orange-900/50 text-orange-200 border border-orange-800' : 'bg-orange-100 text-orange-700 border border-orange-200')
                            }`}>
                                <Star className="w-3 h-3" />
                                {person.specialty === 'transplant' ? 'Transplantasyon' : 'Yara Bakım'}
                            </div>
                        )}

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

            {/* Date Select Modal */}
            {dateModal && (
                <DateSelectModal
                    isOpen={dateModal.isOpen}
                    onClose={() => setDateModal(null)}
                    title={dateModal.type === 'off' ? 'İzinli Günleri Seçin' : 'Nöbet İsteği Seçin'}
                    selectedDays={staff.find(s => s.id === dateModal.staffId)?.[dateModal.type === 'off' ? 'offDays' : 'requestedDays'] || []}
                    onSave={handleDateSave}
                    daysInMonth={daysInMonth}
                    color={dateModal.type === 'off' ? 'red' : 'green'}
                />
            )}

            {/* Bulk Edit Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 text-white' : 'border-gray-200'}`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                            <h3 className="font-bold text-lg">Toplu Düzenle</h3>
                            <button onClick={() => setShowBulkModal(false)} className="p-1 rounded-full hover:bg-black/10"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Hangi Birim?</label>
                                <select value={bulkUnit} onChange={e => setBulkUnit(e.target.value)} className={inputClass}>
                                    <option value="ALL">TÜM BİRİMLER</option>
                                    {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Hangi Kıdem?</label>
                                <select value={bulkRole} onChange={e => setBulkRole(e.target.value)} className={inputClass}>
                                    <option value="ALL">TÜM KIDEMLER</option>
                                    <option value="1">1 - Kıdemli</option>
                                    <option value="2">2 - Tecrübeli</option>
                                    <option value="3">3 - Yeni/Çömez</option>
                                </select>
                                <div className={`text-xs mt-2 p-2 rounded ${isBlackAndWhite ? 'bg-blue-900/30 text-blue-200' : 'bg-blue-50 text-blue-700'}`}>
                                    Bu seçim <b>{affectedCount}</b> personeli etkileyecek.
                                </div>
                            </div>
                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Yeni Nöbet Hedefi</label>
                                <input type="number" value={bulkQuota} onChange={e => setBulkQuota(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Yeni Haftasonu Limiti</label>
                                <input type="number" value={bulkWeekend} onChange={e => setBulkWeekend(e.target.value)} className={inputClass} />
                            </div>
                        </div>
                        <div className={`p-4 border-t flex justify-end gap-3 ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                            <Button variant="ghost" onClick={() => setShowBulkModal(false)} className={isBlackAndWhite ? 'text-gray-400 hover:text-white' : ''}>İptal</Button>
                            <Button onClick={applyBulkUpdate}>Uygula</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Individual Edit Modal */}
            {editingStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 text-white' : 'border-gray-200'}`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                            <h3 className="font-bold text-lg">Personel Düzenle</h3>
                            <button onClick={() => setEditingStaff(null)} className="p-1 rounded-full hover:bg-black/10"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Ad Soyad</label>
                                    <input type="text" value={editingStaff.name} onChange={e => setEditingStaff({...editingStaff, name: e.target.value})} className={inputClass} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Branş</label>
                                    <input type="text" value={editingStaff.unit} onChange={e => setEditingStaff({...editingStaff, unit: e.target.value})} className={inputClass} list="unit-suggestions" />
                                    <datalist id="unit-suggestions">
                                        <option value="Genel Cerrahi" />
                                        <option value="KBB" />
                                        <option value="Beyin ve Ortopedi" />
                                        <option value="Plastik" />
                                    </datalist>
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Salon</label>
                                    <input type="text" value={editingStaff.room} onChange={e => setEditingStaff({...editingStaff, room: e.target.value})} className={inputClass} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Kıdem</label>
                                    <select value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: parseInt(e.target.value)})} className={inputClass}>
                                        <option value={1}>1 - Kıdemli</option>
                                        <option value={2}>2 - Tecrübeli</option>
                                        <option value={3}>3 - Yeni/Çömez</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Özellik Durumu</label>
                                    <select value={editingStaff.specialty || 'none'} onChange={e => setEditingStaff({...editingStaff, specialty: e.target.value as Specialty})} className={inputClass}>
                                        <option value="none">Özellik Yok (Normal)</option>
                                        <option value="transplant">Transplantasyon</option>
                                        <option value="wound">Yara Bakım</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Aylık Nöbet Hedefi</label>
                                    <input type="number" value={editingStaff.quotaService} onChange={e => setEditingStaff({...editingStaff, quotaService: parseInt(e.target.value) || 0})} className={inputClass} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Haftasonu Limit</label>
                                    <input type="number" value={editingStaff.weekendLimit} onChange={e => setEditingStaff({...editingStaff, weekendLimit: parseInt(e.target.value) || 0})} className={inputClass} />
                                </div>
                            </div>
                        </div>
                        <div className={`p-4 border-t flex justify-end gap-3 ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                            <Button variant="ghost" onClick={() => setEditingStaff(null)} className={isBlackAndWhite ? 'text-gray-400 hover:text-white' : ''}>İptal</Button>
                            <Button onClick={handleEditSave}>Değişiklikleri Kaydet</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

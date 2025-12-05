
import React, { useState, useRef, useMemo } from 'react';
import { Staff, RoleConfig, Specialty, Preset } from '../types';
import { Card, Button, DateSelectModal } from './ui';
import { RefreshCw, FileJson, Upload, CheckCircle2, Circle, Stethoscope, DoorOpen, Layers, X, UserPlus, Trash2, Users, AlertCircle, Star, Pencil, Settings2, Plus, LayoutTemplate, Save } from 'lucide-react';
import { importFromJSON } from '../services/backupService';

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
    // Dynamic Metadata
    customUnits: string[];
    setCustomUnits: React.Dispatch<React.SetStateAction<string[]>>;
    customSpecialties: string[];
    setCustomSpecialties: React.Dispatch<React.SetStateAction<string[]>>;
    
    // Preset Management
    onLoadPreset: (preset: Preset) => void;
    savedPresets: Preset[];
    onAddPreset: (preset: Preset) => void;
    onDeletePreset: (id: string) => void;
}

export const StaffManager: React.FC<StaffManagerProps> = ({
    staff, setStaff, roleConfigs, setRoleConfigs,
    handleResetData, handleFileUpload, generateTemplate,
    handleImportBackup, handleExportBackup, isBlackAndWhite, daysInMonth,
    customUnits, setCustomUnits, customSpecialties, setCustomSpecialties,
    onLoadPreset, savedPresets, onAddPreset, onDeletePreset
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backupInputRef = useRef<HTMLInputElement>(null);
    const presetFileInputRef = useRef<HTMLInputElement>(null);
    
    const [newStaff, setNewStaff] = useState<Partial<Staff>>({ 
        name: '', role: 2, unit: customUnits[0] || 'Genel Cerrahi', specialty: 'none', room: '', quotaService: 2, weekendLimit: 1, offDays: [], requestedDays: [], isActive: true
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
    
    // Metadata Edit State
    const [showMetaModal, setShowMetaModal] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');
    const [newSpecialtyName, setNewSpecialtyName] = useState('');

    // Preset Modal State
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    // Extract unique units for dropdown (Combined with custom units to ensure all are shown)
    const uniqueUnits = useMemo(() => {
        // Just use the passed customUnits which should be the source of truth
        return customUnits;
    }, [customUnits]);

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
        setNewStaff({ name: '', role: 2, unit: customUnits[0] || 'Genel Cerrahi', specialty: 'none', room: '', quotaService: 2, weekendLimit: 1, offDays: [], requestedDays: [], isActive: true });
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
    
    // Metadata Management Handlers
    const addUnit = () => {
        if(!newUnitName.trim()) return;
        if(customUnits.includes(newUnitName.trim())) { alert('Bu birim zaten var.'); return; }
        setCustomUnits([...customUnits, newUnitName.trim()]);
        setNewUnitName('');
    };

    const removeUnit = (name: string) => {
        if(window.confirm(`${name} birimini silmek istediğinize emin misiniz?`)) {
            setCustomUnits(customUnits.filter(u => u !== name));
        }
    };

    const addSpecialty = () => {
        if(!newSpecialtyName.trim()) return;
        if(customSpecialties.includes(newSpecialtyName.trim())) { alert('Bu özellik zaten var.'); return; }
        setCustomSpecialties([...customSpecialties, newSpecialtyName.trim()]);
        setNewSpecialtyName('');
    };

    const removeSpecialty = (name: string) => {
         if(window.confirm(`${name} özelliğini silmek istediğinize emin misiniz?`)) {
            setCustomSpecialties(customSpecialties.filter(s => s !== name));
        }
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

    const handleUploadAndCreatePreset = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // LIMIT 1: Max 4 Presets
        if (savedPresets.length >= 4) {
            alert("En fazla 4 adet şablon kaydedebilirsiniz. Lütfen yeni şablon eklemeden önce mevcut bir şablonu silin.");
            if (presetFileInputRef.current) presetFileInputRef.current.value = "";
            return;
        }

        if (!newPresetName.trim()) {
            alert("Lütfen önce şablon için bir isim giriniz.");
            if (presetFileInputRef.current) presetFileInputRef.current.value = "";
            return;
        }

        if (e.target.files && e.target.files[0]) {
            try {
                // Use the backup service logic to parse the complete app state
                const data = await importFromJSON(e.target.files[0]);
                
                // LIMIT 2: Max 300 Staff
                if (data.staff && data.staff.length > 300) {
                    alert("Şablon dosyası en fazla 300 personel içerebilir. Bu dosya limiti aşıyor.");
                    if (presetFileInputRef.current) presetFileInputRef.current.value = "";
                    return;
                }

                // LIMIT 3: Max 10 Services
                if (data.services && data.services.length > 10) {
                    alert("Şablon dosyası en fazla 10 servis içerebilir. Bu dosya limiti aşıyor.");
                    if (presetFileInputRef.current) presetFileInputRef.current.value = "";
                    return;
                }

                const newPreset: Preset = {
                    id: `preset_${Date.now()}`,
                    name: newPresetName.trim(),
                    description: `Oluşturulma: ${new Date().toLocaleDateString()}`,
                    staff: data.staff,
                    services: data.services,
                    customUnits: data.customUnits || [],
                    customSpecialties: data.customSpecialties || [],
                    dailyTotalTarget: data.config.dailyTotalTarget || 6,
                    unitConstraints: data.unitConstraints || []
                };

                onAddPreset(newPreset);
                setNewPresetName('');
                if (presetFileInputRef.current) presetFileInputRef.current.value = "";
                alert('Şablon başarıyla kütüphaneye eklendi.');
                
            } catch (error) {
                alert("Dosya geçersiz veya bozuk.");
                console.error(error);
                if (presetFileInputRef.current) presetFileInputRef.current.value = "";
            }
        }
    };

    const handlePresetSelect = (preset: Preset) => {
        if(window.confirm(`"${preset.name}" şablonunu yüklemek mevcut tüm verilerinizi silecek. Onaylıyor musunuz?`)) {
            onLoadPreset(preset);
            setShowPresetModal(false);
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
                 
                 <Button variant="secondary" onClick={() => setShowMetaModal(true)} className={`text-xs px-3 ${isBlackAndWhite ? '!bg-slate-800 text-white !border-slate-700 hover:!bg-slate-700' : ''}`}>
                    <Settings2 className="w-3.5 h-3.5" /> Ayarlar (Birim/Özellik)
                 </Button>

                 <Button variant="secondary" onClick={() => setShowBulkModal(true)} className={`text-xs px-3 ${isBlackAndWhite ? '!bg-slate-800 text-white !border-slate-700 hover:!bg-slate-700' : ''}`}>
                    <Layers className="w-3.5 h-3.5" /> Toplu Düzenle
                 </Button>

                 <Button variant="secondary" onClick={() => setShowPresetModal(true)} className={`text-xs px-3 ${isBlackAndWhite ? '!bg-slate-800 text-white !border-slate-700 hover:!bg-slate-700' : ''}`}>
                    <LayoutTemplate className="w-3.5 h-3.5" /> Şablon Kütüphanesi
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
                            {customUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>ÖZELLİK DURUMU</label>
                        <select value={newStaff.specialty} onChange={e => setNewStaff({...newStaff, specialty: e.target.value as Specialty})} className={inputClass}>
                            <option value="none">Özellik Yok (Normal)</option>
                            {customSpecialties.map(s => <option key={s} value={s}>{s}</option>)}
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
                                person.specialty === 'Transplantasyon' 
                                ? (isBlackAndWhite ? 'bg-purple-900/50 text-purple-200 border border-purple-800' : 'bg-purple-100 text-purple-700 border border-purple-200')
                                : (isBlackAndWhite ? 'bg-orange-900/50 text-orange-200 border border-orange-800' : 'bg-orange-100 text-orange-700 border border-orange-200')
                            }`}>
                                <Star className="w-3 h-3" />
                                {person.specialty}
                            </div>
                        )}

                        <div className={`grid grid-cols-2 gap-2 text-center text-xs p-2 rounded-lg mb-4 ${isBlackAndWhite ? 'bg-slate-800' : 'bg-white shadow-sm border border-gray-100'}`}>
                             <div>
                                 <div className={`font-bold ${person.isActive !== false ? 'text-indigo-500' : 'text-gray-400'}`}>{person.quotaService}</div>
                                 <div className="opacity-60">Hedef</div>
                             </div>
                             <div>
                                 <div className={`font-bold ${person.isActive !== false ? 'text-rose-500' : 'text-gray-400'}`}>{person.weekendLimit}</div>
                                 <div className="opacity-60">HS Limit</div>
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

            {/* Metadata (Units & Specialties) Manager Modal */}
            {showMetaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                     <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in border ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 text-white' : 'border-gray-200'}`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                            <h3 className="font-bold text-lg">Birim & Özellik Ayarları</h3>
                            <button onClick={() => setShowMetaModal(false)} className="p-1 rounded-full hover:bg-black/10"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto">
                            
                            {/* UNITS SECTION */}
                            <div>
                                <h4 className="font-bold text-sm uppercase mb-3 text-indigo-500">Birimler (Branşlar)</h4>
                                <div className="flex gap-2 mb-4">
                                    <input 
                                        type="text" 
                                        value={newUnitName} 
                                        onChange={(e) => setNewUnitName(e.target.value)}
                                        placeholder="Yeni birim adı..."
                                        className={inputClass}
                                    />
                                    <Button onClick={addUnit} disabled={!newUnitName} className="px-3">
                                        <Plus className="w-4 h-4"/>
                                    </Button>
                                </div>
                                <div className={`border rounded-lg overflow-hidden ${isBlackAndWhite ? 'border-slate-700' : 'border-gray-200'}`}>
                                    {customUnits.map(unit => (
                                        <div key={unit} className={`flex justify-between items-center p-2.5 text-sm border-b last:border-0 ${isBlackAndWhite ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-white'}`}>
                                            <span>{unit}</span>
                                            <button onClick={() => removeUnit(unit)} className="text-red-400 hover:text-red-600 p-1"><X className="w-3.5 h-3.5"/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SPECIALTIES SECTION */}
                            <div>
                                <h4 className="font-bold text-sm uppercase mb-3 text-purple-500">Özellikler (Sertifikalar)</h4>
                                <div className="flex gap-2 mb-4">
                                    <input 
                                        type="text" 
                                        value={newSpecialtyName} 
                                        onChange={(e) => setNewSpecialtyName(e.target.value)}
                                        placeholder="Yeni özellik adı..."
                                        className={inputClass}
                                    />
                                    <Button onClick={addSpecialty} disabled={!newSpecialtyName} className="px-3">
                                        <Plus className="w-4 h-4"/>
                                    </Button>
                                </div>
                                <div className={`border rounded-lg overflow-hidden ${isBlackAndWhite ? 'border-slate-700' : 'border-gray-200'}`}>
                                    {customSpecialties.map(spec => (
                                        <div key={spec} className={`flex justify-between items-center p-2.5 text-sm border-b last:border-0 ${isBlackAndWhite ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-white'}`}>
                                            <span>{spec}</span>
                                            <button onClick={() => removeSpecialty(spec)} className="text-red-400 hover:text-red-600 p-1"><X className="w-3.5 h-3.5"/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                        <div className={`p-4 border-t flex justify-end gap-3 ${isBlackAndWhite ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                            <Button onClick={() => setShowMetaModal(false)}>Tamam</Button>
                        </div>
                     </div>
                </div>
            )}

            {/* PRESET SELECTION MODAL (LIBRARY) */}
            {showPresetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-in border flex flex-col md:flex-row h-[70vh] ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 text-white' : 'border-gray-200'}`}>
                        
                        {/* LEFT SIDE: SAVED PRESETS */}
                        <div className={`w-full md:w-1/2 flex flex-col border-r ${isBlackAndWhite ? 'border-slate-700' : 'border-gray-200'}`}>
                             <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isBlackAndWhite ? 'bg-slate-950 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <LayoutTemplate className="w-5 h-5 text-indigo-500" /> Şablon Kütüphanesi
                                </h3>
                             </div>
                             <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {savedPresets.length === 0 ? (
                                    <div className="text-center py-10 opacity-50 text-sm">
                                        <Save className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                                        <p>Henüz kayıtlı şablonunuz yok.<br/>Yedek dosyalarınızı ekleyerek başlayın.</p>
                                    </div>
                                ) : (
                                    savedPresets.map(preset => (
                                        <div 
                                            key={preset.id}
                                            className={`p-3 rounded-xl border transition-all hover:shadow-md ${isBlackAndWhite ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-sm truncate pr-2">{preset.name}</h4>
                                                <button onClick={() => onDeletePreset(preset.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                    <X className="w-3.5 h-3.5"/>
                                                </button>
                                            </div>
                                            <div className="flex gap-2 mb-3">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isBlackAndWhite ? 'bg-slate-900 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                                    {preset.staff.length} Personel
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${isBlackAndWhite ? 'bg-slate-900 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                                    {preset.services.length} Servis
                                                </span>
                                            </div>
                                            <Button onClick={() => handlePresetSelect(preset)} className={`w-full text-xs h-8 ${isBlackAndWhite ? '!bg-indigo-600' : ''}`}>
                                                Yükle
                                            </Button>
                                        </div>
                                    ))
                                )}
                             </div>
                        </div>

                        {/* RIGHT SIDE: ADD NEW PRESET */}
                        <div className={`w-full md:w-1/2 flex flex-col ${isBlackAndWhite ? 'bg-slate-900' : 'bg-white'}`}>
                            <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isBlackAndWhite ? 'bg-slate-950 border-slate-700' : 'bg-gray-50 border-gray-100'}`}>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-emerald-500" /> Yeni Şablon Ekle
                                </h3>
                                <button onClick={() => setShowPresetModal(false)} className="p-1 rounded-full hover:bg-black/10 md:hidden"><X className="w-5 h-5" /></button>
                                <button onClick={() => setShowPresetModal(false)} className="hidden md:block p-1 rounded-full hover:bg-black/10"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 flex flex-col gap-4">
                                <p className={`text-sm ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Bilgisayarınızdaki bir yedek dosyasını (.json) kütüphaneye ekleyerek her zaman erişilebilir hale getirin.
                                </p>
                                
                                <div className="space-y-3 mt-2">
                                    <div>
                                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Şablon Adı</label>
                                        <input 
                                            type="text" 
                                            value={newPresetName} 
                                            onChange={(e) => setNewPresetName(e.target.value)} 
                                            placeholder="Örn: Acil Servis Kış Düzeni" 
                                            className={inputClass} 
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Yedek Dosyası (.json)</label>
                                        <input 
                                            type="file" 
                                            ref={presetFileInputRef}
                                            accept=".json"
                                            onChange={handleUploadAndCreatePreset} 
                                            className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:cursor-pointer transition-colors ${
                                                isBlackAndWhite 
                                                ? 'file:bg-slate-800 file:text-white hover:file:bg-slate-700 text-gray-400' 
                                                : 'file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-gray-500'
                                            }`} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
                                    {customUnits.map(u => <option key={u} value={u}>{u}</option>)}
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
                                    <select value={editingStaff.unit} onChange={e => setEditingStaff({...editingStaff, unit: e.target.value})} className={inputClass}>
                                         {customUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
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
                                        {customSpecialties.map(s => <option key={s} value={s}>{s}</option>)}
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

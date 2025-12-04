import React, { useState, useEffect, useMemo } from 'react';
import { Scheduler } from './services/scheduler';
import { readStaffFromExcel } from './services/excelService';
import { exportToExcel, generateTemplate } from './services/excelService';
import { exportToJSON, importFromJSON } from './services/backupService';
import { generateShareLink, parseShareLink } from './services/shareService';
import { Staff, Service, RoleConfig, ScheduleResult, UnitConstraint } from './types';
import { ICONS, MOCK_STAFF, MOCK_SERVICES, DEFAULT_UNIT_CONSTRAINTS } from './constants';
import { Card, Button } from './components/ui';
import { Moon, Sun, ShieldCheck, CheckCircle2, BrainCircuit, Info, X, Check, Eye, Link as LinkIcon, Copy, Zap, FileSpreadsheet, MousePointerClick } from 'lucide-react';
import { StaffManager } from './components/StaffManager';
import { ServiceManager } from './components/ServiceManager';
import { ScheduleViewer } from './components/ScheduleViewer';

// Helper for LocalStorage - Robust to null/undefined/errors/type mismatches
const loadState = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    
    const parsed = JSON.parse(stored);
    
    // Safety checks
    if (parsed === null || parsed === undefined) return defaultValue;
    
    // Critical: If default is an array, ensure parsed is also an array
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
        console.warn(`Data corruption detected for key "${key}". Expected array, got something else. Resetting to default.`);
        return defaultValue;
    }
    
    return parsed;
  } catch (e) {
    console.error(`Error loading key ${key}`, e);
    return defaultValue;
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'staff' | 'services' | 'generate'>('staff');
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // --- PERSISTENT STATE ---
  // Load staff and ensure every staff member has 'isActive' property (migration for old data)
  const [staff, setStaff] = useState<Staff[]>(() => {
      const loaded = loadState('nobet_staff', MOCK_STAFF as unknown as Staff[]);
      return loaded.map(s => ({ ...s, isActive: s.isActive !== undefined ? s.isActive : true }));
  });

  const [services, setServices] = useState<Service[]>(() => loadState('nobet_services', MOCK_SERVICES as unknown as Service[]));
  const [roleConfigs, setRoleConfigs] = useState<Record<number, RoleConfig>>(() => loadState('nobet_roleConfigs', {}));
  const [unitConstraints, setUnitConstraints] = useState<UnitConstraint[]>(() => loadState('nobet_constraints', DEFAULT_UNIT_CONSTRAINTS));
  
  // Generator Config Persistence
  const [month, setMonth] = useState(() => loadState('nobet_month', new Date().getMonth()));
  const [year, setYear] = useState(() => loadState('nobet_year', new Date().getFullYear()));
  const [randomizeDays, setRandomizeDays] = useState(() => loadState('nobet_randomize', true));
  const [preventEveryOther, setPreventEveryOther] = useState(() => loadState('nobet_preventEveryOther', true));
  const [isBlackAndWhite, setIsBlackAndWhite] = useState(() => loadState('nobet_bw_theme', false));

  // --- NON-PERSISTENT STATE ---
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [monteCarloIters] = useState(1000); 

  // --- READ ONLY / SHARE MODE STATE ---
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  // --- EFFECTS ---
  // Sync Body Background for full immersion
  useEffect(() => {
    if (isBlackAndWhite) {
      document.body.style.backgroundColor = '#020617'; // slate-950
      document.documentElement.classList.add('high-contrast'); // Add class to root for index.css targeting
    } else {
      document.body.style.backgroundColor = '#f3f4f6'; // gray-100
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isBlackAndWhite]);

  // Load Share Data on Mount
  useEffect(() => {
      const shareData = parseShareLink();
      if (shareData) {
          setIsReadOnly(true);
          setStaff(shareData.staff);
          setServices(shareData.services);
          setResult(shareData.result);
          setMonth(shareData.month);
          setYear(shareData.year);
          setActiveTab('generate'); // Force view
      }
  }, []);

  // Save state only if NOT in read-only mode
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_staff', JSON.stringify(staff)); }, [staff, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_services', JSON.stringify(services)); }, [services, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_roleConfigs', JSON.stringify(roleConfigs)); }, [roleConfigs, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_constraints', JSON.stringify(unitConstraints)); }, [unitConstraints, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_month', JSON.stringify(month)); }, [month, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_year', JSON.stringify(year)); }, [year, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_randomize', JSON.stringify(randomizeDays)); }, [randomizeDays, isReadOnly]);
  useEffect(() => { if(!isReadOnly) localStorage.setItem('nobet_preventEveryOther', JSON.stringify(preventEveryOther)); }, [preventEveryOther, isReadOnly]);
  useEffect(() => { localStorage.setItem('nobet_bw_theme', JSON.stringify(isBlackAndWhite)); }, [isBlackAndWhite]); // Theme is always local pref

  // Ensure role configs
  const uniqueRoles = useMemo(() => {
    if (!Array.isArray(staff)) return [];
    return Array.from(new Set(staff.map(s => s.role))).sort((a: number, b: number) => a - b);
  }, [staff]);

  useEffect(() => {
     if(isReadOnly) return;
     let changed = false;
     const newConfigs = { ...roleConfigs };
     uniqueRoles.forEach(r => {
         if (!newConfigs[r]) {
             newConfigs[r] = { role: r, quotaService: 5, quotaEmergency: 2, weekendLimit: 2 };
             changed = true;
         }
     });
     if (changed) setRoleConfigs(newConfigs);
  }, [uniqueRoles, roleConfigs, isReadOnly]);

  const handleResetData = () => {
      if (window.confirm("Tüm veriler (Personel, Servisler, Ayarlar) silinip varsayılan verilere dönülecek. Emin misiniz?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          try {
              const importedStaff = await readStaffFromExcel(e.target.files[0]);
              setStaff(importedStaff);
              alert(`${importedStaff.length} personel yüklendi. Hedefler ve kısıtlamalar Excel'den okundu.`);
          } catch (error) {
              alert('Dosya okunurken hata oluştu.');
          }
      }
  };

  const handleExportBackup = () => {
    exportToJSON(staff, services, roleConfigs, { month, year, randomizeDays, preventEveryOther }, unitConstraints);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        try {
            const data = await importFromJSON(e.target.files[0]);
            if (Array.isArray(data.staff)) setStaff(data.staff);
            if (Array.isArray(data.services)) setServices(data.services);
            if (data.roleConfigs) setRoleConfigs(data.roleConfigs);
            if (Array.isArray(data.unitConstraints)) setUnitConstraints(data.unitConstraints);
            if (data.config) {
                setMonth(data.config.month);
                setYear(data.config.year);
                setRandomizeDays(data.config.randomizeDays);
                setPreventEveryOther(data.config.preventEveryOther);
            }
            alert("Yedek başarıyla yüklendi!");
        } catch (error) {
            alert("Yedek yüklenirken hata oluştu.");
            console.error(error);
        }
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      try {
        const scheduler = new Scheduler(staff, services, {
          year, month, maxRetries: monteCarloIters, randomizeOrder: randomizeDays, preventEveryOtherDay: preventEveryOther, unitConstraints
        });
        const res = scheduler.generate();
        setResult(res);
      } catch (e) {
        console.error(e);
        alert("Çizelge oluşturulamadı. Lütfen kısıtlamaları kontrol edin veya personel sayısının yeterli olduğundan emin olun.");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const handleCreateShareLink = () => {
      if (!result) return;
      const link = generateShareLink(result, services, staff, year, month);
      setShareLink(link);
  };

  // Add the class to the OUTERMOST container
  return (
    <div className={`min-h-screen font-sans pb-20 transition-all duration-300 ${isBlackAndWhite ? 'bg-slate-950 text-slate-100 high-contrast' : 'bg-gray-100 text-gray-800'}`}>
      
      {/* Header */}
      <header className={`sticky top-0 z-30 mb-6 ${isBlackAndWhite ? '!bg-slate-900 !border-b border-slate-800 text-white' : 'bg-white border-b border-gray-200 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center py-4 gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className={`p-2 rounded-xl shrink-0 ${isBlackAndWhite ? 'bg-white text-black' : 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30'}`}>
                {ICONS.Shield}
              </div>
              <div className={isBlackAndWhite ? 'text-white' : ''}>
                <h1 className="text-xl font-bold leading-none tracking-tight">Nöbetmatik</h1>
                <span className={`text-xs font-bold tracking-wider uppercase ${isBlackAndWhite ? 'text-slate-400' : 'text-indigo-600'}`}>Enterprise Edition</span>
              </div>
              {isReadOnly && (
                  <div className="ml-4 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold uppercase rounded-full border border-amber-300 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Salt Okunur
                  </div>
              )}
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {/* Hide Nav in Read Only Mode */}
              {!isReadOnly && (
                  <nav className={`flex p-1 rounded-xl shrink-0 ${isBlackAndWhite ? '!bg-slate-800' : 'bg-gray-100 border border-gray-200'}`}>
                    {(['staff', 'services', 'generate'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 md:px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                          activeTab === tab 
                            ? (isBlackAndWhite ? 'bg-slate-700 text-white shadow' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200') 
                            : (isBlackAndWhite ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')
                        }`}
                      >
                        {tab === 'staff' && 'Personel'}
                        {tab === 'services' && 'Servisler'}
                        {tab === 'generate' && 'Çizelge'}
                      </button>
                    ))}
                  </nav>
              )}
              <div className="flex items-center gap-2">
                  <button 
                      onClick={() => setShowInfoModal(true)}
                      className={`p-2.5 rounded-full shrink-0 transition-all duration-200 ${isBlackAndWhite ? '!bg-slate-800 text-white border border-slate-700 hover:!bg-slate-700' : 'bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'}`}
                      title="Sistem Özellikleri"
                  >
                      <Info className="w-5 h-5"/>
                  </button>
                  <button 
                      onClick={() => setIsBlackAndWhite(!isBlackAndWhite)}
                      className={`p-2.5 rounded-full shrink-0 transition-all duration-200 ${isBlackAndWhite ? '!bg-slate-800 text-white border border-slate-700 hover:!bg-slate-700' : 'bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'}`}
                      title="Tema Değiştir"
                  >
                      {isBlackAndWhite ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
                  </button>
                  {isReadOnly && (
                      <button 
                        onClick={() => { window.location.href = window.location.origin + window.location.pathname; }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700`}
                      >
                        Yeni Oluştur
                      </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Share Link Modal */}
        {shareLink && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className={`bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg border ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 text-white' : 'border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><LinkIcon className="w-5 h-5"/> Bağlantı Oluşturuldu</h3>
                        <button onClick={() => setShareLink(null)}><X className="w-5 h-5"/></button>
                    </div>
                    <p className={`text-sm mb-4 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-600'}`}>Bu bağlantıyı paylaştığınız kişiler çizelgeyi sadece görüntüleyebilir, üzerinde değişiklik yapamazlar.</p>
                    
                    <div className={`flex items-center gap-2 p-2 rounded-lg border ${isBlackAndWhite ? '!bg-slate-800 !border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                        <input 
                            readOnly 
                            value={shareLink} 
                            className={`bg-transparent w-full text-xs outline-none ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-600'}`}
                        />
                        <button 
                            onClick={() => { navigator.clipboard.writeText(shareLink); alert('Kopyalandı!'); }}
                            className="p-2 hover:bg-white/10 rounded text-indigo-500"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1"><Info className="w-3 h-3"/> Not: Link çok uzun olabilir, WhatsApp gibi platformlarda sorunsuz çalışır.</p>
                </div>
            </div>
        )}

        {/* Info Modal */}
        {showInfoModal && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                 <div className={`relative rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in border ${isBlackAndWhite ? '!bg-slate-900 !border-slate-800 text-white' : 'bg-white border-gray-200'}`}>
                    <div className="sticky top-0 right-0 p-4 flex justify-end z-10">
                        <button onClick={() => setShowInfoModal(false)} className={`p-2 rounded-full ${isBlackAndWhite ? '!bg-slate-800 hover:!bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}><X className={`w-5 h-5 ${isBlackAndWhite ? 'text-white' : 'text-gray-600'}`}/></button>
                    </div>
                    <div className="p-8 pt-0">
                        <div className={`p-6 rounded-2xl mb-8 ${isBlackAndWhite ? '!bg-slate-800 text-white' : 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl'}`}>
                            <div className="flex items-center gap-2 mb-4">
                                <Info className="w-6 h-6" /> <span className="font-medium text-lg">Sistem Hakkında</span>
                            </div>
                            <h2 className="text-3xl font-bold mb-2">Akıllı Nöbet Algoritması v2.0</h2>
                            <p className="opacity-90">Nöbetmatik Enterprise, Monte Carlo simülasyonu ve yeni "Resource Preservation" (Kaynak Koruma) motoru ile milyonlarca kombinasyonu test ederek en adil sonucu bulur.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className={`p-6 border-l-4 rounded-r-xl ${isBlackAndWhite ? 'border-l-indigo-500 !bg-slate-800' : 'border-l-indigo-500 bg-indigo-50/50'}`}>
                                <div className="flex items-start gap-4">
                                    <BrainCircuit className="w-8 h-8 opacity-70 shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-xl mb-3">1. Akıllı & Adil Dağıtım</h3>
                                        <ul className="space-y-3 text-sm">
                                            <li className="flex gap-3 items-start"><Zap className="w-4 h-4 mt-0.5 shrink-0 opacity-70" /> <span><b>Kaynak Koruma:</b> Sistem, nadir bulunan kıdemli personeli basit nöbetlerde harcamaz, zor günlere saklar.</span></li>
                                            <li className="flex gap-3 items-start"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 opacity-70" /> <span><b>Zorluk Analizi:</b> Her gün, önce dolması en zor olan servisler (az kişinin tutabildiği) doldurulur.</span></li>
                                            <li className="flex gap-3 items-start"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 opacity-70" /> <span><b>İstek Nöbetleri:</b> İstek günlerine maksimum öncelik verilir.</span></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            <div className={`p-6 border-l-4 rounded-r-xl ${isBlackAndWhite ? 'border-l-rose-500 !bg-slate-800' : 'border-l-rose-500 bg-rose-50/50'}`}>
                                <div className="flex items-start gap-4">
                                    <ShieldCheck className="w-8 h-8 opacity-70 shrink-0" />
                                    <div>
                                        <h3 className="font-bold text-xl mb-3">2. Kesin Kısıtlamalar</h3>
                                        <ul className="space-y-3 text-sm">
                                            <li className="flex gap-3 items-start"><Check className="w-4 h-4 mt-0.5 shrink-0 opacity-70" /> <span><b>Kesin Kota Sınırı:</b> Belirlenen (Servis/Acil/Haftasonu) hedefler asla aşılmaz.</span></li>
                                            <li className="flex gap-3 items-start"><Check className="w-4 h-4 mt-0.5 shrink-0 opacity-70" /> <span><b>Zorunlu Grup Kuralı:</b> Servis için bir grup seçildiyse (Örn: A Grubu), başka gruptan kimse o nöbeti tutamaz.</span></li>
                                            <li className="flex gap-3 items-start"><Check className="w-4 h-4 mt-0.5 shrink-0 opacity-70" /> <span><b>Dinlenme Süresi:</b> Peş peşe gün nöbet yazılmaz (Günaşırı).</span></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`mt-6 p-6 border rounded-xl flex flex-col md:flex-row gap-6 items-center justify-between ${isBlackAndWhite ? '!bg-slate-800 !border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                             <div>
                                <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500"/> Yeni Özellikler</h3>
                                <ul className="space-y-2 text-sm opacity-80">
                                    <li className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4"/> <b>Matris Excel Çıktısı:</b> Personel bazlı aylık görünüm eklendi.</li>
                                    <li className="flex items-center gap-2"><MousePointerClick className="w-4 h-4"/> <b>Sürükle-Bırak:</b> Servisler sayfasında servislerin sırasını değiştirebilirsiniz.</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> <b>Aktif/Pasif:</b> Personel kartındaki tik ile kişiyi geçici olarak nöbetten çıkarabilirsiniz.</li>
                                </ul>
                             </div>
                             <div className="shrink-0 text-center px-4">
                                <div className="text-3xl font-black text-indigo-500">v2.1</div>
                                <div className="text-[10px] uppercase tracking-widest opacity-60">Enterprise</div>
                             </div>
                        </div>
                    </div>
                 </div>
             </div>
        )}
        
        {/* TAB: STAFF */}
        {activeTab === 'staff' && !isReadOnly && (
          <StaffManager 
            staff={staff} setStaff={setStaff} 
            roleConfigs={roleConfigs} setRoleConfigs={setRoleConfigs}
            handleResetData={handleResetData} handleFileUpload={handleFileUpload} generateTemplate={generateTemplate}
            handleImportBackup={handleImportBackup} handleExportBackup={handleExportBackup}
            isBlackAndWhite={isBlackAndWhite}
            daysInMonth={new Date(year, month + 1, 0).getDate()}
          />
        )}

        {/* TAB: SERVICES */}
        {activeTab === 'services' && !isReadOnly && (
          <ServiceManager 
            services={services} setServices={setServices} 
            staff={staff} 
            isBlackAndWhite={isBlackAndWhite}
            unitConstraints={unitConstraints}
            setUnitConstraints={setUnitConstraints}
          />
        )}

        {/* TAB: GENERATE / VIEW */}
        {(activeTab === 'generate' || isReadOnly) && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Generate Card - Hide in Read Only */}
             {!isReadOnly && (
                 <Card className={`p-8 ${isBlackAndWhite ? '!bg-slate-900 text-white !border-slate-700 border-2' : 'bg-white border-t-4 border-t-indigo-500'}`}>
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-gray-100 pb-6">
                      <div>
                        <h2 className={`text-2xl font-bold tracking-tight ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Nöbet Çizelgesi Oluştur</h2>
                        <p className={`mt-1 text-sm ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Gelişmiş Monte Carlo simülasyonu ile hesaplama.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                          <div className="flex gap-2 w-full sm:w-auto">
                            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className={`border rounded-xl p-3 focus:ring-2 outline-none font-medium cursor-pointer w-full ${isBlackAndWhite ? '!bg-slate-800 !border-slate-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-700 focus:ring-indigo-500'}`}>
                                {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{new Date(0, i).toLocaleString('tr-TR', {month: 'long'})}</option>)}
                            </select>
                            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className={`border rounded-xl p-3 focus:ring-2 outline-none font-medium cursor-pointer w-full ${isBlackAndWhite ? '!bg-slate-800 !border-slate-700 text-white' : 'border-gray-300'}`}>
                                {Array.from({ length: 18 }, (_, i) => 2023 + i).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isBlackAndWhite ? '!border-slate-700 hover:!bg-slate-800' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
                                <input type="checkbox" checked={randomizeDays} onChange={(e) => setRandomizeDays(e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className={`text-sm font-bold ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-700'}`}>Rastgele Gün Dağıtımı</span>
                            </label>
                            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isBlackAndWhite ? '!border-slate-700 hover:!bg-slate-800' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
                                <input type="checkbox" checked={preventEveryOther} onChange={(e) => setPreventEveryOther(e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                                <span className={`text-sm font-bold ${isBlackAndWhite ? 'text-gray-300' : 'text-gray-700'}`}>Günaşırı Koruması</span>
                            </label>
                        </div>

                        <Button onClick={handleGenerate} disabled={loading} className={`h-14 px-10 text-lg w-full sm:w-auto shadow-xl ${isBlackAndWhite ? 'bg-white text-black hover:bg-gray-200' : ''}`}>
                            {loading ? 'HESAPLANIYOR...' : 'LİSTEYİ OLUŞTUR'}
                        </Button>
                    </div>
                  </div>
                </Card>
             )}

            {result && (
                <ScheduleViewer 
                    result={result} setResult={setResult}
                    services={services} staff={staff} year={year} month={month}
                    isBlackAndWhite={isBlackAndWhite}
                    handleDownload={() => exportToExcel(result, services, year, month, staff)}
                    isReadOnly={isReadOnly}
                    onShare={handleCreateShareLink}
                />
            )}
           </div>
        )}
      </main>
    </div>
  );
}
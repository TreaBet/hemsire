
import React, { useState, useMemo, useEffect } from 'react';
import { ScheduleResult, Service, Staff, DaySchedule } from '../types';
import { Card, Button } from './ui';
import { ICONS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Edit3, Save, X, CheckCircle2, Share2, Clipboard, GripVertical, Pencil, RotateCcw, Search, AlertTriangle, Calendar as CalendarIcon, Download, Link as LinkIcon } from 'lucide-react';

interface ScheduleViewerProps {
    result: ScheduleResult;
    setResult: (res: ScheduleResult) => void;
    services: Service[];
    staff: Staff[];
    year: number;
    month: number;
    isBlackAndWhite: boolean;
    handleDownload: () => void;
    isReadOnly?: boolean;
    onShare?: () => void;
}

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({ result, setResult, services, staff, year, month, isBlackAndWhite, handleDownload, isReadOnly = false, onShare }) => {
    
    // --- Manual Edit State ---
    const [isEditing, setIsEditing] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{day: number, serviceId: string, currentStaffId: string} | null>(null);
    const [searchTerm, setSearchTerm] = useState(""); // Search in dropdown

    // --- History / Undo State ---
    const [history, setHistory] = useState<DaySchedule[][]>([]);

    // --- WhatsApp Modal State ---
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

    // --- Drag & Drop State ---
    const [dragData, setDragData] = useState<{day: number, serviceId: string, staffId: string} | null>(null);
    const [dragOverTarget, setDragOverTarget] = useState<{day: number, serviceId: string, staffId: string} | null>(null);

    // --- Stats Logic ---
    const chartData = useMemo(() => {
        if (!staff || !result) return [];
        return result.stats.map(s => {
          const p = staff.find(st => st.id === s.staffId);
          return {
            name: p?.name || '?',
            targetService: p?.quotaService || 0,
            actualService: s.serviceShifts,
            targetEmergency: p?.quotaEmergency || 0,
            actualEmergency: s.emergencyShifts
          };
        });
      }, [result, staff]);

    const fairnessScore = useMemo(() => {
        if (!staff || !result) return { stdDev: "0", reqRate: 0 };
        const totalShifts = result.stats.map(s => s.totalShifts);
        const mean = totalShifts.reduce((a,b) => a+b, 0) / totalShifts.length;
        const variance = totalShifts.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / totalShifts.length;
        const stdDev = Math.sqrt(variance);

        let totalReqs = 0;
        let metReqs = 0;
        staff.forEach(s => {
            totalReqs += s.requestedDays.length;
            s.requestedDays.forEach(day => {
                const daySchedule = result.schedule.find(ds => ds.day === day);
                if (daySchedule?.assignments.some(a => a.staffId === s.id)) metReqs++;
            });
        });
        const reqRate = totalReqs === 0 ? 100 : Math.round((metReqs / totalReqs) * 100);

        return { stdDev: stdDev.toFixed(2), reqRate };
    }, [result, staff]);


    // --- Helper Functions ---
    const addToHistory = () => {
        const snapshot = JSON.parse(JSON.stringify(result.schedule));
        setHistory(prev => [...prev.slice(-19), snapshot]); 
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousSchedule = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        recalculateStats(previousSchedule); 
    };

    const recalculateStats = (newSchedule: DaySchedule[]) => {
        const newStats = staff.map(s => {
            let total = 0, serviceCount = 0, emergency = 0, weekend = 0, sat = 0, sun = 0;
            newSchedule.forEach(day => {
                const assignment = day.assignments.find(a => a.staffId === s.id);
                if(assignment) {
                    total++;
                    if(assignment.isEmergency) emergency++; else serviceCount++;
                    const date = new Date(year, month, day.day);
                    const d = date.getDay();
                    if (d === 0 || d === 6) weekend++; 
                    if (d === 6) sat++;
                    if (d === 0) sun++;
                }
            });
            return {
              staffId: s.id,
              totalShifts: total,
              serviceShifts: serviceCount,
              emergencyShifts: emergency,
              weekendShifts: weekend,
              saturdayShifts: sat,
              sundayShifts: sun
            };
        });

        const unfilled = newSchedule.reduce((acc, day) => acc + day.assignments.filter(a => a.staffId === 'EMPTY').length, 0);

        setResult({
            ...result,
            schedule: newSchedule,
            stats: newStats,
            unfilledSlots: unfilled
        });
    };

    const handleUpdateAssignment = (newStaffId: string) => {
        if (!editingSlot) return;
        addToHistory();
        updateAssignment(editingSlot.day, editingSlot.serviceId, editingSlot.currentStaffId, newStaffId);
        setEditingSlot(null);
        setSearchTerm("");
    };

    const updateAssignment = (day: number, serviceId: string, oldStaffId: string, newStaffId: string) => {
        const newSchedule = [...result.schedule];
        const dayData = newSchedule.find(d => d.day === day);
        if(!dayData) return;

        const targetAssignmentIndex = dayData.assignments.findIndex(a => a.serviceId === serviceId && a.staffId === oldStaffId);
        if(targetAssignmentIndex === -1) return;

        const newStaffMember = staff.find(s => s.id === newStaffId);
        const isRemoving = newStaffId === 'EMPTY';

        const updatedAssignment = {
            ...dayData.assignments[targetAssignmentIndex],
            staffId: isRemoving ? 'EMPTY' : newStaffMember!.id,
            staffName: isRemoving ? 'BOŞ' : newStaffMember!.name,
            role: isRemoving ? 0 : newStaffMember!.role,
            group: isRemoving ? 'Genel' : newStaffMember!.group
        };

        dayData.assignments[targetAssignmentIndex] = updatedAssignment as any;
        recalculateStats(newSchedule);
    };

    const checkConsecutiveConflict = (staffId: string, currentDay: number): boolean => {
        const prevDay = result.schedule.find(d => d.day === currentDay - 1);
        const nextDay = result.schedule.find(d => d.day === currentDay + 1);

        const worksPrev = prevDay?.assignments.some(a => a.staffId === staffId) ?? false;
        const worksNext = nextDay?.assignments.some(a => a.staffId === staffId) ?? false;

        return worksPrev || worksNext;
    };

    const getAvailableStaffForEdit = () => {
        if(!editingSlot) return [];
        const daySchedule = result.schedule.find(s => s.day === editingSlot.day);
        const service = services.find(s => s.id === editingSlot.serviceId);
        if(!daySchedule || !service) return [];
        
        const assignedStaffIds = new Set(daySchedule.assignments.map(a => a.staffId));
        
        let candidates = staff.filter(s => {
            if (assignedStaffIds.has(s.id) && s.id !== editingSlot.currentStaffId) return false;
            if (!service.allowedRoles.includes(s.role)) return false;
            if (s.offDays.includes(editingSlot.day)) return false;
            return true;
        });

        if (searchTerm) {
            const lower = searchTerm.toLocaleLowerCase('tr-TR');
            candidates = candidates.filter(s => s.name.toLocaleLowerCase('tr-TR').includes(lower));
        }

        return candidates.map(s => ({
            ...s,
            hasConsecutiveConflict: checkConsecutiveConflict(s.id, editingSlot.day)
        }));
    };

    const copyWhatsAppMessage = (staffId: string) => {
        const person = staff.find(s => s.id === staffId);
        if (!person) return;

        const shifts = result.schedule
            .filter(d => d.assignments.some(a => a.staffId === staffId))
            .sort((a, b) => a.day - b.day)
            .map(d => {
                const date = new Date(year, month, d.day);
                const dayName = date.toLocaleString('tr-TR', { weekday: 'short' });
                const assignment = d.assignments.find(a => a.staffId === staffId);
                const role = assignment?.isEmergency ? 'Acil' : 'Servis';
                return `${d.day} (${dayName}) - ${role}`;
            });

        const text = `Sn. ${person.name}, ${new Date(year, month).toLocaleString('tr-TR', { month: 'long', year: 'numeric' })} Nöbetleriniz:\n\n${shifts.join('\n')}\n\nToplam: ${shifts.length} Nöbet.\nİyi çalışmalar.`;

        navigator.clipboard.writeText(text);
        alert(`${person.name} için nöbet mesajı kopyalandı!`);
    };

    // --- ICS Calendar Generation ---
    const generateICSFile = (staffId: string) => {
        const person = staff.find(s => s.id === staffId);
        if (!person) return;

        const shifts = result.schedule
            .filter(d => d.assignments.some(a => a.staffId === staffId))
            .map(d => {
                const date = new Date(year, month, d.day);
                const assignment = d.assignments.find(a => a.staffId === staffId);
                const serviceName = services.find(s => s.id === assignment?.serviceId)?.name || 'Nöbet';
                return { date, serviceName };
            });

        if (shifts.length === 0) {
            alert('Nöbet bulunamadı.');
            return;
        }

        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Nobetmatik//TR\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";
        
        shifts.forEach(shift => {
            const dateStr = shift.date.toISOString().replace(/[-:]/g, '').split('T')[0]; // YYYYMMDD
            // Create event for next day as end date (All day event)
            const nextDay = new Date(shift.date);
            nextDay.setDate(nextDay.getDate() + 1);
            const endDateStr = nextDay.toISOString().replace(/[-:]/g, '').split('T')[0];

            icsContent += "BEGIN:VEVENT\n";
            icsContent += `DTSTART;VALUE=DATE:${dateStr}\n`;
            icsContent += `DTEND;VALUE=DATE:${endDateStr}\n`;
            icsContent += `SUMMARY:Nöbet: ${shift.serviceName}\n`;
            icsContent += `DESCRIPTION:Nöbetmatik tarafından oluşturuldu.\n`;
            icsContent += "END:VEVENT\n";
        });

        icsContent += "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${person.name}_Nobetleri_${year}_${month+1}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDragStart = (e: React.DragEvent, day: number, serviceId: string, staffId: string) => {
        if(!isEditing) return;
        setDragData({ day, serviceId, staffId });
        e.dataTransfer.effectAllowed = 'move';
        // Optional: Set custom drag image if needed
    };

    const handleDragOver = (e: React.DragEvent) => {
        if(!isEditing) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e: React.DragEvent, day: number, serviceId: string, staffId: string) => {
        if(!isEditing || !dragData) return;
        // Don't highlight self
        if (dragData.day === day && dragData.serviceId === serviceId && dragData.staffId === staffId) return;
        setDragOverTarget({ day, serviceId, staffId });
    };

    const handleDragLeave = (e: React.DragEvent) => {
       // Typically handled by next Enter, or Drop.
    };

    const handleDrop = (e: React.DragEvent, targetDay: number, targetServiceId: string, targetStaffId: string) => {
        if(!isEditing || !dragData) return;
        e.preventDefault();
        setDragOverTarget(null);
        
        if (dragData.day === targetDay && dragData.serviceId === targetServiceId && dragData.staffId === targetStaffId) {
            setDragData(null);
            return;
        }

        addToHistory(); 

        const newSchedule = [...result.schedule];
        const sourceDay = newSchedule.find(d => d.day === dragData.day);
        const targetDayObj = newSchedule.find(d => d.day === targetDay);
        
        if(!sourceDay || !targetDayObj) return;

        const sourceIdx = sourceDay.assignments.findIndex(a => a.serviceId === dragData.serviceId && a.staffId === dragData.staffId);
        const targetIdx = targetDayObj.assignments.findIndex(a => a.serviceId === targetServiceId && a.staffId === targetStaffId);

        if(sourceIdx === -1 || targetIdx === -1) return;

        const sourceAssignment = sourceDay.assignments[sourceIdx];
        const targetAssignment = targetDayObj.assignments[targetIdx];

        sourceDay.assignments[sourceIdx] = {
            ...sourceAssignment,
            staffId: targetAssignment.staffId,
            staffName: targetAssignment.staffName,
            role: targetAssignment.role,
            group: targetAssignment.group
        };

        targetDayObj.assignments[targetIdx] = {
            ...targetAssignment,
            staffId: sourceAssignment.staffId,
            staffName: sourceAssignment.staffName,
            role: sourceAssignment.role,
            group: sourceAssignment.group
        };

        recalculateStats(newSchedule);
        setDragData(null);
    };

    const chartWidth = useMemo(() => {
        const minWidthPerBar = 80;
        return Math.max(100, chartData.length * minWidthPerBar);
    }, [chartData]);

    useEffect(() => {
        if (editingSlot) {
            const input = document.getElementById('staff-search-input');
            if(input) input.focus();
        }
    }, [editingSlot]);

    // DARK MODE DROPDOWN STYLES
    const dropdownClasses = isBlackAndWhite 
        ? "bg-slate-800 border border-slate-700 text-white shadow-2xl ring-1 ring-white/10"
        : "bg-white border border-gray-200 text-gray-800 shadow-xl ring-1 ring-black/5";
        
    const dropdownHeaderClasses = isBlackAndWhite
        ? "border-b border-slate-700 bg-slate-900/90 text-white"
        : "border-b border-gray-100 bg-gray-50/90 text-gray-900";
        
    const dropdownSearchClasses = isBlackAndWhite
        ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400"
        : "bg-white border-gray-200 text-gray-800 placeholder-gray-400";
        
    const dropdownItemClasses = (isActive: boolean) => {
        if (isBlackAndWhite) {
            return isActive 
                ? "bg-indigo-900/40 text-indigo-100 border border-indigo-700/50" 
                : "hover:bg-slate-700/80 text-slate-300 border border-transparent";
        }
        return isActive 
            ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
            : "hover:bg-gray-50 text-gray-700 border border-transparent";
    }

    // Determine colors for Unfilled Slots Card
    const unfilledCount = result.unfilledSlots;
    const isSuccess = unfilledCount === 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Scorecard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className={`p-4 md:p-5 border-l-4 shadow-sm transition-all hover:shadow-md ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 border-l-emerald-500 text-white' : 'border-l-emerald-500'}`}>
                     <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Toplam Atama</div>
                     <div className={`text-2xl md:text-3xl font-bold ${isBlackAndWhite ? 'text-emerald-400' : 'text-gray-900'}`}>
                       {result.schedule.reduce((acc, day) => acc + day.assignments.filter(a => a.staffId !== 'EMPTY').length, 0)}
                     </div>
                  </Card>
                  
                  {/* UNFILLED SLOTS CARD - DYNAMIC COLOR */}
                  <Card className={`p-4 md:p-5 border-l-4 shadow-sm transition-all hover:shadow-md ${isBlackAndWhite 
                        ? (isSuccess ? 'bg-slate-900 border-slate-700 border-l-emerald-500 text-white' : 'bg-slate-900 border-slate-700 border-l-rose-500 text-white') 
                        : (isSuccess ? 'border-l-emerald-500' : 'border-l-rose-500')}`}>
                     <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Boş Kalan</div>
                     <div className={`text-2xl md:text-3xl font-bold ${
                         isBlackAndWhite 
                            ? (isSuccess ? 'text-emerald-400' : 'text-rose-400') 
                            : (isSuccess ? 'text-emerald-600' : 'text-rose-600')
                     }`}>
                       {result.unfilledSlots}
                     </div>
                  </Card>

                  <Card className={`p-4 md:p-5 border-l-4 shadow-sm transition-all hover:shadow-md ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 border-l-indigo-500 text-white' : 'border-l-indigo-500'}`}>
                     <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Adalet Puanı (SD)</div>
                     <div className="flex items-end gap-2">
                        <div className={`text-2xl md:text-3xl font-bold ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-600'}`}>{fairnessScore.stdDev}</div>
                     </div>
                  </Card>
                  <Card className={`p-4 md:p-5 border-l-4 shadow-sm transition-all hover:shadow-md ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 border-l-blue-500 text-white' : 'border-l-blue-500'}`}>
                     <div className={`text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60 mb-1 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>İstek Karşılama</div>
                     <div className={`text-2xl md:text-3xl font-bold ${isBlackAndWhite ? 'text-blue-400' : 'text-blue-600'}`}>%{fairnessScore.reqRate}</div>
                  </Card>
            </div>

            {/* Actions Bar - READ ONLY CHECK */}
            <div className={`flex flex-col sm:flex-row justify-between items-center p-3 rounded-xl border shadow-sm gap-3 ${isBlackAndWhite ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                 <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="secondary" onClick={handleDownload} className={`text-xs h-9 flex-1 sm:flex-none ${isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}`}>
                       {ICONS.Excel} Excel
                    </Button>
                    <Button variant="secondary" onClick={() => setWhatsAppModalOpen(true)} className={`text-xs h-9 flex-1 sm:flex-none ${isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}`}>
                       <Share2 className="w-4 h-4" /> Paylaş & Takvim
                    </Button>
                    {/* Share Link Button - Only show if onShare prop is present and NOT in read only mode */}
                    {!isReadOnly && onShare && (
                        <Button variant="secondary" onClick={onShare} className={`text-xs h-9 flex-1 sm:flex-none text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 ${isBlackAndWhite ? 'bg-slate-800 text-indigo-300 border-slate-700 hover:bg-slate-700' : ''}`}>
                            <LinkIcon className="w-4 h-4 mr-1" /> Link Paylaş
                        </Button>
                    )}
                    {!isReadOnly && history.length > 0 && (
                        <Button variant="secondary" onClick={handleUndo} className={`text-xs h-9 flex-1 sm:flex-none text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200 ${isBlackAndWhite ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700' : ''}`}>
                            <RotateCcw className="w-4 h-4 mr-1" /> Geri Al
                        </Button>
                    )}
                 </div>
                 
                 {/* Hide Edit Button if Read Only */}
                 {!isReadOnly && (
                     <Button variant="secondary" onClick={() => setIsEditing(!isEditing)} className={`text-xs h-9 w-full sm:w-auto ${isEditing ? (isBlackAndWhite ? 'bg-indigo-900/50 text-indigo-200 border-indigo-500' : 'bg-indigo-50 text-indigo-800 border-indigo-200') : (isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : '')}`}>
                        {isEditing ? <Save className="w-3.5 h-3.5"/> : <Edit3 className="w-3.5 h-3.5"/>}
                        {isEditing ? 'Düzenlemeyi Bitir' : 'Manuel Düzenle'}
                    </Button>
                 )}
            </div>

            {/* Logs */}
            {result.logs.length > 0 && (
                <Card className={isBlackAndWhite ? 'bg-slate-900 border-slate-700 border text-white' : 'bg-amber-50 border-amber-200 border'} id="log-section">
                    <div className={`p-4 border-b font-bold flex items-center gap-2 ${isBlackAndWhite ? 'border-slate-700' : 'border-amber-200 text-amber-800'}`}>
                        {ICONS.Alert} Sistem Logları ve Hatalar
                    </div>
                    <div className={`p-4 max-h-48 overflow-y-auto text-sm font-mono space-y-1.5 ${isBlackAndWhite ? 'text-gray-300' : 'text-amber-900'}`}>
                        {result.logs.map((log, i) => <div key={i} className="flex gap-2"><span>•</span><span>{log}</span></div>)}
                    </div>
                </Card>
            )}

            {/* Chart */}
            <Card className={`p-4 md:p-6 shadow-md overflow-hidden ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 text-white' : ''}`}>
                  <div className="flex items-center gap-2 mb-4 md:mb-6">
                      <div className={`w-1 h-6 rounded-full ${isBlackAndWhite ? 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]' : 'bg-indigo-500'}`}></div>
                      <h3 className={`font-bold text-lg ${isBlackAndWhite ? 'text-white' : 'text-gray-900'}`}>Hedef Tutarlılığı Grafiği</h3>
                  </div>
                  <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                      <div style={{ width: `${chartWidth}px`, minWidth: '100%', height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isBlackAndWhite ? "#374151" : "#e5e7eb"} />
                            <XAxis dataKey="name" tick={{fontSize: 11, fill: isBlackAndWhite ? '#d1d5db' : '#4b5563', fontWeight: 600}} interval={0} angle={-45} textAnchor="end" height={80} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: isBlackAndWhite ? '#d1d5db' : '#4b5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid ' + (isBlackAndWhite ? '#334155' : '#e5e7eb'), boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: isBlackAndWhite ? '#1e293b' : 'white', color: isBlackAndWhite ? 'white' : 'black' }} cursor={{fill: isBlackAndWhite ? '#1e293b' : '#f3f4f6'}} />
                            <Legend verticalAlign="top" iconType="circle" wrapperStyle={{paddingBottom: '20px'}}/>
                            <Bar dataKey="targetService" name="Hedef (Srv)" fill={isBlackAndWhite ? '#4f46e5' : '#e0e7ff'} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actualService" name="Gerçekleşen (Srv)" fill={isBlackAndWhite ? '#818cf8' : '#4f46e5'} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="targetEmergency" name="Hedef (Acil)" fill={isBlackAndWhite ? '#be123c' : '#ffe4e6'} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actualEmergency" name="Gerçekleşen (Acil)" fill={isBlackAndWhite ? '#fb7185' : '#f43f5e'} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                  </div>
            </Card>

            {/* Main Schedule Table */}
            <Card className={`report-table-container shadow-lg border-0 overflow-hidden ${isBlackAndWhite ? 'bg-slate-900' : ''}`}>
                  <table className="report-table w-full">
                    <thead>
                      <tr>
                        <th className={`sticky-col w-20 md:w-28 shadow-lg z-30 text-center ${isBlackAndWhite ? 'bg-slate-950 text-white border-b border-slate-700' : 'bg-gray-800 text-white'}`}>Gün</th>
                        {services.map(s => (
                          <th key={s.id} className={`min-w-[140px] md:min-w-[160px] ${isBlackAndWhite ? 'bg-slate-950 text-white border-b border-slate-700' : ''}`}>
                              <div className="truncate font-bold text-sm">{s.name}</div>
                              <div className="text-[10px] font-normal opacity-70 mt-0.5">Min: {s.minDailyCount} Personel</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.schedule.map((day) => (
                        <tr key={day.day} className={day.isWeekend ? 'is-weekend' : ''}>
                          <td className={`sticky-col p-0 border-r ${isBlackAndWhite ? 'bg-slate-900 border-slate-700 text-slate-200' : 'border-gray-200'}`} style={{ height: '1px' }}>
                            <div className="flex flex-col items-center justify-center h-full min-h-[70px] py-2 bg-inherit w-full">
                              <span className={`text-xl font-bold ${isBlackAndWhite ? 'text-white' : 'text-gray-700'}`}>{day.day}</span>
                              <span className={`text-[10px] uppercase font-bold px-1.5 rounded ${day.isWeekend ? (isBlackAndWhite ? 'bg-indigo-900/40 text-indigo-200' : 'bg-orange-100 text-orange-700') : (isBlackAndWhite ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-500')}`}>
                                {new Date(year, month, day.day).toLocaleString('tr-TR', {weekday: 'short'})}
                              </span>
                            </div>
                          </td>
                          {services.map(service => {
                            const assignments = day.assignments.filter(a => a.serviceId === service.id);
                            return (
                              <td key={service.id} 
                                className={`align-top h-full p-1.5 ${isBlackAndWhite ? 'border-slate-700' : ''}`}
                                style={{ height: '1px' }}
                                onDragOver={isEditing ? handleDragOver : undefined}
                              >
                                <div className="flex flex-col gap-2 min-h-[70px] h-full justify-start">
                                    {assignments.length > 0 ? assignments.map((a, idx) => {
                                      let badgeClass = 'slot-normal';
                                      if (a.staffId === 'EMPTY') badgeClass = 'slot-empty';
                                      else if (a.isEmergency) badgeClass = 'slot-emergency';
                                      
                                      const isSelected = editingSlot && editingSlot.day === day.day && editingSlot.serviceId === service.id && editingSlot.currentStaffId === a.staffId;
                                      const isDraggingItem = dragData && dragData.day === day.day && dragData.serviceId === service.id && dragData.staffId === a.staffId;
                                      const isDropTarget = dragOverTarget && dragOverTarget.day === day.day && dragOverTarget.serviceId === service.id && dragOverTarget.staffId === a.staffId;

                                      return (
                                        <div 
                                          key={idx} 
                                          draggable={isEditing}
                                          onDragStart={isEditing ? (e) => handleDragStart(e, day.day, service.id, a.staffId) : undefined}
                                          onDrop={isEditing ? (e) => handleDrop(e, day.day, service.id, a.staffId) : undefined}
                                          onDragEnter={isEditing ? (e) => handleDragEnter(e, day.day, service.id, a.staffId) : undefined}
                                          className={`slot-badge ${badgeClass} ${isSelected ? 'slot-selected' : ''} ${isDraggingItem ? 'slot-dragging' : ''} ${isDropTarget ? 'slot-drag-over' : ''} ${isEditing ? 'clickable relative pr-7' : ''} flex justify-between items-center group/slot flex-1`}
                                          onClick={(e) => {
                                              if (isEditing) {
                                                  e.stopPropagation();
                                                  setEditingSlot({day: day.day, serviceId: service.id, currentStaffId: a.staffId});
                                              }
                                          }}
                                        >
                                          <div className="flex items-center gap-2 overflow-hidden w-full">
                                             <div className={`dot w-1.5 h-1.5 rounded-full shrink-0 ${a.isEmergency ? 'bg-white' : (isBlackAndWhite ? 'bg-indigo-400' : 'bg-indigo-500')}`}></div>
                                             <span className="font-semibold block truncate text-sm select-none">{a.staffName}</span>
                                          </div>
                                          {isEditing && (
                                              <div className="flex items-center gap-1 absolute right-1">
                                                  <GripVertical className="w-3.5 h-3.5 text-current opacity-50 cursor-move" />
                                              </div>
                                          )}
                                        </div>
                                      );
                                    }) : (
                                      <span className={`text-center text-xs block py-2 border-2 border-dashed rounded-lg h-full flex items-center justify-center select-none ${isBlackAndWhite ? 'border-slate-700 text-slate-600' : 'border-gray-100 text-gray-300'}`}>-</span>
                                    )}
                                  </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
            </Card>

            {/* Styled Searchable Dropdown for Editing */}
            {editingSlot && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 animate-fade-in"
                    onClick={() => setEditingSlot(null)}
                >
                    <div 
                        className={`rounded-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[70vh] transition-all transform animate-scale-in ${dropdownClasses}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className={`p-4 flex justify-between items-center shrink-0 ${dropdownHeaderClasses}`}>
                             <div>
                                <h3 className="font-bold text-sm">Nöbet Değiştir</h3>
                                <div className="text-[11px] opacity-70 uppercase tracking-wide font-medium mt-0.5">{editingSlot.day} {new Date(year, month, editingSlot.day).toLocaleString('tr-TR', {month:'long'})}</div>
                             </div>
                             <button onClick={() => setEditingSlot(null)} className="p-1.5 rounded-full hover:bg-black/10 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                        
                        {/* Search Bar */}
                        <div className={`p-3 border-b ${isBlackAndWhite ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
                             <div className="relative">
                                 <Search className={`w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 ${isBlackAndWhite ? 'text-gray-400' : 'text-slate-400'}`} />
                                 <input 
                                    id="staff-search-input"
                                    type="text" 
                                    placeholder="Personel ara..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className={`w-full text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow ${dropdownSearchClasses}`}
                                    autoComplete="off"
                                 />
                             </div>
                        </div>

                        {/* List */}
                        <div className={`flex-1 overflow-y-auto p-1.5 custom-scrollbar ${isBlackAndWhite ? 'bg-slate-800' : 'bg-white'}`}>
                            <div className="space-y-1">
                                <button 
                                    onClick={() => handleUpdateAssignment('EMPTY')}
                                    className={`w-full px-3 py-2.5 text-left rounded-lg flex justify-between items-center group transition-all ${isBlackAndWhite ? 'hover:bg-slate-700' : 'hover:bg-rose-50'}`}
                                >
                                    <span className="text-rose-500 font-bold text-sm group-hover:text-rose-600 flex items-center gap-2">
                                        <X className="w-4 h-4" /> Nöbeti Boşalt
                                    </span>
                                </button>
                                
                                {getAvailableStaffForEdit().length === 0 && (
                                    <div className="text-gray-500 text-xs text-center py-6">Uygun personel bulunamadı.</div>
                                )}

                                {getAvailableStaffForEdit().map(s => {
                                    const isActive = s.id === editingSlot.currentStaffId;
                                    return (
                                        <button 
                                            key={s.id}
                                            onClick={() => handleUpdateAssignment(s.id)}
                                            className={`w-full px-3 py-2.5 text-left rounded-lg flex justify-between items-center transition-all group ${dropdownItemClasses(isActive)}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-semibold ${isActive ? (isBlackAndWhite ? 'text-indigo-100' : 'text-indigo-800') : (isBlackAndWhite ? 'text-slate-200' : 'text-gray-700')}`}>{s.name}</span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                     <span className={`text-[10px] px-1.5 rounded border ${isBlackAndWhite ? 'border-slate-600 text-slate-400' : 'border-gray-200 text-gray-500'}`}>KD: {s.role}</span>
                                                     <span className={`text-[10px] ${isBlackAndWhite ? 'text-slate-500' : 'text-gray-400'}`}>{s.group} Grubu</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {s.hasConsecutiveConflict && (
                                                    <div className="text-amber-500 bg-amber-500/10 p-1 rounded" title="Dikkat: Dün veya Yarın nöbeti var">
                                                        <AlertTriangle className="w-4 h-4" />
                                                    </div>
                                                )}
                                                {isActive && <CheckCircle2 className={`w-5 h-5 ${isBlackAndWhite ? 'text-indigo-400' : 'text-indigo-600'}`} />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* WhatsApp & ICS Modal */}
            {whatsAppModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className={`rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] ${isBlackAndWhite ? 'bg-slate-900 text-white border border-slate-700' : 'bg-white'}`}>
                        <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isBlackAndWhite ? 'bg-slate-950 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className="font-bold flex items-center gap-2"><Share2 className="w-5 h-5 text-green-600"/> Paylaş & Takvim</h3>
                            <button onClick={() => setWhatsAppModalOpen(false)} className={`p-1 rounded hover:bg-black/10`}><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <p className={`text-sm mb-4 ${isBlackAndWhite ? 'text-gray-400' : 'text-gray-500'}`}>Personelin yanındaki butonları kullanarak nöbet listesini kopyalayabilir veya takvim dosyası (.ics) indirebilirsiniz.</p>
                            <div className="space-y-2">
                                {staff.map(s => (
                                    <div key={s.id} className={`flex justify-between items-center p-3 border rounded-xl transition-colors ${isBlackAndWhite ? 'border-slate-700 hover:bg-slate-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <span className="font-bold text-sm truncate mr-2">{s.name}</span>
                                        <div className="flex gap-2">
                                            {/* Button bileşeni 'title' prop'unu desteklemediği için kapsayıcı div'e 'title' verildi */}
                                            <div title="Takvime Ekle">
                                                <Button variant="secondary" onClick={() => generateICSFile(s.id)} className={`text-xs py-1.5 h-8 px-2 ${isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}`}>
                                                    <CalendarIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline ml-1">Takvim</span>
                                                </Button>
                                            </div>
                                            <div title="Mesaj Kopyala">
                                                <Button variant="secondary" onClick={() => copyWhatsAppMessage(s.id)} className={`text-xs py-1.5 h-8 px-2 ${isBlackAndWhite ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' : ''}`}>
                                                    <Clipboard className="w-3.5 h-3.5" /> <span className="hidden sm:inline ml-1">Mesaj</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

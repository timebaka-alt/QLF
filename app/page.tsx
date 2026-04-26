'use client';

import { useState, useEffect } from 'react';
import { useStore, STAGES, STAGE_LABELS, STAGE_COLORS, Stage, FilmProject } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Bot, Send, User as UserIcon, LinkIcon, Upload, CheckCircle2, CircleDashed, Clock, FileType2, Download, Users, X, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { GoogleGenAI, Type } from "@google/genai";
import Papa from 'papaparse';
import { useRef } from 'react';

import { ProjectGroupRow } from '@/components/ProjectGroupRow';

export default function Home() {
  const { users, projects, clients, currentUser, setCurrentUser, addProject, updateProjectStatus, updateProjectDetails, removeProject, assignUser, addUser, removeUser, acceptTask, rejectTask, addClient, updateClient, removeClient, refreshPipelines, notifications, markNotificationRead, markAllNotificationsRead } = useStore();
  
  const [chatMessage, setChatMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const [selectedTask, setSelectedTask] = useState<{ projectId: string, stage: Stage } | null>(null);
  const [fileUrlInput, setFileUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'internal' | 'client'>('internal');
  const [activeClientId, setActiveClientId] = useState<string>('');
  
  // Client Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPrefix, setNewClientPrefix] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom Role Titles
  const { availableTitles = [], addAvailableTitle, removeAvailableTitle, updateCustomTitle, customStageLabels, updateStageLabel } = useStore();
  const getStageLabel = (stage: Stage) => customStageLabels[stage] || STAGE_LABELS[stage];

  // Staff Modal
  const { updateUser } = useStore();
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffTitleInput, setNewStaffTitleInput] = useState('');
  const [newStaffTitles, setNewStaffTitles] = useState<string[]>([]);
  const [newStaffRoles, setNewStaffRoles] = useState<Stage[]>([]);
  const [editingRoleNode, setEditingRoleNode] = useState<{ type: 'stage'|'custom', id: string, name: string } | null>(null);
  const [isRenamingRoles, setIsRenamingRoles] = useState(false);

  // Edit Project Modal
  const [editingProject, setEditingProject] = useState<FilmProject | null>(null);
  const [newLanguageName, setNewLanguageName] = useState('');
  const [isAddingLanguage, setIsAddingLanguage] = useState(false);

  const currentUserObj = users.find(u => u.id === currentUser);

  useEffect(() => {
    if (activeTab === 'client' && !activeClientId && clients.length > 0) {
      setTimeout(() => setActiveClientId(clients[0].id), 0);
    }
  }, [activeTab, activeClientId, clients]);

  useEffect(() => {
    refreshPipelines();
  }, [refreshPipelines]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    
    // Prevent adding to client if no client selected
    if (activeTab === 'client' && clients.length === 0) {
      toast.error('Vui lòng thêm khách hàng trước khi tạo dự án!');
      return;
    }
    
    setIsParsing(true);
    
    try {
      const text = chatMessage.trim();
      const textLower = text.toLowerCase();
      // Thuật toán bóc tách dữ liệu nhanh (Regex / Keyword based)
      
      let code = 'UNKNOWN';
      let note = '';
      let videoLink = '';
      let originalName = '';
      let translatedName = '';
      let block = '';
      let duration: number | undefined = undefined;

      // 1. Phân tích Link (Lấy từ http đến hết chuỗi, bao gồm cả pass)
      const linkMatch = text.match(/(https?:\/\/[^\s]+.*)/);
      if (linkMatch) {
        videoLink = linkMatch[1].trim();
      }

      // 2. Phân tích Note (ví dụ: (Lô 58))
      const noteMatch = text.match(/\(([^)]+)\)/);
      if (noteMatch) {
        note = noteMatch[0];
      }

      // 3. Phân tích Code (ví dụ: KK-1398)
      const codeKeywordMatch = text.match(/(?:mã|code|id)[\s:]*([A-Za-z0-9\-_]+)/i);
      if (codeKeywordMatch) {
        code = codeKeywordMatch[1];
      } else {
        const strongCodeMatch = text.match(/\b([A-Za-z]+-?\d+|\d+-?[A-Za-z]+)\b/i);
        if (strongCodeMatch) {
           code = strongCodeMatch[1];
        } else {
          const fallbackMatch = text.match(/^([A-Za-z0-9\-_]+)/);
          if (fallbackMatch && fallbackMatch[1].length > 1) { 
             code = fallbackMatch[1];
          }
        }
      }

      // Lọc các thành phần đã lấy ra khỏi chuỗi để tìm tên gốc và tên việt
      let remainingText = text;
      if (videoLink) remainingText = remainingText.replace(videoLink, '');
      if (noteMatch) remainingText = remainingText.replace(noteMatch[0], '');
      if (code !== 'UNKNOWN') remainingText = remainingText.replace(new RegExp(`(?:mã|code|id)?[\\s:]*${code}`, 'i'), '');

      // Tìm tên block / duration (nếu có để lọc ra khỏi chuỗi tên)
      const blockMatch = text.match(/(?:block|tập)[\s:]*([A-Za-z0-9]+)/i);
      if (blockMatch) {
        block = blockMatch[1];
        remainingText = remainingText.replace(blockMatch[0], '');
      }

      const durationMatch = text.match(/(\d+)\s*(?:phút|p|min)/i);
      if (durationMatch) {
        duration = parseInt(durationMatch[1], 10);
        remainingText = remainingText.replace(durationMatch[0], '');
      }
      
      remainingText = remainingText.trim();

      // 4. Phân tích Tên gốc (Tiếng Trung/Hàn/Nhật...) và Tên Việt
      const chineseRegex = /([\u3400-\u9FBF\u3040-\u30FF\u31F0-\u31FF\uF900-\uFAFF\uFF66-\uFF9F]+(?:\s+[\u3400-\u9FBF\u3040-\u30FF\u31F0-\u31FF\uF900-\uFAFF\uFF66-\uFF9F]+)*)/;
      const chineseMatch = remainingText.match(chineseRegex);

      if (chineseMatch) {
        originalName = chineseMatch[0].trim();
        translatedName = remainingText.replace(chineseMatch[0], '').replace(/^[-\s:,|]+|[-\s:,|]+$/g, '').trim();
      } else {
         const nameMatch = text.match(/(?:phim|tên)[\s:]*([^,;.]+)/i);
         if (nameMatch) {
            translatedName = nameMatch[1].trim();
         } else {
            translatedName = remainingText; 
         }
      }
      
      let voiceType: 'TM_NGUOI' | 'TM_AI' | 'LT_AI' = 'TM_NGUOI';
      if (/thuyết minh ai/i.test(textLower) || /tm ai/i.test(textLower)) {
        voiceType = 'TM_AI';
      } else if (/lồng tiếng/i.test(textLower) || /lt ai/i.test(textLower) || /me/i.test(textLower)) {
        voiceType = 'LT_AI';
        if (/ai/i.test(textLower)) {
          voiceType = 'LT_AI'; 
        }
      } else if (/ai/i.test(textLower)) {
        voiceType = 'LT_AI'; 
      }

      const assignments: Record<string, string> = {};
      const keywords = {
        cbnl: ['chuẩn bị', 'cbnl', 'cb'],
        dich: ['dịch', 'dich'],
        tm_lt: ['thuyết minh', 'lồng tiếng', 'tm', 'lt', 'voice', 'đọc'],
        mix: ['mix', 'audio'],
        tp: ['tp', 'thành phẩm', 'video', 'dựng']
      };

      const parts = textLower.split(/[,;\n\.\|]+/);
      for (const part of parts) {
        for (const [role, kwList] of Object.entries(keywords)) {
          if (kwList.some(kw => part.includes(kw))) {
            const userFound = users.find(u => {
              const lowerName = u.name.toLowerCase();
              return part.includes(lowerName);
            });
            if (userFound && !assignments[role]) {
              assignments[role] = userFound.id;
            }
          }
        }
      }
      
      // Giả lập thời gian chờ nhỏ như đang xử lý
      await new Promise(resolve => setTimeout(resolve, 300));
      
      addProject({
        projectType: activeTab,
        clientId: activeTab === 'client' ? activeClientId : undefined,
        block: block || '',
        code: code,
        originalName: originalName,
        translatedName: translatedName,
        videoLink: videoLink,
        duration: duration,
        language: '',
        timeline: '',
        notes: note || text, // Ưu tiên note, nếu k có giữ lại text gốc
        voiceType: voiceType,
        assignments: assignments || {}
      });
      
      toast.success('Đã phân tích và thêm dự án mới!');
      setChatMessage('');
      
    } catch (e) {
      toast.error('Có lỗi xảy ra khi phân tích: ' + (e as Error).message);
      console.error(e);
    } finally {
      setIsParsing(false);
    }
  };

  const getStageSLA = (voiceType: string | undefined, stage: Stage) => {
    const type = voiceType || 'TM_NGUOI';
    if (type === 'TM_AI') {
      if (stage === 'cbnl') return 'Chuẩn bị voice 1n';
      if (stage === 'mix') return 'Mix 1n';
      if (stage === 'tp') return 'TP 1n';
      return '';
    }
    if (type === 'LT_AI') {
      if (stage === 'cbnl') return 'Ch. bị voice 2n';
      if (stage === 'dich') return 'Làm ME 1n';
      if (stage === 'mix') return 'Mix 1n';
      if (stage === 'tp') return 'TP 1n';
      return '';
    }
    // TM_NGUOI default
    if (stage === 'cbnl') return '1 ngày';
    if (stage === 'dich') return '2 ngày';
    if (stage === 'tm_lt') return '2 ngày';
    if (stage === 'mix') return '1 ngày';
    if (stage === 'tp') return '1 ngày';
    return '';
  };

  const handleUpdateStatus = () => {
    if (!selectedTask) return;
    const { projectId, stage } = selectedTask;
    const proj = projects.find(p => p.id === projectId);
    
    // Find next person to notify
    const currentIdx = STAGES.indexOf(stage);
    let nextUserMsg = 'dự án đã hoàn tất!';
    if (proj) {
      for (let i = currentIdx + 1; i < STAGES.length; i++) {
        if (proj.assignments[STAGES[i]]) {
          const nxUserId = proj.assignments[STAGES[i]];
          const nxUser = users.find(u => u.id === nxUserId);
          nextUserMsg = `khâu tiếp theo (${nxUser?.name || 'Ai đó'})`;
          break;
        }
      }
    }
    
    updateProjectStatus(projectId, stage, 'done', fileUrlInput);
    toast.success(`Đã nộp bài và thông báo cho ${nextUserMsg}`);
    setSelectedTask(null);
    setFileUrlInput('');
  };

  const getStatusBadge = (status: string, stage: Stage) => {
    if (status === 'done') return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase rounded border border-emerald-500/20 shadow-sm shadow-emerald-500/10">Hoàn thành</span>;
    if (status === 'pending') return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-black uppercase rounded shadow-sm shadow-blue-500/10">Chờ nhận</span>;
    if (status === 'in_progress') return <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase rounded border border-amber-500/20">Đang làm</span>;
    if (status === 'rejected') return <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[9px] font-black uppercase rounded border border-red-500/20 shadow-sm shadow-red-500/10 animate-pulse">Bị từ chối</span>;
    return <span className="px-2 py-1 bg-slate-800 text-slate-500 text-[9px] font-black uppercase rounded border border-slate-700">Đang chờ</span>;
  };

  const handleExportCSV = () => {
    // Export exact system data structure
    const dataToExport = projects.map(p => ({
      id: p.id,
      projectType: p.projectType,
      clientId: p.clientId || '',
      block: p.block,
      code: p.code,
      originalName: p.originalName,
      translatedName: p.translatedName,
      otherNames: p.otherNames ? JSON.stringify(p.otherNames) : '',
      videoLink: p.videoLink,
      duration: p.duration || '',
      language: p.language || '',
      timeline: p.timeline || '',
      voiceType: p.voiceType || '',
      notes: p.notes || '',
      createdAt: p.createdAt,
      // Statuses mapping
      cbnl_assign: p.assignments.cbnl || '',
      cbnl_status: p.statuses.cbnl || 'waiting',
      cbnl_file: p.files.cbnl || '',
      dich_assign: p.assignments.dich || '',
      dich_status: p.statuses.dich || 'waiting',
      dich_file: p.files.dich || '',
      tm_lt_assign: p.assignments.tm_lt || '',
      tm_lt_status: p.statuses.tm_lt || 'waiting',
      tm_lt_file: p.files.tm_lt || '',
      mix_assign: p.assignments.mix || '',
      mix_status: p.statuses.mix || 'waiting',
      mix_file: p.files.mix || '',
      tp_assign: p.assignments.tp || '',
      tp_status: p.statuses.tp || 'waiting',
      tp_file: p.files.tp || ''
    }));
    
    const csvContent = Papa.unparse(dataToExport);
      
    const hiddenElement = document.createElement('a');
    const blob = new Blob(["\uFEFF"+csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    hiddenElement.href = url;
    hiddenElement.target = '_blank';
    hiddenElement.download = `sao_luu_du_an_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    hiddenElement.click();
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const { importProjects } = useStore.getState();
          const imported = results.data.map((row: any) => ({
            id: row.id || Math.random().toString(36).substring(2, 9),
            projectType: row.projectType || 'internal',
            clientId: row.clientId || undefined,
            block: row.block || '',
            code: row.code || '',
            originalName: row.originalName || '',
            translatedName: row.translatedName || '',
            otherNames: row.otherNames ? JSON.parse(row.otherNames) : undefined,
            videoLink: row.videoLink || '',
            duration: row.duration || undefined,
            language: row.language || undefined,
            timeline: row.timeline || undefined,
            voiceType: row.voiceType || 'TM_NGUOI',
            notes: row.notes || '',
            createdAt: parseInt(row.createdAt) || Date.now(),
            assignments: {
              cbnl: row.cbnl_assign || undefined,
              dich: row.dich_assign || undefined,
              tm_lt: row.tm_lt_assign || undefined,
              mix: row.mix_assign || undefined,
              tp: row.tp_assign || undefined,
            },
            statuses: {
              cbnl: row.cbnl_status || 'waiting',
              dich: row.dich_status || 'waiting',
              tm_lt: row.tm_lt_status || 'waiting',
              mix: row.mix_status || 'waiting',
              tp: row.tp_status || 'waiting',
            },
            files: {
              cbnl: row.cbnl_file || undefined,
              dich: row.dich_file || undefined,
              tm_lt: row.tm_lt_file || undefined,
              mix: row.mix_file || undefined,
              tp: row.tp_file || undefined,
            }
          }));
          importProjects(imported);
          toast.success("Khôi phục dữ liệu dự án thành công!");
        } catch (e) {
          toast.error("Lỗi khi khôi phục: Định dạng file không hợp lệ.");
          console.error(e);
        }
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        toast.error(`Lỗi đọc file: ${error.message}`);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end p-4 md:p-8 mb-4 border-b border-slate-800 gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">Trợ Lý Phim</h1>
          <p className="text-slate-400 font-medium tracking-widest uppercase text-[10px] md:text-xs mt-2">Quản lý dự án phim cho người lười</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex flex-wrap bg-slate-900 border border-slate-800 rounded-3xl p-1 md:mr-2 ring-1 ring-inset ring-slate-800">
            <button 
              className={`px-4 md:px-6 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'internal' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setActiveTab('internal')}
            >
              Nội Bộ Công Ty
            </button>
            <button 
              className={`px-4 md:px-6 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'client' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setActiveTab('client')}
            >
              Của Khách Hàng
            </button>
          </div>
          
          <button className="px-4 md:px-6 py-2 border-2 border-slate-700 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest hover:border-blue-500 transition-colors whitespace-nowrap" onClick={() => setIsStaffModalOpen(true)}>
            Quản lý nhân sự
          </button>
          
          <div className="flex flex-wrap bg-slate-900 border border-slate-800 rounded-3xl p-1 ring-1 ring-inset ring-slate-800 gap-1">
            <button className="px-3 md:px-4 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-colors text-slate-400 flex items-center gap-2 whitespace-nowrap" onClick={handleExportCSV}>
              <Download className="w-3 h-3" /> Xuất Sao Lưu
            </button>
            <button className="px-3 md:px-4 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-colors text-slate-400 flex items-center gap-2 whitespace-nowrap" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3 h-3" /> Nhập Phục Hồi
            </button>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImportCSV} 
            />
          </div>

          <div className="flex items-center gap-2 md:gap-4 ml-0 md:ml-2">
            {/* Notification Bell */}
            {currentUser && (
              <div className="relative">
                <button 
                  className="relative p-2 rounded-full bg-slate-900 border-2 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                >
                  <Bell className="w-4 h-4" />
                  {notifications.filter(n => n.userId === currentUser && !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black tracking-tighter text-white flex items-center justify-center border-2 border-slate-950">
                      {notifications.filter(n => n.userId === currentUser && !n.read).length}
                    </span>
                  )}
                </button>
                
                {isNotificationsOpen && (
                  <div className="absolute top-full right-0 mt-2 w-[350px] bg-slate-900 border-2 border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-slate-800">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-white">Thông báo</h3>
                      <button 
                        className="text-[10px] text-blue-400 font-bold uppercase hover:text-blue-300"
                        onClick={() => markAllNotificationsRead(currentUser)}
                      >
                        Đánh dấu đã đọc
                      </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                      {notifications.filter(n => n.userId === currentUser).sort((a,b) => b.createdAt - a.createdAt).length > 0 ? (
                        notifications.filter(n => n.userId === currentUser).sort((a,b) => b.createdAt - a.createdAt).map(n => (
                          <div 
                            key={n.id} 
                            className={`p-3 rounded-lg text-sm border ${n.read ? 'bg-slate-900/50 border-transparent text-slate-400' : 'bg-slate-800/80 border-slate-700 text-slate-100'} cursor-pointer hover:bg-slate-800 transition-colors duration-200 flex flex-col gap-1`}
                            onClick={() => {
                              markNotificationRead(n.id);
                              // Could also set state to highlight project
                            }}
                          >
                            <p className="leading-snug">{n.message}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{format(n.createdAt, 'HH:mm dd/MM')}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">Chưa có thông báo nào.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Select value={currentUser || ''} onValueChange={(val) => { setCurrentUser(val); setIsNotificationsOpen(false); }}>
              <SelectTrigger className="w-[180px] bg-slate-900 border-2 border-slate-700 text-slate-50 rounded-full text-xs font-bold tracking-widest uppercase">
                <UserIcon className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Chọn nhân viên" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-50">
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 md:px-8 pb-8 flex flex-col gap-6 md:gap-8 w-full max-w-screen-2xl mx-auto">
        
        {/* Client Sub-tabs */}
        {activeTab === 'client' && (
          <div className="flex gap-2 items-center overflow-x-auto pb-4 border-b border-slate-900/50">
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveClientId(c.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${activeClientId === c.id ? 'bg-indigo-600 border-2 border-indigo-500 text-white shadow shadow-indigo-500/20' : 'bg-slate-900 border-2 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                {c.name} ({c.prefix})
              </button>
            ))}
            <button 
              onClick={() => {
                setEditingClientId(null);
                setNewClientName('');
                setNewClientPrefix('');
                setIsClientModalOpen(true);
              }}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap border-2 border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors ml-2"
            >
              Quản lý khách hàng
            </button>
          </div>
        )}
        
        {/* Chat Input Area for "Lazy Data Entry" */}
        {currentUserObj?.roles.includes('tp') && (
          <section className="flex flex-col">
            <div className="bg-slate-900 border-2 border-slate-800 p-6 rounded-3xl flex flex-col relative overflow-hidden">
              {activeTab === 'client' && clients.length === 0 ? (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-4">
                  <p className="text-sm text-slate-300 font-medium">Vui lòng thêm ít nhất 1 khách hàng trước khi nhập liệu.</p>
                  <button onClick={() => setIsClientModalOpen(true)} className="px-6 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest hover:bg-indigo-500">
                    + Thêm khách
                  </button>
                </div>
              ) : null}
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                Trợ Lý Nhập Liệu Nhanh {activeTab === 'internal' ? "(Nội Bộ)" : "(Khách Hàng)"}
              </h2>
              <p className="text-slate-400 text-sm mb-6">
                Nhập chuỗi thông tin thô để trích xuất tự động vào dự án mới. 
                {activeTab === 'client' && <span className="text-indigo-300 font-medium ml-1">Thuật toán sẽ lấy ID tiến trình dựa theo khách hàng đang chọn.</span>}
                {activeTab === 'internal' && <span className="text-blue-300 font-medium ml-1">Thuật toán sẽ tự động gán ID công ty (VD: DMV01...).</span>}
              </p>
              
              <div className="flex flex-col gap-4">
                <Textarea 
                  placeholder="VD: Mã A1, Phim Mật Mã, dịch Minh..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-mono text-blue-300 focus:outline-none focus:border-blue-500 resize-none min-h-[100px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
              </div>
              <button 
                onClick={handleSendMessage} 
                disabled={isParsing || !chatMessage.trim()}
                className="mt-4 w-full py-4 bg-white text-black font-black uppercase tracking-tighter rounded-2xl text-xl hover:bg-blue-400 disabled:opacity-50 transition-colors italic flex justify-center items-center gap-2"
              >
                {isParsing ? <><CircleDashed className="animate-spin w-6 h-6" /> ĐANG PHÂN TÍCH...</> : 'TẠO DỰ ÁN'}
              </button>
            </div>
          </section>
        )}

        {/* Dashboard Data Table */}
        <section className="flex flex-col gap-6 overflow-hidden flex-1">
          <div className="flex justify-between items-center">
            {activeTab === 'internal' ? (
              <h2 className="text-xl font-bold uppercase tracking-widest text-blue-100">Dự Án Nội Bộ Đang Chạy</h2>
            ) : (
              <h2 className="text-xl font-bold uppercase tracking-widest text-indigo-100 flex items-center gap-2">
                Dự Án Khách Hàng <span className="text-indigo-400">›</span> {clients.find(c => c.id === activeClientId)?.name || '...'}
              </h2>
            )}
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  {projects.filter(p => activeTab === 'internal' ? p.projectType === 'internal' : (p.projectType === 'client' && p.clientId === activeClientId)).length} DỰ ÁN
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden flex flex-col flex-1">
            <div className="relative w-full overflow-auto">
              <table className="w-full text-sm text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-950/50 text-[10px] text-slate-500 uppercase tracking-widest border-b-2 border-slate-800">
                  <tr>
                    <th className="px-4 py-4 font-bold border-r border-slate-800/50">Phim</th>
                    <th className="px-4 py-4 font-bold border-r border-slate-800/50 min-w-[120px]">Tiến độ</th>
                    {STAGES.map((stage) => (
                      <th key={stage} className="px-4 py-4 font-bold text-center border-r border-slate-800/50 min-w-[150px]">
                        {getStageLabel(stage)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {projects.filter(p => activeTab === 'internal' ? p.projectType === 'internal' : (p.projectType === 'client' && p.clientId === activeClientId)).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-medium">
                        CHƯA CÓ DỰ ÁN NÀO TRONG MỤC NÀY
                      </td>
                    </tr>
                  ) : (
                    Object.values(projects.filter(p => activeTab === 'internal' ? p.projectType === 'internal' : (p.projectType === 'client' && p.clientId === activeClientId)).reduce((acc, p) => {
                        const baseCode = p.code.includes('_') ? p.code.substring(p.code.indexOf('_') + 1) : p.code;
                        if (!acc[baseCode]) acc[baseCode] = [];
                        acc[baseCode].push(p);
                        return acc;
                    }, {} as Record<string, typeof projects>)).sort((a,b) => b[0].createdAt - a[0].createdAt).map((group: any) => (
                        <ProjectGroupRow 
                          key={group[0].code}
                          group={group}
                          STAGES={STAGES}
                          users={users}
                          currentUser={currentUser}
                          removeProject={removeProject}
                          setEditingProject={setEditingProject}
                          assignUser={assignUser}
                          getStageLabel={getStageLabel}
                          getStatusBadge={getStatusBadge}
                          getStageSLA={getStageSLA}
                          setSelectedTask={setSelectedTask}
                          acceptTask={acceptTask}
                          rejectTask={rejectTask}
                        />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Shortcut Info */}
      <footer className="mt-auto px-8 py-4 flex justify-between text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] border-t border-slate-900 bg-slate-950">
        <div>Theo dõi tiến độ nhóm</div>
        <div>© 2026 Hệ thống quản lý hậu kỳ</div>
      </footer>

      {/* Task Submission Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">NỘP BÀI</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-semibold tracking-wide uppercase">
              Bạn đang hoàn tất khâu <strong className="text-blue-400">{selectedTask && getStageLabel(selectedTask.stage)}</strong>. Vui lòng đính kèm link thành phẩm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link" className="text-xs font-bold uppercase text-slate-300">Link Thành Phẩm hoặc Tải file</Label>
              <div className="flex gap-2">
                <Input 
                  id="link" 
                  placeholder="https://..." 
                  value={fileUrlInput}
                  onChange={(e) => setFileUrlInput(e.target.value)}
                  className="bg-slate-950 border-slate-800 font-mono text-xs text-blue-300 focus-visible:ring-blue-500 h-10 flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-10 text-xs border-slate-800 bg-slate-900 border-dashed hover:bg-slate-800"
                  onClick={() => document.getElementById('mockUpload')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2 text-slate-400" />
                  <span className="text-slate-400">Tải lên</span>
                </Button>
                <input 
                  id="mockUpload" 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Tạo link local object url để có thể xem lại file vừa upload
                      const objectUrl = URL.createObjectURL(file);
                      setFileUrlInput(objectUrl);
                      toast.success(`Đã tải lên tệp: ${file.name} thành công.`);
                    }
                  }}
                />
              </div>
            </div>
            <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4 flex items-start gap-3">
              <Upload className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs font-medium text-blue-300/80 leading-relaxed">
                Xác nhận sẽ tự động chuyển phim sang hàng chờ của người phụ trách khâu tiếp theo.
              </div>
            </div>
          </div>
          <DialogFooter>
            <button className="px-4 py-2 border border-slate-700 text-slate-300 text-xs font-bold uppercase rounded-lg hover:bg-slate-800" onClick={() => setSelectedTask(null)}>Hủy</button>
            <button className="px-5 py-2 bg-blue-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-blue-500" onClick={handleUpdateStatus} disabled={!fileUrlInput.trim()}>Hoàn thành</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Staff Management Dialog */}
      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-500" />
              QUẢN LÝ NHÂN SỰ
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col gap-6">
            <div className="max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-2">
              {users.map(u => (
                <div key={u.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-slate-100">{u.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase mt-1">
                      {u.roles.map(r => getStageLabel(r)).concat(u.customTitle ? u.customTitle.split(', ') : []).join(' • ')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                        setEditingStaffId(u.id);
                        setNewStaffName(u.name);
                        setNewStaffTitles(u.customTitle ? u.customTitle.split(', ') : []);
                        setNewStaffRoles(u.roles);
                    }} className="w-16 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors text-xs font-bold">
                      SỬA
                    </button>
                    <button onClick={() => removeUser(u.id)} className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-4 flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {editingStaffId ? 'Cập nhật nhân sự' : 'Thêm nhân sự mới'}
              </h3>
              <div className="flex flex-col gap-4">
                <Input 
                  placeholder="Tên nhân viên..." 
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-sm focus-visible:ring-blue-500 w-full"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center w-full mb-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Vai trò & Khả năng phụ trách:</div>
                  <button 
                    onClick={() => setIsRenamingRoles(!isRenamingRoles)}
                    className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isRenamingRoles ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {isRenamingRoles ? 'Hoàn tất sửa' : 'Chỉnh sửa tên vai trò'}
                  </button>
                </div>
                <Input 
                  placeholder="Gõ chức năng công việc muốn thêm (VD: Video Editor, QC...) rồi nhấn Enter" 
                  value={newStaffTitleInput}
                  onChange={e => setNewStaffTitleInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newStaffTitleInput.trim()) {
                      e.preventDefault();
                      const val = newStaffTitleInput.trim();
                      if (!availableTitles.includes(val)) {
                        addAvailableTitle(val);
                      }
                      if (!newStaffTitles.includes(val)) {
                        setNewStaffTitles([...newStaffTitles, val]);
                      }
                      setNewStaffTitleInput('');
                    }
                  }}
                  className="bg-slate-950 border-slate-700 text-sm focus-visible:ring-indigo-500 w-full"
                />
                
                <div className="flex flex-wrap gap-2 mt-1">
                  {/* System Tags */}
                  {STAGES.map(s => {
                    const isActive = newStaffRoles.includes(s);
                    if (isRenamingRoles && editingRoleNode?.id === s) {
                      return (
                        <input
                          key={`edit-${s}`}
                          autoFocus
                          value={editingRoleNode.name}
                          onChange={e => setEditingRoleNode({...editingRoleNode, name: e.target.value})}
                          onBlur={() => {
                            if (editingRoleNode.name.trim()) updateStageLabel(s, editingRoleNode.name.trim());
                            setEditingRoleNode(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (editingRoleNode.name.trim()) updateStageLabel(s, editingRoleNode.name.trim());
                              setEditingRoleNode(null);
                            }
                          }}
                          className="px-2 py-1.5 text-[10px] font-bold uppercase rounded-lg border border-amber-500 bg-slate-900 text-white min-w-[80px]"
                        />
                      );
                    }
                    return (
                      <button 
                        key={s}
                        onClick={() => {
                          if (isRenamingRoles) {
                            setEditingRoleNode({ type: 'stage', id: s, name: getStageLabel(s) });
                          } else {
                            setNewStaffRoles(prev => 
                              prev.includes(s) ? prev.filter(r => r !== s) : [...prev, s]
                            )
                          }
                        }}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-colors ${isRenamingRoles ? 'border-amber-500 text-amber-100 hover:bg-amber-500/20 bg-slate-900' : isActive ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                      >
                        {getStageLabel(s)}
                      </button>
                    )
                  })}

                  {/* Custom System Tags */}
                  {availableTitles.map(title => {
                    const isActive = newStaffTitles.includes(title);
                    if (isRenamingRoles && editingRoleNode?.id === title) {
                       return (
                        <input
                          key={`edit-${title}`}
                          autoFocus
                          value={editingRoleNode.name}
                          onChange={e => setEditingRoleNode({...editingRoleNode, name: e.target.value})}
                          onBlur={() => {
                            if (editingRoleNode.name.trim() && editingRoleNode.name !== title) {
                              updateCustomTitle(title, editingRoleNode.name.trim());
                              setNewStaffTitles(prev => prev.map(t => t === title ? editingRoleNode.name.trim() : t));
                            }
                            setEditingRoleNode(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (editingRoleNode.name.trim() && editingRoleNode.name !== title) {
                                updateCustomTitle(title, editingRoleNode.name.trim());
                                setNewStaffTitles(prev => prev.map(t => t === title ? editingRoleNode.name.trim() : t));
                              }
                              setEditingRoleNode(null);
                            }
                          }}
                          className="px-2 py-1.5 text-[10px] font-bold uppercase rounded-lg border border-amber-500 bg-slate-900 text-white min-w-[80px]"
                        />
                      );
                    }
                    return (
                      <div key={title} className={`flex overflow-hidden rounded-lg border shadow-sm relative group ${isRenamingRoles ? 'border-amber-500' : 'border-slate-800'}`}>
                        <button 
                          onClick={() => {
                            if (isRenamingRoles) {
                                setEditingRoleNode({ type: 'custom', id: title, name: title });
                            } else {
                              if (isActive) {
                                setNewStaffTitles(newStaffTitles.filter(t => t !== title));
                              } else {
                                setNewStaffTitles([...newStaffTitles, title]);
                              }
                            }
                          }}
                          className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-colors flex items-center gap-1 ${isRenamingRoles ? 'bg-slate-900 text-amber-100 hover:bg-amber-500/20' : isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-950 text-slate-500 hover:bg-slate-900'}`}
                        >
                          {title}
                        </button>
                        {!isRenamingRoles && (
                          <button 
                              onClick={() => {
                                removeAvailableTitle(title);
                                setNewStaffTitles(newStaffTitles.filter(t => t !== title));
                              }}
                              className={`px-2 flex items-center justify-center transition-colors ${isActive ? 'bg-indigo-700 text-indigo-300 hover:bg-indigo-800 hover:text-white' : 'bg-slate-900 text-slate-600 hover:bg-red-500 hover:text-white'}`}
                              title="Xóa chức danh này khỏi hệ thống"
                          >
                              <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                {editingStaffId && (
                  <button 
                    onClick={() => {
                      setEditingStaffId(null);
                      setNewStaffName('');
                      setNewStaffTitleInput('');
                      setNewStaffTitles([]);
                      setNewStaffRoles([]);
                    }}
                    className="px-4 py-3 border border-slate-700 text-slate-300 text-xs font-bold uppercase rounded-lg hover:bg-slate-800" 
                  >
                    Hủy
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (newStaffName.trim() && (newStaffRoles.length > 0 || newStaffTitles.length > 0)) {
                      if (editingStaffId) {
                        updateUser(editingStaffId, {
                          name: newStaffName.trim(), 
                          customTitle: newStaffTitles.length > 0 ? newStaffTitles.join(', ') : undefined,
                          roles: newStaffRoles 
                        });
                        toast.success('Đã cập nhật nhân sự!');
                        setEditingStaffId(null);
                      } else {
                        addUser({ 
                          name: newStaffName.trim(), 
                          customTitle: newStaffTitles.length > 0 ? newStaffTitles.join(', ') : undefined,
                          roles: newStaffRoles 
                        });
                        toast.success('Đã thêm nhân sự!');
                      }
                      setNewStaffName('');
                      setNewStaffTitleInput('');
                      setNewStaffTitles([]);
                      setNewStaffRoles([]);
                    } else {
                      toast.error('Vui lòng nhập tên và chọn ít nhất 1 quyền!');
                    }
                  }}
                  className="flex-1 py-3 bg-white text-black font-black uppercase text-sm rounded-lg hover:bg-slate-200"
                >
                  {editingStaffId ? 'CẬP NHẬT NHÂN VIÊN' : 'THÊM NHÂN VIÊN'}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Client Management Dialog */}
      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">QUẢN LÝ KHÁCH HÀNG</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 flex flex-col gap-6">
            {clients.length > 0 && (
              <div className="max-h-[250px] overflow-y-auto pr-2 flex flex-col gap-2">
                {clients.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-indigo-300">{c.name}</span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase mt-1">
                        Mã lô phim: <span className="text-indigo-400 font-bold">{c.prefix}</span>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setEditingClientId(c.id);
                        setNewClientName(c.name);
                        setNewClientPrefix(c.prefix);
                      }} className="w-16 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors text-xs font-bold">
                        SỬA
                      </button>
                      <button onClick={() => {
                        removeClient(c.id);
                        if (activeClientId === c.id) setActiveClientId('');
                      }} className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={`space-y-4 ${clients.length > 0 ? 'border-t border-slate-800 pt-4' : ''}`}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {editingClientId ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="clientName" className="text-[10px] font-bold uppercase text-slate-500">Tên Khách Hàng</Label>
                <Input 
                  id="clientName" 
                  placeholder="VD: CCAP, Phim Vietsub..." 
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-indigo-500 h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientPrefix" className="text-[10px] font-bold uppercase text-slate-500">Mã Tiền Tố (Để tạo ID tự động)</Label>
                <Input 
                  id="clientPrefix" 
                  placeholder="VD: CC, VN, KH..." 
                  value={newClientPrefix}
                  onChange={(e) => setNewClientPrefix(e.target.value.toUpperCase())}
                  className="bg-slate-950 border-slate-800 font-mono text-sm text-indigo-300 focus-visible:ring-indigo-500 h-10 uppercase"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-2">
              {editingClientId && (
                <button 
                  className="px-4 py-2 border border-slate-700 text-slate-300 text-xs font-bold uppercase rounded-lg hover:bg-slate-800" 
                  onClick={() => {
                    setEditingClientId(null);
                    setNewClientName('');
                    setNewClientPrefix('');
                  }}
                >
                  Hủy Sửa
                </button>
              )}
              <button 
                className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-indigo-500 disabled:opacity-50 flex-1" 
                onClick={() => {
                  if (newClientName.trim() && newClientPrefix.trim()) {
                    if (editingClientId) {
                      updateClient(editingClientId, { name: newClientName.trim(), prefix: newClientPrefix.trim() });
                      toast.success('Đã cập nhật thông tin khách hàng!');
                      setEditingClientId(null);
                    } else {
                      addClient({ name: newClientName.trim(), prefix: newClientPrefix.trim() });
                      toast.success('Đã thêm khách hàng mới!');
                    }
                    setNewClientName('');
                    setNewClientPrefix('');
                  }
                }} 
                disabled={!newClientName.trim() || !newClientPrefix.trim()}
              >
                {editingClientId ? 'Cập Nhật' : 'Lưu Khách Hàng'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-white">Sửa Thông Tin Dự Án</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Mã: <strong className="text-blue-400">#{editingProject?.block}-{editingProject?.code}</strong>
            </DialogDescription>
          </DialogHeader>
          
          {editingProject && (
            <div className="py-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Mã phim</Label>
                  <Input 
                    value={editingProject.code}
                    onChange={(e) => setEditingProject({...editingProject, code: e.target.value})}
                    className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-indigo-500 font-mono text-blue-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Tên phim (Việt)</Label>
                  <Input 
                    value={editingProject.translatedName}
                    onChange={(e) => setEditingProject({...editingProject, translatedName: e.target.value})}
                    className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Tên gốc</Label>
                <Input 
                  value={editingProject.originalName}
                  onChange={(e) => setEditingProject({...editingProject, originalName: e.target.value})}
                  className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-indigo-500"
                />
              </div>

              {Object.entries(editingProject.otherNames || {}).map(([lang, name]) => (
                <div key={lang} className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
                  <Input 
                     value={lang} disabled className="bg-slate-950 border-slate-800 text-[10px] font-bold uppercase text-slate-500 disabled:opacity-70" 
                  />
                  <Input 
                    value={name as string}
                    onChange={(e) => setEditingProject({...editingProject, otherNames: {...(editingProject.otherNames || {}), [lang]: e.target.value}})}
                    className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-indigo-500"
                  />
                  <button 
                     onClick={() => {
                        const newOther = {...editingProject.otherNames};
                        delete newOther[lang];
                        setEditingProject({...editingProject, otherNames: newOther});
                     }}
                     className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                  >
                     <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {isAddingLanguage ? (
                 <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center border border-indigo-500/30 p-2 rounded-lg bg-indigo-500/5">
                    <Input autoFocus placeholder="Ngôn ngữ..." value={newLanguageName} onChange={e => setNewLanguageName(e.target.value)} className="bg-slate-900 border-indigo-500/50 text-xs text-white" />
                    <button 
                       className="h-10 bg-indigo-600 rounded-lg text-xs font-bold text-white uppercase hover:bg-indigo-500 transition-colors"
                       onClick={() => {
                          if (newLanguageName.trim()) {
                             setEditingProject({...editingProject, otherNames: {...(editingProject.otherNames || {}), [newLanguageName.trim()]: ''}});
                             setNewLanguageName('');
                             setIsAddingLanguage(false);
                          }
                       }}
                    >Tạo</button>
                    <button onClick={() => setIsAddingLanguage(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"><X className="w-4 h-4" /></button>
                 </div>
              ) : (
                 <button className="text-[10px] uppercase font-bold text-indigo-400 hover:text-indigo-300 w-max" onClick={() => setIsAddingLanguage(true)}>+ Thêm tên ngôn ngữ khác (Anh, Hàn...)</button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Thời lượng (Phút)</Label>
                  <Input 
                    placeholder="VD: 30"
                    value={editingProject.duration || ''}
                    onChange={(e) => setEditingProject({...editingProject, duration: e.target.value})}
                    className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Ngôn ngữ</Label>
                  <Input 
                    placeholder="VD: Tiếng Trung"
                    value={editingProject.language || ''}
                    onChange={(e) => setEditingProject({...editingProject, language: e.target.value})}
                    className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Deadline (Timeline)</Label>
                <Input 
                  placeholder="VD: 25/11"
                  value={editingProject.timeline || ''}
                  onChange={(e) => setEditingProject({...editingProject, timeline: e.target.value})}
                  className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-amber-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Video Link (RAW)</Label>
                <Input 
                  value={editingProject.videoLink || ''}
                  onChange={(e) => setEditingProject({...editingProject, videoLink: e.target.value})}
                  className="bg-slate-950 border-slate-800 text-sm focus-visible:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button 
                  className="px-4 py-2 border border-slate-700 text-slate-300 text-xs font-bold uppercase rounded-lg hover:bg-slate-800" 
                  onClick={() => setEditingProject(null)}
                >
                  Hủy
                </button>
                <button 
                  className="px-6 py-2 bg-indigo-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-indigo-500 flex-1" 
                  onClick={() => {
                    const isNewDuplicate = editingProject.id.startsWith('new_duplicate_');
                    if (isNewDuplicate) {
                       // Create a clean new project with the same metadata but empty workflow
                       addProject({
                          projectType: activeTab,
                          clientId: activeClientId || undefined,
                          code: editingProject.code.includes('_') ? editingProject.code.substring(editingProject.code.indexOf('_') + 1) : editingProject.code, // Provide base code, addProject generates prefix
                          block: editingProject.block,
                          originalName: editingProject.originalName,
                          translatedName: editingProject.translatedName,
                          otherNames: editingProject.otherNames,
                          duration: Number(editingProject.duration) || editingProject.duration,
                          language: editingProject.language,
                          timeline: editingProject.timeline,
                          voiceType: editingProject.voiceType,
                          notes: editingProject.notes,
                          videoLink: editingProject.videoLink,
                          assignments: editingProject.assignments // Retain assignments? Or empty them? User might want to retain team for a new language, wait, a new language often uses same translation team? Let's retain them so they don't have to re-setup everything.
                       });
                       toast.success('Đã tạo phiên bản ngôn ngữ mới!');
                    } else {
                       updateProjectDetails(editingProject.id, {
                           code: editingProject.code,
                           translatedName: editingProject.translatedName,
                           originalName: editingProject.originalName,
                           otherNames: editingProject.otherNames,
                           duration: Number(editingProject.duration) || editingProject.duration,
                           language: editingProject.language,
                           timeline: editingProject.timeline,
                           videoLink: editingProject.videoLink
                       });
                       toast.success('Đã cập nhật dự án!');
                    }
                    setEditingProject(null);
                  }} 
                >
                  {editingProject.id.startsWith('new_duplicate_') ? 'Tạo Dự Án Mới' : 'Cập Nhật Dự Án'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

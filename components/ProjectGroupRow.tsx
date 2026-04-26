import React, { useState } from 'react';
import { FilmProject, Stage } from '@/store/useStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, CheckCircle2, Upload, Edit, Edit2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export function ProjectGroupRow({ 
  group, 
  STAGES, 
  users, 
  currentUser, 
  removeProject, 
  setEditingProject, 
  assignUser, 
  getStageLabel, 
  getStatusBadge, 
  getStageSLA, 
  setSelectedTask,
  acceptTask,
  rejectTask
}: any) {
  const [selectedId, setSelectedId] = useState(group[0].id);
  // Ensure the selected ID is still in the group (e.g. if deleted)
  const p = group.find((proj: any) => proj.id === selectedId) || group[0];
  const isTaskPendingForMe = STAGES.some((s: Stage) => p.assignments[s] === currentUser && p.statuses[s] === 'pending');
  const baseCode = group[0].code;

  return (
    <tr className={`hover:bg-slate-800/20 transition-colors group/row ${isTaskPendingForMe ? 'bg-blue-900/10' : ''}`}>
      <td className="px-4 py-4 max-w-[250px] border-r border-slate-800/50 relative align-top">
        <button
          onClick={() => {
            if (confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) {
              removeProject(p.id);
              toast.success('Đã xóa!');
            }
          }}
          className="absolute -left-3 top-1/2 -translate-y-1/2 p-2 bg-red-950/80 text-red-400 rounded-full opacity-0 group-hover/row:opacity-100 hover:bg-red-900 hover:text-red-300 transition-all border border-red-900 shadow-xl z-10"
          title="Xóa dự án"
        >
          <X className="w-3 h-3" strokeWidth={3} />
        </button>
        
        <div className="flex gap-3 mt-1 items-start">
          {(p.posterUrl || group[0].posterUrl) && (
            <img src={p.posterUrl || group[0].posterUrl} alt="Poster" className="w-14 h-20 sm:w-16 sm:h-24 object-cover rounded shadow-md border border-slate-800 shrink-0" referrerPolicy="no-referrer" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-blue-400 font-mono mb-1 inline-flex p-1 px-2 border border-blue-900/50 bg-blue-950/30 rounded">
              #{p.block ? `${p.block}-` : ''}{baseCode}
            </div>
            <div className="font-bold text-slate-50 mt-1 break-words line-clamp-3 leading-snug" title={p.translatedName}>{p.translatedName}</div>
            <div className="text-[10px] text-slate-400 italic line-clamp-2 mt-1">{p.originalName}</div>
          </div>
        </div>
        
        {p.otherNames && Object.keys(p.otherNames).length > 0 && (
          <div className="flex flex-col gap-0.5 mt-1">
            {Object.entries(p.otherNames).map(([lang, name]: any) => (
              <div key={lang} className="text-[10px] text-slate-300 truncate">
                <span className="text-slate-500 font-bold uppercase tracking-widest text-[8px] mr-1">[{lang}]</span>
                {name}
              </div>
            ))}
          </div>
        )}

        <div 
          className="mt-2 flex gap-2 text-[9px] font-bold tracking-widest uppercase flex-wrap cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setEditingProject(p)}
          title="Sửa thông tin"
        >
          <span className={`px-1.5 py-0.5 rounded border ${p.duration ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'}`}>
            ⏱ {p.duration ? `${p.duration}P` : 'Cần nhập liệu'}
          </span>
          <span className={`px-1.5 py-0.5 rounded border ${p.timeline ? 'bg-slate-950 border-slate-800 text-amber-500/80' : 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'}`}>
            📅 {p.timeline ? `DL: ${p.timeline}` : 'Cần nhập liệu'}
          </span>
        </div>

        {p.videoLink && (
          <a href={p.videoLink} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-400 underline decoration-2 underline-offset-4 uppercase tracking-tighter mt-3 inline-block hover:text-blue-300">
            Xem File RAW
          </a>
        )}

        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-2">Phiên bản ngôn ngữ:</div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {group.map((proj: any) => (
              <div key={proj.id} className="relative group/lang flex items-stretch">
                <button
                  onClick={() => setSelectedId(proj.id)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-l border-y border-l transition-colors ${selectedId === proj.id ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'}`}
                >
                  {proj.language || 'Gốc'}
                </button>
                <div className={`flex flex-col border-y border-r rounded-r overflow-hidden ${selectedId === proj.id ? 'border-blue-500/50' : 'border-slate-800'}`}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingProject(proj); }}
                    className={`px-1.5 py-0.5 flex-1 flex items-center justify-center transition-colors ${selectedId === proj.id ? 'bg-blue-600/20 hover:bg-blue-600/40 text-blue-400' : 'bg-slate-900 hover:bg-slate-800 text-slate-500'} ${group.length > 1 ? 'border-b border-inherit' : ''}`}
                    title="Sửa phiên bản này"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                  {group.length > 1 && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if(confirm(`Xóa phiên bản ngôn ngữ: ${proj.language || 'Gốc'}?`)) {
                          removeProject(proj.id);
                          if (selectedId === proj.id) {
                            setSelectedId(group.find((g: any) => g.id !== proj.id)?.id);
                          }
                          toast.success('Đã xóa phiên bản!');
                        }
                      }}
                      className={`px-1.5 py-0.5 flex-1 flex items-center justify-center transition-colors ${selectedId === proj.id ? 'bg-red-500/10 hover:bg-red-500/30 text-red-400' : 'bg-slate-900 hover:bg-red-900/50 text-slate-500 hover:text-red-400'}`}
                      title="Xóa phiên bản này"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
               onClick={() => {
                 setEditingProject({
                    ...p,
                    language: '', // clear language so user enters new one
                    id: `new_duplicate_${Date.now()}`
                 });
               }}
               className="p-1 h-6 px-2 rounded border border-slate-700 border-dashed text-slate-500 hover:text-slate-300 hover:bg-slate-800 flex items-center justify-center font-bold text-[10px] transition-colors"
               title="Thêm bản dịch ngôn ngữ khác cho dự án này"
            >
               + Thêm
            </button>
          </div>
        </div>
      </td>

      <td className="px-4 py-4 border-r border-slate-800/50 align-top">
        <div className="flex flex-col gap-3 w-full p-2 bg-slate-900/50 rounded-xl border border-slate-800/50">
          {group.map((proj: any) => (
            <div key={proj.id} className={`w-full transition-all duration-300 ${selectedId === proj.id ? 'opacity-100' : 'opacity-40 grayscale'} cursor-pointer hover:opacity-80`} onClick={() => setSelectedId(proj.id)}>
              <div className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${selectedId === proj.id ? 'text-blue-400' : 'text-slate-500'}`}>
                {proj.language || 'Gốc'}
              </div>
              <div className="flex gap-1 flex-wrap w-full">
                {STAGES.map((s: Stage) => (
                  <div 
                    key={s} 
                    className={`h-1.5 flex-1 rounded-sm ${proj.statuses[s] === 'done' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20' : proj.statuses[s] === 'pending' || proj.statuses[s] === 'in_progress' ? 'bg-amber-500 shadow-sm shadow-amber-500/20' : 'bg-slate-800 border border-slate-700'}`}
                    title={getStageLabel(s)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </td>
      
      {STAGES.map((stage: Stage) => {
        const isAssigned = p.assignments[stage] === currentUser;
        const assignedUser = users.find((u: any) => u.id === p.assignments[stage]);
        const status = p.statuses[stage];
        
        return (
          <td key={stage} className={`px-4 py-4 text-center border-r border-slate-800/50 relative align-top ${isAssigned && status === 'pending' ? 'bg-blue-950/20' : ''}`}>
            {isAssigned && status === 'pending' && (
              <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-bl-lg animate-pulse" />
            )}
            <div className="flex flex-col items-center gap-2 w-full mt-2">
              <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded-full border border-slate-800/80 w-full max-w-[120px] relative justify-center group cursor-pointer hover:bg-slate-900 transition-colors">
                <Select 
                  value={p.assignments[stage] || 'unassigned'} 
                  onValueChange={(val) => assignUser(p.id, stage, val || 'unassigned')}
                >
                  <SelectTrigger className="h-6 w-full text-[10px] bg-transparent border-0 ring-offset-transparent focus:ring-0 p-0 text-slate-300 font-bold uppercase tracking-tighter flex justify-center gap-1 items-center shadow-none data-[placeholder]:text-slate-500">
                    <div className="w-4 h-4 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[7px] text-indigo-300 shrink-0">
                      {assignedUser ? assignedUser.name.substring(0, 1).toUpperCase() : '?'}
                    </div>
                    <span className="truncate max-w-[60px]">{assignedUser?.name || 'CHƯA GIAO'}</span>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-50">
                    <SelectItem value="unassigned" className="text-[10px] text-slate-500 font-bold">Chưa giao</SelectItem>
                    {users.filter((u: any) => u.roles.includes(stage)).map((u: any) => (
                      <SelectItem key={u.id} value={u.id} className="text-[10px] font-bold text-slate-200">
                        {u.name} {u.customTitle ? `(${u.customTitle})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {getStatusBadge(status, stage)}
              
              <div className="text-[8px] text-slate-500 font-mono font-bold">
                {getStageSLA(p.voiceType, stage)}
              </div>
              
              {status === 'done' && p.files[stage] && (
                <a href={p.files[stage]} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-emerald-400 underline decoration-2 underline-offset-4 uppercase tracking-tighter hover:text-emerald-300 mt-1">
                  Xem File
                </a>
              )}
              
              <div className="mt-2 w-full">
                {isAssigned && status === 'pending' && (
                  <div className="flex gap-1 mt-2 w-full">
                    <button 
                      onClick={() => {
                        acceptTask(p.id, stage);
                        toast.success('Đã nhận nhiệm vụ!');
                      }}
                      className="py-1 flex-1 bg-blue-600 text-white text-[9px] font-black uppercase rounded hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
                    >
                      Nhận
                    </button>
                    <button 
                      onClick={() => {
                        rejectTask(p.id, stage);
                        toast.error('Đã từ chối! Hoàn trả về khâu trước.');
                      }}
                      className="py-1 flex-1 bg-red-600/80 text-white text-[9px] font-black uppercase rounded hover:bg-red-500 transition-colors shadow-lg shadow-red-500/10"
                    >
                      Từ chối
                    </button>
                  </div>
                )}
                {isAssigned && (status === 'in_progress' || status === 'rejected') && (
                  <button 
                    onClick={() => setSelectedTask({ projectId: p.id, stage })}
                    className="py-1 px-3 bg-white text-black text-[10px] font-black uppercase rounded-lg hover:bg-slate-200 mt-2 transition-colors italic w-full shadow-lg shadow-white/10"
                  >
                    Nộp bài
                  </button>
                )}
              </div>
            </div>
          </td>
        );
      })}
      {/* Empty TD column matching the "Add Stage" header */}
      <td className="px-4 py-4 min-w-[150px] border-r border-slate-800/50 align-top"></td>
    </tr>
  );
}


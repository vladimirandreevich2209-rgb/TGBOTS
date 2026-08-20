import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  Tag,
  Check,
  X,
  FileText,
  Copy,
  Layers,
} from 'lucide-react';
import { Preset } from '../types';
import { api } from '../lib/api';
import { hapticFeedback } from '../lib/telegram';

interface PresetsTabProps {
  presets: Preset[];
  onRefresh: () => void;
}

export const PresetsTab: React.FC<PresetsTabProps> = ({ presets, onRefresh }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    hapticFeedback.light();
    setEditingPreset(null);
    setTitle('');
    setText('');
    setHashtags('#shorts #tiktok #рек #тренды');
    setError(null);
    setIsEditing(true);
  };

  const openEditModal = (preset: Preset) => {
    hapticFeedback.light();
    setEditingPreset(preset);
    setTitle(preset.title);
    setText(preset.text);
    setHashtags(preset.hashtags);
    setError(null);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Укажите название шаблона');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingPreset) {
        await api.updatePreset(editingPreset.id, { title, text, hashtags });
      } else {
        await api.createPreset({ title, text, hashtags });
      }
      hapticFeedback.success();
      setIsEditing(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения');
      hapticFeedback.error();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этот пресет?')) return;
    hapticFeedback.light();
    try {
      await api.deletePreset(id);
      hapticFeedback.success();
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления');
      hapticFeedback.error();
    }
  };

  const addTag = (tag: string) => {
    hapticFeedback.selection();
    if (!hashtags.includes(tag)) {
      setHashtags((prev) => (prev ? `${prev.trim()} ${tag}` : tag));
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-28 max-w-4xl mx-auto space-y-5">
      {/* Header & Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Шаблоны и Пресеты
          </h2>
          <p className="text-xs text-[#708499]">
            Быстрая подстановка заголовков, описаний и хештегов в 1 клик
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2 rounded-xl bg-[#3390EC] hover:bg-[#2884E0] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Создать</span>
        </button>
      </div>

      {/* Preset Modal (Create / Edit) */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#17212B] border border-[#2B3A4A] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{editingPreset ? 'Редактировать пресет' : 'Новый шаблон'}</span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-lg text-[#708499] hover:text-white hover:bg-[#242F3D] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs text-[#708499] font-medium">Название пресета / Заголовок</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: 🔥 Тренды Недели"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#242F3D] border border-[#2B3A4A] text-sm text-white placeholder:text-[#708499] outline-none focus:border-[#3390EC]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#708499] font-medium">Текст описания</label>
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Шаблонный текст, призывы подписаться..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#242F3D] border border-[#2B3A4A] text-xs text-white placeholder:text-[#708499] outline-none focus:border-[#3390EC] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#708499] font-medium">Набор хештегов</label>
                <input
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#shorts #tiktok #viral"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#242F3D] border border-[#2B3A4A] text-xs font-mono text-white placeholder:text-[#708499] outline-none focus:border-[#3390EC]"
                />
                <div className="flex flex-wrap gap-1.5">
                  {['#shorts', '#tiktok', '#тренды', '#рек', '#reels', '#coding', '#лайфхак'].map(
                    (tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-[#242F3D] border border-[#2B3A4A] text-[#708499] hover:text-white hover:bg-[#2B3A4A] cursor-pointer"
                      >
                        {tag}
                      </button>
                    )
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#242F3D] hover:bg-[#2B3A4A] text-xs text-white font-medium cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-[#3390EC] hover:bg-[#2884E0] text-xs text-white font-semibold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Сохранение...' : 'Сохранить'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Presets List */}
      {presets.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#242F3D] border border-[#2B3A4A] mx-auto flex items-center justify-center text-[#708499]">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Нет сохраненных пресетов
            </p>
            <p className="text-xs text-[#708499] mt-0.5">
              Создайте шаблон для быстрой вставки описаний и тегов в 1 клик
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-[#3390EC] hover:bg-[#2884E0] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить пресет</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="p-4 rounded-2xl bg-[#17212B] border border-[#2B3A4A] space-y-3 hover:border-[#3390EC]/40 transition shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    {preset.title}
                  </h3>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(preset)}
                    className="p-1.5 rounded-lg text-[#708499] hover:text-white hover:bg-[#242F3D] transition cursor-pointer"
                    title="Редактировать"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(preset.id)}
                    className="p-1.5 rounded-lg text-[#708499] hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {preset.text && (
                <p className="text-xs text-[#708499] line-clamp-2 leading-relaxed bg-[#242F3D] p-2.5 rounded-xl border border-[#2B3A4A]/60">
                  {preset.text}
                </p>
              )}

              {preset.hashtags && (
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-[#3390EC]">
                  {preset.hashtags.split(' ').map((tag, idx) => (
                    <span key={idx} className="bg-[#242F3D] px-2 py-0.5 rounded-md border border-[#2B3A4A]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

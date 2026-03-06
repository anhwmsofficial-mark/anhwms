'use client';

import { useState } from 'react';
import { PhotoIcon, ChatBubbleLeftRightIcon, XMarkIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface MemoPhoto {
  id: string;
  type: 'memo' | 'photo';
  content?: string;
  photoUrl?: string;
  fileName?: string;
  createdAt: Date;
  createdBy: string;
}

interface MemoPhotoUploaderProps {
  taskId: string;
  taskName?: string;
  onSave?: (items: MemoPhoto[]) => void;
}

export default function MemoPhotoUploader({ taskId, taskName, onSave }: MemoPhotoUploaderProps) {
  void taskId;
  const [items, setItems] = useState<MemoPhoto[]>([]);
  const [memoText, setMemoText] = useState('');
  const [isAddingMemo, setIsAddingMemo] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // 메모 추가
  const handleAddMemo = () => {
    if (!memoText.trim()) return;

    const newMemo: MemoPhoto = {
      id: `memo-${Date.now()}`,
      type: 'memo',
      content: memoText,
      createdAt: new Date(),
      createdBy: '현재 사용자', // TODO: 실제 사용자 정보로 대체
    };

    const updatedItems = [...items, newMemo];
    setItems(updatedItems);
    setMemoText('');
    setIsAddingMemo(false);

    if (onSave) {
      onSave(updatedItems);
    }
  };

  // 사진 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles([...selectedFiles, ...files]);

      // 사진을 items에 추가 (미리보기용)
      const newPhotos: MemoPhoto[] = files.map((file) => ({
        id: `photo-${Date.now()}-${Math.random()}`,
        type: 'photo',
        photoUrl: URL.createObjectURL(file),
        fileName: file.name,
        createdAt: new Date(),
        createdBy: '현재 사용자',
      }));

      const updatedItems = [...items, ...newPhotos];
      setItems(updatedItems);

      if (onSave) {
        onSave(updatedItems);
      }
    }
  };

  // 항목 삭제
  const handleDelete = (id: string) => {
    const updatedItems = items.filter((item) => item.id !== id);
    setItems(updatedItems);

    if (onSave) {
      onSave(updatedItems);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* 헤더 */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <PaperClipIcon className="h-5 w-5 text-blue-600" />
          작업 메모 및 사진
        </h3>
        {taskName && <p className="text-sm text-gray-600 mt-1">작업: {taskName}</p>}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setIsAddingMemo(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
          메모 작성
        </button>
        <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition cursor-pointer">
          <PhotoIcon className="h-5 w-5" />
          사진 첨부
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* 메모 작성 폼 */}
      {isAddingMemo && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <textarea
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="작업 관련 메모를 작성하세요..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setIsAddingMemo(false);
                setMemoText('');
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
            >
              취소
            </button>
            <button
              onClick={handleAddMemo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 메모/사진 목록 */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <PaperClipIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>아직 작성된 메모나 사진이 없습니다.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-gray-50 rounded-lg p-4 relative hover:bg-gray-100 transition"
            >
              {/* 삭제 버튼 */}
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-600 transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>

              {/* 메모 */}
              {item.type === 'memo' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">메모</span>
                  </div>
                  <p className="text-gray-900 whitespace-pre-wrap pr-6">{item.content}</p>
                </div>
              )}

              {/* 사진 */}
              {item.type === 'photo' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <PhotoIcon className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-gray-700">사진</span>
                    {item.fileName && (
                      <span className="text-xs text-gray-500">({item.fileName})</span>
                    )}
                  </div>
                  {item.photoUrl && (
                    <Image
                      src={item.photoUrl}
                      alt="첨부 사진"
                      width={1024}
                      height={768}
                      className="max-w-full h-auto rounded-lg shadow max-h-64 object-contain"
                      unoptimized
                    />
                  )}
                </div>
              )}

              {/* 메타 정보 */}
              <div className="mt-2 text-xs text-gray-500">
                {item.createdBy} • {item.createdAt.toLocaleString('ko-KR')}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 통계 */}
      {items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4 text-sm text-gray-600">
          <span>
            📝 메모: <strong>{items.filter((i) => i.type === 'memo').length}</strong>개
          </span>
          <span>
            📷 사진: <strong>{items.filter((i) => i.type === 'photo').length}</strong>개
          </span>
        </div>
      )}
    </div>
  );
}


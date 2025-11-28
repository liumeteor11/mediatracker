import React, { useState, useCallback, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';
import { MediaItem } from '../types/types';
import { X, Upload, Save, Trash2, RotateCcw } from 'lucide-react';
import { useCollectionStore } from '../store/useCollectionStore';
import clsx from 'clsx';
import { toast } from 'react-toastify';

interface EditMediaModalProps {
  item: MediaItem;
  onClose: () => void;
  onDelete: () => void;
}

export const EditMediaModal: React.FC<EditMediaModalProps> = ({ item, onClose, onDelete }) => {
  const { updateItem } = useCollectionStore();
  const [activeTab, setActiveTab] = useState<'review' | 'cover'>('review');
  const [reviewContent, setReviewContent] = useState(item.userReview || '');
  const [isSaving, setIsSaving] = useState(false);

  // Image Upload & Crop State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save effect (basic implementation)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (reviewContent !== (item.userReview || '')) {
        handleSave(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [reviewContent]);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return '';
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl as string);
    }
  };

  const readFile = (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result));
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async (silent = false) => {
    setIsSaving(true);
    try {
      const updates: Partial<MediaItem> = {
        userReview: reviewContent,
        lastEditedAt: Date.now(),
      };

      if (imageSrc && croppedAreaPixels && activeTab === 'cover') {
        const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
        updates.customPosterUrl = croppedImage;
      }

      updateItem(item.id, updates);
      if (!silent) {
        toast.success('Changes saved successfully!');
        onClose();
      }
    } catch (error) {
      console.error('Save error:', error);
      if (!silent) toast.error('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this card? This action cannot be undone.')) {
      onDelete();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl h-[80vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-theme-surface border border-theme-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-theme-border bg-theme-bg">
          <h2 className="text-xl font-bold text-theme-accent">
            Edit: {item.title}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-theme-surface transition-colors">
            <X className="w-6 h-6 text-theme-subtext" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-full md:w-48 border-b md:border-b-0 md:border-r flex flex-row md:flex-col p-4 gap-2 border-theme-border bg-theme-surface overflow-x-auto md:overflow-visible flex-shrink-0">
            <button
              onClick={() => setActiveTab('review')}
              className={clsx(
                "w-auto md:w-full text-left px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap",
                activeTab === 'review'
                  ? "bg-theme-accent text-theme-bg"
                  : "text-theme-subtext hover:bg-theme-bg"
              )}
            >
              Review & Notes
            </button>
            <button
              onClick={() => setActiveTab('cover')}
              className={clsx(
                "w-auto md:w-full text-left px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap",
                activeTab === 'cover'
                  ? "bg-theme-accent text-theme-bg"
                  : "text-theme-subtext hover:bg-theme-bg"
              )}
            >
              Cover Image
            </button>
            
            <div className="flex-1" />
            
            <button
              onClick={handleDelete}
              className="w-auto md:w-full text-left px-4 py-2 rounded-lg font-medium text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Delete Card
            </button>
          </div>

          {/* Main Area */}
          <div className="flex-1 p-6 overflow-y-auto relative bg-theme-bg">
            {activeTab === 'review' && (
              <div className="h-full flex flex-col">
                <ReactQuill
                  theme="snow"
                  value={reviewContent}
                  onChange={setReviewContent}
                  className="h-[calc(100%-3rem)] mb-12 text-theme-text"
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, false] }],
                      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                      [{'list': 'ordered'}, {'list': 'bullet'}],
                      [{ 'color': [] }, { 'background': [] }],
                      ['clean']
                    ],
                  }}
                />
              </div>
            )}

            {activeTab === 'cover' && (
              <div className="h-full flex flex-col gap-4">
                <div className="flex gap-4 items-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 transition-colors bg-theme-surface hover:bg-theme-bg text-theme-text border border-theme-border"
                  >
                    <Upload className="w-4 h-4" />
                    Select Image
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  {imageSrc && (
                    <button
                      onClick={() => { setImageSrc(null); setZoom(1); }}
                      className="px-4 py-2 rounded-lg flex items-center gap-2 text-theme-subtext hover:bg-theme-surface transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </button>
                  )}
                </div>

                <div className="relative flex-1 bg-theme-subtext/10 rounded-xl overflow-hidden min-h-[400px]">
                  {imageSrc ? (
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={2 / 3} // Standard Poster Aspect Ratio
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-theme-subtext flex-col gap-2">
                      <div className="w-48 h-72 border-2 border-dashed border-theme-border rounded-lg flex items-center justify-center">
                        No Image Selected
                      </div>
                      <p>Upload an image to crop and set as cover</p>
                    </div>
                  )}
                </div>
                
                {imageSrc && (
                   <div className="flex items-center gap-2 px-4">
                      <span className="text-sm text-theme-text">Zoom</span>
                      <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full h-1 bg-theme-border rounded-lg appearance-none cursor-pointer"
                      />
                   </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3 border-theme-border bg-theme-bg">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium transition-colors text-theme-subtext hover:text-theme-text"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className={clsx(
              "px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors",
              "bg-theme-accent text-theme-bg hover:bg-theme-accent-hover",
              isSaving && "opacity-50 cursor-not-allowed"
            )}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

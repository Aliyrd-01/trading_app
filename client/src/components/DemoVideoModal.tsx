import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DemoVideoModal({ isOpen, onClose }: DemoVideoModalProps) {
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setVideoError(false);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Путь к видео файлу - загрузите видео в public/videos/demo.mp4
  // Или используйте YouTube/Vimeo ссылку
  const videoUrl = "/videos/demo.mp4"; // Локальный файл
  // const videoUrl = "https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1"; // Для YouTube
  // const videoUrl = "https://player.vimeo.com/video/YOUR_VIDEO_ID?autoplay=1"; // Для Vimeo

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-6xl bg-background rounded-lg overflow-hidden shadow-2xl">
        {/* Кнопка закрытия */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 bg-background/80 hover:bg-background rounded-full"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Видео плеер */}
        <div className="w-full aspect-video bg-black">
          {videoError ? (
            <div className="w-full h-full flex items-center justify-center text-white p-8">
              <div className="text-center">
                <p className="text-lg mb-2">Видео не найдено</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Загрузите видео файл в папку <code className="bg-muted px-2 py-1 rounded">public/videos/demo.mp4</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Или настройте YouTube/Vimeo ссылку в компоненте DemoVideoModal.tsx
                </p>
              </div>
            </div>
          ) : (
            <video
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
              onEnded={onClose}
              onError={() => setVideoError(true)}
            >
              <source src={videoUrl} type="video/mp4" />
              <source src={videoUrl.replace('.mp4', '.webm')} type="video/webm" />
              Ваш браузер не поддерживает воспроизведение видео.
            </video>
          )}
        </div>

        {/* Альтернатива: YouTube iframe */}
        {/* Раскомментируйте, если используете YouTube, и закомментируйте video выше */}
        {/*
        <div className="w-full aspect-video bg-black">
          <iframe
            className="w-full h-full"
            src={videoUrl}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        */}
      </div>
    </div>
  );
}


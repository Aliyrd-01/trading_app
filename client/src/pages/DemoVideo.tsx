import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DemoVideo() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  // Путь к видео файлу - пользователь должен загрузить видео в public/videos/demo.mp4
  // Или можно использовать YouTube/Vimeo ссылку
  const videoUrl = "/videos/demo.mp4"; // Локальный файл
  // const videoUrl = "https://www.youtube.com/embed/YOUR_VIDEO_ID"; // Для YouTube
  // const videoUrl = "https://player.vimeo.com/video/YOUR_VIDEO_ID"; // Для Vimeo

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      <div className="relative w-full h-full max-w-7xl max-h-[90vh] bg-background rounded-lg overflow-hidden">
        {/* Кнопка закрытия */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10 bg-background/80 hover:bg-background"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Видео плеер */}
        <div className="w-full h-full flex items-center justify-center p-4">
          <video
            className="w-full h-full max-h-[90vh] object-contain"
            controls
            autoPlay
            playsInline
          >
            <source src={videoUrl} type="video/mp4" />
            <source src={videoUrl.replace('.mp4', '.webm')} type="video/webm" />
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
        </div>

        {/* Альтернатива: YouTube iframe */}
        {/* Раскомментируйте, если используете YouTube */}
        {/*
        <div className="w-full h-full p-4">
          <div className="relative w-full h-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={videoUrl}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
        */}
      </div>
    </div>
  );
}


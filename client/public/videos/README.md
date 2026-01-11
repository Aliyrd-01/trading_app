# Видео для демо-презентации

## Как добавить видео

1. **Локальное видео:**
   - Поместите видео файл в эту папку (`client/public/videos/`)
   - Назовите файл `demo.mp4` (или `demo.webm`)
   - Поддерживаемые форматы: MP4, WebM

2. **YouTube:**
   - Откройте `client/src/components/DemoVideoModal.tsx`
   - Найдите строку: `const videoUrl = "/videos/demo.mp4";`
   - Замените на: `const videoUrl = "https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1";`
   - Раскомментируйте блок с iframe для YouTube
   - Закомментируйте блок с `<video>`

3. **Vimeo:**
   - Откройте `client/src/components/DemoVideoModal.tsx`
   - Найдите строку: `const videoUrl = "/videos/demo.mp4";`
   - Замените на: `const videoUrl = "https://player.vimeo.com/video/YOUR_VIDEO_ID?autoplay=1";`
   - Раскомментируйте блок с iframe для Vimeo
   - Закомментируйте блок с `<video>`

## Рекомендации

- Формат видео: MP4 (H.264) для лучшей совместимости
- Разрешение: 1920x1080 (Full HD) или выше
- Длительность: 2-5 минут для демо-презентации
- Размер файла: старайтесь оптимизировать видео (до 50-100 МБ)


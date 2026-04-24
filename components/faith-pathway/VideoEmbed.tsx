import React from 'react';

interface VideoEmbedProps {
  url: string;
  title?: string;
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const videoId = u.searchParams.get('v') ?? u.pathname.split('/').pop();
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').pop();
      return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch {
    return null;
  }
  return null;
}

const VideoEmbed: React.FC<VideoEmbedProps> = ({ url, title }) => {
  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div className="bg-gray-100 p-8 rounded-lg text-center border-2 border-dashed border-gray-300">
        <p className="text-gray-600 mb-2">Video cannot be embedded automatically.</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
          Open video link
        </a>
      </div>
    );
  }

  return (
    <div className="relative pt-[56.25%] w-full bg-black rounded-lg overflow-hidden shadow-lg">
      <iframe
        className="absolute top-0 left-0 w-full h-full"
        src={embedUrl}
        title={title ?? 'Lesson Video'}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default VideoEmbed;

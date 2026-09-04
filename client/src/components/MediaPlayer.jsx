import { Download, FileText } from 'lucide-react';

/**
 * Whatever the church uploaded, played where it stands.
 *
 * Native controls on purpose: a church's sermon recording is not the place to
 * introduce a bespoke transport, and the browser's own controls already know
 * how to seek — which works because the file server answers byte ranges.
 */
export const MediaPlayer = ({ asset, poster }) => {
  if (!asset) return null;

  if (asset.mimeType?.startsWith('video/')) {
    return (
      <video className="media-player" controls preload="metadata" poster={poster} playsInline>
        <source src={asset.url} type={asset.mimeType} />
        Your browser cannot play this video.
      </video>
    );
  }

  if (asset.mimeType?.startsWith('audio/')) {
    return (
      <audio className="media-player media-player-audio" controls preload="metadata">
        <source src={asset.url} type={asset.mimeType} />
        Your browser cannot play this audio.
      </audio>
    );
  }

  return (
    <a className="btn btn-outline btn-sm" href={asset.url} target="_blank" rel="noreferrer">
      {asset.mimeType === 'application/pdf' ? <FileText size={14} /> : <Download size={14} />}
      {asset.filename ?? 'Open the file'}
    </a>
  );
};

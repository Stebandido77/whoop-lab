import { useRef, useState } from 'react';
import { count } from '@/lib/format';
import { useMessages } from '@/lib/i18n';
import { useStore } from '@/state/store';

export function ImportView() {
  const m = useMessages();
  const setExport = useStore((s) => s.setExport);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setStatus(m.import.reading);
    try {
      // The parser drags in JSZip and PapaParse, together about a third of what
      // the app used to ship on first paint, and neither is needed until a file
      // actually lands. Loading it here costs a round trip nobody notices, since
      // the reader has just committed to a drop and is already reading «Leyendo…».
      const { readExportFiles } = await import('@/lib/whoop/parse');
      const { data, found } = await readExportFiles([...files]);
      if (!found.length) {
        setStatus(m.import.notWhoop);
        return;
      }
      setStatus(found.map((f) => `${count(f.rows)} ${m.import.kinds[f.kind]}`).join(' · '));
      setExport(data, { persist: true });
    } catch (error) {
      setStatus(m.import.readError((error as Error).message));
    }
  }

  async function demo() {
    const { generateDemoExport } = await import('@/lib/demo');
    setExport(generateDemoExport(), { source: 'demo' });
  }

  return (
    <div className="intro">
      <h2>{m.import.heading}</h2>
      <p>{m.import.lead}</p>

      <button
        type="button"
        className={`dropzone${over ? ' over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files);
        }}
      >
        <strong>{m.import.dropTitle}</strong>
        <small>{m.import.dropHint}</small>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.csv"
        multiple
        hidden
        onChange={(e) => void handle(e.target.files)}
      />

      {status && <p className="filelog">{status}</p>}

      <p className="note">
        {m.import.note(
          <button
            type="button"
            className="ghost"
            style={{ padding: '2px 8px' }}
            onClick={() => void demo()}
          >
            {m.import.demoLink}
          </button>,
        )}
      </p>
    </div>
  );
}

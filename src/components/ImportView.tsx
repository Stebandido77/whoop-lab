import { useRef, useState } from 'react';
import { readExportFiles } from '@/lib/whoop/parse';
import { generateDemoExport } from '@/lib/demo';
import { useStore } from '@/state/store';

const KIND_LABELS: Record<string, string> = {
  cycles: 'ciclos',
  sleeps: 'sueños',
  workouts: 'actividades',
  journal: 'respuestas de diario',
};

export function ImportView() {
  const setExport = useStore((s) => s.setExport);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setStatus('Leyendo…');
    try {
      const { data, found } = await readExportFiles([...files]);
      if (!found.length) {
        setStatus(
          'Ese archivo no parece un export de WHOOP. Busca el ZIP del correo “Your WHOOP Export is Ready”.',
        );
        return;
      }
      setStatus(
        found.map((f) => `${f.rows.toLocaleString('es-CO')} ${KIND_LABELS[f.kind]}`).join(' · '),
      );
      setExport(data, { persist: true });
    } catch (error) {
      setStatus(`No pude leer el archivo: ${(error as Error).message}`);
    }
  }

  return (
    <div className="intro">
      <h2>Suelta aquí tu export de WHOOP.</h2>
      <p>
        El ZIP completo o los CSV sueltos: <code>physiological_cycles</code>, <code>sleeps</code>,{' '}
        <code>workouts</code> y <code>journal_entries</code>. Todo se procesa en tu navegador; nada
        sale de tu equipo.
      </p>

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
        <strong>Arrastra el ZIP o haz clic para elegir archivos</strong>
        <small>.zip o .csv — puedes soltar varios a la vez</small>
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
        ¿Todavía no pediste el export? En la app: <b>More → App Settings → Data Export</b>. Llega
        por correo en menos de una hora. Mientras tanto,{' '}
        <button
          type="button"
          className="ghost"
          style={{ padding: '2px 8px' }}
          onClick={() => setExport(generateDemoExport(), { demo: true })}
        >
          mira una demo con datos sintéticos
        </button>
        .
      </p>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import './App.css';
import type { MergeOptions, MergeReport } from './types';

type InspectState = 'idle' | 'loading' | 'error';

const DEFAULT_OPTIONS: MergeOptions = {
  toleranceSeconds: 1,
  replaceMovingTime: true,
  overlayFields: ['power', 'cadence']
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

function App() {
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [overlayFile, setOverlayFile] = useState<File | null>(null);
  const [options, setOptions] = useState<MergeOptions>(DEFAULT_OPTIONS);
  const [report, setReport] = useState<MergeReport | null>(null);
  const [inspectState, setInspectState] = useState<InspectState>('idle');
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const overlayKey = useMemo(() => options.overlayFields.join('|'), [options.overlayFields]);
  const masterKey = useMemo(
    () => (options.masterFields ? options.masterFields.join('|') : ''),
    [options.masterFields]
  );

  const canSubmit = useMemo(
    () => !!masterFile && !!overlayFile && !isMerging,
    [masterFile, overlayFile, isMerging]
  );

  useEffect(() => {
    if (!masterFile || !overlayFile) {
      setReport(null);
      setInspectState('idle');
      setInspectError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setInspectState('loading');
      setInspectError(null);

      try {
        const formData = buildFormData(masterFile, overlayFile, options);
        const response = await fetch(`${API_BASE_URL}/inspect`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        if (!response.ok) {
          const message = await extractErrorMessage(response, 'Failed to inspect FIT files.');
          throw new Error(message);
        }

        const data = (await response.json()) as MergeReport;
        setReport(data);
        syncOptionsWithServer(data.options, setOptions);
        setInspectState('idle');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setInspectState('error');
        setInspectError(error instanceof Error ? error.message : 'Failed to inspect FIT files.');
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [masterFile, overlayFile, options.toleranceSeconds, options.replaceMovingTime, overlayKey, masterKey]);

  const handleMerge = async () => {
    if (!masterFile || !overlayFile) {
      setMergeError('Please select both FIT files before merging.');
      return;
    }

    setIsMerging(true);
    setMergeError(null);

    try {
      const formData = buildFormData(masterFile, overlayFile, options);
      const response = await fetch(`${API_BASE_URL}/merge`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response, 'Failed to merge FIT files.');
        throw new Error(message);
      }

      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, 'merged.fit');

      const header = response.headers.get('X-Merge-Report');
      if (header) {
        try {
          const decoded = atob(header);
          const parsed = JSON.parse(decoded) as MergeReport;
          setReport(parsed);
          syncOptionsWithServer(parsed.options, setOptions);
        } catch (error) {
          console.warn('Unable to parse merge summary header', error);
        }
      }
    } catch (error) {
      setMergeError(error instanceof Error ? error.message : 'Failed to merge FIT files.');
    } finally {
      setIsMerging(false);
    }
  };

  const handleToleranceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (Number.isFinite(value) && value >= 0) {
      setOptions((prev) => ({ ...prev, toleranceSeconds: Math.floor(value) }));
    } else if (event.target.value === '') {
      setOptions((prev) => ({ ...prev, toleranceSeconds: 0 }));
    }
  };

  const handleReplaceMovingTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setOptions((prev) => ({ ...prev, replaceMovingTime: checked }));
  };

  const handleOverlayToggle = (field: string, checked: boolean) => {
    setOptions((prev) => {
      const available = report?.availableFields.overlay ?? [];
      if (!available.includes(field)) {
        return prev;
      }
      const next = new Set(prev.overlayFields);
      if (checked) {
        next.add(field);
      } else {
        next.delete(field);
      }
      const overlayFields = Array.from(next);
      return arraysEqual(prev.overlayFields, overlayFields) ? prev : { ...prev, overlayFields };
    });
  };

  const handleMasterToggle = (field: string, checked: boolean) => {
    if (field === 'timestamp') {
      return;
    }
    setOptions((prev) => {
      const available = report?.availableFields.master ?? [];
      if (!available.includes(field)) {
        return prev;
      }

      const current = prev.masterFields ? new Set(prev.masterFields) : new Set(available);
      if (checked) {
        current.add(field);
      } else {
        current.delete(field);
      }
      current.add('timestamp');

      const next = Array.from(current);
      if (prev.masterFields === undefined && next.length === available.length) {
        return prev;
      }

      if (next.length === available.length) {
        return arraysEqual(next, available) ? { ...prev, masterFields: undefined } : prev;
      }

      return arraysEqual(prev.masterFields ?? [], next)
        ? prev
        : { ...prev, masterFields: next };
    });
  };

  const selectedMasterFields = useMemo(() => {
    if (options.masterFields && options.masterFields.length) {
      return options.masterFields;
    }
    return report?.availableFields.master ?? [];
  }, [options.masterFields, report?.availableFields.master]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>FitFusion</h1>
        <p className="subtitle">Inspect, align, and fuse FIT record fields locally.</p>
      </header>

      <section className="panel">
        <h2>Uploads</h2>
        <div className="file-grid">
          <FileInput label="Master (File 1)" file={masterFile} onChange={setMasterFile} />
          <FileInput label="Overlay (File 2)" file={overlayFile} onChange={setOverlayFile} />
        </div>
      </section>

      <section className="panel">
        <h2>Merge Options</h2>
        <div className="options-grid">
          <label className="tolerance">
            <span>Timestamp tolerance (seconds)</span>
            <input
              type="number"
              min={0}
              value={options.toleranceSeconds}
              onChange={handleToleranceChange}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={options.replaceMovingTime}
              onChange={handleReplaceMovingTimeChange}
            />
            Replace Moving Time
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Field Selection</h2>
        {report?.availableFields ? (
          <div className="field-grid">
            <FieldSelection
              title="Master Fields"
              description="Retained from File 1"
              fields={report.availableFields.master}
              selected={selectedMasterFields}
              onToggle={handleMasterToggle}
              lockedFields={['timestamp']}
            />
            <FieldSelection
              title="Overlay Fields"
              description="Copied from File 2"
              fields={report.availableFields.overlay}
              selected={options.overlayFields}
              onToggle={handleOverlayToggle}
              lockedFields={['timestamp']}
            />
          </div>
        ) : (
          <p className="info">Upload both FIT files to review available fields.</p>
        )}
      </section>

      <section className="panel">
        <h2>Summary</h2>
        {inspectState === 'loading' && <p className="info">Loading summary…</p>}
        {inspectState === 'error' && inspectError && <p className="error">{inspectError}</p>}
        {!masterFile || !overlayFile ? (
          <p className="info">Select both FIT files to preview the merge summary.</p>
        ) : report ? (
          <Summary report={report} />
        ) : inspectState === 'idle' ? (
          <p className="info">No summary available yet. Adjust options or re-select files.</p>
        ) : null}
      </section>

      {mergeError && <p className="error">{mergeError}</p>}

      <button className="merge-button" disabled={!canSubmit} onClick={handleMerge}>
        {isMerging ? 'Merging…' : 'Merge & Download'}
      </button>
    </div>
  );
}

interface FileInputProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}

function FileInput({ label, file, onChange }: FileInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    onChange(selected);
  };

  return (
    <label className="file-input">
      <span>{label}</span>
      <input type="file" accept=".fit" onChange={handleChange} />
      <span className="file-input__name">{file ? file.name : 'No file selected'}</span>
    </label>
  );
}

interface FieldSelectionProps {
  title: string;
  description: string;
  fields: string[];
  selected: string[];
  onToggle: (field: string, checked: boolean) => void;
  lockedFields?: string[];
}

function FieldSelection({ title, description, fields, selected, onToggle, lockedFields = [] }: FieldSelectionProps) {
  if (!fields.length) {
    return (
      <div className="field-selection">
        <h3>{title}</h3>
        <p className="info">No fields detected</p>
      </div>
    );
  }

  return (
    <div className="field-selection">
      <div className="field-selection__header">
        <h3>{title}</h3>
        <span>{description}</span>
      </div>
      <ul className="field-selection__list">
        {fields.map((field) => {
          const locked = lockedFields.includes(field);
          const checked = locked || selected.includes(field);
          return (
            <li key={field}>
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={(event) => onToggle(field, event.target.checked)}
                />
                {field}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface SummaryProps {
  report: MergeReport;
}

function Summary({ report }: SummaryProps) {
  return (
    <div className="summary-grid">
      <SummaryCard
        title="Master (File 1)"
        meta={report.master}
        extra={[`Fields retained: ${formatFieldList(report.options.masterFields)}`]}
      />
      <SummaryCard
        title="Overlay (File 2)"
        meta={report.overlay}
        extra={[
          `Clipped records: ${report.overlay.clippedRecordCount}`,
          `Fields copied: ${formatFieldList(report.options.overlayFields)}`
        ]}
      />
      <DiffCard report={report} />
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  meta: MergeReport['master'];
  extra?: string[];
}

function SummaryCard({ title, meta, extra = [] }: SummaryCardProps) {
  return (
    <div className="summary-card">
      <h3>{title}</h3>
      <dl>
        <div>
          <dt>Records</dt>
          <dd>{meta.recordCount ?? '–'}</dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{formatTimestamp(meta.startTimestamp)}</dd>
        </div>
        <div>
          <dt>End</dt>
          <dd>{formatTimestamp(meta.endTimestamp)}</dd>
        </div>
      </dl>
      {extra.length > 0 && (
        <ul className="summary-card__extra">
          {extra.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiffCard({ report }: { report: MergeReport }) {
  const { updates, options } = report;
  const fieldUpdates = Object.entries(updates.fieldUpdates).sort((a, b) => b[1] - a[1]);

  return (
    <div className="summary-card">
      <h3>Diff</h3>
      <dl>
        <div>
          <dt>Matched Records</dt>
          <dd>{updates.matchedRecords}</dd>
        </div>
        <div>
          <dt>Tolerance</dt>
          <dd>{options.toleranceSeconds} s</dd>
        </div>
        <div>
          <dt>Moving Time</dt>
          <dd>{options.replaceMovingTime ? 'Replaced' : 'Original'}</dd>
        </div>
      </dl>
      <StatsList label="Power" stats={updates.powerStats} updates={updates.powerUpdates} />
      <StatsList label="Cadence" stats={updates.cadenceStats} updates={updates.cadenceUpdates} />
      <FieldUpdatesList items={fieldUpdates} />
    </div>
  );
}

function StatsList({
  label,
  stats,
  updates
}: {
  label: string;
  stats?: MergeReport['updates']['powerStats'];
  updates: number;
}) {
  if (!stats || updates === 0) {
    return <p className="stats-placeholder">No {label.toLowerCase()} updates.</p>;
  }

  return (
    <ul className="stats-list">
      <li>
        <span>Updates</span>
        <strong>{updates}</strong>
      </li>
      <li>
        <span>Min</span>
        <strong>{stats.min}</strong>
      </li>
      <li>
        <span>Avg</span>
        <strong>{stats.avg}</strong>
      </li>
      <li>
        <span>Max</span>
        <strong>{stats.max}</strong>
      </li>
    </ul>
  );
}

function FieldUpdatesList({ items }: { items: Array<[string, number]> }) {
  if (!items.length) {
    return <p className="stats-placeholder">No overlay fields copied.</p>;
  }

  return (
    <div className="field-updates">
      <h4>Field Updates</h4>
      <ul>
        {items.map(([field, count]) => (
          <li key={field}>
            <span>{field}</span>
            <strong>{count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTimestamp(value?: string) {
  if (!value) {
    return '–';
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatFieldList(fields?: string[] | null) {
  if (!fields || !fields.length) {
    return 'All';
  }
  return fields.join(', ');
}

function buildFormData(master: File, overlay: File, options: MergeOptions) {
  const formData = new FormData();
  formData.append('master', master);
  formData.append('overlay', overlay);
  formData.append('replaceMovingTime', String(options.replaceMovingTime));
  formData.append('toleranceSeconds', String(options.toleranceSeconds));
  formData.append('overlayFields', JSON.stringify(options.overlayFields));
  if (options.masterFields && options.masterFields.length) {
    formData.append('masterFields', JSON.stringify(options.masterFields));
  }
  return formData;
}

async function extractErrorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object' && typeof payload.message === 'string') {
      return payload.message;
    }
  } catch (error) {
    console.warn('Failed to parse error payload', error);
  }
  return fallback;
}

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function arraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) {
    return true;
  }
  const aArr = a ?? [];
  const bArr = b ?? [];
  if (aArr.length !== bArr.length) {
    return false;
  }
  return aArr.every((value, index) => value === bArr[index]);
}

function optionsEqual(a: MergeOptions, b: MergeOptions): boolean {
  return (
    a.toleranceSeconds === b.toleranceSeconds &&
    a.replaceMovingTime === b.replaceMovingTime &&
    arraysEqual(a.overlayFields, b.overlayFields) &&
    arraysEqual(a.masterFields, b.masterFields)
  );
}

function syncOptionsWithServer(next: MergeOptions, updater: (fn: (prev: MergeOptions) => MergeOptions) => void) {
  updater((prev) => {
    if (optionsEqual(prev, next)) {
      return prev;
    }
    return {
      toleranceSeconds: next.toleranceSeconds,
      replaceMovingTime: next.replaceMovingTime,
      overlayFields: [...next.overlayFields],
      masterFields: next.masterFields ? [...next.masterFields] : undefined
    };
  });
}

export default App;

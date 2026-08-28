const traceFiles = import.meta.glob('../../data/traces/*.json', {
  eager: true,
  import: 'default',
});

const statuses = new Set(['pending', 'approved', 'rejected']);

function loadTraces() {
  return Object.entries(traceFiles).map(([file, trace]) => {
    const validTrace =
      trace &&
      typeof trace.id === 'string' &&
      typeof trace.gift === 'string' &&
      (trace.name === null || typeof trace.name === 'string') &&
      (trace.location === null || typeof trace.location === 'string') &&
      typeof trace.message === 'string' &&
      (trace.photo === null || typeof trace.photo === 'string') &&
      typeof trace.language === 'string' &&
      statuses.has(trace.status) &&
      !Number.isNaN(Date.parse(trace.createdAt));

    if (!validTrace) {
      throw new Error(`Invalid trace data in ${file}`);
    }

    return trace;
  });
}

export function loadApprovedTraces() {
  return loadTraces()
    .filter((trace) => trace.status === 'approved')
    .map((trace) => ({ ...trace, photoUrl: getPhotoUrl(trace.photo) }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function getPhotoUrl(photo) {
  if (!photo || photo.startsWith('https://')) return photo;

  const mediaUrl = import.meta.env.PUBLIC_MEDIA_URL || '/media';
  return `${mediaUrl.replace(/\/$/, '')}/${photo}`;
}

export function formatTraceDate(date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(date));
}

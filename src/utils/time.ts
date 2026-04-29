const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : dateFormatter.format(d);
};

export const formatDuration = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const diffMs = end - start;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMin = minutes % 60;
    return remainingMin > 0 ? `${hours}h ${remainingMin}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

/** The 7 consecutive YYYY-MM-DD dates starting at weekStart (a Monday). */
export function weekDatesOf(weekStart: string): string[] {
  const [y, m, d] = weekStart.split('-').map(Number);
  const dates: string[] = [];
  for (let k = 0; k < 7; k++) {
    const dt = new Date(y, m - 1, d + k, 12);
    dates.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    );
  }
  return dates;
}

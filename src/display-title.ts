const DAILY_NOTE_BASENAME = /^(\d{4})-(\d{2})-(\d{2})$/;

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });

export function getDisplayTitle(basename: string): string {
  const match = DAILY_NOTE_BASENAME.exec(basename);
  if (!match) return basename;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return basename;
  }

  return `${weekdayFormatter.format(date)}, ${monthFormatter.format(date)} ${day}${getOrdinalSuffix(day)}, ${year}`;
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export default function formatDate(dateString: string) {
  if (!dateString) {
    throw new Error('Invalid date string');
  }

  const [day, month, year] = dateString.split('/');
  if (!day || !month || !year) {
    return null;
  }

  // Reformat the date to YYYY-MM-DD
  const formattedDate = `${year}-${month}-${day}`;
  const parsedDate = new Date(formattedDate);

  if (isNaN(parsedDate.getTime())) {
    throw new Error('Failed to parse date');
  }

  return parsedDate;
}

import { IResource } from './resource.model';

/** Recognises Google Drive / Docs links and returns what kind of item it is. */
export const detectDriveType = (rawUrl: string): IResource['driveType'] => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  const p = url.pathname;
  if (host === 'drive.google.com') {
    if (p.includes('/folders/') || p.includes('/drive/u/') || url.searchParams.has('folder')) return 'folder';
    return 'file';
  }
  if (host === 'docs.google.com') {
    if (p.startsWith('/document')) return 'document';
    if (p.startsWith('/spreadsheets')) return 'spreadsheet';
    if (p.startsWith('/presentation')) return 'presentation';
    if (p.startsWith('/forms')) return 'form';
    return 'file';
  }
  if (host === 'forms.gle') return 'form';
  return null;
};

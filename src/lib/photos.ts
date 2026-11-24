// Free photos from Unsplash (unsplash.com/license: free to use, no permission needed).
// They load over the internet the first time and are then kept on the phone.

export type Photo = {
  /** Unsplash image id, as in images.unsplash.com/<id>. */
  id: string;
  /** What it shows (also read out by screen readers). */
  alt: string;
  by: string;
  page: string;
  /** Colour shown until the photo loads, or when there's no internet. */
  tint: string;
};

export const PHOTOS = {
  start: {
    id: 'photo-1509062522246-3755977927d7',
    alt: 'Students in a classroom with a teacher presenting',
    by: 'Quilia',
    page: 'https://unsplash.com/photos/students-in-classroom-with-teacher-presenting-zFSo6bnZJTw',
    tint: '#2B2770',
  },
  signUp: {
    id: 'photo-1598981457915-aea220950616',
    alt: 'A student writing on paper at a desk in a classroom',
    by: 'Jeswin Thomas',
    page: 'https://unsplash.com/photos/student-writing-at-classroom-desk--hgJu2ykh4E',
    tint: '#DCD9F7',
  },
  head: {
    id: 'photo-1770172410691-acea3d3bfef0',
    alt: 'A school building with many windows',
    by: 'Caleb Walley',
    page: 'https://unsplash.com/photos/traditional-academy-building-with-many-windows-QPCvYh27cDw',
    tint: '#DCD9F7',
  },
  staff: {
    id: 'photo-1511629091441-ee46146481b6',
    alt: 'A teacher writing on a green chalkboard',
    by: 'Tra Nguyen',
    page: 'https://unsplash.com/photos/teacher-writing-physics-on-chalkboard-TVSRWmnW8Us',
    tint: '#FFE4D1',
  },
  student: {
    id: 'photo-1636202339022-7d67f7447e3a',
    alt: 'Children sitting at desks in a classroom',
    by: 'Mario Heller',
    page: 'https://unsplash.com/photos/a-group-of-children-sitting-at-desks-in-a-classroom-hXLkFpvKRys',
    tint: '#D7F0E2',
  },
  classroom: {
    id: 'photo-1580582932707-520aed937b7b',
    alt: 'An empty classroom with desks and a chalkboard',
    by: 'Ivan Aleksic',
    page: 'https://unsplash.com/photos/empty-classroom-with-desks-and-chalkboard-PDRFeeDniCk',
    tint: '#2B2770',
  },
  students: {
    id: 'photo-1758270704524-596810e891b5',
    alt: 'Students smiling in a classroom',
    by: 'Vitaly Gariev',
    page: 'https://unsplash.com/photos/students-smiling-in-a-lecture-hall-classroom-NGLWZV4xOPg',
    tint: '#1F4D3A',
  },
  writing: {
    id: 'photo-1649252504109-686f70fa38af',
    alt: 'A pencil writing on a piece of paper',
    by: 'Giu Vicente',
    page: 'https://unsplash.com/photos/a-person-writing-on-a-piece-of-paper-with-a-pencil-mLF8eEf8FLs',
    tint: '#FFE4D1',
  },
  books: {
    id: 'photo-1503676260728-1c00da094a0b',
    alt: 'A red apple on a pile of books',
    by: 'Element5 Digital',
    page: 'https://unsplash.com/photos/red-apple-fruit-on-four-pyle-books-OyCl7Y4y0Bk',
    tint: '#FFE4D1',
  },
  pencils: {
    id: 'photo-1521056787327-165dc2a32836',
    alt: 'A pencil holder on a stack of books',
    by: 'Debby Hudson',
    page: 'https://unsplash.com/photos/white-ceramic-pencil-organizer-on-top-of-stack-of-books-ERb-JXVwAfo',
    tint: '#ECEBFF',
  },
} satisfies Record<string, Photo>;

/** A sized, compressed copy of the photo from Unsplash's image service. */
export function photoUri(photo: Photo, width: number): string {
  return `https://images.unsplash.com/${photo.id}?auto=format&fit=crop&w=${Math.round(width)}&q=70`;
}

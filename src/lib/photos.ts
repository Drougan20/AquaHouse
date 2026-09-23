import type { ImageMetadata } from 'astro';
import { site } from '../config/site';

export type HousePhoto = {
  fileName: string;
  image: ImageMetadata;
  alt: string;
};

const files = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/photos/*.{jpg,jpeg,JPG,JPEG}',
  { eager: true }
);

const photos = Object.entries(files)
  .map(([path, file]) => ({
    fileName: path.slice(path.lastIndexOf('/') + 1),
    image: file.default,
  }))
  .sort((a, b) =>
    a.fileName.localeCompare(b.fileName, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );

function findPhoto(fileName: string) {
  const name = fileName.trim().split(/[\\/]/).pop();

  if (!name) return undefined;

  return photos.find(
    (photo) => photo.fileName.toLowerCase() === name.toLowerCase()
  );
}

const chosenHero = findPhoto(site.photos.hero.src);

export const heroPhoto: HousePhoto | null = chosenHero
  ? {
      ...chosenHero,
      alt: site.photos.hero.alt || 'Photo of the guest house',
    }
  : photos[0]
    ? {
        ...photos[0],
        alt: 'Photo of the guest house',
      }
    : null;

const chosenGallery = site.photos.gallery.filter(
  (photo) => photo.src.trim()
);

export const galleryPhotos: HousePhoto[] = chosenGallery.length
  ? chosenGallery.map((entry, index) => {
      const photo = findPhoto(entry.src);

      if (!photo) {
        throw new Error(`Gallery photo not found: ${entry.src}`);
      }

      return {
        ...photo,
        alt: entry.alt || `Guest house photo ${index + 1}`,
      };
    })
  : photos
      .filter((photo) => photo.fileName !== heroPhoto?.fileName)
      .map((photo, index) => ({
        ...photo,
        alt: `Guest house photo ${index + 1}`,
      }));